// Descarga scoreboards y summaries de la API pública de ESPN a datos/crudos/.
// Uso:  node herramientas/descargar.mjs <semana> [<semana> ...]
// Solo toca los dos endpoints de la especificación. Sin dependencias.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CRUDOS = path.join(RAIZ, 'datos', 'crudos');
const TEMPORADA = 2026;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function traer(url) {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.error(`  intento ${intento} falló (${e.message}) -> ${url}`);
      if (intento === 3) throw e;
      await esperar(2000 * intento);
    }
  }
}

async function existe(ruta) {
  try { await access(ruta); return true; } catch { return false; }
}

const semanas = process.argv.slice(2).map(Number).filter(Boolean);
if (!semanas.length) {
  console.error('Indica al menos una semana. Ej: node herramientas/descargar.mjs 9 10');
  process.exit(1);
}

await mkdir(CRUDOS, { recursive: true });

for (const semana of semanas) {
  const url = `${BASE}/scoreboard?dates=${TEMPORADA}&seasontype=2&week=${semana}`;
  const texto = await traer(url);
  const sb = JSON.parse(texto);
  await writeFile(path.join(CRUDOS, `scoreboard-semana-${semana}.json`), texto);
  console.log(`Semana ${semana}: ${sb.events.length} partidos`);
  for (const ev of sb.events) {
    const terminado = ev.status?.type?.completed === true;
    if (!terminado) { console.log(`  ${ev.id} ${ev.shortName}: no terminado, se omite`); continue; }
    const destino = path.join(CRUDOS, `summary-${ev.id}.json`);
    if (await existe(destino)) { console.log(`  ${ev.id} ${ev.shortName}: ya estaba`); continue; }
    const cuerpo = await traer(`${BASE}/summary?event=${ev.id}`);
    JSON.parse(cuerpo); // valida que sea JSON antes de guardar
    await writeFile(destino, cuerpo);
    console.log(`  ${ev.id} ${ev.shortName}: ${(cuerpo.length / 1024).toFixed(0)} KB`);
    await esperar(700); // sin prisa: es una API pública
  }
}
