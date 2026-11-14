// Pruebas del modelo con los partidos guardados para el modo repetición (datos/partidos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido, construirCartelera, contarJugadas, jugadasClave, textoPeriodo, construirResumen, separarFrases } from '../js/modelo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p) => JSON.parse(readFileSync(path.join(RAIZ, ...p), 'utf8'));
const indice = leer('datos', 'partidos', 'indice.json');
const jueves = leer('datos', 'partidos', '401873052.json'); // Commanders 24, Giants 21 (12 nov 2026)

test('el índice de repeticiones tiene al menos 2 partidos y cada uno tiene su archivo', () => {
  assert.ok(indice.partidos.length >= 2);
  for (const p of indice.partidos) {
    assert.ok(existsSync(path.join(RAIZ, 'datos', 'partidos', `${p.id}.json`)), `falta datos/partidos/${p.id}.json`);
    assert.ok(p.local.nombre && p.visitante.nombre && p.fecha);
  }
});

test('las copias aligeradas no traen logos ni enlaces de ESPN', () => {
  for (const f of readdirSync(path.join(RAIZ, 'datos', 'partidos')).filter((x) => /^\d+\.json$/.test(x))) {
    const texto = readFileSync(path.join(RAIZ, 'datos', 'partidos', f), 'utf8');
    assert.doesNotMatch(texto, /espncdn|logos|\.png/, `${f} trae logos`);
  }
});

test('partido completo: marcador final, equipos y drives', () => {
  const p = construirPartido(jueves);
  assert.equal(p.estado, 'final');
  assert.equal(p.local.nombre, 'Giants');
  assert.equal(p.visitante.nombre, 'Commanders');
  assert.equal(p.local.puntos, 21);
  assert.equal(p.visitante.puntos, 24);
  assert.equal(p.visitante.gano, true);
  assert.equal(p.jugadasIncluidas, p.totalJugadas);
  assert.equal(p.totalJugadas, contarJugadas(jueves));
  assert.equal(p.drives[0].resumen.texto, 'Avance de los Giants: 7 jugadas, 33 yardas, terminó en despeje (punt).');
  assert.equal(p.situacion, null);
  for (const d of p.drives) for (const j of d.jugadas) assert.ok(j.explicacion.explicacion.length > 0);
});

test('modo repetición: avanza jugada por jugada como si fuera en vivo', () => {
  const cero = construirPartido(jueves, { hasta: 0 });
  assert.equal(cero.estado, 'programado');
  assert.equal(cero.drives.length, 0);
  assert.deepEqual([cero.local.puntos, cero.visitante.puntos], [0, 0]);

  const una = construirPartido(jueves, { hasta: 1 });
  assert.equal(una.estado, 'en-vivo');
  assert.equal(una.drives[0].resumen.texto, 'Avance de los Giants: acaba de empezar.');

  const dos = construirPartido(jueves, { hasta: 2 });
  assert.equal(dos.jugadasIncluidas, 2);
  assert.equal(dos.drives[0].enCurso, true);
  assert.equal(dos.situacion.titulo, '2.ª y 7 en la yarda 28 de los Giants');
  assert.match(dos.situacion.texto, /Segunda oportunidad: a los Giants les faltan 7 yardas/);
  assert.equal(dos.situacion.punto.equipoId, '19');
  assert.equal(dos.periodoTexto, '1.er cuarto');

  const todas = construirPartido(jueves, { hasta: 9999 });
  assert.equal(todas.estado, 'final');
  assert.deepEqual([todas.local.puntos, todas.visitante.puntos], [21, 24]);
});

test('modo repetición: el marcador nunca baja y ningún paso rompe', () => {
  const total = contarJugadas(jueves);
  let antes = 0;
  for (let n = 0; n <= total; n++) {
    const p = construirPartido(jueves, { hasta: n });
    const suma = p.local.puntos + p.visitante.puntos;
    assert.ok(suma >= antes, `el marcador bajó en la jugada ${n}`);
    antes = suma;
    assert.equal(p.jugadasIncluidas, n);
    if (p.situacion) assert.doesNotMatch(p.situacion.texto, /undefined|NaN/);
  }
});

test('jugadas clave: salen de la probabilidad de ganar y vienen en orden', () => {
  const p = construirPartido(jueves);
  const claves = jugadasClave(p, 5);
  assert.ok(claves.length >= 3 && claves.length <= 5);
  for (let i = 1; i < claves.length; i++) assert.ok(claves[i].orden > claves[i - 1].orden);
  assert.ok(claves.some((j) => /Touchdown de los Commanders/.test(j.explicacion.explicacion)));
  assert.ok(p.drives.flatMap((d) => d.jugadas).some((j) => j.clave));
});

test('el aviso de zona roja sale como mucho una vez por serie', () => {
  for (const { id } of indice.partidos) {
    const p = construirPartido(leer('datos', 'partidos', `${id}.json`));
    for (const d of p.drives) {
      assert.ok(d.jugadas.filter((j) => j.explicacion.porQue?.clave === 'zona-roja').length <= 1);
    }
  }
});

test('todos los partidos guardados se construyen completos', () => {
  for (const item of indice.partidos) {
    const p = construirPartido(leer('datos', 'partidos', `${item.id}.json`));
    assert.equal(p.estado, 'final');
    assert.equal(p.local.puntos, item.local.puntos);
    assert.equal(p.visitante.puntos, item.visitante.puntos);
    assert.ok(p.drives.length > 10);
  }
});

test('datos vacíos o rotos no rompen el modelo', () => {
  const rotos = [null, undefined, {}, { header: {} }, { header: { competitions: [{}] }, drives: { previous: [null, { plays: null }, { plays: [null, {}] }] } }];
  for (const s of rotos) {
    const p = construirPartido(s);
    assert.ok(Array.isArray(p.drives));
    assert.equal(typeof p.local.nombre, 'string');
  }
  assert.deepEqual(construirCartelera(null).partidos, []);
  assert.deepEqual(construirCartelera({ events: [{}] }).partidos, []);
});

test('drives.current (en vivo) se agrega sin duplicar', () => {
  const previos = jueves.drives.previous.slice(0, 3);
  const actual = { ...jueves.drives.previous[3], plays: jueves.drives.previous[3].plays.slice(0, 2), displayResult: undefined, result: undefined };
  const comp = { ...jueves.header.competitions[0], status: { type: { state: 'in' }, period: 1, displayClock: '2:10' } };
  const enVivo = { ...jueves, header: { ...jueves.header, competitions: [comp] }, drives: { previous: previos, current: actual } };
  const p = construirPartido(enVivo);
  assert.equal(p.estado, 'en-vivo');
  assert.equal(p.drives.length, 4);
  assert.equal(p.drives[3].enCurso, true);
  assert.equal(p.reloj, '2:10');
  assert.ok(p.situacion && p.situacion.texto.length > 0);
  const repetido = construirPartido({ ...enVivo, drives: { previous: [...previos, actual], current: actual } });
  assert.equal(repetido.drives.length, 4);
});

const rutaCartelera = path.join(RAIZ, 'datos', 'crudos', 'scoreboard-semana-10.json');
test('cartelera de la semana 10: 14 partidos, programados antes que los finales', { skip: !existsSync(rutaCartelera) && 'no hay datos crudos' }, () => {
  const c = construirCartelera(JSON.parse(readFileSync(rutaCartelera, 'utf8')));
  assert.equal(c.semana, 10);
  assert.equal(c.partidos.length, 14);
  const final = c.partidos.find((p) => p.id === '401873052');
  assert.equal(final.estado, 'final');
  assert.deepEqual([final.visitante.nombre, final.visitante.puntos, final.local.nombre, final.local.puntos], ['Commanders', 24, 'Giants', 21]);
  assert.equal(c.partidos[c.partidos.length - 1].estado, 'final');
  assert.equal(c.partidos[0].estado, 'programado');
});

test('separar frases no corta en las iniciales de los jugadores', () => {
  assert.deepEqual(separarFrases('I. Likely atrapa el pase de J. McCarthy. ¡Touchdown de los Giants! Vale 6 puntos.'),
    ['I. Likely atrapa el pase de J. McCarthy.', '¡Touchdown de los Giants!', 'Vale 6 puntos.']);
  assert.deepEqual(separarFrases('¡Intercepción! J. Holland atrapa el pase. Ahora atacan los Giants.'),
    ['¡Intercepción!', 'J. Holland atrapa el pase.', 'Ahora atacan los Giants.']);
  assert.deepEqual(separarFrases('Bandera contra los Patriots (Dr. Jones): fuera de lugar. Son 5 yardas.'),
    ['Bandera contra los Patriots (Dr. Jones): fuera de lugar.', 'Son 5 yardas.']);
  assert.deepEqual(separarFrases(''), []);
});

test('resumen final: cada jugada clave se lee completa', () => {
  const r = construirResumen(construirPartido(jueves));
  assert.equal(r.titulo, 'Así se ganó el partido');
  assert.equal(r.cabecera, 'Commanders 24, Giants 21. Las jugadas que más movieron el partido:');
  assert.ok(r.lineas.length >= 3 && r.lineas.length <= 5);
  for (const linea of r.lineas) {
    assert.match(linea, /^(\d\.(er|º) cuarto|Tiempo extra), \d+:\d\d: /);
    assert.ok(linea.length > 60, `línea demasiado corta: ${linea}`);
    assert.match(linea, /[.!?]$/);
  }
  assert.ok(r.lineas.some((l) => /I\. Likely atrapa el pase profundo .* ¡Touchdown de los Giants!$/.test(l)));
  assert.ok(r.lineas.some((l) => /¡Intercepción! J\. Holland atrapa/.test(l)));
  assert.match(r.texto, /Explicado por Primer Down$/);
  assert.equal(construirResumen(construirPartido(jueves, { hasta: 50 })), null);
  for (const item of indice.partidos) {
    const resumen = construirResumen(construirPartido(leer('datos', 'partidos', `${item.id}.json`)));
    assert.ok(resumen && resumen.lineas.length >= 1, `sin resumen: ${item.id}`);
    for (const linea of resumen.lineas) assert.ok(linea.length > 40, `línea demasiado corta en ${item.id}: ${linea}`);
  }
});

test('nombres de los periodos', () => {
  assert.equal(textoPeriodo(1), '1.er cuarto');
  assert.equal(textoPeriodo(4), '4.º cuarto');
  assert.equal(textoPeriodo(5), 'Tiempo extra');
  assert.equal(textoPeriodo(0), '');
});
