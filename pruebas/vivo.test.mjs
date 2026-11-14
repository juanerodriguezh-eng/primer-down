// Pruebas del modo en vivo con un partido "en curso" simulado (un partido guardado cortado a la mitad).
// No se ha podido probar con un partido real, así que se prueban las formas posibles de drives.current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido, construirResumen, contarJugadas } from '../js/modelo.js';
import { simularEnCurso, FORMAS_EN_VIVO } from '../js/simulador.js';
import { crearSondeo, mensajeDeFallo, CADA_EN_VIVO, CADA_EN_ESPERA } from '../js/vivo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jueves = JSON.parse(readFileSync(path.join(RAIZ, 'datos', 'partidos', '401873052.json'), 'utf8'));
const TOTAL = contarJugadas(jueves); // 188

const ids = (p) => p.drives.flatMap((d) => d.jugadas.map((j) => j.id));

// Reloj falso: los temporizadores solo corren cuando la prueba avanza el tiempo.
function relojFalso() {
  let t = 0;
  let siguiente = 1;
  const pendientes = new Map();
  return {
    ahora: () => t,
    poner: (fn, ms) => { const id = siguiente++; pendientes.set(id, { fn, en: t + ms }); return id; },
    quitar: (id) => { pendientes.delete(id); },
    cuantos: () => pendientes.size,
    async avanzar(ms) {
      const fin = t + ms;
      for (;;) {
        const proximo = [...pendientes.entries()].filter(([, x]) => x.en <= fin).sort((a, b) => a[1].en - b[1].en)[0];
        if (!proximo) break;
        t = proximo[1].en;
        pendientes.delete(proximo[0]);
        await proximo[1].fn();
      }
      t = fin;
    },
  };
}

// Arma un sondeo sobre el partido simulado, con una "pantalla" que guarda lo último pintado.
function montar({ desde = 60, paso = 3, forma = 'con-current' } = {}) {
  const reloj = relojFalso();
  const pantalla = { partido: null, pintadas: 0, aviso: '', oculta: false, fallaLaRed: false, jugada: desde };
  const sondeo = crearSondeo({
    traer: async () => {
      if (pantalla.fallaLaRed) throw new Error('sin red');
      const summary = simularEnCurso(jueves, pantalla.jugada, { forma });
      pantalla.jugada += paso;
      return summary;
    },
    alRecibir: (summary) => {
      const p = construirPartido(summary);
      pantalla.partido = p;
      pantalla.pintadas++;
      pantalla.aviso = '';
      return p.estado;
    },
    alFallar: ({ hayDatos }) => { pantalla.aviso = mensajeDeFallo(hayDatos); },
    estaOculta: () => pantalla.oculta,
    ahora: reloj.ahora, poner: reloj.poner, quitar: reloj.quitar,
  });
  return { reloj, pantalla, sondeo };
}

test('partido en curso simulado: tiene estado en progreso, marcador parcial y no toca el original', () => {
  const antes = JSON.stringify(jueves);
  for (const forma of FORMAS_EN_VIVO) {
    const s = simularEnCurso(jueves, 60, { forma });
    assert.equal(s.header.competitions[0].status.type.state, 'in', forma);
    assert.equal(contarJugadas(s), 60, forma);
    assert.equal(Boolean(s.drives.current), forma !== 'sin-current', forma);
  }
  assert.equal(JSON.stringify(jueves), antes);
  assert.equal(simularEnCurso(jueves, 0).header.competitions[0].status.type.state, 'pre');
  assert.equal(simularEnCurso(jueves, TOTAL).header.competitions[0].status.type.state, 'post');
});

test('las tres formas del drive actual (con current, repetido y sin current) dan exactamente el mismo partido', () => {
  for (const n of [1, 14, 60, 95, 150, TOTAL - 1]) {
    const modelos = FORMAS_EN_VIVO.map((forma) => construirPartido(simularEnCurso(jueves, n, { forma })));
    const [base] = modelos;
    assert.equal(base.estado, 'en-vivo', `jugada ${n}`);
    assert.equal(ids(base).length, n, `jugada ${n}`);
    assert.equal(new Set(ids(base)).size, n, `jugada ${n}: hay jugadas repetidas`);
    // El marcador es el de la repetición cortada en la misma jugada.
    const repeticion = construirPartido(jueves, { hasta: n });
    assert.deepEqual([base.local.puntos, base.visitante.puntos], [repeticion.local.puntos, repeticion.visitante.puntos], `jugada ${n}`);
    assert.equal(base.situacion?.titulo, repeticion.situacion?.titulo, `jugada ${n}`);
    for (const m of modelos.slice(1)) {
      assert.deepEqual(ids(m), ids(base), `jugada ${n}`);
      assert.deepEqual(m.drives.map((d) => [d.id, d.enCurso, d.resumen.texto]), base.drives.map((d) => [d.id, d.enCurso, d.resumen.texto]), `jugada ${n}`);
      assert.deepEqual(m.situacion, base.situacion, `jugada ${n}`);
      assert.deepEqual([m.local.puntos, m.visitante.puntos, m.periodo, m.reloj], [base.local.puntos, base.visitante.puntos, base.periodo, base.reloj]);
    }
  }
});

test('en la jugada 60 el partido en curso muestra la situación, el drive abierto y ningún resumen final', () => {
  const p = construirPartido(simularEnCurso(jueves, 60));
  assert.match(p.situacion.titulo, /^2.ª y 8 en la yarda 37/);
  assert.match(p.situacion.texto, /Segunda oportunidad/);
  assert.equal(p.drives.at(-1).enCurso, true);
  assert.equal(p.drives.slice(0, -1).some((d) => d.enCurso), false);
  assert.equal(p.local.gano || p.visitante.gano, false);
  assert.equal(construirResumen(p), null);
});

test('al refrescar, las jugadas nuevas se agregan al final y las anteriores no se repiten ni cambian de lugar', () => {
  for (const forma of FORMAS_EN_VIVO) {
    let anterior = [];
    for (let n = 55; n <= 75; n += 3) {
      const actual = ids(construirPartido(simularEnCurso(jueves, n, { forma })));
      assert.equal(new Set(actual).size, actual.length, `${forma}, jugada ${n}`);
      assert.deepEqual(actual.slice(0, anterior.length), anterior, `${forma}, jugada ${n}: cambió lo ya pintado`);
      anterior = actual;
    }
    // La misma respuesta dos veces (no hubo jugada nueva) da el mismo partido.
    assert.deepEqual(ids(construirPartido(simularEnCurso(jueves, 73, { forma }))), anterior);
  }
});

test('formas raras del drive actual: sin id, con menos jugadas que la copia de previous, o con jugadas repetidas', () => {
  const s = simularEnCurso(jueves, 60, { forma: 'current-repetido' });
  const esperado = ids(construirPartido(s));
  // 1) current sin id: se reconoce por su primera jugada.
  const sinId = structuredClone(s);
  delete sinId.drives.current.id;
  assert.deepEqual(ids(construirPartido(sinId)), esperado);
  // 2) current atrasado (trae menos jugadas que previous): gana la copia más completa.
  const atrasado = structuredClone(s);
  atrasado.drives.current.plays.pop();
  assert.deepEqual(ids(construirPartido(atrasado)), esperado);
  // 3) current con otro id pero con jugadas que ya estaban: no se duplican.
  const otroId = structuredClone(s);
  otroId.drives.current.id = 'otro';
  otroId.drives.current.plays = otroId.drives.current.plays.slice(1);
  assert.deepEqual(ids(construirPartido(otroId)), esperado);
  // 4) basura en vez de drives: no rompe.
  for (const drives of [null, {}, { previous: null, current: 'x' }, { previous: [null, { plays: [null, 7] }], current: [] }]) {
    assert.doesNotThrow(() => construirPartido({ ...s, drives }));
  }
});

test('sondeo: consulta cada 20 segundos mientras el partido está en vivo', async () => {
  const { reloj, pantalla, sondeo } = montar();
  await sondeo.consultar();
  assert.equal(pantalla.partido.estado, 'en-vivo');
  assert.equal(sondeo.info().consultas, 1);
  await reloj.avanzar(CADA_EN_VIVO - 1);
  assert.equal(sondeo.info().consultas, 1);
  await reloj.avanzar(1);
  assert.equal(sondeo.info().consultas, 2);
  await reloj.avanzar(CADA_EN_VIVO * 3);
  assert.equal(sondeo.info().consultas, 5);
  assert.equal(ids(pantalla.partido).length, 60 + 3 * 4);
});

test('sondeo: con la pestaña oculta no consulta; al volver consulta de inmediato si ya tocaba', async () => {
  const { reloj, pantalla, sondeo } = montar();
  await sondeo.consultar();
  pantalla.oculta = true;
  sondeo.programar(); // lo que hace el evento visibilitychange
  assert.equal(reloj.cuantos(), 0);
  await reloj.avanzar(CADA_EN_VIVO * 10);
  assert.equal(sondeo.info().consultas, 1);
  pantalla.oculta = false;
  sondeo.programar();
  await reloj.avanzar(0);
  assert.equal(sondeo.info().consultas, 2);
  // Si vuelve antes de los 20 segundos, espera lo que falta en vez de consultar de más.
  pantalla.oculta = true; sondeo.programar();
  await reloj.avanzar(5000);
  pantalla.oculta = false; sondeo.programar();
  await reloj.avanzar(CADA_EN_VIVO - 5001);
  assert.equal(sondeo.info().consultas, 2);
  await reloj.avanzar(1);
  assert.equal(sondeo.info().consultas, 3);
});

test('sondeo: nunca hay dos consultas a la vez ni dos temporizadores', async () => {
  const reloj = relojFalso();
  let soltar;
  let llamadas = 0;
  const sondeo = crearSondeo({
    traer: () => { llamadas++; return new Promise((ok) => { soltar = () => ok(simularEnCurso(jueves, 60)); }); },
    alRecibir: (s) => construirPartido(s).estado,
    ahora: reloj.ahora, poner: reloj.poner, quitar: reloj.quitar,
  });
  const primera = sondeo.consultar();
  sondeo.programar(); sondeo.programar(); // la pestaña cambia de visibilidad con la consulta en camino
  sondeo.consultar();
  await reloj.avanzar(CADA_EN_VIVO * 2);
  assert.equal(llamadas, 1);
  soltar();
  await primera;
  sondeo.programar(); sondeo.programar();
  assert.equal(reloj.cuantos(), 1);
});

test('fallo de red: mensaje claro, queda lo último que había y se vuelve a intentar', async () => {
  const { reloj, pantalla, sondeo } = montar();
  await sondeo.consultar();
  const antes = pantalla.partido;
  pantalla.fallaLaRed = true;
  await reloj.avanzar(CADA_EN_VIVO);
  assert.equal(sondeo.info().fallos, 1);
  assert.equal(pantalla.partido, antes, 'lo pintado no se toca');
  assert.match(pantalla.aviso, /No pudimos actualizar/);
  assert.match(pantalla.aviso, /lo último que teníamos/);
  await reloj.avanzar(CADA_EN_VIVO);
  assert.equal(sondeo.info().fallos, 2);
  pantalla.fallaLaRed = false;
  await reloj.avanzar(CADA_EN_VIVO);
  assert.equal(pantalla.aviso, '');
  assert.ok(ids(pantalla.partido).length > ids(antes).length);
});

test('fallo de red en la primera carga: otro mensaje, que ofrece el modo repetición, y reintento a los 20 segundos', async () => {
  const { reloj, pantalla, sondeo } = montar();
  pantalla.fallaLaRed = true;
  await sondeo.consultar();
  assert.equal(pantalla.partido, null);
  assert.match(pantalla.aviso, /No pudimos cargar/);
  assert.match(pantalla.aviso, /modo repetición/);
  pantalla.fallaLaRed = false;
  await reloj.avanzar(CADA_EN_VIVO);
  assert.equal(pantalla.partido.estado, 'en-vivo');
});

test('una respuesta que no se puede pintar cuenta como fallo y no borra lo anterior', async () => {
  const reloj = relojFalso();
  const respuestas = [simularEnCurso(jueves, 60), null, { header: {} }, 'texto'];
  let visto = null; let aviso = '';
  const sondeo = crearSondeo({
    traer: async () => respuestas.shift(),
    alRecibir: (s) => {
      const p = construirPartido(s);
      if (!p.local.nombre && !p.visitante.nombre) throw new Error('La respuesta no trae el partido');
      visto = p; return p.estado;
    },
    alFallar: ({ hayDatos }) => { aviso = mensajeDeFallo(hayDatos); },
    ahora: reloj.ahora, poner: reloj.poner, quitar: reloj.quitar,
  });
  await sondeo.consultar();
  await reloj.avanzar(CADA_EN_VIVO * 3);
  assert.equal(sondeo.info().fallos, 3);
  assert.equal(ids(visto).length, 60);
  assert.match(aviso, /lo último que teníamos/);
});

test('de "en vivo" a "final": aparece el resumen y el sondeo se detiene', async () => {
  const { reloj, pantalla, sondeo } = montar({ desde: TOTAL - 4, paso: 2 });
  await sondeo.consultar();
  assert.equal(pantalla.partido.estado, 'en-vivo');
  assert.equal(construirResumen(pantalla.partido), null);
  await reloj.avanzar(CADA_EN_VIVO);
  assert.equal(pantalla.partido.estado, 'en-vivo');
  await reloj.avanzar(CADA_EN_VIVO);
  assert.equal(pantalla.partido.estado, 'final');
  const resumen = construirResumen(pantalla.partido);
  assert.equal(resumen.titulo, 'Así se ganó el partido');
  assert.match(resumen.cabecera, /Commanders 24, Giants 21/);
  assert.ok(resumen.lineas.length >= 3);
  assert.equal(pantalla.partido.visitante.gano, true);
  assert.equal(pantalla.partido.situacion, null);
  const consultas = sondeo.info().consultas;
  assert.equal(reloj.cuantos(), 0);
  await reloj.avanzar(CADA_EN_VIVO * 20);
  assert.equal(sondeo.info().consultas, consultas);
});

test('partido que todavía no empieza: consulta cada 60 segundos y pasa a 20 cuando arranca', async () => {
  const { reloj, pantalla, sondeo } = montar({ desde: 0, paso: 0 });
  await sondeo.consultar();
  assert.equal(pantalla.partido.estado, 'programado');
  await reloj.avanzar(CADA_EN_ESPERA - 1);
  assert.equal(sondeo.info().consultas, 1);
  pantalla.jugada = 5;
  await reloj.avanzar(1);
  assert.equal(pantalla.partido.estado, 'en-vivo');
  await reloj.avanzar(CADA_EN_VIVO);
  assert.equal(sondeo.info().consultas, 3);
});
