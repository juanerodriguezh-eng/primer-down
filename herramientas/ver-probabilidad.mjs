// Muestra la serie de probabilidad de ganar de los partidos guardados: frase de arriba, cuántos puntos y los momentos importantes.
// Uso: node herramientas/ver-probabilidad.mjs [idPartido ...] [--momentos]
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido } from '../js/modelo.js';
import { serieDeProbabilidad, fraseDeTV, textoDePunto, coloresDeGrafica } from '../js/probabilidad.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'datos', 'partidos');
const args = process.argv.slice(2);
const verMomentos = args.includes('--momentos');
const pedidos = args.filter((a) => /^\d+$/.test(a));
const ids = pedidos.length ? pedidos : readdirSync(DIR).filter((f) => /^\d+\.json$/.test(f)).map((f) => f.replace('.json', ''));
for (const id of ids) {
  const p = construirPartido(JSON.parse(readFileSync(path.join(DIR, `${id}.json`), 'utf8')));
  const s = serieDeProbabilidad(p);
  console.log(`\n${id}  ${p.visitante.nombre} ${p.visitante.puntos}, ${p.local.nombre} ${p.local.puntos}`);
  if (!s) { console.log('  (sin probabilidad de ganar)'); continue; }
  const c = { oscuro: coloresDeGrafica(s.local, s.visitante, '#141d30', '#eef2fa'), claro: coloresDeGrafica(s.local, s.visitante, '#ffffff', '#131a2a') };
  console.log(`  ${fraseDeTV(s)}`);
  console.log(`  ${s.puntos.length} puntos · ${s.momentos} momentos · anotaciones ${s.puntos.filter((x) => x.anotacion).length} · pérdidas ${s.puntos.filter((x) => x.perdida).length} · clave ${s.puntos.filter((x) => x.clave).length} · colores oscuro ${c.oscuro.visitante}/${c.oscuro.local} claro ${c.claro.visitante}/${c.claro.local}`);
  if (verMomentos) for (const x of s.puntos.filter((y) => y.importante)) console.log(`   - ${textoDePunto(x, s)}`);
}
