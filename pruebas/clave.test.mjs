// Pruebas de "Jugadas clave" (parte pura): qué jugadas se eligen, por qué, y los pasos de la reproducción.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido } from '../js/modelo.js';
import { simularEnCurso } from '../js/simulador.js';
import { elegirJugadasClave, tarjetaDeClave, tarjetaFinal, pasosDeClave, inicioDeRepeticion, esRecreable, pesoPorHechos } from '../js/clave.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'datos', 'partidos');
const crudo = (f) => JSON.parse(readFileSync(path.join(CARPETA, f), 'utf8'));
const archivos = readdirSync(CARPETA).filter((f) => /^\d+\.json$/.test(f));
const sinProb = (s) => ({ ...s, winprobability: undefined });
const jueves = construirPartido(crudo('401873052.json'));
const todas = (p) => p.drives.flatMap((d) => d.jugadas);

test('con probabilidad de ganar: las 5 jugadas que más la movieron, en orden cronológico', () => {
  const claves = elegirJugadasClave(jueves);
  assert.equal(claves.length, 5);
  assert.ok(claves.every((c) => c.criterio === 'probabilidad'));
  assert.deepEqual(claves.map((c) => c.orden), [...claves.map((c) => c.orden)].sort((a, b) => a - b));
  // Ninguna jugada que se pueda ver y haya quedado fuera movió más el partido que la menor de las elegidas.
  const minimo = Math.min(...claves.map((c) => Math.abs(c.cambio)));
  const ids = new Set(claves.map((c) => c.id));
  for (const j of todas(jueves)) {
    if (ids.has(j.id) || j.explicacion.categoria === 'pausa' || j.explicacion.menor || !esRecreable(j, jueves)) continue;
    assert.ok(Math.abs(j.cambio) <= minimo + 1e-9, `quedó fuera una jugada que movió más: ${j.explicacion.original}`);
  }
  // El partido del jueves se decidió con el touchdown de Diggs a 0:57 del final.
  const diggs = claves.find((c) => /S\.Diggs for 32 yards, TOUCHDOWN/.test(c.explicacion.original));
  assert.ok(diggs);
  assert.deepEqual(diggs.antes, { local: 21, visitante: 17 }); // los Giants son locales
  assert.equal(diggs.motivo, 'Touchdown de los Commanders: le dio la vuelta al marcador. Subió 49 puntos la probabilidad de ganar de los Commanders.');
});

test('sin probabilidad de ganar: se eligen anotaciones, pérdidas de balón, cuartas oportunidades y ganancias grandes', () => {
  const p = construirPartido(sinProb(crudo('401873052.json')));
  const claves = elegirJugadasClave(p);
  assert.equal(claves.length, 5);
  assert.ok(claves.every((c) => c.criterio === 'hechos'));
  for (const c of claves) {
    const e = c.explicacion;
    const hecho = e.anotacion || e.cambioDePosesion || c.inicio?.down === 4 || Math.abs(c.yardas ?? 0) >= 20;
    assert.ok(hecho, `jugada sin hecho de peso: ${e.original}`);
    assert.doesNotMatch(c.motivo, /probabilidad/);
  }
  assert.ok(claves.some((c) => /S\.Diggs for 32 yards, TOUCHDOWN/.test(c.explicacion.original)), 'el touchdown que le dio la vuelta al final tiene que estar');
  assert.ok(claves.some((c) => c.motivo === 'Intercepción: los Giants perdieron el balón.'));
});

test('peso por hechos: pesa más lo que pasa tarde y con el marcador cerrado', () => {
  const td = todas(jueves).find((j) => j.explicacion.anotacion?.puntos >= 6);
  const temprano = pesoPorHechos({ ...td, periodo: 1 }, { local: 0, visitante: 0 });
  const tarde = pesoPorHechos({ ...td, periodo: 4 }, { local: 0, visitante: 0 });
  const paliza = pesoPorHechos({ ...td, periodo: 4 }, { local: 35, visitante: 7 });
  assert.ok(tarde > temprano && tarde > paliza);
  const pausa = todas(jueves).find((j) => j.explicacion.categoria === 'pausa');
  assert.equal(pesoPorHechos(pausa, { local: 0, visitante: 0 }), 0);
});

test('los 16 partidos guardados, con y sin probabilidad: 5 jugadas, en orden, que se pueden ver y con su motivo', () => {
  let total = 0;
  for (const f of archivos) {
    for (const s of [crudo(f), sinProb(crudo(f))]) {
      const p = construirPartido(s);
      const claves = elegirJugadasClave(p);
      assert.equal(claves.length, 5, `${f}: ${claves.length} jugadas clave`);
      assert.equal(new Set(claves.map((c) => c.id)).size, 5, `${f}: jugadas repetidas`);
      let previo = -1;
      claves.forEach((c, i) => {
        assert.ok(c.orden > previo, `${f}: fuera de orden`);
        previo = c.orden;
        assert.ok(esRecreable(c, p), `${f}: no se puede ver ${c.explicacion.original}`);
        assert.notEqual(c.explicacion.categoria, 'pausa');
        const t = tarjetaDeClave(c, i, claves.length, p);
        assert.equal(t.titulo, `Jugada clave ${i + 1} de 5`);
        assert.match(t.cuando, /cuarto|tiempo extra/i);
        assert.match(t.marcador, /^\S.* \d+ · \S.* \d+$/);
        assert.ok(t.motivo.length >= 12 && t.motivo.length <= 150, `${f}: motivo de ${t.motivo.length} caracteres: ${t.motivo}`);
        assert.doesNotMatch(t.motivo, /undefined|null|NaN|los \.|de \./);
        // El marcador de la tarjeta es el de antes de la jugada: nunca supera al de después.
        assert.ok(c.antes.local <= c.marcador.local && c.antes.visitante <= c.marcador.visitante);
        total++;
      });
      // El motivo de una anotación nombra al equipo que de verdad sumó puntos.
      for (const c of claves.filter((x) => x.explicacion.anotacion && /^(Touchdown|Gol de campo|Safety) de los /.test(x.motivo))) {
        const sumoLocal = c.marcador.local > c.antes.local;
        const nombre = sumoLocal ? p.local.nombre : p.visitante.nombre;
        assert.ok(c.motivo.includes(`de los ${nombre}`), `${f}: ${c.motivo} / ${c.explicacion.original}`);
      }
    }
  }
  console.log(`      ${total} jugadas clave revisadas en ${archivos.length} partidos (con y sin probabilidad)`);
});

test('partido en curso o con pocas jugadas: devuelve las que haya, sin romperse', () => {
  const s = crudo('401873052.json');
  const temprano = elegirJugadasClave(construirPartido(simularEnCurso(s, 12)));
  assert.ok(temprano.length <= 5);
  assert.deepEqual(elegirJugadasClave(construirPartido(simularEnCurso(s, 0))), []);
  assert.deepEqual(elegirJugadasClave(null), []);
  assert.deepEqual(elegirJugadasClave(construirPartido({})), []);
  assert.equal(elegirJugadasClave(jueves, 3).length, 3);
});

test('tarjeta final: marcador final y ganador', () => {
  assert.deepEqual(tarjetaFinal(jueves), { titulo: 'Marcador final', marcador: 'Commanders 24 · Giants 21', texto: 'Ganaron los Commanders.' });
  const enCurso = tarjetaFinal(construirPartido(simularEnCurso(crudo('401873052.json'), 60)));
  assert.equal(enCurso.titulo, 'Así va el partido');
  assert.equal(enCurso.texto, '');
});

test('pasos de la reproducción: título, jugada, repetición y cortina por cada una, y el marcador al final', () => {
  const pasos = pasosDeClave(2);
  assert.deepEqual(pasos.map((x) => `${x.tipo}${x.i}`), ['titulo0', 'jugada0', 'repeticion0', 'cortina0', 'titulo1', 'jugada1', 'repeticion1', 'cortina1', 'final2']);
  // Con "reducir movimiento" no hay repetición ni cortina.
  assert.deepEqual(pasosDeClave(2, { sinMovimiento: true }).map((x) => x.tipo), ['titulo', 'jugada', 'titulo', 'jugada', 'final']);
  assert.deepEqual(pasosDeClave(0).map((x) => x.tipo), ['final']);
});

test('la repetición corta muestra solo el final de la jugada', () => {
  assert.equal(inicioDeRepeticion({ duracion: 8 }), 5);
  assert.equal(inicioDeRepeticion({ duracion: 2.2 }), 0);
  assert.equal(inicioDeRepeticion(null), 0);
});
