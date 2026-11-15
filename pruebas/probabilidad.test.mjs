// Pruebas de la serie de probabilidad de ganar (js/probabilidad.js): con los 16 partidos guardados,
// sin `winprobability`, con el simulador del modo en vivo y con la repetición.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido, contarJugadas } from '../js/modelo.js';
import { simularEnCurso, FORMAS_EN_VIVO } from '../js/simulador.js';
import { elegirJugadasClave } from '../js/clave.js';
import {
  serieDeProbabilidad, fraseDeTV, lecturaDePunto, textoDePunto, descripcionDeSerie, segundosDeJuego, porcentajes,
  escalas, rutaDeLinea, rutaDeArea, masCercano, saltarAMomento, coloresDeGrafica, contraste,
} from '../js/probabilidad.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'datos', 'partidos');
const leer = (id) => JSON.parse(readFileSync(path.join(DIR, `${id}.json`), 'utf8'));
const IDS = readdirSync(DIR).filter((f) => /^\d+\.json$/.test(f)).map((f) => f.replace('.json', ''));
const jueves = leer('401873052'); // Commanders 24, Giants 21 (local: Giants)
const copia = (x) => JSON.parse(JSON.stringify(x));

test('partido del jueves: un punto por jugada con dato de ESPN, más el pronóstico previo', () => {
  const s = serieDeProbabilidad(construirPartido(jueves));
  assert.equal(s.puntos.length, 189);
  assert.equal(s.puntos[0].cuando, 'Antes del partido');
  assert.equal(s.puntos[0].t, 0);
  assert.deepEqual(s.puntos[0].pct, { local: 50, visitante: 50 });
  const ultimo = s.puntos.at(-1);
  assert.deepEqual(ultimo.pct, { local: 0, visitante: 100 });
  assert.deepEqual(ultimo.marcador, { local: 21, visitante: 24 });
  assert.equal(s.total, 3600);
  assert.deepEqual(s.cuartos.map((c) => c.rotulo), ['1.º', '2.º', '3.º', '4.º']);
  assert.equal(s.local.nombre, 'Giants');
  assert.equal(s.visitante.nombre, 'Commanders');
  assert.equal(fraseDeTV(s), 'Los Commanders llegaron a tener solo un 7 % de probabilidad de ganar (4.º cuarto, 2:19) y lo ganaron.');
});

test('partido del jueves: los momentos importantes son anotaciones, pérdidas de balón y las jugadas clave de clave.js', () => {
  const p = construirPartido(jueves);
  const s = serieDeProbabilidad(p);
  assert.equal(s.puntos.filter((x) => x.anotacion).length, 7);
  assert.equal(s.puntos.filter((x) => x.perdida).length, 4); // 3 intercepciones y 1 fumble perdido
  assert.deepEqual(s.puntos.filter((x) => x.clave).map((x) => x.id), elegirJugadasClave(p, 5).map((c) => c.id));
  assert.equal(s.momentos, 11);
  // El fumble de la patada de salida que recuperó el mismo equipo NO es una pérdida de balón.
  assert.ok(!s.puntos.some((x) => x.perdida && /patea de salida/.test(x.texto)));
  // En una pérdida, el texto corto dice cómo se perdió el balón.
  for (const x of s.puntos.filter((y) => y.perdida)) assert.match(x.texto, /Intercepción|Pierde el balón|quita el balón/);
  const td = s.puntos.find((x) => x.clave && x.anotacion && x.periodo === 4 && x.reloj === '0:57');
  assert.deepEqual(lecturaDePunto(td, s), {
    cuando: '4.º cuarto · 0:57',
    marcador: 'Commanders 24 · Giants 21',
    porcentajes: 'Commanders 84 % · Giants 16 %',
    momento: 'Anotación y Jugada clave',
    texto: 'S. Diggs atrapa el pase corto por el centro de J. Daniels y nadie lo alcanza: 32 yardas hasta la zona de anotación.',
  });
  assert.equal(textoDePunto(td, s), 'Anotación y Jugada clave. 4.º cuarto, 0:57. Commanders 24, Giants 21. Commanders 84 %, Giants 16 %. S. Diggs atrapa el pase corto por el centro de J. Daniels y nadie lo alcanza: 32 yardas hasta la zona de anotación.');
});

test('los 16 partidos guardados: cada punto es el dato de ESPN de esa jugada, sin repetidos y en orden', () => {
  let puntos = 0;
  for (const id of IDS) {
    const summary = leer(id);
    const crudo = new Map(summary.winprobability.map((w) => [String(w.playId), w.homeWinPercentage]));
    const p = construirPartido(summary);
    const jugadas = new Map(p.drives.flatMap((d) => d.jugadas).map((j) => [j.id, j]));
    const s = serieDeProbabilidad(p);
    assert.ok(s, `${id}: debería haber serie`);
    const ids = s.puntos.map((x) => x.id).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `${id}: puntos repetidos`);
    let t = -1;
    for (const x of s.puntos) {
      puntos++;
      assert.ok(x.t >= t && x.t <= s.total, `${id}: el tiempo retrocede o se sale (${x.cuando})`);
      t = x.t;
      assert.ok(x.local >= 0 && x.local <= 1);
      assert.equal(x.pct.local + x.pct.visitante, 100);
      assert.ok(x.texto && x.texto.length <= 300 && !/undefined|null|NaN/.test(x.texto), `${id}: texto raro: ${x.texto}`);
      if (!x.id) continue;
      assert.equal(x.local, crudo.get(x.id), `${id}: la probabilidad no es la de ESPN`); // nada calculado por nosotros
      const j = jugadas.get(x.id);
      assert.ok(j, `${id}: punto sin jugada`);
      assert.equal(x.anotacion, !!j.explicacion.anotacion);
      assert.deepEqual(x.marcador, j.marcador);
      assert.equal(x.importante, x.anotacion || x.perdida || x.clave);
    }
    assert.equal(s.puntos[0].local, summary.winprobability[0].homeWinPercentage);
    assert.equal(s.puntos.filter((x) => x.clave).length, 5);
    assert.match(fraseDeTV(s), /^Los [A-Z0-9]\S* (llegaron|fueron|no eran) .*\d+ %.*\.$/);
    assert.ok(descripcionDeSerie(s).includes(s.local.nombre) && descripcionDeSerie(s).includes('flechas'));
  }
  console.log(`      ${puntos} puntos revisados en ${IDS.length} partidos`);
});

test('tiempo extra: la gráfica se alarga y agrega su división', () => {
  const s = serieDeProbabilidad(construirPartido(leer('401873039'))); // Browns 22, Saints 23 en tiempo extra
  assert.equal(s.total, 4200);
  assert.deepEqual(s.cuartos.map((c) => c.rotulo), ['1.º', '2.º', '3.º', '4.º', 'TE']);
  assert.ok(s.puntos.at(-1).t > 3600);
  assert.equal(fraseDeTV(s), 'Los Saints llegaron a tener solo un 13 % de probabilidad de ganar (4.º cuarto, 2:54) y lo ganaron.');
});

test('dato malo de ESPN: la jugada que cierra un partido no puede dar 100 % al equipo que acaba de perder', () => {
  // Browns 22, Saints 23: el touchdown final de los Browns (sin conversión, se acabó el partido) llega de ESPN con
  // 0 % para los Saints, que ganaron. Ese dato se descarta: la jugada queda sin punto y no cuenta como "jugada clave".
  const crudo = leer('401873039');
  const p = construirPartido(crudo);
  const jugadas = p.drives.flatMap((d) => d.jugadas);
  const cierre = jugadas.find((j) => j.periodo === 5 && j.reloj === '1:00' && j.explicacion.anotacion);
  assert.equal(crudo.winprobability.find((w) => String(w.playId) === cierre.id).homeWinPercentage, 0); // así llega
  assert.equal(cierre.conProb, false);
  assert.equal(cierre.cambio, 0);
  assert.equal(cierre.clave, false);
  const s = serieDeProbabilidad(p);
  assert.ok(!s.puntos.some((x) => x.id === cierre.id));
  assert.equal(s.puntos.at(-1).pct.local, 100);
  assert.ok(s.puntos.slice(-5).every((x) => x.local > 0.8), 'el final de la línea ya no salta al lado del perdedor');
  // En los 16 partidos: después de quedar el marcador final en el último instante, nadie "gana" en la gráfica si perdió.
  for (const id of IDS) {
    const q = construirPartido(leer(id));
    const serie = serieDeProbabilidad(q);
    const ganaLocal = q.local.puntos > q.visitante.puntos;
    const ultimo = serie.puntos.at(-1);
    for (const x of serie.puntos.filter((y) => y.t === ultimo.t && y.marcador.local === q.local.puntos && y.marcador.visitante === q.visitante.puntos)) {
      assert.ok(ganaLocal ? x.local >= 0.5 : x.local <= 0.5, `${id}: ${x.cuando} contradice el resultado`);
    }
  }
  // En vivo no se descarta nada: no se conoce el resultado.
  const enVivo = construirPartido(simularEnCurso(crudo, contarJugadas(crudo) - 1));
  assert.equal(enVivo.estado, 'en-vivo');
  assert.equal(enVivo.drives.flatMap((d) => d.jugadas).find((j) => j.id === cierre.id).conProb, true);
});

test('sin winprobability no hay serie (la sección no aparece) y no se calcula nada propio', () => {
  for (const wp of [undefined, null, [], 'basura', [{ playId: 'x' }], [{ playId: '1', homeWinPercentage: 'alto' }]]) {
    const s = copia(jueves);
    if (wp === undefined) delete s.winprobability; else s.winprobability = wp;
    const p = construirPartido(s);
    assert.equal(serieDeProbabilidad(p), null);
    assert.equal(p.probInicial, null);
  }
  // Un solo dato (solo el pronóstico previo) tampoco alcanza para dibujar una línea.
  const uno = copia(jueves);
  uno.winprobability = uno.winprobability.slice(0, 1);
  assert.equal(serieDeProbabilidad(construirPartido(uno)), null);
  // Si el primer dato de ESPN ya es de una jugada (no hay pronóstico previo), no se inventa el punto "Antes del partido".
  const sinPrevio = copia(jueves);
  sinPrevio.winprobability = sinPrevio.winprobability.slice(1);
  const serieSinPrevio = serieDeProbabilidad(construirPartido(sinPrevio));
  assert.equal(serieSinPrevio.puntos.length, 188);
  assert.equal(serieSinPrevio.puntos[0].cuando, '1.er cuarto · 15:00');
  assert.equal(serieDeProbabilidad(null), null);
  assert.equal(serieDeProbabilidad({}), null);
  assert.equal(fraseDeTV(null), '');
  assert.equal(descripcionDeSerie(null), '');
});

test('datos a medias: valores fuera de rango o jugadas sin dato se saltan sin romper', () => {
  const s = copia(jueves);
  s.winprobability[10].homeWinPercentage = 7; // imposible
  s.winprobability[11].homeWinPercentage = null;
  s.winprobability.splice(20, 15); // ESPN todavía no calculó esas jugadas
  s.winprobability.push(copia(s.winprobability[30])); // una entrada repetida
  const serie = serieDeProbabilidad(construirPartido(s));
  assert.ok(serie.puntos.length >= 189 - 17 - 1 && serie.puntos.length < 189);
  assert.ok(serie.puntos.every((x) => x.local >= 0 && x.local <= 1));
  const ids = serie.puntos.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('en vivo (simulador): la serie crece con cada sondeo, sin duplicar ni cambiar los puntos ya dibujados', () => {
  const total = contarJugadas(jueves);
  const completa = serieDeProbabilidad(construirPartido(jueves));
  for (const forma of FORMAS_EN_VIVO) {
    let previa = null;
    for (let n = 1; n <= total; n += 7) {
      const p = construirPartido(simularEnCurso(jueves, n, { forma }));
      const s = serieDeProbabilidad(p);
      if (n < total) assert.equal(p.estado, 'en-vivo');
      assert.ok(s, `${forma}, jugada ${n}: debería haber serie`);
      assert.equal(s.puntos.length, n + 1, `${forma}, jugada ${n}`);
      const ids = s.puntos.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length);
      // Lo que ya estaba sigue igual (mismo punto, mismo lugar): solo cambian las marcas de "jugada clave".
      s.puntos.forEach((x, i) => {
        const y = completa.puntos[i];
        assert.deepEqual([x.id, x.t, x.local, x.cuando, x.anotacion, x.perdida, x.texto], [y.id, y.t, y.local, y.cuando, y.anotacion, y.perdida, y.texto]);
      });
      if (previa) assert.deepEqual(s.puntos.slice(0, previa.puntos.length).map((x) => x.id), previa.puntos.map((x) => x.id));
      assert.equal(s.total, 3600); // el eje no se reescala: la línea avanza hacia la derecha
      assert.match(fraseDeTV(s), /^(Partido parejo: ahora|Ahora) mismo los (Commanders|Giants) tienen un \d+ % de probabilidad de ganar\./);
      previa = s;
    }
  }
  // En vivo solo se marca como jugada clave lo que movió 5 puntos o más (al final del partido, las 5 de clave.js).
  for (const n of [20, 60, 120]) {
    const p = construirPartido(simularEnCurso(jueves, n));
    const porId = new Map(p.drives.flatMap((d) => d.jugadas).map((j) => [j.id, j]));
    const marcadas = serieDeProbabilidad(p).puntos.filter((x) => x.clave);
    assert.ok(marcadas.length <= 5);
    for (const x of marcadas) assert.ok(Math.abs(porId.get(x.id).cambio) >= 0.05, `jugada ${n}: clave con cambio mínimo`);
  }
  // Las tres formas de drives.current dan la misma serie.
  const [a, b, c] = FORMAS_EN_VIVO.map((forma) => serieDeProbabilidad(construirPartido(simularEnCurso(jueves, 120, { forma }))));
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  // Antes de la primera jugada no hay nada que dibujar.
  assert.equal(serieDeProbabilidad(construirPartido(simularEnCurso(jueves, 0))), null);
});

test('en vivo: la frase dice quién va arriba ahora y, si remontó, desde dónde', () => {
  const s = serieDeProbabilidad(construirPartido(simularEnCurso(jueves, 184)));
  assert.equal(s.estado, 'en-vivo');
  assert.equal(fraseDeTV(s), 'Ahora mismo los Commanders tienen un 100 % de probabilidad de ganar. Llegaron a tener solo un 7 % (4.º cuarto, 2:19).');
  const temprano = serieDeProbabilidad(construirPartido(simularEnCurso(jueves, 3)));
  assert.match(fraseDeTV(temprano), /^Partido parejo: ahora mismo los (Giants|Commanders) tienen un 5\d % de probabilidad de ganar\.$/);
});

test('repetición: cortada en la jugada N tiene N puntos más el pronóstico previo', () => {
  for (const n of [1, 60, 150, 188]) {
    const s = serieDeProbabilidad(construirPartido(jueves, { hasta: n }));
    assert.equal(s.puntos.length, n + 1);
  }
  assert.equal(serieDeProbabilidad(construirPartido(jueves, { hasta: 0 })), null);
});

test('frases de arriba: cada caso con datos inventados solo para la prueba', () => {
  const eq = (id, nombre) => ({ id, nombre, abrev: nombre.slice(0, 3).toUpperCase(), color: '', colorAlterno: '' });
  const serie = (locales, final, estado = 'final') => ({
    estado, final: final ? { local: final[0], visitante: final[1] } : null, local: eq('1', 'Osos'), visitante: eq('2', 'Lobos'), momentos: 0, total: 3600, cuartos: [],
    puntos: locales.map((l, i) => ({ id: String(i), t: i * 600, local: l, visitante: 1 - l, pct: porcentajes(l), periodo: i ? Math.min(4, Math.ceil(i * 600 / 900)) : 0, reloj: '5:00', cuando: i ? `${Math.min(4, Math.ceil(i * 600 / 900))}.º cuarto · 5:00` : 'Antes del partido', marcador: { local: 0, visitante: 0 }, texto: 'x' })),
  });
  assert.equal(fraseDeTV(serie([0.5, 0.4, 0.12, 0.6, 1], [20, 17])), 'Los Osos llegaron a tener solo un 12 % de probabilidad de ganar (2.º cuarto, 5:00) y lo ganaron.');
  assert.equal(fraseDeTV(serie([0.5, 0.62, 0.7, 0.4, 0], [10, 17])), 'Los Lobos llegaron a bajar al 30 % de probabilidad de ganar (2.º cuarto, 5:00), pero se quedaron con el partido.');
  assert.equal(fraseDeTV(serie([0.62, 0.7, 0.8, 0.9, 1], [30, 3])), 'Los Osos fueron favoritos de principio a fin: su probabilidad de ganar nunca bajó del 62 %.');
  assert.equal(fraseDeTV(serie([0.36, 0.5, 0.8, 0.9, 1], [30, 3])), 'Los Osos no eran los favoritos al empezar (36 % de probabilidad de ganar) y se quedaron con el partido.');
  assert.equal(fraseDeTV(serie([0.5, 0.3, 0.7, 0.5], [20, 20])), 'Terminó empatado: la probabilidad de ganar de los Osos se movió entre el 30 % y el 70 %.');
  assert.equal(fraseDeTV(serie([0.5, 0.45, 0.29], null, 'en-vivo')), 'Ahora mismo los Lobos tienen un 71 % de probabilidad de ganar.');
  assert.equal(fraseDeTV(serie([0.5, 0.8, 0.31], null, 'en-vivo')), 'Ahora mismo los Lobos tienen un 69 % de probabilidad de ganar. Llegaron a tener solo un 20 % (1.er cuarto, 5:00).'.replace('1.er', '1.º'));
});

test('reloj de juego: segundos transcurridos, sin retroceder aunque el dato venga mal', () => {
  assert.equal(segundosDeJuego(1, '15:00'), 0);
  assert.equal(segundosDeJuego(1, '0:00'), 900);
  assert.equal(segundosDeJuego(2, '14:07'), 953);
  assert.equal(segundosDeJuego(4, '0:00'), 3600);
  assert.equal(segundosDeJuego(5, '10:00'), 3600);
  assert.equal(segundosDeJuego(5, '1:00'), 4140);
  assert.equal(segundosDeJuego(3, '', 1900), 1900); // sin reloj: se queda donde iba
  assert.equal(segundosDeJuego(0, '0:00', 2700), 2700); // final de cuarto con el cuarto en blanco
  assert.equal(segundosDeJuego(2, '15:00', 1000), 1000); // nunca retrocede
  assert.equal(segundosDeJuego(1, '99:99', 0), 0); // reloj imposible: no pasa del final del cuarto ni rompe
});

test('geometría: arriba el visitante, abajo el local, y la línea pasa por todos los puntos', () => {
  const s = serieDeProbabilidad(construirPartido(jueves));
  const e = escalas(s, 328, 190);
  assert.equal(e.y(0), e.arriba); // 0 % del local = 100 % del visitante: arriba
  assert.equal(e.y(1), e.abajo);
  assert.equal(e.y(0.5), e.medio);
  assert.equal(e.x(0), e.izq);
  assert.equal(e.x(s.total), e.der);
  assert.ok(e.der <= 328 && e.abajo <= 190);
  const linea = rutaDeLinea(s.puntos, e);
  assert.match(linea, /^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+)+$/);
  assert.equal(linea.split('L').length, s.puntos.length);
  assert.ok(rutaDeArea(s.puntos, e).endsWith('Z'));
  assert.ok(!/NaN|undefined/.test(linea));
  // Ida y vuelta: del píxel al instante.
  assert.ok(Math.abs(e.tDe(e.x(1800)) - 1800) < 10);
  // Aun con un ancho absurdo no se rompe.
  assert.ok(!/NaN/.test(rutaDeLinea(s.puntos, escalas(s, 0, 0))));
});

test('recorrido: el punto más cercano y los saltos entre momentos importantes', () => {
  const s = serieDeProbabilidad(construirPartido(jueves));
  assert.equal(s.puntos[masCercano(s.puntos, -50)].t, 0);
  assert.equal(masCercano(s.puntos, 99999), s.puntos.length - 1);
  const i = masCercano(s.puntos, 1800);
  assert.ok(Math.abs(s.puntos[i].t - 1800) <= 60);
  assert.equal(masCercano([], 10), -1);
  // Varias jugadas en el mismo segundo de reloj: gana la importante; si ninguna lo es, la última.
  const mismas = [{ t: 10 }, { t: 50, importante: false }, { t: 50, importante: true }, { t: 50, importante: false }, { t: 90 }];
  assert.equal(masCercano(mismas, 52), 2);
  assert.equal(masCercano(mismas.map((x) => ({ t: x.t })), 52), 3);
  // En el partido real: sobre cada momento importante el puntero elige ese momento, no la pausa que comparte su reloj.
  for (const [k, x] of s.puntos.entries()) if (x.importante) assert.ok(s.puntos[masCercano(s.puntos, x.t)].importante, `en ${x.cuando} elige ${k}`);
  const primero = saltarAMomento(s.puntos, 0, 1);
  assert.ok(s.puntos[primero].importante);
  assert.equal(s.puntos[primero].cuando, '2.º cuarto · 14:07');
  assert.equal(saltarAMomento(s.puntos, primero, -1), primero); // no hay ninguno antes: se queda
  const ultimo = saltarAMomento(s.puntos, s.puntos.length - 1, -1);
  assert.equal(s.puntos[ultimo].cuando, '4.º cuarto · 0:34');
  assert.equal(saltarAMomento(s.puntos, ultimo, 1), ultimo);
  // Recorriéndolos todos hacia adelante salen exactamente los momentos marcados.
  let k = 0; let cuenta = 0;
  for (;;) { const sig = saltarAMomento(s.puntos, k, 1); if (sig === k) break; k = sig; cuenta++; }
  assert.equal(cuenta, s.momentos);
});

test('colores: los de cada equipo se distinguen del fondo (3:1) y entre sí, en los dos temas, para los 16 partidos', () => {
  const temas = { oscuro: ['#141d30', '#eef2fa'], claro: ['#ffffff', '#131a2a'] };
  for (const id of IDS) {
    const p = construirPartido(leer(id));
    for (const [tema, [fondo, texto]] of Object.entries(temas)) {
      const c = coloresDeGrafica(p.local, p.visitante, fondo, texto);
      for (const lado of ['local', 'visitante']) {
        assert.match(c[lado], /^#[0-9a-f]{6}$/);
        assert.ok(contraste(c[lado], fondo) >= 3, `${id} ${tema} ${lado}: ${c[lado]} da ${contraste(c[lado], fondo).toFixed(2)}`);
      }
      assert.notEqual(c.local, c.visitante, `${id} ${tema}: los dos equipos con el mismo color`);
    }
  }
  // Equipos sin color (o con datos basura) también reciben uno visible.
  const c = coloresDeGrafica({ color: '', colorAlterno: 'rojo' }, {}, '#141d30', '#eef2fa');
  assert.ok(contraste(c.local, '#141d30') >= 3 && contraste(c.visitante, '#141d30') >= 3);
  // Dos equipos con el mismo azul oscuro: no pueden quedar iguales.
  const iguales = coloresDeGrafica({ color: '#002a5c', colorAlterno: '#69be28' }, { color: '#002a5c', colorAlterno: '#c60c30' }, '#141d30', '#eef2fa');
  assert.notEqual(iguales.local, iguales.visitante);
});
