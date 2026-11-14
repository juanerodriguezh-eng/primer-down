// Genera pruebas/jugadas-reales.json: una muestra fija de jugadas reales (hasta 6 por cada type.text)
// con el mismo contexto que arma el sitio. Así las pruebas no dependen de los 25 MB de datos/.
// Uso: node herramientas/generar-casos.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './cargar-datos.mjs';
import { jugadasConContexto } from './recorrer-con-contexto.mjs';

const POR_TIPO = 6;

// Jugadas concretas que las pruebas revisan por nombre. Se buscan por un trozo de su texto original
// (o con una función) y se toma la primera que aparezca.
const CON_NOMBRE = {
  'gol-de-campo-46': 'J.Slye 46 yard field goal is GOOD',
  'gol-fallado-56': 'C.Boswell 56 yard field goal is No Good, Wide Right',
  intercepcion: 'INTERCEPTED by H.Smith at MIN 44',
  'td-pase-con-extra': 'M.Willis pass short left to M.Washington for 1 yard, TOUCHDOWN',
  'offside-anula-intercepcion': 'INTERCEPTED by C.Elliss at MIA 44',
  invasion: 'PENALTY on NE-C.Durden, Encroachment',
  'interferencia-defensiva': 'PENALTY on JAX-J.Lewis, Defensive Pass Interference, 9 yards',
  'despeje-con-regreso': 'K.Kroeger punts 52 yards to NYG 13',
  'patada-touchback': 'C.Dicker kicks 65 yards from LAC 35 to end zone, Touchback to the BUF 35',
  'captura-compartida': 'sack split by T.Settle and K.Chaisson',
  'tercera-fallida': 'W.Marks right tackle to HST 17 for 1 yard',
  'tiempo-fuera': 'Timeout #2 by JAX at 00:34',
  'penal-rechazado': 'Penalty on LA-J.Wallace, Defensive Pass Interference, declined',
  'recepcion-y-carrera': 'G.Minshew pass short left to T.Allgeier to DAL 3 for 17 yards',
  'carrera-con-perdida': 'C.Lamb left end to DAL 26 for -6 yards',
  'conversion-de-2-buena': (j) => /TWO-POINT CONVERSION ATTEMPT/.test(j.text) && /ATTEMPT SUCCEEDS/.test(j.text),
  'conversion-de-2-fallada': (j) => /TWO-POINT CONVERSION ATTEMPT/.test(j.text) && /ATTEMPT FAILS/.test(j.text),
  'punto-extra-fallado': (j) => /extra point is No Good/.test(j.text),
  'balon-clavado': (j) => /spiked the ball/.test(j.text),
  rodilla: (j) => /kneels/.test(j.text),
  'cuarta-jugada-y-convertida': (j) => j.start?.down === 4 && j.type?.text === 'Rush' && j.end?.down === 1 && j.start?.team?.id === j.end?.team?.id && !/PENALTY|kneels|punt/i.test(j.text),
  'cuarta-jugada-y-fallada': (j) => j.start?.down === 4 && j.type?.text === 'Pass Incompletion' && !/PENALTY|spiked/i.test(j.text),
  'revision-revertida': (j) => /and the play was REVERSED/.test(j.text),
  'patada-corta': (j) => /onside/i.test(j.text) && j.type?.text === 'Kickoff',
};
const porTipo = new Map();
const conNombre = {};
for (const { jugada, ctx, partido } of jugadasConContexto()) {
  for (const [nombre, regla] of Object.entries(CON_NOMBRE)) {
    if (conNombre[nombre]) continue;
    if (typeof regla === 'string' ? (jugada.text || '').includes(regla) : regla(jugada)) conNombre[nombre] = { tipo: jugada.type?.text, partido: partido.id, jugada, ctx };
  }
  const tipo = jugada.type?.text || '(sin tipo)';
  if (!porTipo.has(tipo)) porTipo.set(tipo, []);
  porTipo.get(tipo).push({ partido: partido.id, jugada, ctx });
}
const casos = [];
for (const [tipo, lista] of [...porTipo].sort((a, b) => a[0].localeCompare(b[0]))) {
  const paso = Math.max(1, Math.floor(lista.length / POR_TIPO));
  for (let i = 0, n = 0; i < lista.length && n < POR_TIPO; i += paso, n++) casos.push({ tipo, ...lista[i] });
}
mkdirSync(path.join(RAIZ, 'pruebas'), { recursive: true });
const destino = path.join(RAIZ, 'pruebas', 'jugadas-reales.json');
writeFileSync(destino, JSON.stringify({ generado: 'node herramientas/generar-casos.mjs', tipos: porTipo.size, casos, conNombre }));
const faltan = Object.keys(CON_NOMBRE).filter((n) => !conNombre[n]);
if (faltan.length) console.log('OJO, sin encontrar: ' + faltan.join(', '));
console.log(`Escrito ${path.relative(RAIZ, destino)}: ${casos.length} jugadas de ${porTipo.size} tipos`);
