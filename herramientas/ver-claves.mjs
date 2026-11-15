// Muestra las jugadas clave que se eligen en cada partido guardado, con y sin la probabilidad de ganar de ESPN.
//   node herramientas/ver-claves.mjs [idPartido ...]
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido } from '../js/modelo.js';
import { elegirJugadasClave, tarjetaDeClave, tarjetaFinal } from '../js/clave.js';

const CARPETA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'datos', 'partidos');
const pedidos = process.argv.slice(2);
const archivos = readdirSync(CARPETA).filter((f) => /^\d+\.json$/.test(f) && (!pedidos.length || pedidos.includes(f.replace('.json', ''))));
for (const f of archivos) {
  const summary = JSON.parse(readFileSync(path.join(CARPETA, f), 'utf8'));
  for (const [nombre, s] of [['con probabilidad', summary], ['sin probabilidad', { ...summary, winprobability: undefined }]]) {
    const p = construirPartido(s);
    const claves = elegirJugadasClave(p);
    const fin = tarjetaFinal(p);
    console.log(`\n=== ${f.replace('.json', '')} · ${fin.marcador} · ${nombre} ===`);
    claves.forEach((c, i) => {
      const t = tarjetaDeClave(c, i, claves.length, p);
      console.log(`${i + 1}. ${t.cuando} | ${t.marcador}\n   ${t.motivo}\n   ${c.explicacion.original.slice(0, 110)}`);
    });
  }
}
