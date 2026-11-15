// Muestra el relato del narrador de algunas jugadas guardadas, para leerlo con ojos humanos.
// Uso: node herramientas/ver-relatos.mjs [idPartido] [cada]
import { readFileSync } from 'node:fs';
import { construirPartido } from '../js/modelo.js';
import { lineaDeTiempo } from '../js/jugada3d.js';
import { relatoDeJugada } from '../js/narrador.js';

const id = process.argv[2] || '401873052';
const cada = Number(process.argv[3]) || 7;
const p = construirPartido(JSON.parse(readFileSync(new URL(`../datos/partidos/${id}.json`, import.meta.url), 'utf8')));
const ctx = { local: { ...p.ctx.local }, visitante: { ...p.ctx.visitante }, dorsales: p.dorsales };
p.drives.flatMap((d) => d.jugadas).forEach((j, i) => {
  if (i % cada) return;
  const linea = lineaDeTiempo(j, ctx);
  if (!linea) return;
  console.log(`\n#${i} [${linea.forma}, ${linea.duracion}s] ${j.explicacion.original}`);
  for (const f of relatoDeJugada(j, linea, p)) console.log(`   ${f.t.toFixed(1)}s ${f.momento}: ${f.texto}`);
});
