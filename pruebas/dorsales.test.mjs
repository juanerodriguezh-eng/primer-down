// Pruebas de los dorsales reales: salen del boxscore de ESPN y solo se muestran cuando no hay duda de a quién pertenecen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido, dorsalesDe, claveDorsal } from '../js/modelo.js';
import { lineaDeTiempo } from '../js/jugada3d.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'datos', 'partidos');
const leer = (f) => JSON.parse(readFileSync(path.join(CARPETA, f), 'utf8'));
const atleta = (firstName, lastName, jersey) => ({ athlete: { firstName, lastName, jersey } });
const boxscore = (...equipos) => ({ boxscore: { players: equipos.map(([id, ...atletas]) => ({ team: { id }, statistics: [{ name: 'passing', athletes: atletas }] })) } });

test('claveDorsal: sin espacios ni sufijos', () => {
  assert.equal(claveDorsal('M.Penix Jr.'), 'M.Penix');
  assert.equal(claveDorsal('M. Penix'), 'M.Penix');
  assert.equal(claveDorsal('K.Walker III'), 'K.Walker');
  assert.equal(claveDorsal('J.Daniels'), 'J.Daniels');
  assert.equal(claveDorsal(null), '');
});

test('dorsalesDe: arma el mapa por equipo con la forma en que el texto nombra al jugador', () => {
  const d = dorsalesDe(boxscore(['28', atleta('Jayden', 'Daniels', '5'), atleta('Michael', 'Penix Jr.', '9')]));
  assert.equal(d['28']['J.Daniels'], '5');
  assert.equal(d['28']['M.Penix'], '9');
  assert.equal(d['28']['Ja.Daniels'], '5', 'la liga usa dos letras cuando hay dos jugadores con la misma inicial');
});

test('dorsalesDe: dos jugadores con la misma inicial y apellido se quedan sin dorsal con una letra, pero no con dos', () => {
  const d = dorsalesDe(boxscore(['22', atleta('Michael', 'Wilson', '14'), atleta('Marco', 'Wilson', '1'), atleta('Kyler', 'Murray', '1')]));
  assert.equal(d['22']['M.Wilson'], undefined, 'no se adivina cuál de los dos es');
  assert.equal(d['22']['Mi.Wilson'], '14');
  assert.equal(d['22']['Ma.Wilson'], '1');
  assert.equal(d['22']['K.Murray'], '1');
});

test('dorsalesDe: datos basura no rompen y no inventan números', () => {
  for (const basura of [null, undefined, {}, { boxscore: null }, { boxscore: { players: 'x' } }, { boxscore: { players: [{ team: {}, statistics: [{ athletes: [{}] }] }] } }]) {
    assert.deepEqual(dorsalesDe(basura), {});
  }
  const d = dorsalesDe(boxscore(['5', atleta('Sin', 'Numero', ''), atleta('Numero', 'Raro', 'abc'), atleta('', 'SinNombre', '12'), atleta('Bien', 'Puesto', '7')]));
  assert.deepEqual(Object.keys(d['5']).sort(), ['B.Puesto', 'Bi.Puesto']);
});

test('los partidos guardados traen dorsales y el partido los entrega', () => {
  const p = construirPartido(leer('401873052.json'));
  assert.equal(p.dorsales[p.visitante.id]['J.Daniels'], '5');
  assert.ok(Object.keys(p.dorsales[p.local.id]).length > 20);
});

test('un partido sin boxscore (por ejemplo, en vivo si ESPN no lo manda) sigue funcionando: rótulos sin número', () => {
  const crudo = leer('401873052.json');
  delete crudo.dorsales;
  const p = construirPartido(crudo);
  assert.deepEqual(p.dorsales, {});
  const j = p.drives.flatMap((d) => d.jugadas).find((x) => /pass short/.test(x.explicacion.original));
  const linea = lineaDeTiempo(j, { local: p.ctx.local, visitante: p.ctx.visitante, dorsales: p.dorsales });
  assert.ok(linea.rotulos.length >= 1);
  for (const r of linea.rotulos) assert.equal(r.numero, '');
});

test('barrido: casi todos los protagonistas llevan su dorsal real y ningún rótulo es un texto mal recortado', () => {
  let con = 0; let sin = 0;
  for (const f of readdirSync(CARPETA).filter((x) => /^\d+\.json$/.test(x))) {
    const p = construirPartido(leer(f));
    const validos = new Set(Object.values(p.dorsales).flatMap((m) => Object.values(m)));
    for (const j of p.drives.flatMap((d) => d.jugadas)) {
      const linea = lineaDeTiempo(j, { local: p.ctx.local, visitante: p.ctx.visitante, dorsales: p.dorsales });
      if (!linea) continue;
      for (const r of linea.rotulos) {
        assert.ok(r.nombre.length <= 26 && !/ (to|for|at) /.test(r.nombre), `rótulo sospechoso: "${r.nombre}"`);
        if (r.numero === '') { sin++; continue; }
        con++;
        assert.ok(validos.has(r.numero), `dorsal ${r.numero} de ${r.nombre} no está en el boxscore`);
      }
    }
  }
  console.log(`      ${con} rótulos con dorsal real, ${sin} sin número`);
  assert.ok(con / (con + sin) > 0.97, `solo ${con} de ${con + sin} rótulos tienen dorsal`);
});
