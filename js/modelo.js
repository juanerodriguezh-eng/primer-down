// Modelo: convierte las respuestas de ESPN (scoreboard y summary) en objetos listos para pintar.
// Funciones puras: sin DOM y sin red. Las usan la portada, la vista de partido y el modo repetición.
import { explicarJugada, explicarSituacion, resumirDrive } from './motor.js';

// Cuánto tiene que moverse la probabilidad de ganar para marcar una jugada como clave.
const UMBRAL_CLAVE = 0.12;
const UMBRAL_CLAVE_ANOTACION = 0.07;

const ESTADOS = { pre: 'programado', in: 'en-vivo', post: 'final' };

export function textoPeriodo(n) {
  return { 1: '1.er cuarto', 2: '2.º cuarto', 3: '3.er cuarto', 4: '4.º cuarto' }[Number(n)] || (Number(n) >= 5 ? 'Tiempo extra' : '');
}

function numero(x, respaldo = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : respaldo;
}

// Un competidor de ESPN -> equipo en español, sin logos.
function equipoDesde(c) {
  const t = c?.team || {};
  const record = Array.isArray(c?.record) ? c.record.find((r) => r.type === 'total')?.summary : (Array.isArray(c?.records) ? c.records.find((r) => r.type === 'total')?.summary : '');
  return {
    id: String(t.id ?? c?.id ?? ''),
    abrev: t.abbreviation || '',
    nombre: t.name || t.shortDisplayName || t.displayName || '',
    ciudad: t.location || '',
    color: /^[0-9a-f]{6}$/i.test(t.color || '') ? `#${t.color}` : '',
    colorAlterno: /^[0-9a-f]{6}$/i.test(t.alternateColor || '') ? `#${t.alternateColor}` : '',
    puntos: numero(c?.score),
    gano: c?.winner === true,
    record: record || '',
  };
}

function ladosDe(competitors) {
  const lista = Array.isArray(competitors) ? competitors : [];
  return {
    local: equipoDesde(lista.find((c) => c?.homeAway === 'home') || lista[0]),
    visitante: equipoDesde(lista.find((c) => c?.homeAway === 'away') || lista[1]),
  };
}

function estadoDe(status) {
  const tipo = status?.type || {};
  return ESTADOS[tipo.state] || (tipo.completed ? 'final' : 'programado');
}

// ---------------------------------------------------------------------------
// Portada: partidos de la semana
// ---------------------------------------------------------------------------

const ORDEN_ESTADO = { 'en-vivo': 0, programado: 1, final: 2 };

export function construirCartelera(scoreboard) {
  const eventos = Array.isArray(scoreboard?.events) ? scoreboard.events : [];
  const partidos = eventos.map((ev) => {
    const comp = ev?.competitions?.[0] || {};
    const status = comp.status || ev?.status || {};
    const { local, visitante } = ladosDe(comp.competitors);
    const estado = estadoDe(status);
    const sit = comp.situation || null;
    return {
      id: String(ev?.id ?? ''),
      estado,
      fecha: ev?.date || comp.date || '',
      periodo: numero(status.period),
      periodoTexto: textoPeriodo(status.period),
      reloj: status.displayClock || '',
      medioTiempo: status?.type?.name === 'STATUS_HALFTIME',
      local,
      visitante,
      posesion: sit?.possession ? String(sit.possession) : '',
      situacionCorta: sit?.downDistanceText || '',
    };
  }).filter((p) => p.id);
  partidos.sort((a, b) => (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]) || String(a.fecha).localeCompare(String(b.fecha)));
  return { semana: numero(scoreboard?.week?.number) || null, partidos };
}

// ---------------------------------------------------------------------------
// Vista de partido
// ---------------------------------------------------------------------------

// Junta drives.previous y drives.current sin repetir nada. En vivo no sabemos con certeza cómo llega el drive
// en curso (solo en current, repetido en previous o sin current), así que se toleran las tres formas:
// si el drive actual ya está entre los previos gana la copia con más jugadas, y una jugada con el mismo id
// nunca se cuenta dos veces.
function drivesDe(summary) {
  const previos = Array.isArray(summary?.drives?.previous) ? summary.drives.previous.filter((d) => d && typeof d === 'object') : [];
  const actual = summary?.drives?.current;
  let lista = previos;
  if (actual && typeof actual === 'object' && !Array.isArray(actual)) {
    const primera = actual.plays?.[0]?.id;
    const i = previos.findIndex((d) => (d.id != null && actual.id != null && String(d.id) === String(actual.id))
      || (primera != null && d.plays?.[0]?.id != null && String(d.plays[0].id) === String(primera)));
    if (i === -1) lista = [...previos, actual];
    else if ((actual.plays?.length || 0) >= (previos[i].plays?.length || 0)) { lista = [...previos]; lista[i] = actual; }
  }
  const vistas = new Set();
  return lista.map((d) => {
    const original = Array.isArray(d.plays) ? d.plays : [];
    const plays = original.filter((p) => {
      if (!p || typeof p !== 'object') return false;
      if (p.id == null) return true;
      const id = String(p.id);
      if (vistas.has(id)) return false;
      vistas.add(id);
      return true;
    });
    return plays.length === original.length && Array.isArray(d.plays) ? d : { ...d, plays };
  });
}

export function contarJugadas(summary) {
  return drivesDe(summary).reduce((n, d) => n + (Array.isArray(d.plays) ? d.plays.length : 0), 0);
}

// Resumen de un drive que todavía no termina (en vivo o en plena repetición): cuenta lo que va.
function driveParcial(drive, jugadas, ctx) {
  const deAtaque = jugadas.filter((j) => ['pase', 'carrera', 'perdida', 'anotacion'].includes(j.explicacion.categoria) && j.inicio?.down >= 1);
  const primera = jugadas.find((j) => typeof j.inicio?.yardLine === 'number' && j.inicio?.down >= 1);
  const ultima = jugadas[jugadas.length - 1];
  let yardas = 0;
  const equipoId = String(drive?.team?.id ?? '');
  if (primera && ultima && typeof ultima.fin?.yardLine === 'number' && String(ultima.fin?.team?.id ?? '') === equipoId && ctx.local.id) {
    const avance = ultima.fin.yardLine - primera.inicio.yardLine;
    yardas = equipoId === ctx.local.id ? avance : -avance;
  } else {
    yardas = deAtaque.reduce((n, j) => n + numero(j.yardas), 0);
  }
  const resumen = resumirDrive({ team: drive?.team, offensivePlays: deAtaque.length, yards: yardas }, ctx);
  // Si todavía no hubo ninguna jugada de ataque (solo la patada de salida), "0 jugadas, 0 yardas" no dice nada.
  if (!deAtaque.length) resumen.texto = resumen.texto.replace(/:.*$/, ': acaba de empezar.');
  return resumen;
}

// summary: respuesta de ESPN (o la copia aligerada de datos/partidos).
// opciones.hasta: número de jugadas a mostrar (modo repetición). Sin él, se muestran todas.
export function construirPartido(summary, opciones = {}) {
  const comp = summary?.header?.competitions?.[0] || {};
  const { local, visitante } = ladosDe(comp.competitors);
  const ctxBase = {
    local: { id: local.id, abrev: local.abrev, nombre: local.nombre, ciudad: local.ciudad },
    visitante: { id: visitante.id, abrev: visitante.abrev, nombre: visitante.nombre, ciudad: visitante.ciudad },
  };
  const drivesCrudos = drivesDe(summary);
  const total = drivesCrudos.reduce((n, d) => n + (Array.isArray(d.plays) ? d.plays.length : 0), 0);
  const enRepeticion = typeof opciones.hasta === 'number';
  const limite = enRepeticion ? Math.max(0, Math.min(total, Math.floor(opciones.hasta))) : total;

  const prob = new Map();
  for (const w of Array.isArray(summary?.winprobability) ? summary.winprobability : []) {
    if (w?.playId != null && typeof w.homeWinPercentage === 'number') prob.set(String(w.playId), w.homeWinPercentage);
  }

  const drives = [];
  let marcador = { local: 0, visitante: 0 };
  let probLocal = prob.size ? 0.5 : null;
  let incluidas = 0;
  let ultima = null;

  for (const d of drivesCrudos) {
    if (incluidas >= limite) break;
    const plays = Array.isArray(d.plays) ? d.plays : [];
    const jugadas = [];
    let avisoZonaRoja = false;
    for (const play of plays) {
      if (incluidas >= limite) break;
      incluidas++;
      const ctx = { ...ctxBase, equipoDrive: d.team?.id ? String(d.team.id) : '', marcadorAntes: { ...marcador } };
      const explicacion = explicarJugada(play, ctx);
      // El aviso de "entran a la zona roja" solo una vez por serie.
      if (explicacion.porQue?.clave === 'zona-roja') {
        if (avisoZonaRoja) explicacion.porQue = null;
        avisoZonaRoja = true;
      }
      if (typeof play?.homeScore === 'number' && typeof play?.awayScore === 'number') {
        marcador = { local: play.homeScore, visitante: play.awayScore };
      }
      let cambio = 0;
      const p = play?.id != null ? prob.get(String(play.id)) : undefined;
      if (typeof p === 'number') {
        cambio = probLocal === null ? 0 : p - probLocal;
        probLocal = p;
      }
      const clave = Math.abs(cambio) >= UMBRAL_CLAVE || (!!explicacion.anotacion && Math.abs(cambio) >= UMBRAL_CLAVE_ANOTACION);
      const jugada = {
        id: String(play?.id ?? `${d.id}-${jugadas.length}`),
        explicacion,
        periodo: numero(play?.period?.number),
        reloj: play?.clock?.displayValue || '',
        marcador: { ...marcador },
        inicio: play?.start || null,
        fin: play?.end || null,
        yardas: typeof play?.statYardage === 'number' ? play.statYardage : null,
        probLocal,
        cambio,
        // A quién favoreció el cambio de probabilidad.
        favorece: cambio > 0 ? local.id : cambio < 0 ? visitante.id : '',
        clave,
      };
      jugadas.push(jugada);
      ultima = jugada;
    }
    if (!jugadas.length) continue;
    const completo = jugadas.length === plays.length && !!(d.displayResult || d.result);
    const ctxDrive = ctxBase;
    const resumen = completo ? resumirDrive(d, ctxDrive) : driveParcial(d, jugadas, ctxDrive);
    drives.push({ id: String(d.id ?? drives.length), equipoId: d.team?.id ? String(d.team.id) : '', resumen, enCurso: !completo, jugadas });
  }

  const estadoReal = estadoDe(comp.status);
  const terminoLaRepeticion = enRepeticion && limite >= total;
  const estado = enRepeticion ? (terminoLaRepeticion ? 'final' : limite === 0 ? 'programado' : 'en-vivo') : estadoReal;

  let periodo; let reloj;
  if (enRepeticion || estadoReal !== 'en-vivo') {
    periodo = ultima?.periodo || 0;
    reloj = ultima?.reloj || '';
  } else {
    periodo = numero(comp.status?.period) || ultima?.periodo || 0;
    reloj = comp.status?.displayClock || ultima?.reloj || '';
  }

  const puntos = enRepeticion || !comp.competitors
    ? marcador
    : { local: estadoReal === 'programado' ? 0 : (Number.isFinite(Number(comp.competitors.find((c) => c.homeAway === 'home')?.score)) ? local.puntos : marcador.local),
        visitante: estadoReal === 'programado' ? 0 : (Number.isFinite(Number(comp.competitors.find((c) => c.homeAway === 'away')?.score)) ? visitante.puntos : marcador.visitante) };

  // Situación actual: sale de cómo terminó la última jugada.
  let situacion = null;
  if (estado === 'en-vivo' && ultima?.fin) {
    const s = explicarSituacion(ultima.fin, ctxBase);
    if (s.texto) {
      situacion = {
        ...s,
        punto: { down: numero(ultima.fin.down), distancia: numero(ultima.fin.distance), yardLine: numero(ultima.fin.yardLine, null), equipoId: String(ultima.fin.team?.id ?? '') },
      };
    }
  }

  return {
    id: String(summary?.header?.id ?? comp.id ?? ''),
    estado,
    enRepeticion,
    fecha: comp.date || '',
    semana: numero(summary?.header?.week) || null,
    periodo,
    periodoTexto: textoPeriodo(periodo),
    reloj,
    local: { ...local, puntos: puntos.local, gano: estado === 'final' ? puntos.local > puntos.visitante : false },
    visitante: { ...visitante, puntos: puntos.visitante, gano: estado === 'final' ? puntos.visitante > puntos.local : false },
    ctx: ctxBase,
    drives,
    totalJugadas: total,
    jugadasIncluidas: incluidas,
    ultima,
    situacion,
    probLocal,
  };
}

// Las jugadas que más movieron el partido, en orden cronológico (para el resumen final).
export function jugadasClave(partido, cuantas = 5) {
  const todas = [];
  let orden = 0;
  for (const d of partido?.drives || []) for (const j of d.jugadas) todas.push({ ...j, orden: orden++ });
  return todas
    .filter((j) => Math.abs(j.cambio) >= 0.04 && !j.explicacion.menor)
    .sort((a, b) => Math.abs(b.cambio) - Math.abs(a.cambio))
    .slice(0, cuantas)
    .sort((a, b) => a.orden - b.orden);
}

// Parte un texto en frases sin cortar en las iniciales de los jugadores ("I. Likely", "Dr. Jones").
export function separarFrases(texto) {
  return String(texto || '')
    .split(/(?<=[.!?])(?<!(?:^|[\s(])[A-ZÁÉÍÓÚÑ][a-z]?\.)\s+(?=[A-ZÁÉÍÓÚÑ¡¿])/)
    .filter(Boolean);
}

// Resumen para el final del partido: titular, las jugadas clave en una línea cada una y el texto para copiar.
export function construirResumen(partido) {
  if (!partido || partido.estado !== 'final') return null;
  const claves = jugadasClave(partido, 5);
  if (!claves.length) return null;
  const empate = partido.local.puntos === partido.visitante.puntos;
  const ganador = partido.local.puntos >= partido.visitante.puntos ? partido.local : partido.visitante;
  const perdedor = ganador === partido.local ? partido.visitante : partido.local;
  const titulo = empate ? 'Así terminó el partido' : 'Así se ganó el partido';
  const cabecera = `${ganador.nombre} ${ganador.puntos}, ${perdedor.nombre} ${perdedor.puntos}. Las jugadas que más movieron el partido:`;
  const lineas = claves.map((j) => {
    const frases = separarFrases(j.explicacion.explicacion);
    // Una exclamación suelta ("¡Intercepción!") no dice nada sola; y en una anotación interesa llegar hasta el "¡Touchdown...!".
    let cuantas = 1;
    if (frases[0] && frases[0].length < 28) cuantas = 2;
    else if (j.explicacion.anotacion && frases[1] && /^¡/.test(frases[1])) cuantas = 2;
    return `${textoPeriodo(j.periodo) || 'Partido'}, ${j.reloj}: ${frases.slice(0, cuantas).join(' ')}`;
  });
  const texto = `${titulo}\n${cabecera}\n${lineas.map((l) => `• ${l}`).join('\n')}\n\nExplicado por Primer Down`;
  return { titulo, cabecera, lineas, texto };
}
