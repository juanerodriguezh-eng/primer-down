// Imprime el resumen final ("Así se ganó el partido") de los partidos guardados, para leerlo y juzgar el texto.
// Uso: node herramientas/ver-resumenes.mjs [id ...]   (sin ids: todos)
import { readFileSync } from 'node:fs';
import { construirPartido, construirResumen } from '../js/modelo.js';

const raiz = new URL('../datos/partidos/', import.meta.url);
const indice = JSON.parse(readFileSync(new URL('indice.json', raiz), 'utf8'));
const pedidos = process.argv.slice(2);
for (const item of indice.partidos) {
  if (pedidos.length && !pedidos.includes(item.id)) continue;
  const resumen = construirResumen(construirPartido(JSON.parse(readFileSync(new URL(`${item.id}.json`, raiz), 'utf8'))));
  console.log(`--- ${item.id} ---\n${resumen ? resumen.texto : '(sin resumen)'}\n`);
}
