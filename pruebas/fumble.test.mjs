// Texto de los balones sueltos (fumbles): cuando el mismo defensor lo provoca y lo recupera, su nombre se dice una sola vez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { construirPartido } from '../js/modelo.js';

const carpeta = new URL('../datos/partidos/', import.meta.url);
const partidos = readdirSync(carpeta).filter((a) => /^\d+\.json$/.test(a)).map((a) => construirPartido(JSON.parse(readFileSync(new URL(a, carpeta), 'utf8'))));
const explicaciones = partidos.flatMap((p) => p.drives.flatMap((d) => d.jugadas)).map((j) => j.explicacion);

test('el mismo jugador fuerza y recupera el balón: se cuenta con naturalidad', () => {
  const e = explicaciones.find((x) => (x.original || '').includes('FUMBLES (N.Bonitto) [N.Bonitto], RECOVERED by DEN-N.'));
  assert.ok(e, 'no está la jugada de N. Bonitto en los partidos guardados');
  assert.match(e.explicacion, /N\. Bonitto le quita el balón \(fumble\) y él mismo lo recupera para los Broncos: cambio de posesión\./);
  assert.doesNotMatch(e.explicacion, /forzado por N\. Bonitto y lo recupera N\. Bonitto/);
  assert.equal(e.cambioDePosesion, true);
});

test('barrido de los partidos guardados: ningún nombre repetido en "forzado por X y lo recupera X"', () => {
  let conFumble = 0;
  let elMismo = 0;
  for (const e of explicaciones) {
    if (!/fumble/i.test(e.explicacion)) continue;
    conFumble++;
    const m = /forzado por ([^,.:]+?) y lo recupera ([^,.:]+?) para/.exec(e.explicacion);
    if (m) assert.notEqual(m[1].trim(), m[2].trim(), `nombre repetido: ${e.explicacion}`);
    if (/le quita el balón \(fumble\) y él mismo lo recupera/.test(e.explicacion)) elMismo++;
    assert.ok(!/undefined|null|NaN/.test(e.explicacion), `texto roto: ${e.explicacion}`);
  }
  assert.ok(conFumble >= 10, `solo ${conFumble} jugadas con fumble`);
  assert.ok(elMismo >= 2);
  console.log(`      ${conFumble} jugadas con fumble (${elMismo} forzadas y recuperadas por el mismo jugador)`);
});

test('cuando son dos jugadores distintos, se nombran los dos', () => {
  const e = explicaciones.find((x) => /forzado por .+ y lo recupera .+ para/.test(x.explicacion));
  assert.ok(e, 'no hay ningún fumble forzado por uno y recuperado por otro');
});
