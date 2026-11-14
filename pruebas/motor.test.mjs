// Pruebas del motor de explicaciones con jugadas reales de la temporada 2026.
// Correr: node --test pruebas/
// Las jugadas salen de pruebas/jugadas-reales.json (lo genera herramientas/generar-casos.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  explicarJugada, explicarJugadaEstricta, explicarSituacion, resumirDrive, resultadoDeDrive,
  analizarTexto, describirYarda, yardasParaAnotar, nombreJugador, ordinalCorto, TIPOS_ESPN,
} from '../js/motor.js';
import { existeTermino } from '../js/glosario.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const datos = JSON.parse(readFileSync(path.join(AQUI, 'jugadas-reales.json'), 'utf8'));
const { casos, conNombre } = datos;

const CATEGORIAS = new Set(['pase', 'carrera', 'patada', 'penal', 'perdida', 'anotacion', 'pausa', 'otro']);
const SOSPECHOSO = /undefined|NaN|\bnull\b|\[object|\$\{|  |\.\.|,\.| \.|Todavía no tenemos/;

// Comprobaciones que debe cumplir cualquier explicación, sea del tipo que sea.
function revisarForma(e, jugada) {
  assert.equal(typeof e.explicacion, 'string');
  assert.ok(e.explicacion.length >= 20, `explicación muy corta: "${e.explicacion}"`);
  assert.ok(e.explicacion.length <= 700, `explicación muy larga (${e.explicacion.length}): "${e.explicacion}"`);
  assert.match(e.explicacion, /^[A-ZÁÉÍÓÚÑ¡¿]/, `no empieza con mayúscula: "${e.explicacion}"`);
  assert.match(e.explicacion, /[.!?]$/, `no termina con puntuación: "${e.explicacion}"`);
  assert.doesNotMatch(e.explicacion, SOSPECHOSO, `texto sospechoso: "${e.explicacion}"`);
  if (e.porQue) {
    assert.equal(typeof e.porQue.texto, 'string');
    assert.doesNotMatch(e.porQue.texto, SOSPECHOSO, `porqué sospechoso: "${e.porQue.texto}"`);
    assert.match(e.porQue.texto, /[.!?]$/);
  }
  assert.ok(CATEGORIAS.has(e.categoria), `categoría desconocida: ${e.categoria}`);
  assert.ok(e.etiqueta && typeof e.etiqueta === 'string');
  assert.ok(Array.isArray(e.conceptos));
  for (const c of e.conceptos) assert.ok(existeTermino(c), `el concepto "${c}" no está en el glosario (jugada: ${jugada.text})`);
  assert.equal(new Set(e.conceptos).size, e.conceptos.length, `conceptos repetidos: ${e.conceptos}`);
  assert.equal(e.original, jugada.text || '');
}

const explicar = (nombre) => {
  const c = conNombre[nombre];
  assert.ok(c, `falta la jugada "${nombre}" en jugadas-reales.json; corre node herramientas/generar-casos.mjs`);
  return explicarJugadaEstricta(c.jugada, c.ctx);
};

// ---------------------------------------------------------------------------
// 1. Todos los tipos de jugada vistos en los datos reales
// ---------------------------------------------------------------------------

test('el archivo de casos cubre los 32 tipos de jugada vistos en 137 partidos', () => {
  const tipos = new Set(casos.map((c) => c.tipo));
  assert.equal(tipos.size, 32);
  assert.equal(datos.tipos, 32);
});

const porTipo = new Map();
for (const c of casos) { if (!porTipo.has(c.tipo)) porTipo.set(c.tipo, []); porTipo.get(c.tipo).push(c); }

for (const [tipo, lista] of porTipo) {
  test(`tipo "${tipo}": ${lista.length} jugada(s) real(es) con explicación específica`, () => {
    for (const c of lista) {
      const e = explicarJugadaEstricta(c.jugada, c.ctx);
      revisarForma(e, c.jugada);
      assert.notEqual(e.accion, 'desconocida', `sin acción reconocida: ${c.jugada.text}`);
      assert.notEqual(e.categoria, 'otro', `cayó en la categoría genérica: ${c.jugada.text}`);
    }
  });
}

test('todos los tipos de ESPN vistos están en la tabla TIPOS_ESPN', () => {
  for (const tipo of porTipo.keys()) assert.ok(TIPOS_ESPN[tipo], `falta "${tipo}" en TIPOS_ESPN`);
});

// ---------------------------------------------------------------------------
// 2. Jugadas concretas: que la explicación diga lo que pasó
// ---------------------------------------------------------------------------

test('gol de campo bueno: distancia, 3 puntos, marcador y porqué de la cuarta oportunidad', () => {
  const e = explicar('gol-de-campo-46');
  assert.equal(e.categoria, 'anotacion');
  assert.match(e.explicacion, /46 yardas/);
  assert.match(e.explicacion, /3 puntos para los Titans/);
  assert.match(e.explicacion, /Titans 3, Bengals 0/);
  assert.deepEqual(e.anotacion, { equipo: '10', puntos: 3 });
  assert.match(e.porQue.texto, /cuarta oportunidad/i);
  assert.ok(e.conceptos.includes('gol-de-campo') && e.conceptos.includes('cuarta-oportunidad'));
});

test('gol de campo fallado: no hay puntos, el balón cambia y el porqué no dice que "aseguran" nada', () => {
  const e = explicar('gol-fallado-56');
  assert.equal(e.etiqueta, 'Gol de campo fallado');
  assert.equal(e.anotacion, null);
  assert.match(e.explicacion, /falla el gol de campo de 56 yardas/);
  assert.match(e.explicacion, /desviado a la derecha/);
  assert.match(e.explicacion, /pasa a los Falcons/);
  assert.doesNotMatch(e.porQue.texto, /aseguran/);
  assert.match(e.porQue.texto, /patada larga y difícil/);
});

test('touchdown por pase con punto extra: 7 puntos y marcador nuevo', () => {
  const e = explicar('td-pase-con-extra');
  assert.equal(e.categoria, 'anotacion');
  assert.equal(e.etiqueta, 'Touchdown por pase');
  assert.match(e.explicacion, /¡Touchdown de los Dolphins!/);
  assert.match(e.explicacion, /punto extra es bueno: 7 puntos/);
  assert.match(e.explicacion, /Dolphins 13, Patriots 3/);
  assert.doesNotMatch(e.explicacion, /Injury|returned/);
  assert.deepEqual(e.anotacion, { equipo: '15', puntos: 7 });
  assert.equal(e.destacada, true);
});

test('touchdown con punto extra fallado: se quedan con 6', () => {
  const e = explicar('punto-extra-fallado');
  assert.match(e.explicacion, /Fallan la patada del punto extra/);
  assert.equal(e.anotacion.puntos, 6);
});

test('conversión de 2 puntos: buena suma 8, fallada deja 6', () => {
  const buena = explicar('conversion-de-2-buena');
  assert.match(buena.explicacion, /conversión de 2 puntos y la consiguen: 8 puntos/);
  assert.equal(buena.anotacion.puntos, 8);
  assert.ok(buena.conceptos.includes('conversion-de-2'));
  const fallada = explicar('conversion-de-2-fallada');
  assert.match(fallada.explicacion, /conversión de 2 puntos, pero la defensa la detiene/);
  assert.equal(fallada.anotacion.puntos, 6);
});

test('intercepción: quién la atrapa, cambio de posesión y dónde arranca el rival', () => {
  const e = explicar('intercepcion');
  assert.equal(e.categoria, 'perdida');
  assert.equal(e.cambioDePosesion, true);
  assert.match(e.explicacion, /¡Intercepción! H\. Smith/);
  assert.match(e.explicacion, /ahora atacan los Vikings desde la yarda 41 de los Colts/);
  assert.match(e.explicacion, /regresó 15 yardas/);
});

test('un penal que anula la jugada: la intercepción no cuenta y se repite la oportunidad', () => {
  const e = explicar('offside-anula-intercepcion');
  assert.equal(e.categoria, 'penal');
  assert.equal(e.cambioDePosesion, false);
  assert.match(e.explicacion, /La intercepción no cuenta/);
  assert.match(e.explicacion, /contra los Patriots \(Dr\. Jones\): fuera de lugar/);
  assert.match(e.explicacion, /5 yardas a favor de los Dolphins y la oportunidad se repite/);
});

test('penales: primer down automático solo cuando la regla lo da', () => {
  const invasion = explicar('invasion');
  assert.match(invasion.explicacion, /invasión \(encroachment\)/);
  assert.match(invasion.explicacion, /suficientes para alcanzar el primer down/);
  assert.doesNotMatch(invasion.explicacion, /automático/);
  const interferencia = explicar('interferencia-defensiva');
  assert.match(interferencia.explicacion, /interferencia de pase defensiva/);
  assert.match(interferencia.explicacion, /9 yardas a favor de los Ravens y primer down automático/);
});

test('penal rechazado: se explica que conviene más el resultado de la jugada', () => {
  const e = explicar('penal-rechazado');
  assert.equal(e.categoria, 'pase');
  assert.match(e.explicacion, /27 yardas/);
  assert.match(e.explicacion, /los Broncos la rechazan/);
});

test('despeje en cuarta oportunidad: regreso, dónde empieza el rival y por qué patean', () => {
  const e = explicar('despeje-con-regreso');
  assert.equal(e.categoria, 'patada');
  assert.match(e.explicacion, /despeja \(punt\) 52 yardas/);
  assert.match(e.explicacion, /los Giants empiezan en su propia yarda 23/);
  assert.match(e.porQue.texto, /cuarta oportunidad con 21 yardas por ganar/);
  assert.doesNotMatch(e.porQue.texto, /muy cerca de su propia zona/);
});

test('patada de salida con touchback y patada corta (onside)', () => {
  const tb = explicar('patada-touchback');
  assert.match(tb.explicacion, /touchback/);
  assert.match(tb.explicacion, /los Bills arrancan desde su yarda 35/);
  const corta = explicar('patada-corta');
  assert.equal(corta.etiqueta, 'Patada corta (onside)');
  assert.match(corta.explicacion, /onside kick/);
  assert.ok(corta.porQue.texto.length > 20);
});

test('captura compartida y carrera con pérdida', () => {
  const sack = explicar('captura-compartida');
  assert.equal(sack.etiqueta, 'Captura (sack)');
  assert.match(sack.explicacion, /T\. Settle y K\. Chaisson/);
  assert.match(sack.explicacion, /pierden 6 yardas/);
  const perdida = explicar('carrera-con-perdida');
  assert.match(perdida.explicacion, /C\. Lamb/);
  assert.match(perdida.explicacion, /pierden 6 yardas/);
});

test('tercera oportunidad fallida avisa que viene la decisión de cuarta', () => {
  const e = explicar('tercera-fallida');
  assert.match(e.explicacion, /gana 1 yarda/);
  assert.match(e.explicacion, /queda cuarta oportunidad y 1 yarda por ganar/);
});

test('cuarta oportunidad jugada: convertida y fallada', () => {
  const si = explicar('cuarta-jugada-y-convertida');
  assert.match(si.explicacion, /Se la jugaron en cuarta oportunidad y les salió/);
  assert.match(si.porQue.texto, /falta solo 1 yarda/);
  const no = explicar('cuarta-jugada-y-fallada');
  assert.match(no.explicacion, /Era cuarta oportunidad y no llegaron: el balón pasa a los Saints/);
  assert.equal(no.cambioDePosesion, true);
});

test('recepción en la que todo el avance fue después de atrapar', () => {
  const e = explicar('recepcion-y-carrera');
  assert.match(e.explicacion, /17 yardas/);
  assert.match(e.explicacion, /Todo el avance lo consiguió corriendo después de atrapar/);
  assert.doesNotMatch(e.explicacion, /La mayor parte/);
  assert.match(e.explicacion, /tercera oportunidad y la convierten/);
});

test('manejo del reloj: tiempo fuera, balón clavado y rodilla al suelo', () => {
  const tf = explicar('tiempo-fuera');
  assert.match(tf.explicacion, /Tiempo fuera de los Jaguars: es el segundo/);
  assert.match(tf.explicacion, /Les queda 1/);
  const spike = explicar('balon-clavado');
  assert.equal(spike.etiqueta, 'Balón clavado (spike)');
  assert.match(spike.explicacion, /detener el reloj/);
  const rodilla = explicar('rodilla');
  assert.equal(rodilla.etiqueta, 'Rodilla al suelo');
  assert.match(rodilla.explicacion, /rodilla en el suelo a propósito/);
});

test('jugada revisada y revertida: se explica el resultado corregido y que hubo revisión', () => {
  const e = explicar('revision-revertida');
  revisarForma(e, conNombre['revision-revertida'].jugada);
  assert.match(e.explicacion, /revisar el video|revisión/);
});

// ---------------------------------------------------------------------------
// 3. Que no suene a robot: frases variadas para el mismo tipo de jugada
// ---------------------------------------------------------------------------

test('las carreras y los pases no repiten siempre la misma frase', () => {
  const moldes = (tipo) => {
    const lista = porTipo.get(tipo);
    return new Set(lista.map((c) => explicarJugadaEstricta(c.jugada, c.ctx).explicacion.replace(/[A-Z]\. ?[A-Za-zÀ-ÿ'.-]+/g, 'X').replace(/\d+/g, 'N')));
  };
  assert.ok(moldes('Rush').size >= 3, 'las carreras de muestra usan menos de 3 frases distintas');
  assert.ok(moldes('Pass Reception').size >= 3, 'los pases de muestra usan menos de 3 frases distintas');
});

test('la misma jugada siempre da la misma explicación (sin azar)', () => {
  for (const c of casos.slice(0, 40)) {
    assert.equal(explicarJugadaEstricta(c.jugada, c.ctx).explicacion, explicarJugadaEstricta(c.jugada, c.ctx).explicacion);
  }
});

// ---------------------------------------------------------------------------
// 4. Respaldo: nunca rompe la app
// ---------------------------------------------------------------------------

test('explicarJugada nunca lanza errores con datos raros', () => {
  const raros = [
    null, undefined, 42, 'texto', [], {}, { text: null }, { text: 12345 }, { type: null, text: '' },
    { type: { text: 'Tipo Que No Existe' }, text: 'Something totally new happened here.' },
    { type: { text: 'Rush' }, text: 'J.Cook right tackle to BUF 30 for 5 yards.', start: null, end: 'x' },
    { type: { text: 'Pass Reception' }, start: { down: 'a', distance: {}, yardLine: 'z' }, end: {} },
  ];
  for (const jugada of raros) {
    for (const ctx of [undefined, null, {}, { local: {}, visitante: null }]) {
      const e = explicarJugada(jugada, ctx);
      assert.equal(typeof e.explicacion, 'string');
      assert.ok(e.explicacion.length > 0);
      assert.ok(Array.isArray(e.conceptos));
      assert.doesNotMatch(e.explicacion, /undefined|NaN|\[object/);
    }
  }
});

test('un tipo desconocido recibe la explicación genérica y sigue siendo legible', () => {
  const e = explicarJugada({ type: { text: 'Tipo Que No Existe' }, text: 'Something totally new happened here.' }, {});
  assert.match(e.explicacion, /[.!?]$/);
  assert.equal(e.original, 'Something totally new happened here.');
});

test('sin contexto de equipos, las jugadas reales igual se explican', () => {
  for (const c of casos) {
    const e = explicarJugada(c.jugada, {});
    assert.ok(e.explicacion.length > 0);
    assert.doesNotMatch(e.explicacion, /undefined|NaN|\[object/, c.jugada.text);
  }
});

// ---------------------------------------------------------------------------
// 5. Situación actual, drives y utilidades
// ---------------------------------------------------------------------------

const ctxDemo = {
  local: { id: '19', abrev: 'NYG', nombre: 'Giants', ciudad: 'New York' },
  visitante: { id: '28', abrev: 'WSH', nombre: 'Commanders', ciudad: 'Washington' },
};

test('situación: "2nd & 7" se explica como en la especificación', () => {
  const s = explicarSituacion({ down: 2, distance: 7, yardLine: 28, team: { id: '19' } }, ctxDemo);
  assert.equal(s.titulo, '2.ª y 7 en la yarda 28 de los Giants');
  assert.match(s.texto, /^Segunda oportunidad: a los Giants les faltan 7 yardas para renovar/);
  assert.match(s.texto, /Les quedan 3 intentos/);
  assert.equal(s.yardasParaAnotar, 72);
});

test('situación: cuarta oportunidad, gol o nada y zona roja', () => {
  const cuarta = explicarSituacion({ down: 4, distance: 1, yardLine: 55, team: { id: '19' } }, ctxDemo);
  assert.match(cuarta.texto, /Cuarta oportunidad/);
  assert.match(cuarta.texto, /falta 1 yarda/);
  assert.match(cuarta.texto, /último intento/);
  assert.ok(cuarta.conceptos.includes('cuarta-oportunidad'));
  const gol = explicarSituacion({ down: 1, distance: 4, yardLine: 4, team: { id: '28' } }, ctxDemo);
  assert.equal(gol.golONada, true);
  assert.match(gol.texto, /Primera oportunidad y gol: a los Commanders les faltan 4 yardas para el touchdown/);
  const roja = explicarSituacion({ down: 1, distance: 10, yardLine: 85, team: { id: '19' } }, ctxDemo);
  assert.ok(roja.conceptos.includes('zona-roja'));
  for (const c of [...cuarta.conceptos, ...gol.conceptos, ...roja.conceptos]) assert.ok(existeTermino(c), `"${c}" no está en el glosario`);
});

test('situación: datos vacíos o raros no rompen', () => {
  for (const p of [null, undefined, {}, { down: 0 }, { down: 9, distance: 'x' }, { down: -1, distance: -1, yardLine: 50 }]) {
    const s = explicarSituacion(p, ctxDemo);
    assert.equal(s.texto, '');
  }
  assert.equal(explicarSituacion({ down: 2, distance: 5, yardLine: 40 }, null).texto.length > 0, true);
});

test('situación al terminar cada jugada real de muestra', () => {
  for (const c of casos) {
    const s = explicarSituacion(c.jugada.end, c.ctx);
    assert.doesNotMatch(s.titulo + s.texto, /undefined|NaN|\[object/);
  }
});

test('resumen de drive como pide la especificación', () => {
  const r = resumirDrive({ team: { id: '19' }, offensivePlays: 8, yards: 65, displayResult: 'Touchdown', isScore: true }, ctxDemo);
  assert.equal(r.texto, 'Avance de los Giants: 8 jugadas, 65 yardas, terminó en touchdown.');
  assert.equal(r.anoto, true);
  assert.equal(resumirDrive({ team: { id: '28' }, offensivePlays: 1, yards: -3 }, ctxDemo).enCurso, true);
  assert.equal(resultadoDeDrive('Punt'), 'terminó en despeje (punt)');
  assert.equal(resultadoDeDrive('Missed FG'), 'falló el gol de campo');
  assert.equal(resultadoDeDrive('Downs'), 'se quedó sin oportunidades y entregó el balón');
  assert.equal(resultadoDeDrive(''), '');
  assert.equal(typeof resumirDrive(null, null).texto, 'string');
});

test('yardas: el local ataca hacia 100 y el visitante hacia 0', () => {
  assert.equal(yardasParaAnotar(25, '19', ctxDemo), 75);
  assert.equal(yardasParaAnotar(25, '28', ctxDemo), 25);
  assert.equal(describirYarda(28, ctxDemo), 'la yarda 28 de los Giants');
  assert.equal(describirYarda(72, ctxDemo), 'la yarda 28 de los Commanders');
  assert.equal(describirYarda(50, ctxDemo), 'el medio campo');
});

test('utilidades de texto', () => {
  assert.equal(nombreJugador('J.McCarthy'), 'J. McCarthy');
  assert.equal(ordinalCorto(3), '3.ª');
  const h = analizarTexto('(Shotgun) J.McCarthy pass short left to C.Skattebo to NYG 28 for 3 yards (A.Robertson).');
  assert.equal(typeof h, 'object');
});

// ---------------------------------------------------------------------------
// 6. Barrido completo (solo si están los datos de análisis en datos/)
// ---------------------------------------------------------------------------

const hayCorpus = existsSync(path.join(AQUI, '..', 'datos', 'corpus')) && existsSync(path.join(AQUI, '..', 'datos', 'crudos'));

test('barrido de todas las jugadas guardadas: ningún error ni texto sospechoso', { skip: !hayCorpus && 'no están datos/corpus ni datos/crudos' }, async () => {
  const { jugadasConContexto } = await import('../herramientas/recorrer-con-contexto.mjs');
  let total = 0;
  const fallas = [];
  for (const { jugada, ctx } of jugadasConContexto()) {
    total++;
    try {
      const e = explicarJugadaEstricta(jugada, ctx);
      if (e.accion === 'desconocida' || e.categoria === 'otro') fallas.push(`sin acción: ${jugada.text}`);
      else if (SOSPECHOSO.test(e.explicacion) || (e.porQue && SOSPECHOSO.test(e.porQue.texto))) fallas.push(`sospechoso: ${e.explicacion} ${e.porQue?.texto || ''}`);
      else if (!/[.!?]$/.test(e.explicacion)) fallas.push(`sin punto final: ${e.explicacion}`);
      else { for (const c of e.conceptos) if (!existeTermino(c)) { fallas.push(`concepto sin glosario: ${c}`); break; } }
    } catch (error) {
      fallas.push(`ERROR ${error.message}: ${jugada.text}`);
    }
  }
  assert.ok(total > 20000, `se esperaban más de 20.000 jugadas y hay ${total}`);
  assert.deepEqual([...new Set(fallas)].slice(0, 15), []);
});
