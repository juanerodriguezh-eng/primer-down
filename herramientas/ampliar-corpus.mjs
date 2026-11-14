// Recorre semanas completas de la temporada SIN guardar el JSON crudo (pesaría ~75 MB)
// y extrae solo las jugadas, en formato compacto, a datos/corpus/semana-N.json.
// Sirve para descubrir tipos de jugada raros y para las pruebas del motor.
// Uso:  node herramientas/ampliar-corpus.mjs 1 2 3 4 5 6 7 8
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(RAIZ, 'datos', 'corpus');
const TEMPORADA = 2026;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function traerJSON(url) {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`  intento ${intento} falló (${e.message}) -> ${url}`);
      if (intento === 3) throw e;
      await esperar(2000 * intento);
    }
  }
}

// Deja solo lo que el motor necesita de cada jugada.
export function compactarJugada(p) {
  const limpiarPunto = (x) => x && {
    down: x.down, distance: x.distance, yardLine: x.yardLine, yardsToEndzone: x.yardsToEndzone,
    downDistanceText: x.downDistanceText, possessionText: x.possessionText, team: x.team && { id: x.team.id },
  };
  const j = {
    id: p.id, type: p.type, text: p.text, period: p.period, clock: p.clock,
    awayScore: p.awayScore, homeScore: p.homeScore, scoringPlay: p.scoringPlay,
    isPenalty: p.isPenalty, isTurnover: p.isTurnover, statYardage: p.statYardage,
    start: limpiarPunto(p.start), end: limpiarPunto(p.end),
  };
  for (const k of ['yardsAfterCatch', 'scoringType', 'pointAfterAttempt', 'penalty', 'review']) {
    if (p[k] !== undefined) j[k] = p[k];
  }
  return j;
}

export function compactarPartido(s) {
  const comp = s.header.competitions[0];
  const equipos = comp.competitors.map((c) => ({
    id: c.team.id, homeAway: c.homeAway, abbreviation: c.team.abbreviation,
    name: c.team.name, location: c.team.location, score: c.score,
  }));
  const drives = (s.drives?.previous ?? []).map((d) => ({
    id: d.id, team: d.team && { id: d.team.id, abbreviation: d.team.abbreviation },
    description: d.description, result: d.result, displayResult: d.displayResult,
    yards: d.yards, isScore: d.isScore, offensivePlays: d.offensivePlays,
    plays: (d.plays ?? []).map(compactarJugada),
  }));
  return { id: s.header.id, date: comp.date, equipos, drives };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const semanas = process.argv.slice(2).map(Number).filter(Boolean);
  await mkdir(CORPUS, { recursive: true });
  for (const semana of semanas) {
    const destino = path.join(CORPUS, `semana-${semana}.json`);
    try { await access(destino); console.log(`Semana ${semana}: ya estaba`); continue; } catch {}
    const sb = await traerJSON(`${BASE}/scoreboard?dates=${TEMPORADA}&seasontype=2&week=${semana}`);
    const partidos = [];
    for (const ev of sb.events) {
      if (ev.status?.type?.completed !== true) continue;
      try {
        const s = await traerJSON(`${BASE}/summary?event=${ev.id}`);
        partidos.push(compactarPartido(s));
      } catch (e) {
        console.error(`  ${ev.id} ${ev.shortName}: no se pudo (${e.message})`);
      }
      await esperar(500);
    }
    await writeFile(destino, JSON.stringify({ semana, partidos }));
    const n = partidos.reduce((a, p) => a + p.drives.reduce((b, d) => b + d.plays.length, 0), 0);
    console.log(`Semana ${semana}: ${partidos.length} partidos, ${n} jugadas`);
  }
}
