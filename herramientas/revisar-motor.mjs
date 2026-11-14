// Pasa el motor por todas las jugadas guardadas y reporta errores, jugadas sin explicación
// específica y una muestra para leer a ojo.
// Uso:
//   node herramientas/revisar-motor.mjs                 -> resumen
//   node herramientas/revisar-motor.mjs muestra 30 7    -> 30 explicaciones al azar (semilla 7)
//   node herramientas/revisar-motor.mjs tipo "Punt" 12  -> 12 ejemplos de un tipo
//   node herramientas/revisar-motor.mjs buscar "texto"  -> jugadas cuyo original o explicación contiene el texto
import { explicarJugadaEstricta, explicarSituacion } from '../js/motor.js';
import { jugadasConContexto } from './recorrer-con-contexto.mjs';

const [modo = 'resumen', a1, a2] = process.argv.slice(2);

function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function mostrar({ jugada, ctx }, e) {
  const sit = jugada.start?.downDistanceText || '';
  console.log(`\n[${jugada.type?.text}] ${ctx.visitante.abrev} @ ${ctx.local.abrev} · Q${jugada.period?.number} ${jugada.clock?.displayValue}${sit ? ' · ' + sit : ''}`);
  console.log(`  EN: ${jugada.text}`);
  console.log(`  ES: (${e.categoria} / ${e.etiqueta}) ${e.explicacion}`);
  if (e.porQue) console.log(`  ¿POR QUÉ? ${e.porQue.texto}`);
  console.log(`  conceptos: ${e.conceptos.join(', ')}${e.destacada ? ' · DESTACADA' : ''}`);
}

const todas = [...jugadasConContexto()];

if (modo === 'resumen') {
  const errores = []; const desconocidas = new Map(); const categorias = new Map(); const etiquetas = new Map();
  let largas = 0; let total = 0; const ejemplosDesc = [];
  for (const item of todas) {
    total++;
    let e;
    try { e = explicarJugadaEstricta(item.jugada, item.ctx); }
    catch (err) { errores.push({ texto: item.jugada.text, tipo: item.jugada.type?.text, err: err.stack.split('\n').slice(0, 3).join(' | ') }); continue; }
    categorias.set(e.categoria, (categorias.get(e.categoria) || 0) + 1);
    etiquetas.set(e.etiqueta, (etiquetas.get(e.etiqueta) || 0) + 1);
    if ((e.accion === 'desconocida' && e.categoria === 'otro') || /Todavía no tenemos/.test(e.explicacion) || /undefined|NaN|null|\[object/.test(e.explicacion + (e.porQue?.texto || ''))) {
      const k = item.jugada.type?.text;
      desconocidas.set(k, (desconocidas.get(k) || 0) + 1);
      if (ejemplosDesc.length < 40) ejemplosDesc.push(`${k} :: ${item.jugada.text} => ${e.explicacion}`);
    }
    if (e.explicacion.length > 420) largas++;
    explicarSituacion(item.jugada.end, item.ctx);
  }
  console.log(`Jugadas: ${total} · errores: ${errores.length} · sin acción reconocida o con texto sospechoso: ${[...desconocidas.values()].reduce((a, b) => a + b, 0)} · explicaciones de más de 420 caracteres: ${largas}`);
  console.log('Categorías:', [...categorias].sort((a, b) => b[1] - a[1]).map((x) => x.join(': ')).join(' · '));
  console.log('Etiquetas:', [...etiquetas].sort((a, b) => b[1] - a[1]).map((x) => x.join(': ')).join(' · '));
  if (desconocidas.size) console.log('Sin acción por tipo:', [...desconocidas].map((x) => x.join(': ')).join(' · '));
  ejemplosDesc.forEach((x) => console.log('  ? ' + x.slice(0, 330)));
  errores.slice(0, 15).forEach((x) => console.log('  ERROR ' + x.tipo + ' :: ' + x.texto.slice(0, 160) + '\n     ' + x.err));
  process.exitCode = errores.length ? 1 : 0;
} else if (modo === 'muestra') {
  const n = Number(a1 || 30); const r = azar(Number(a2 || 1));
  for (let i = 0; i < n; i++) { const item = todas[Math.floor(r() * todas.length)]; mostrar(item, explicarJugadaEstricta(item.jugada, item.ctx)); }
} else if (modo === 'tipo') {
  const delTipo = todas.filter((x) => x.jugada.type?.text === a1); const n = Number(a2 || 10); const paso = Math.max(1, Math.floor(delTipo.length / n));
  for (let i = 0; i < delTipo.length && i / paso < n; i += paso) mostrar(delTipo[i], explicarJugadaEstricta(delTipo[i].jugada, delTipo[i].ctx));
} else if (modo === 'buscar') {
  let n = 0; const max = Number(a2 || 12);
  for (const item of todas) {
    const e = explicarJugadaEstricta(item.jugada, item.ctx);
    if ((item.jugada.text || '').includes(a1) || e.explicacion.includes(a1) || (e.porQue?.texto || '').includes(a1)) { mostrar(item, e); if (++n >= max) break; }
  }
}
