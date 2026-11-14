// Pruebas de la parte pura de La Pizarra (js/pizarra.js) con los partidos guardados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { construirPartido } from '../js/modelo.js';
import { trazoDeJugada } from '../js/pizarra.js';

const carpeta = new URL('../datos/partidos/', import.meta.url);
const leer = (id) => construirPartido(JSON.parse(readFileSync(new URL(`${id}.json`, carpeta), 'utf8')));
const jueves = leer('401873052'); // Commanders 24, Giants 21 (los Giants son locales)
const jugadas = (p) => p.drives.flatMap((d) => d.jugadas);
const buscar = (p, trozo) => jugadas(p).find((j) => (j.explicacion.original || '').includes(trozo));

test('carrera del local: línea hacia la derecha, con scrimmage y línea a conseguir', () => {
  const j = buscar(jueves, 'C.Skattebo right guard to NYG 37 for 9 yards');
  const t = trazoDeJugada(j, jueves.ctx);
  assert.equal(t.forma, 'carrera');
  assert.equal(t.haciaDerecha, true);
  assert.equal(t.desde, 28);
  assert.equal(t.hasta, 37);
  assert.equal(t.scrimmage, 28);
  assert.equal(t.marca, 35);
  assert.match(t.descripcion, /por tierra de la yarda 28 de los Giants a la yarda 37 de los Giants: 9 yardas hacia la derecha\./);
});

test('pase completo: arco', () => {
  const t = trazoDeJugada(buscar(jueves, 'pass short left to C.Skattebo to NYG 28 for 3 yards'), jueves.ctx);
  assert.equal(t.forma, 'pase');
  assert.equal(t.hasta - t.desde, 3);
  assert.match(t.descripcion, /por aire/);
});

test('pase incompleto: se dibuja el intento hacia adelante aunque el balón no cambie de lugar', () => {
  const j = buscar(jueves, 'J.McCarthy pass incomplete short left [C.Omenihu]');
  const t = trazoDeJugada(j, jueves.ctx);
  assert.equal(t.forma, 'pase-incompleto');
  assert.equal(t.resultado, 'incompleto');
  assert.ok(t.hasta > t.desde, 'el local ataca hacia la derecha');
  assert.match(t.descripcion, /nadie atrapa/);
});

test('captura: el balón va hacia atrás', () => {
  const t = trazoDeJugada(buscar(jueves, 'J.McCarthy sacked at NYG 25 for -10 yards'), jueves.ctx);
  assert.equal(t.forma, 'carrera');
  assert.equal(t.hasta, 25);
  assert.match(t.descripcion, /10 yardas hacia la izquierda \(hacia atrás\)/);
});

test('el visitante ataca hacia la izquierda', () => {
  const t = trazoDeJugada(buscar(jueves, 'J.Daniels pass short middle to B.Sinnott for 1 yard, TOUCHDOWN'), jueves.ctx);
  assert.equal(t.haciaDerecha, false);
  assert.equal(t.hasta, 0);
  assert.equal(t.marca, null, 'en primero y gol no hay línea a conseguir');
  assert.match(t.descripcion, /zona de anotación de los Giants/);
});

test('gol de campo: va a los postes, bueno o fallado', () => {
  const bueno = trazoDeJugada(buscar(jueves, 'D.Stevens 46 yard field goal is GOOD'), jueves.ctx);
  assert.equal(bueno.forma, 'gol-de-campo');
  assert.equal(bueno.resultado, 'bueno');
  assert.equal(bueno.hasta, 0);
  const fallado = trazoDeJugada(buscar(jueves, 'D.Zvada 33 yard field goal is No Good'), jueves.ctx);
  assert.equal(fallado.resultado, 'fallado');
  assert.equal(fallado.hasta, 100);
  assert.match(fallado.descripcion, /no entra/);
});

test('despeje y patada de salida: patada, sin línea a conseguir en la patada de salida', () => {
  const despeje = trazoDeJugada(buscar(jueves, 'J.Stout punts 34 yards to WAS 8'), jueves.ctx);
  assert.equal(despeje.forma, 'patada');
  assert.equal(despeje.hasta, 92);
  const salida = trazoDeJugada(buscar(jueves, 'D.Stevens kicks 64 yards from WAS 35 to NYG 1. G.Desrosiers to NYG 25'), jueves.ctx);
  assert.equal(salida.forma, 'patada');
  assert.equal(salida.scrimmage, null);
  assert.equal(salida.marca, null);
});

test('pausas y datos incompletos no se animan y no rompen', () => {
  assert.equal(trazoDeJugada(buscar(jueves, 'Two-Minute Warning'), jueves.ctx), null);
  assert.equal(trazoDeJugada(buscar(jueves, 'END GAME'), jueves.ctx), null);
  assert.equal(trazoDeJugada(null, jueves.ctx), null);
  assert.equal(trazoDeJugada({}, jueves.ctx), null);
  assert.equal(trazoDeJugada({ inicio: { yardLine: 'x' }, explicacion: {} }, jueves.ctx), null);
  assert.equal(trazoDeJugada({ inicio: { yardLine: 20, team: { id: '1' } }, fin: { yardLine: 30 }, explicacion: { categoria: 'carrera' } }, null), null);
});

test('barrido de los partidos guardados: todo trazo es válido y la mayoría de las jugadas se puede animar', () => {
  const ids = readdirSync(carpeta).filter((n) => /^\d+\.json$/.test(n)).map((n) => n.replace('.json', ''));
  assert.ok(ids.length >= 2);
  let total = 0; let animables = 0; let deAtaque = 0; let deAtaqueAnimables = 0;
  const formas = new Set();
  for (const id of ids) {
    const p = leer(id);
    for (const j of jugadas(p)) {
      total++;
      const t = trazoDeJugada(j, p.ctx);
      const esDeAtaque = ['pase', 'carrera', 'anotacion', 'patada', 'perdida'].includes(j.explicacion.categoria);
      if (esDeAtaque) deAtaque++;
      if (!t) continue;
      animables++;
      if (esDeAtaque) deAtaqueAnimables++;
      formas.add(t.forma);
      assert.ok(t.desde >= 0 && t.desde <= 100 && t.hasta >= 0 && t.hasta <= 100, `fuera de la cancha: ${j.explicacion.original}`);
      assert.notEqual(t.desde, t.hasta, `sin movimiento: ${j.explicacion.original}`);
      assert.ok(t.descripcion.length > 20);
      assert.doesNotMatch(t.descripcion, /undefined|NaN|null|\s{2}/, j.explicacion.original);
      if (t.marca !== null) assert.ok(t.marca > 0 && t.marca < 100);
    }
  }
  for (const f of ['pase', 'pase-incompleto', 'carrera', 'patada', 'gol-de-campo']) assert.ok(formas.has(f), `falta la forma ${f}`);
  assert.ok(deAtaqueAnimables / deAtaque > 0.9, `solo ${deAtaqueAnimables} de ${deAtaque} jugadas de balón se pueden animar`);
  console.log(`  pizarra: ${animables} de ${total} jugadas con animación (${deAtaqueAnimables} de ${deAtaque} jugadas de balón); formas: ${[...formas].join(', ')}`);
});
