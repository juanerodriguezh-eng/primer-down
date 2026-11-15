// Convierte un partido terminado en uno "en curso": lo corta en la jugada n y le pone el estado en progreso.
// Sirve para probar el modo en vivo sin un partido real (pruebas con Node y partido.html?fuente=simulado).
// Pura: no toca el partido original.
//
// No sabemos con certeza cómo entrega ESPN el drive actual en vivo, así que se simulan tres formas:
//   'con-current'      el drive en curso viene solo en drives.current
//   'current-repetido' el drive en curso viene en drives.current y también al final de drives.previous
//   'sin-current'      no hay drives.current: el drive en curso es el último de drives.previous, sin resultado
export const FORMAS_EN_VIVO = ['con-current', 'current-repetido', 'sin-current'];

const copiar = (x) => JSON.parse(JSON.stringify(x));

export function simularEnCurso(summary, n, { forma = 'con-current' } = {}) {
  const previos = Array.isArray(summary?.drives?.previous) ? summary.drives.previous : [];
  const total = previos.reduce((s, d) => s + (d.plays?.length || 0), 0);
  const hasta = Math.max(0, Math.min(total, Math.floor(Number(n) || 0)));
  if (hasta >= total) return copiar(summary); // ya terminó: el partido tal como quedó guardado

  const drives = [];
  let cuenta = 0;
  let ultima = null;
  for (const d of previos) {
    if (cuenta >= hasta) break;
    const plays = (d.plays || []).slice(0, hasta - cuenta);
    cuenta += plays.length;
    if (!plays.length) continue;
    ultima = plays[plays.length - 1];
    // Un drive a medias no tiene resultado, final ni totales.
    drives.push(plays.length === (d.plays || []).length
      ? copiar(d)
      : copiar({ id: d.id, description: '', team: d.team, start: d.start, plays }));
  }

  const header = copiar(summary.header || {});
  const comp = header.competitions?.[0];
  if (comp) {
    comp.status = hasta === 0
      ? { type: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled' }, period: 0, displayClock: '0:00' }
      : { type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress' },
          period: ultima?.period?.number || 1, displayClock: ultima?.clock?.displayValue || '' };
    for (const c of comp.competitors || []) {
      delete c.winner;
      delete c.linescores;
      const puntos = c.homeAway === 'home' ? ultima?.homeScore : ultima?.awayScore;
      c.score = String(typeof puntos === 'number' ? puntos : 0);
    }
  }

  const incluidas = new Set(drives.flatMap((d) => d.plays.map((p) => String(p.id))));
  // Se conservan los datos de las jugadas incluidas y los que no son de ninguna jugada (el pronóstico previo al partido).
  const todas = new Set(previos.flatMap((d) => (d.plays || []).map((p) => String(p.id))));
  const winprobability = (summary.winprobability || []).filter((w) => incluidas.has(String(w.playId)) || !todas.has(String(w.playId)));

  let salida;
  if (forma === 'sin-current' || !drives.length) salida = { previous: drives };
  else if (forma === 'current-repetido') salida = { previous: drives, current: copiar(drives[drives.length - 1]) };
  else salida = { previous: drives.slice(0, -1), current: drives[drives.length - 1] };
  return { header, drives: salida, winprobability };
}
