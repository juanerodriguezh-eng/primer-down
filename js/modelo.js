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
// Dorsales reales por equipo, con la misma forma en que el texto de la jugada nombra a cada jugador ("J.Daniels").
// Salen del boxscore del summary (o de `summary.dorsales` en los partidos guardados). Si dos jugadores de un
// equipo comparten inicial y apellido, ese nombre se queda sin dorsal: es preferible no mostrar número a mostrar uno equivocado.
// "M.Penix Jr." y "M. Penix" son el mismo jugador: la clave va sin espacios ni sufijos (Jr., Sr., II, III...).
export const claveDorsal = (nombre) => String(nombre ?? '').replace(/\s+/g, '').replace(/,?(Jr|Sr|II|III|IV|V)\.?$/i, '');

export function dorsalesDe(summary) {
  if (summary?.dorsales && typeof summary.dorsales === 'object') return summary.dorsales;
  const salida = {};
  for (const equipo of (Array.isArray(summary?.boxscore?.players) ? summary.boxscore.players : [])) {
    const id = String(equipo?.team?.id ?? '');
    if (!id) continue;
    const mapa = {};
    const dudosos = new Set();
    for (const grupo of (Array.isArray(equipo.statistics) ? equipo.statistics : [])) {
      for (const fila of (Array.isArray(grupo?.athletes) ? grupo.athletes : [])) {
        const a = fila?.athlete || {};
        const dorsal = String(a.jersey ?? '').trim();
        const nombre = String(a.firstName || '').trim();
        const apellido = String(a.lastName || '').trim();
        if (!/^\d{1,2}$/.test(dorsal) || !nombre || !apellido) continue;
        const clave = claveDorsal(`${nombre[0]}.${apellido}`);
        if (mapa[clave] != null && mapa[clave] !== dorsal) dudosos.add(clave);
        mapa[clave] = dorsal;
        // Cuando hay dos con la misma inicial, el texto de la liga usa dos letras ("Mi.Wilson").
        if (nombre.length > 1) mapa[claveDorsal(`${nombre.slice(0, 2)}.${apellido}`)] = dorsal;
      }
    }
    for (const clave of dudosos) delete mapa[clave];
    if (Object.keys(mapa).length) salida[id] = mapa;
  }
  return salida;
}

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
  // Punto de partida: el primer valor que da ESPN (el pronóstico previo al partido), no 50 %. Con 50 % la
  // patada inicial parecía mover el partido 20 o 30 puntos y salía como "jugada clave" sin serlo.
  const primera = (Array.isArray(summary?.winprobability) ? summary.winprobability : []).find((w) => typeof w?.homeWinPercentage === 'number');
  let probLocal = primera ? primera.homeWinPercentage : null;
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
      // Dato malo de ESPN: a veces una pausa llega con marcador 0-0 en pleno partido. Un marcador no vuelve a cero.
      const marcadorEnBlanco = play?.homeScore === 0 && play?.awayScore === 0 && marcador.local + marcador.visitante > 0;
      if (typeof play?.homeScore === 'number' && typeof play?.awayScore === 'number' && !marcadorEnBlanco) {
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
        // true si ESPN entregó la probabilidad de ganar de esta jugada (si no, probLocal es la de la anterior).
        conProb: typeof p === 'number',
        cambio,
        // A quién favoreció el cambio de probabilidad.
        favorece: cambio > 0 ? local.id : cambio < 0 ? visitante.id : '',
        clave,
        // Lo que dice ESPN sobre si la jugada fue una pérdida de balón (null si no lo dice).
        perdidaEspn: typeof play?.isTurnover === 'boolean' ? play.isTurnover : null,
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
    dorsales: dorsalesDe(summary),
    drives,
    totalJugadas: total,
    jugadasIncluidas: incluidas,
    ultima,
    situacion,
    probLocal,
    // Primer valor que entrega ESPN: el pronóstico de antes de la patada inicial (null si no hay winprobability).
    // Solo cuenta como pronóstico previo si ese primer dato no es de una jugada del partido.
    probInicial: primera && !drivesCrudos.some((d) => (d.plays || []).some((pl) => pl?.id != null && String(pl.id) === String(primera.playId))) ? primera.homeWinPercentage : null,
  };
}

// Las jugadas que más movieron el partido, en orden cronológico (para el resumen final).
export function jugadasClave(partido, cuantas = 5) {
  const todas = [];
  let orden = 0;
  for (const d of partido?.drives || []) for (const j of d.jugadas) todas.push({ ...j, orden: orden++ });
  return todas
    .filter((j) => Math.abs(j.cambio) >= 0.04 && !j.explicacion.menor && j.explicacion.categoria !== 'pausa')
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

// ---------------------------------------------------------------------------
// Resumen final: "Así se ganó el partido"
// ---------------------------------------------------------------------------

const todasLasJugadas = (partido) => (partido?.drives || []).flatMap((d) => d.jugadas);

// Cómo se movió el marcador, visto desde el ganador. Sale solo del marcador real después de cada jugada.
//   maxAbajo: la mayor desventaja que tuvo el ganador · empates: veces que volvió a quedar igualado después del 0-0
//   cambiosDeLider: veces que la ventaja pasó de un equipo al otro · definitiva: la jugada con la que el ganador
//   se puso arriba y ya no soltó la ventaja.
export function historiaDelMarcador(partido) {
  const ganaLocal = partido.local.puntos >= partido.visitante.puntos;
  const jugadas = todasLasJugadas(partido);
  let maxAbajo = 0; let empates = 0; let cambiosDeLider = 0; let lider = 0; let previa = 0; let definitiva = null;
  for (const j of jugadas) {
    const dif = ganaLocal ? j.marcador.local - j.marcador.visitante : j.marcador.visitante - j.marcador.local;
    if (dif === previa) continue;
    maxAbajo = Math.max(maxAbajo, -dif);
    const signo = Math.sign(dif);
    if (signo !== 0 && lider !== 0 && signo !== lider) cambiosDeLider++;
    if (signo !== 0) lider = signo;
    if (dif === 0) empates++;
    if (dif > 0 && previa <= 0) definitiva = j;
    else if (dif <= 0) definitiva = null;
    previa = dif;
  }
  return {
    maxAbajo, empates, cambiosDeLider, definitiva,
    diferencia: Math.abs(partido.local.puntos - partido.visitante.puntos),
    tiempoExtra: jugadas.some((j) => j.periodo >= 5),
  };
}

const puntosTexto = (n) => (n === 1 ? '1 punto' : `${n} puntos`);
const conMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Dos o tres frases que cuentan qué tipo de partido fue. Cada una se apoya en un dato del marcador; no se adorna.
function relatoDelPartido(h, ganador, perdedor) {
  const g = `los ${ganador.nombre}`;
  const p = `los ${perdedor.nombre}`;
  const frases = [];
  let dijoLaDiferencia = true;
  if (h.maxAbajo >= 10) {
    frases.push(`Remontada de ${g}: llegaron a estar ${puntosTexto(h.maxAbajo)} abajo y terminaron ganando por ${h.diferencia}.`);
  } else if (h.maxAbajo === 0 && h.empates === 0 && h.diferencia >= 14) {
    frases.push(`${conMayuscula(g)} mandaron de principio a fin: nunca estuvieron abajo en el marcador y ganaron por ${h.diferencia}.`);
  } else if (h.maxAbajo === 0 && h.empates === 0) {
    frases.push(h.diferencia <= 8
      ? `${conMayuscula(g)} nunca estuvieron abajo en el marcador, pero ${p} no los dejaron escaparse: la diferencia final fue de ${puntosTexto(h.diferencia)}.`
      : `${conMayuscula(g)} nunca estuvieron abajo en el marcador y ganaron por ${h.diferencia}.`);
  } else if (h.maxAbajo === 0) {
    frases.push(`${conMayuscula(g)} nunca estuvieron abajo en el marcador, aunque ${p} llegaron a empatarles.`);
    dijoLaDiferencia = false;
  } else if (h.diferencia >= 14) {
    frases.push(`${conMayuscula(g)} llegaron a ir abajo (por ${h.maxAbajo}), pero terminaron ganando con claridad: por ${h.diferencia}.`);
  } else if (h.cambiosDeLider >= 3) {
    frases.push(`Partido de ida y vuelta: la ventaja cambió de manos ${h.cambiosDeLider} veces.`);
    dijoLaDiferencia = false;
  } else {
    frases.push(`${conMayuscula(g)} llegaron a ir abajo (por ${h.maxAbajo}) y le dieron la vuelta.`);
    dijoLaDiferencia = false;
  }
  const d = h.definitiva;
  if (d && (h.maxAbajo > 0 || h.empates > 0)) {
    const cuando = d.periodo >= 5 ? 'en el tiempo extra'
      : d.periodo === 4 && d.reloj === '0:00' ? 'en la última jugada del partido'
        : d.periodo === 4 ? `a ${d.reloj} del final del partido`
          : `en el ${textoPeriodo(d.periodo)}`;
    frases.push(`Se pusieron al frente para no soltar más la ventaja ${cuando}.`);
  }
  if (h.tiempoExtra && d?.periodo < 5) frases.push('Hizo falta tiempo extra para definirlo.');
  if (!dijoLaDiferencia) {
    if (h.diferencia === 3) frases.push('Al final los separó apenas un gol de campo.');
    else if (h.diferencia < 3) frases.push(`Al final los separó apenas ${puntosTexto(h.diferencia)}.`);
    else if (h.diferencia <= 8) frases.push(`Terminó a una sola posesión de distancia (${puntosTexto(h.diferencia)}).`);
    else frases.push(`Ganaron por ${h.diferencia}.`);
  }
  return frases;
}

// De toda la explicación de una jugada, las frases que cuentan su consecuencia: anotación, balón perdido,
// conversión o fallo de la oportunidad, penal y cómo quedó el marcador. El resto (cuánto vale un touchdown,
// qué es un penal) ya está en la tarjeta de la jugada.
const CONSECUENCIAS = [
  /^¡(Touchdown|Safety|Gol de campo)/, /^Y lo lleva/, /^Pierde el balón/, /cambio de posesión/, /^El balón cambia de manos/,
  /^Lo recuperan? /, /touchback/, /conversión de 2 puntos/,
  /la convierten/, /^Fallan en/, /^No (la )?(convierten|alcanza)/, /entregan el balón/, /primer down/,
  /^(Pero hay b|B)andera amarilla/, /^Son \d+ yardas? a favor/, /^Les cuesta/, /^Retroceden/,
  /^(Le dan la vuelta al marcador|Abren el marcador|Rompen el empate|Amplían su ventaja|Empatan el partido|Se acercan en el marcador):/,
];
const LARGO_MAXIMO_DE_LINEA = 330;

function lineaDeResumen(j) {
  const frases = separarFrases(j.explicacion.explicacion);
  // Una exclamación suelta ("¡Intercepción!") no dice nada sola: va con la frase que le sigue.
  const base = frases[0] && frases[0].length < 28 ? 2 : 1;
  const elegidas = frases.slice(0, base);
  let largo = elegidas.join(' ').length;
  for (const f of frases.slice(base)) {
    if (!CONSECUENCIAS.some((re) => re.test(f)) || largo + f.length + 1 > LARGO_MAXIMO_DE_LINEA) continue;
    elegidas.push(f);
    largo += f.length + 1;
  }
  return `${textoPeriodo(j.periodo) || 'Partido'}, ${j.reloj}: ${elegidas.join(' ')}`;
}

// Resumen para el final del partido: el marcador, un relato corto, las jugadas clave y el texto para copiar.
export function construirResumen(partido) {
  if (!partido || partido.estado !== 'final') return null;
  let claves = jugadasClave(partido, 5);
  if (!claves.length) return null;
  const empate = partido.local.puntos === partido.visitante.puntos;
  const ganador = partido.local.puntos >= partido.visitante.puntos ? partido.local : partido.visitante;
  const perdedor = ganador === partido.local ? partido.visitante : partido.local;
  const titulo = empate ? 'Así terminó el partido' : 'Así se ganó el partido';
  const marcador = `${ganador.nombre} ${ganador.puntos}, ${perdedor.nombre} ${perdedor.puntos}.`;
  const historia = historiaDelMarcador(partido);
  const relato = empate ? [] : relatoDelPartido(historia, ganador, perdedor);
  // La jugada que dio la ventaja definitiva tiene que estar en la lista, aunque otra haya movido más el pronóstico.
  const d = historia.definitiva;
  if (!empate && d && (historia.maxAbajo > 0 || historia.empates > 0) && !claves.some((j) => j.id === d.id)) {
    const orden = todasLasJugadas(partido).findIndex((j) => j.id === d.id);
    const menor = claves.reduce((a, b) => (Math.abs(a.cambio) <= Math.abs(b.cambio) ? a : b));
    claves = [...claves.filter((j) => j !== menor || claves.length < 5), { ...d, orden }].sort((a, b) => a.orden - b.orden);
  }
  // Una jugada corriente de una sola frase ("corre y gana 7 yardas") no explica por qué pesó: se omite si quedan 3 o más.
  const dicePoco = (j) => !j.explicacion.anotacion && !j.explicacion.cambioDePosesion && j.id !== d?.id
    && separarFrases(j.explicacion.explicacion).length < 2 && Math.abs(j.yardas ?? 0) < 15;
  const conSustancia = claves.filter((j) => !dicePoco(j));
  if (conSustancia.length >= 3) claves = conSustancia;
  const encabezadoLista = 'Las jugadas que más movieron el partido:';
  const cabecera = [marcador, ...relato].join(' ');
  const lineas = claves.map(lineaDeResumen);
  const texto = `${titulo}\n${cabecera}\n\n${encabezadoLista}\n${lineas.map((l) => `• ${l}`).join('\n')}\n\nExplicado por Primer Down`;
  return { titulo, marcador, relato, cabecera, encabezadoLista, lineas, texto };
}
