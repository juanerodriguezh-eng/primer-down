// Recorre las jugadas de los partidos guardados armando el mismo contexto que usa el sitio
// (equipos, equipo del drive y marcador antes de la jugada). Lo usan las pruebas y las herramientas.
import { cargarTodos } from './cargar-datos.mjs';

export function contextoDePartido(partido) {
  const pick = (ha) => {
    const e = partido.equipos.find((x) => x.homeAway === ha) || {};
    return { id: String(e.id ?? ''), abrev: e.abbreviation || '', nombre: e.name || '', ciudad: e.location || '' };
  };
  return { local: pick('home'), visitante: pick('away') };
}

// Genera { partido, drive, jugada, ctx, indiceDrive, indiceJugada } para cada jugada.
export function* jugadasConContexto(partidos = cargarTodos()) {
  for (const partido of partidos) {
    const base = contextoDePartido(partido);
    let marcador = { local: 0, visitante: 0 };
    for (let d = 0; d < partido.drives.length; d++) {
      const drive = partido.drives[d];
      for (let i = 0; i < drive.plays.length; i++) {
        const jugada = drive.plays[i];
        const ctx = { ...base, equipoDrive: drive.team?.id ? String(drive.team.id) : '', marcadorAntes: { ...marcador } };
        yield { partido, drive, jugada, ctx, indiceDrive: d, indiceJugada: i };
        if (typeof jugada.homeScore === 'number' && typeof jugada.awayScore === 'number') {
          marcador = { local: jugada.homeScore, visitante: jugada.awayScore };
        }
      }
    }
  }
}
