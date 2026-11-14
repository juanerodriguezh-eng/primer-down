// Gráficos de transmisión de la vista 3D: qué dice el marcador de esquina y el cartel de "3.ª y 7".
// Pura (sin DOM): sale solo de los datos reales de la jugada y del partido. La pinta js/vista3d.js.
// Convención de los datos: yardLine va de 0 (zona de anotación del local) a 100 (la del visitante);
// el local ataca hacia 100 y el visitante hacia 0.

const ORDINAL_CORTO = { 1: '1.ª', 2: '2.ª', 3: '3.ª', 4: '4.ª' };
const ORDINAL_LARGO = { 1: 'Primera', 2: 'Segunda', 3: 'Tercera', 4: 'Cuarta' };
const PERIODO_CORTO = { 1: '1.º', 2: '2.º', 3: '3.º', 4: '4.º' };
const PERIODO_LARGO = { 1: 'primer cuarto', 2: 'segundo cuarto', 3: 'tercer cuarto', 4: 'cuarto cuarto' };
const entero = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

// "3.ª y 7", "1.ª y gol" o '' si la jugada no tiene oportunidad (patadas de salida, intentos extra).
// inicio: el `start` de la jugada de ESPN. idLocal: id del equipo local.
export function textoDeOportunidad(inicio, idLocal, largo = false) {
  const down = entero(inicio?.down);
  const distancia = entero(inicio?.distance);
  const yarda = entero(inicio?.yardLine);
  if (!(down >= 1 && down <= 4) || distancia === null || distancia < 0) return '';
  const ordinal = (largo ? ORDINAL_LARGO : ORDINAL_CORTO)[down];
  const idAtaque = inicio?.team?.id != null ? String(inicio.team.id) : '';
  // Yardas hasta la zona de anotación que se ataca: si alcanzan para menos que la distancia, es "y gol".
  const alGol = yarda === null || !idAtaque ? null : (idAtaque === String(idLocal) ? 100 - yarda : yarda);
  if (alGol !== null && alGol > 0 && distancia >= alGol) return `${ordinal} y gol`;
  if (distancia === 0) return `${ordinal} y pulgadas`;
  return `${ordinal} y ${distancia}`;
}

// Datos del marcador de esquina para una jugada. El marcador que se muestra al empezar es el de ANTES de la
// jugada (ESPN entrega el de después); `puntosDespues` permite actualizarlo cuando la jugada termina.
// Devuelve null si falta el partido o la jugada.
export function graficaDeTV(jugada, partido) {
  if (!jugada || !partido?.local || !partido?.visitante) return null;
  const todas = (partido.drives || []).flatMap((d) => d.jugadas || []);
  const i = todas.findIndex((j) => j === jugada || (j.id && j.id === jugada.id));
  const despues = jugada.marcador || { local: 0, visitante: 0 };
  const antes = i > 0 ? (todas[i - 1].marcador || despues) : i === 0 ? { local: 0, visitante: 0 } : despues;
  // Un marcador nunca baja: si los datos lo hicieran bajar, se muestra el de después desde el principio.
  const coherente = antes.local <= despues.local && antes.visitante <= despues.visitante;
  const idAtaque = jugada.inicio?.team?.id != null ? String(jugada.inicio.team.id) : '';
  const equipo = (e, lado) => ({
    abrev: String(e.abrev || e.nombre || '').toUpperCase().slice(0, 4),
    nombre: e.nombre || e.abrev || '',
    color: e.color || '',
    puntos: coherente ? antes[lado] : despues[lado],
    puntosDespues: despues[lado],
    ataca: !!idAtaque && String(e.id) === idAtaque,
  });
  const visitante = equipo(partido.visitante, 'visitante');
  const local = equipo(partido.local, 'local');
  const periodo = Number(jugada.periodo) || 0;
  const periodoCorto = PERIODO_CORTO[periodo] || (periodo >= 5 ? 'T. E.' : '');
  const periodoLargo = PERIODO_LARGO[periodo] || (periodo >= 5 ? 'tiempo extra' : '');
  const reloj = /^\d{1,2}:\d{2}$/.test(jugada.reloj || '') ? jugada.reloj : '';
  const oportunidad = textoDeOportunidad(jugada.inicio, partido.local.id);
  const oportunidadLarga = textoDeOportunidad(jugada.inicio, partido.local.id, true);
  const partes = [
    `Marcador: ${visitante.nombre} ${visitante.puntos}, ${local.nombre} ${local.puntos}.`,
    [periodoLargo, reloj].filter(Boolean).join(', '),
    oportunidadLarga,
  ].filter(Boolean);
  return {
    visitante, local, periodo: periodoCorto, reloj, oportunidad,
    cambia: visitante.puntos !== visitante.puntosDespues || local.puntos !== local.puntosDespues,
    descripcion: partes.map((x) => (/[.!?]$/.test(x) ? x : `${x.charAt(0).toUpperCase()}${x.slice(1)}.`)).join(' '),
  };
}
