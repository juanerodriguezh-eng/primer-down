// Lee un partido de ESPN (en curso o terminado) con Node y lo pasa por el modelo y la serie de probabilidad.
// Uso: node herramientas/ver-en-vivo.mjs 401873053   (el id sale de la cartelera de ESPN o de la dirección del partido)
import { construirPartido } from '../js/modelo.js';
import { serieDeProbabilidad, fraseDeTV } from '../js/probabilidad.js';
const id = process.argv[2];
const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`);
const s = await r.json();
const st = s.header?.competitions?.[0]?.status;
console.log('estado ESPN:', st?.type?.state, st?.type?.shortDetail);
console.log('winprobability:', Array.isArray(s.winprobability) ? s.winprobability.length : typeof s.winprobability);
console.log('drives.previous:', s.drives?.previous?.length, '· drives.current:', s.drives?.current ? `sí (${s.drives.current.plays?.length} jugadas, id ${s.drives.current.id})` : 'no');
console.log('boxscore.players:', s.boxscore?.players?.length, '· situation:', s.situation ? Object.keys(s.situation).join(',') : 'no');
const jugadasCrudas = [...(s.drives?.previous || []), ...(s.drives?.current ? [s.drives.current] : [])].flatMap((d) => d.plays || []);
const ids = new Set(jugadasCrudas.map((j) => String(j.id)));
const wp = s.winprobability || [];
console.log('jugadas crudas (con repetidas):', jugadasCrudas.length, '· distintas:', ids.size, '· wp con jugada:', wp.filter((w) => ids.has(String(w.playId))).length, '· wp sin jugada:', wp.filter((w) => !ids.has(String(w.playId))).length);
const ult = jugadasCrudas.at(-1);
console.log('última jugada:', ult?.type?.text, '|', (ult?.text || '').slice(0, 80), '| end:', JSON.stringify(ult?.end)?.slice(0, 160), '| wp:', wp.find((w) => String(w.playId) === String(ult?.id))?.homeWinPercentage);
const p = construirPartido(s);
const todas = p.drives.flatMap((d) => d.jugadas);
console.log('modelo: estado', p.estado, '· drives', p.drives.length, '· jugadas', todas.length, '· con prob', todas.filter((j) => j.conProb).length, '· probInicial', p.probInicial, '· dorsales', p.dorsales ? Object.keys(p.dorsales).length : 0);
const serie = serieDeProbabilidad(p);
if (!serie) console.log('serie: null (la sección no aparece)');
else {
  console.log('serie:', serie.puntos.length, 'puntos ·', serie.momentos, 'momentos · total', serie.total, '· cuartos', serie.cuartos.map((c) => c.rotulo).join(' '));
  console.log('frase:', fraseDeTV(serie));
  for (const x of serie.puntos.slice(-4)) console.log('  ', x.cuando, x.pct.visitante, '/', x.pct.local, '|', x.marcador.visitante, '-', x.marcador.local, '|', x.texto.slice(0, 70));
  const ts = serie.puntos.map((x) => x.t); console.log('tiempo nunca retrocede:', ts.every((t, i) => !i || t >= ts[i - 1]), '· ids repetidos:', serie.puntos.length - new Set(serie.puntos.map((x) => x.id)).size);
}
