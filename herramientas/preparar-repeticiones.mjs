// Crea las copias aligeradas de los partidos guardados para el modo repetición:
//   datos/partidos/{id}.json  (misma forma que el summary de ESPN, pero sin noticias, videos, logos ni estadísticas)
//   datos/partidos/indice.json (lista para la portada)
// Uso: node herramientas/preparar-repeticiones.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './cargar-datos.mjs';
import { compactarJugada } from './ampliar-corpus.mjs';
import { dorsalesDe } from '../js/modelo.js';

const ORIGEN = path.join(RAIZ, 'datos', 'crudos');
const DESTINO = path.join(RAIZ, 'datos', 'partidos');

const equipoLigero = (t) => t && {
  id: t.id, location: t.location, name: t.name, abbreviation: t.abbreviation, displayName: t.displayName,
  color: t.color, alternateColor: t.alternateColor,
};

export function aligerar(s) {
  const comp = s.header.competitions[0];
  return {
    header: {
      id: s.header.id,
      season: s.header.season,
      week: s.header.week,
      competitions: [{
        id: comp.id,
        date: comp.date,
        status: comp.status,
        competitors: comp.competitors.map((c) => ({
          id: c.id, homeAway: c.homeAway, winner: c.winner, score: c.score, linescores: c.linescores,
          record: (c.record || []).filter((r) => r.type === 'total').map((r) => ({ type: r.type, summary: r.summary })),
          team: equipoLigero(c.team),
        })),
      }],
    },
    drives: {
      previous: (s.drives?.previous ?? []).map((d) => ({
        id: d.id, description: d.description,
        team: d.team && { id: d.team.id, name: d.team.name, abbreviation: d.team.abbreviation },
        start: d.start, end: d.end, timeElapsed: d.timeElapsed, yards: d.yards, isScore: d.isScore,
        offensivePlays: d.offensivePlays, result: d.result, displayResult: d.displayResult,
        plays: (d.plays ?? []).map(compactarJugada),
      })),
    },
    dorsales: dorsalesDe(s), // { idEquipo: { 'J.Daniels': '5' } }: número real de camiseta para la recreación de la jugada
    winprobability: (s.winprobability ?? []).map((w) => ({ playId: w.playId, homeWinPercentage: w.homeWinPercentage })),
  };
}

mkdirSync(DESTINO, { recursive: true });
const indice = [];
let bytes = 0;
for (const f of readdirSync(ORIGEN).filter((x) => x.startsWith('summary-') && x.endsWith('.json')).sort()) {
  const s = JSON.parse(readFileSync(path.join(ORIGEN, f), 'utf8'));
  const ligero = aligerar(s);
  const texto = JSON.stringify(ligero);
  writeFileSync(path.join(DESTINO, `${ligero.header.id}.json`), texto);
  bytes += texto.length;
  const comp = ligero.header.competitions[0];
  const lado = (ha) => {
    const c = comp.competitors.find((x) => x.homeAway === ha);
    return { id: c.team.id, abrev: c.team.abbreviation, nombre: c.team.name, ciudad: c.team.location, puntos: Number(c.score), color: /^[0-9a-f]{6}$/i.test(c.team.color || '') ? `#${c.team.color}` : '', gano: !!c.winner };
  };
  indice.push({
    id: ligero.header.id, fecha: comp.date, semana: ligero.header.week,
    local: lado('home'), visitante: lado('away'),
    jugadas: ligero.drives.previous.reduce((n, d) => n + d.plays.length, 0),
  });
}
indice.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
writeFileSync(path.join(DESTINO, 'indice.json'), JSON.stringify({ generado: new Date().toISOString(), partidos: indice }, null, 1));
console.log(`Escritos ${indice.length} partidos en datos/partidos (${(bytes / 1024).toFixed(0)} KB en total) + indice.json`);
