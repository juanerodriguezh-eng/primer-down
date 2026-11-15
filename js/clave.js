// "Jugadas clave": elige las jugadas que decidieron el partido y arma lo que se muestra entre una y otra.
// Todo es puro (sin DOM ni red). La reproducción en pantalla vive en js/modoclave.js.
import { lineaDeTiempo } from './jugada3d.js';
import { textoPeriodo } from './modelo.js';

const nombreDe = (id, partido) => (id && id === partido.local.id ? partido.local.nombre : id && id === partido.visitante.id ? partido.visitante.nombre : '');
const los = (nombre) => (nombre ? `los ${nombre}` : '');

// ¿Se puede ver esta jugada? (las pausas y las jugadas sin movimiento de balón no tienen recreación)
export function esRecreable(jugada, partido) {
  try { return !!lineaDeTiempo(jugada, { local: partido.ctx.local, visitante: partido.ctx.visitante, dorsales: partido.dorsales || null }); } catch { return false; }
}

const esCuartaConvertida = (j) => j.inicio?.down === 4 && ['pase', 'carrera'].includes(j.explicacion.categoria)
  && !j.explicacion.cambioDePosesion && j.explicacion.conceptos.includes('primer-down');
const esCuartaFallada = (j) => j.explicacion.conceptos.includes('entrega-por-downs');
export const esPerdida = (j) => j.explicacion.categoria === 'perdida' || (j.explicacion.cambioDePosesion && !esCuartaFallada(j) && j.explicacion.categoria !== 'patada');

// Peso de una jugada cuando ESPN no entrega la probabilidad de ganar: anotaciones, pérdidas de balón,
// cuartas oportunidades y ganancias grandes; pesa más cuanto más tarde y más cerrado esté el partido.
export function pesoPorHechos(j, antes) {
  const e = j.explicacion;
  let base = 0;
  if (e.anotacion) base = e.anotacion.puntos >= 6 ? 90 : e.anotacion.puntos === 3 ? 60 : 70;
  else if (esPerdida(j)) base = 80;
  else if (esCuartaFallada(j)) base = 65;
  else if (esCuartaConvertida(j)) base = 55;
  else if (['pase', 'carrera'].includes(e.categoria) && Math.abs(j.yardas ?? 0) >= 20) base = 30 + Math.min(30, Math.abs(j.yardas) / 2);
  if (!base) return 0;
  const tarde = 1 + 0.15 * Math.max(0, Math.min(5, j.periodo || 1) - 1);
  const cerrado = Math.abs(antes.local - antes.visitante) <= 8 ? 1.3 : 1;
  return base * tarde * cerrado;
}

// Una línea que dice por qué pesó la jugada. Sale solo de datos de la jugada y del marcador de antes y de después.
export function motivoDeClave(j, antes, partido, conProbabilidad) {
  const e = j.explicacion;
  const ataque = nombreDe(String(j.inicio?.team?.id ?? ''), partido);
  let hecho = '';
  if (e.anotacion) {
    const idAnota = String(e.anotacion.equipo ?? '');
    const esLocal = idAnota === partido.local.id;
    const quien = nombreDe(idAnota, partido);
    const tipo = e.anotacion.puntos >= 6 ? 'Touchdown' : e.anotacion.puntos === 3 ? 'Gol de campo' : e.anotacion.puntos === 2 ? 'Safety' : 'Anotación';
    const titulo = quien ? `${tipo} de ${los(quien)}` : tipo;
    if (quien) {
      const difAntes = esLocal ? antes.local - antes.visitante : antes.visitante - antes.local;
      const difDespues = esLocal ? j.marcador.local - j.marcador.visitante : j.marcador.visitante - j.marcador.local;
      let efecto;
      if (difAntes < 0 && difDespues > 0) efecto = 'le dio la vuelta al marcador';
      else if (difAntes === 0 && antes.local + antes.visitante === 0) efecto = 'abrió el marcador';
      else if (difAntes === 0 && difDespues > 0) efecto = 'rompió el empate';
      else if (difAntes < 0 && difDespues === 0) efecto = 'empató el partido';
      else if (difAntes < 0) efecto = `los acercó a ${-difDespues === 1 ? '1 punto' : `${-difDespues} puntos`}`;
      else if (difDespues > difAntes) efecto = `amplió su ventaja a ${difDespues}`;
      hecho = efecto ? `${titulo}: ${efecto}.` : `${titulo}.`;
    } else hecho = `${titulo}.`;
  } else if (e.accion === 'intercepcion') {
    hecho = ataque ? `Intercepción: ${los(ataque)} perdieron el balón.` : 'Intercepción: cambio de posesión.';
  } else if (esPerdida(j)) {
    const conNombre = ataque && ['pase-completo', 'carrera', 'captura'].includes(e.accion);
    hecho = conNombre ? `Balón perdido (fumble): ${los(ataque)} se quedaron sin la posesión.` : 'Balón perdido: cambio de posesión.';
  } else if (esCuartaFallada(j)) {
    hecho = ataque ? `Cuarta oportunidad fallada: ${los(ataque)} entregaron el balón.` : 'Cuarta oportunidad fallada: se entrega el balón.';
  } else if (esCuartaConvertida(j)) {
    hecho = ataque ? `Cuarta oportunidad convertida: ${los(ataque)} siguieron con el balón.` : 'Cuarta oportunidad convertida.';
  } else if (e.categoria === 'patada' && e.accion === 'gol-de-campo') {
    hecho = ataque ? `Gol de campo fallado: ${los(ataque)} se fueron sin puntos.` : 'Gol de campo fallado.';
  } else if (['pase', 'carrera'].includes(e.categoria) && (j.yardas ?? 0) >= 15) {
    hecho = `Ganancia de ${j.yardas} yardas${ataque ? ` de ${los(ataque)}` : ''}.`;
  } else if (e.accion === 'captura') {
    hecho = ataque ? `Captura al mariscal de ${los(ataque)}.` : 'Captura al mariscal.';
  } else if (e.categoria === 'pase' && e.accion === 'pase-incompleto') {
    hecho = j.inicio?.down >= 3 ? `Pase incompleto en ${j.inicio.down === 3 ? 'tercera' : 'cuarta'} oportunidad.` : 'Pase incompleto.';
  } else if (j.inicio?.down >= 3 && e.conceptos.includes('primer-down')) {
    hecho = `${j.inicio.down === 3 ? 'Tercera' : 'Cuarta'} oportunidad convertida${ataque ? `: ${los(ataque)} siguieron con el balón` : ''}.`;
  } else if (['pase', 'carrera'].includes(e.categoria) && (j.yardas ?? 0) > 0) {
    hecho = `Avance de ${j.yardas} ${j.yardas === 1 ? 'yarda' : 'yardas'}${ataque ? ` de ${los(ataque)}` : ''}.`;
  }
  const puntos = Math.round(Math.abs(j.cambio || 0) * 100);
  const favorecido = nombreDe(j.favorece, partido);
  const prob = conProbabilidad && puntos >= 1 && favorecido ? `Subió ${puntos} ${puntos === 1 ? 'punto' : 'puntos'} la probabilidad de ganar de ${los(favorecido)}.` : '';
  return [hecho, prob].filter(Boolean).join(' ') || 'Una de las jugadas que más pesó en el partido.';
}

// Las jugadas que decidieron el partido, en orden cronológico. Si el partido trae la probabilidad de ganar
// (winprobability de ESPN) se eligen los mayores cambios; si no, se eligen por hechos (ver pesoPorHechos).
// Cada elemento es la jugada del modelo más: orden, antes (marcador previo), peso, criterio y motivo.
export function elegirJugadasClave(partido, cuantas = 5) {
  if (!partido?.drives) return [];
  const todas = [];
  let antes = { local: 0, visitante: 0 };
  let orden = 0;
  for (const d of partido.drives) {
    for (const j of d.jugadas) {
      todas.push({ ...j, orden: orden++, antes });
      antes = j.marcador;
    }
  }
  const conProbabilidad = todas.some((j) => Math.abs(j.cambio || 0) > 0);
  const candidatas = [];
  for (const j of todas) {
    const e = j.explicacion;
    if (e.categoria === 'pausa' || e.menor || e.accion === 'arrodillarse') continue;
    const hechos = pesoPorHechos(j, j.antes);
    const peso = conProbabilidad ? Math.abs(j.cambio || 0) : hechos;
    if (peso <= 0) continue;
    candidatas.push({ ...j, peso, hechos, criterio: conProbabilidad ? 'probabilidad' : 'hechos' });
  }
  // Mayor peso primero; a igual peso, la que tiene un hecho más fuerte y después la más tardía.
  candidatas.sort((a, b) => b.peso - a.peso || b.hechos - a.hechos || b.orden - a.orden);
  const elegidas = [];
  for (const j of candidatas) {
    if (elegidas.length >= cuantas) break;
    if (!esRecreable(j, partido)) continue; // se mira solo lo que se puede ver
    elegidas.push(j);
  }
  return elegidas
    .sort((a, b) => a.orden - b.orden)
    .map(({ hechos, ...j }) => ({ ...j, motivo: motivoDeClave(j, j.antes, partido, conProbabilidad) }));
}

// Lo que dice la tarjeta de título de cada jugada clave.
export function tarjetaDeClave(clave, indice, total, partido) {
  const cuarto = textoPeriodo(clave.periodo) || 'Partido';
  return {
    titulo: `Jugada clave ${indice + 1} de ${total}`,
    cuando: `${cuarto}${clave.reloj ? ` · ${clave.reloj}` : ''}`,
    marcador: `${partido.visitante.nombre} ${clave.antes.visitante} · ${partido.local.nombre} ${clave.antes.local}`,
    motivo: clave.motivo,
  };
}

// La tarjeta del final: el marcador final del partido.
export function tarjetaFinal(partido) {
  const { local, visitante } = partido;
  const ganador = local.puntos === visitante.puntos ? null : local.puntos > visitante.puntos ? local : visitante;
  return {
    titulo: partido.estado === 'final' ? 'Marcador final' : 'Así va el partido',
    marcador: `${visitante.nombre} ${visitante.puntos} · ${local.nombre} ${local.puntos}`,
    texto: partido.estado !== 'final' ? '' : ganador ? `Ganaron los ${ganador.nombre}.` : 'Terminó empatado.',
  };
}

// Los pasos de la reproducción continua, en orden: por cada jugada, tarjeta de título, la jugada con cámara de
// transmisión, una repetición corta y una cortina; al final, el marcador. Con "reducir movimiento" no hay
// repetición ni cortina.
export function pasosDeClave(total, { sinMovimiento = false } = {}) {
  const pasos = [];
  for (let i = 0; i < total; i++) {
    pasos.push({ tipo: 'titulo', i }, { tipo: 'jugada', i });
    if (!sinMovimiento) pasos.push({ tipo: 'repeticion', i }, { tipo: 'cortina', i });
  }
  pasos.push({ tipo: 'final', i: total });
  return pasos;
}

// Desde qué segundo se muestra la repetición corta: los últimos segundos de la jugada (donde se decide).
export function inicioDeRepeticion(linea, segundos = 3) {
  const duracion = Number(linea?.duracion) || 0;
  return Math.max(0, Math.round((duracion - segundos) * 100) / 100);
}
