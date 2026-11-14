// Motor de explicaciones de Primer Down.
//
// Convierte una jugada de la API de ESPN en una explicación en español simple.
// Todo aquí son funciones puras: no tocan el DOM, no usan la red, no dependen de la hora
// ni del azar (las variantes de redacción se eligen con un hash del id de la jugada, así la
// misma jugada siempre se explica igual).
//
// Entradas principales:
//   explicarJugada(jugada, contexto)   -> { categoria, etiqueta, explicacion, porQue, conceptos, ... }
//   explicarSituacion(punto, contexto) -> { titulo, texto, conceptos }
//   resumirDrive(drive, contexto)      -> "Avance de los Giants: 8 jugadas, 65 yardas, terminó en touchdown."
//   analizarTexto(texto)               -> hechos leídos del texto en inglés (se exporta para las pruebas)
//
// Notas sobre los datos reales (ver datos/tipos-de-jugada.md):
//   - `yardLine` es la distancia a la zona de anotación del equipo LOCAL (0 a 100).
//   - `yardsToEndzone` no es fiable; aquí se calcula.
//   - `type.text` a veces viene mal; se decide con el texto y, si no alcanza, con el tipo.

import { abreviaturaEspn, mismaAbreviatura } from './equipos.js';
import { buscarPenal } from './penales.js';

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

export function hashTexto(s) {
  let h = 2166136261;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Elige una variante de forma determinista.
function elegir(opciones, semilla) {
  const lista = opciones.filter(Boolean);
  if (!lista.length) return '';
  return lista[hashTexto(semilla) % lista.length];
}

function yardasTexto(n) {
  const v = Math.abs(Number(n) || 0);
  return v === 1 ? '1 yarda' : `${v} yardas`;
}

function mayuscula(s) {
  const t = String(s || '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function conPunto(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function unir(frases) {
  return frases.map((f) => String(f || '').trim()).filter(Boolean).map(conPunto).join(' ');
}

const ORDINALES = { 1: 'primera', 2: 'segunda', 3: 'tercera', 4: 'cuarta' };

export function ordinalCorto(down) {
  return down >= 1 && down <= 4 ? `${down}.ª` : '';
}

// "J.McCarthy" -> "J. McCarthy". Los nombres completos se dejan como vienen.
export function nombreJugador(crudo) {
  const s = String(crudo || '').replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, (m) => (/\b(Jr|Sr)\.$/.test(crudo.trim()) ? m : ''));
  if (!s) return '';
  return s.replace(/^([A-Z][a-z]{0,3})\.(?=\S)/, '$1. ');
}

function listaNombres(nombres) {
  const l = nombres.map(nombreJugador).filter(Boolean);
  if (l.length <= 1) return l[0] || '';
  return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}

function segundosDeReloj(reloj) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(reloj || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// ---------------------------------------------------------------------------
// Equipos y posición en el campo
// ---------------------------------------------------------------------------

function los(equipo) {
  return equipo?.nombre ? `los ${equipo.nombre}` : 'el equipo';
}

function deLos(equipo) {
  return equipo?.nombre ? `de los ${equipo.nombre}` : 'del equipo';
}

function equipoPorId(id, ctx) {
  if (!id || !ctx) return null;
  if (ctx.local?.id === String(id)) return ctx.local;
  if (ctx.visitante?.id === String(id)) return ctx.visitante;
  return null;
}

function rivalDe(equipo, ctx) {
  if (!equipo || !ctx) return null;
  if (ctx.local && equipo.id === ctx.local.id) return ctx.visitante || null;
  if (ctx.visitante && equipo.id === ctx.visitante.id) return ctx.local || null;
  return null;
}

function equipoPorAbrev(abrev, ctx) {
  if (!abrev || !ctx) return null;
  if (mismaAbreviatura(abrev, ctx.local?.abrev)) return ctx.local;
  if (mismaAbreviatura(abrev, ctx.visitante?.abrev)) return ctx.visitante;
  return null;
}

// Yardas que le faltan a `equipo` para llegar a la zona de anotación rival desde `yardLine`.
// El local ataca hacia 100 y el visitante hacia 0.
export function yardasParaAnotar(yardLine, equipoId, ctx) {
  if (typeof yardLine !== 'number' || !ctx?.local?.id || !equipoId) return null;
  return String(equipoId) === ctx.local.id ? 100 - yardLine : yardLine;
}

// "la yarda 28 de los Giants", en términos absolutos.
export function describirYarda(yardLine, ctx) {
  if (typeof yardLine !== 'number') return '';
  if (yardLine <= 0 || yardLine >= 100) return 'la zona de anotación';
  if (yardLine === 50) return 'el medio campo';
  if (yardLine < 50) return ctx?.local?.nombre ? `la yarda ${yardLine} de los ${ctx.local.nombre}` : `la yarda ${yardLine}`;
  return ctx?.visitante?.nombre ? `la yarda ${100 - yardLine} de los ${ctx.visitante.nombre}` : `la yarda ${100 - yardLine}`;
}

// Igual que describirYarda, pero si la yarda está en el campo de `equipo` dice "su propia yarda 23".
// Sirve para frases cuyo sujeto es ese equipo ("los Giants empiezan en su propia yarda 23").
function describirYardaPara(yardLine, equipo, ctx) {
  if (typeof yardLine !== 'number' || !equipo?.id || !ctx?.local?.id || yardLine <= 0 || yardLine >= 100 || yardLine === 50) return describirYarda(yardLine, ctx);
  const esLocal = String(equipo.id) === ctx.local.id;
  if (esLocal && yardLine < 50) return `su propia yarda ${yardLine}`;
  if (!esLocal && yardLine > 50) return `su propia yarda ${100 - yardLine}`;
  return describirYarda(yardLine, ctx);
}

// "su propia yarda 25" / "la yarda 30 del rival", desde el punto de vista de quien ataca.
function describirYardaRelativa(ypa) {
  if (typeof ypa !== 'number') return '';
  if (ypa <= 0) return 'la zona de anotación';
  if (ypa === 50) return 'el medio campo';
  return ypa > 50 ? `su propia yarda ${100 - ypa}` : `la yarda ${ypa} del rival`;
}

// ---------------------------------------------------------------------------
// Lectura del texto en inglés
// ---------------------------------------------------------------------------

const RE_REVISION = /(?:(?<=[.)\]]|^)\s*([A-Z][A-Za-z ]*?) challenged the (.+?) ruling|The Replay Official reviewed(?: the (.+?))? ruling), and the play was (REVERSED|Upheld)\.?(?: The ruling on the field stands\.)?(?: \(Timeout #\d\.?\))?/g;
const RE_PENAL = /(?:PENALTY|Penalty) on ([A-Z]{2,3})(?:-([^,]+))?, ([^,]+?), (.*?)(?=(?:PENALTY|Penalty) on |$)/g;

const DIRECCION = { left: 'izquierda', middle: 'centro', right: 'derecha' };
const TRAMO_FINAL = '(?: (?:to|pushed ob at|ran ob at) (?:[A-Z]{2,3} )?-?\\d+)?';
const GANANCIA = '(?:for (-?\\d+) yards?|for (no gain))';
// Nombre de jugador en el formato de la liga: "T.Lawrence", "Ji.Horn", "A.St. Brown", "K.Walker III".
const NOMBRE = "[A-Z][a-z]{0,3}\\.\\s?(?:St\\. ?)?[A-Z][A-Za-z'\\-]+(?: (?:Jr|Sr|II|III|IV)\\b\\.?)?";

function limpiarPrincipal(texto) {
  let p = String(texto || '');
  p = p.replace(/\*\* Injury Update: .*?\.(?=\s|$)/g, ' ');
  p = p.replace(/[A-Z]{2,3}-\S+(?: (?:Jr|Sr|II|III|IV)\.?)? was injured during the play\.(?: (?:He|His) [^.]*\.)?/g, ' ');
  p = p.replace(/\((?:[A-Za-z ]+, )?(?:Shotgun|No Huddle|Punt formation|Field Goal formation|Run formation|Pass formation|Kick formation)\)\s*/g, '');
  p = p.replace(/^.*reported in as eligible\.\s*/, '');
  p = p.replace(/Direct snap to .+?\.\s+(?=[A-Z])/, '');
  return p.replace(/\s+/g, ' ').trim();
}

function leerPenales(texto) {
  const penales = [];
  for (const m of String(texto || '').matchAll(RE_PENAL)) {
    const cola = m[4] || '';
    const yd = /(\d+) yards?/.exec(cola);
    penales.push({
      equipo: m[1],
      jugador: (m[2] || '').trim(),
      nombre: m[3].trim(),
      yardas: yd ? Number(yd[1]) : null,
      estado: /\bdeclined\b/.test(cola) ? 'rechazado' : /\boffsetting\b/.test(cola) ? 'compensado' : 'aceptado',
      sinJugada: /- No Play/.test(cola),
      entreDowns: /between downs/.test(cola),
    });
  }
  return penales;
}

function leerRetorno(resto) {
  // Devuelve quién regresó una patada o una intercepción y cuántas yardas.
  const td = new RegExp(`(${NOMBRE}) for (\\d+) yards?, TOUCHDOWN`).exec(resto);
  if (td) return { jugador: td[1].trim(), yardas: Number(td[2]), touchdown: true };
  const re = new RegExp(`(${NOMBRE}) (?:\\(didn't try to advance\\) )?(?:to|pushed ob at|ran ob at) (?:[A-Z]{2,3} )?-?\\d+ ${GANANCIA}`);
  const m = re.exec(resto);
  if (m) return { jugador: m[1].trim(), yardas: m[3] ? 0 : Number(m[2]), touchdown: false };
  return null;
}

function leerBalonSuelto(p) {
  const i = p.indexOf('FUMBLES');
  if (i < 0) return null;
  const cola = p.slice(i);
  const forzado = /^FUMBLES \((?!Aborted)([^)]+)\)/.exec(cola);
  const rec = /(?:RECOVERED|recovered) by ([A-Z]{2,3})-(\S+(?: (?:Jr|Sr|II|III|IV)\.?)?)/.exec(cola);
  return {
    abortado: /^FUMBLES \(Aborted\)/.test(cola) || /Aborted\. \S+ FUMBLES/.test(p),
    forzadoPor: forzado ? forzado[1] : '',
    equipoRecupera: rec ? rec[1] : '',
    jugadorRecupera: rec ? rec[2].replace(/[.,]$/, '') : '',
    recuperaElMismo: !rec && /and recovers/.test(cola),
    fueraDelCampo: !rec && /out of bounds/.test(cola),
  };
}

// Lee el formato corto que ESPN usa a veces en lugar del texto de la liga
// ("Kirk Cousins Pass Complete for 5 Yds to Michael Mayer").
function leerFormatoCorto(p, h) {
  let m;
  if ((m = /^(.+?) Pass Complete for (-?\d+) Yds? to (.+?)(?: [A-Z][a-z]+ [A-Z][A-Za-z]+ Fumble.*)?$/.exec(p))) {
    Object.assign(h, { accion: 'pase-completo', pasador: m[1], yardas: Number(m[2]), receptor: m[3] });
  } else if ((m = /^(.+?) Incomplete Pass(?:, Intended For (.+))?$/i.exec(p))) {
    Object.assign(h, { accion: 'pase-incompleto', pasador: m[1], receptor: m[2] || '' });
  } else if ((m = /^(.+?) (\d+) Yds? pass from (.+?)(?: \((.*)\))?\.?$/i.exec(p))) {
    Object.assign(h, { accion: 'pase-completo', receptor: m[1], yardas: Number(m[2]), pasador: m[3], touchdown: true });
    leerExtraCorto(m[4], h);
  } else if ((m = /^(.+?) (\d+) Yds? Run(?: \((.*)\))?\.?$/i.exec(p))) {
    Object.assign(h, { accion: 'carrera', corredor: m[1], yardas: Number(m[2]), touchdown: true });
    leerExtraCorto(m[3], h);
  } else if ((m = /(?:^|Pnlty )([A-Z][A-Za-z.' \-]+?) (-?\d+) Yds? Rush$/.exec(p))) {
    Object.assign(h, { accion: 'carrera', corredor: m[1], yardas: Number(m[2]) });
  } else if ((m = /^(.+?) (\d+) Yds? Field Goal/i.exec(p))) {
    Object.assign(h, { accion: 'gol-de-campo', golDeCampo: { pateador: m[1], yardas: Number(m[2]), resultado: 'bueno', detalle: '' } });
  } else if ((m = /^(.+?) (\d+) Yds? (Interception|Fumble|Punt|Kickoff)(?: Return| Recovery)(?: \((.*)\))?\.?$/i.exec(p))) {
    Object.assign(h, { accion: 'regreso-corto', regresador: m[1], yardas: Number(m[2]), origenRegreso: m[3].toLowerCase(), touchdown: true });
    leerExtraCorto(m[4], h);
  } else if (/\bSafety$/i.test(p)) {
    Object.assign(h, { accion: 'safety', safety: true });
  } else {
    return false;
  }
  h.formatoCorto = true;
  return true;
}

function leerExtraCorto(parentesis, h) {
  const t = String(parentesis || '');
  if (!t) return;
  if (/Two-Point/i.test(t)) h.conversion2 = { tipo: /Pass/i.test(t) ? 'pase' : 'carrera', exito: !/Failed/i.test(t) };
  else if (/PAT failed/i.test(t)) h.puntoExtra = 'fallado';
  else if (/PAT blocked/i.test(t)) h.puntoExtra = 'bloqueado';
  else if (/Kick/i.test(t)) h.puntoExtra = 'bueno';
}

export function analizarTexto(textoCrudo) {
  const original = String(textoCrudo || '').replace(/\s+/g, ' ').trim();
  const h = {
    original,
    accion: 'desconocida',
    revision: null,
    penales: [],
    sinJugada: false,
    escopeta: /\(.*Shotgun.*?\)/.test(original),
    sinReunion: /\(No Huddle/.test(original),
    touchdown: false,
    touchdownAnulado: false,
    safety: false,
    yardas: null,
    fueraDelCampo: false,
    lateral: false,
  };

  // 1. Revisiones: si la jugada se revirtió, la versión que vale es la que viene después.
  let efectivo = original;
  const revisiones = [...original.matchAll(RE_REVISION)];
  if (revisiones.length) {
    const ultima = revisiones[revisiones.length - 1];
    const revertida = revisiones.some((r) => r[4] === 'REVERSED');
    h.revision = {
      quien: ultima[1] ? ultima[1].trim() : '',
      sobre: (ultima[2] || ultima[3] || '').trim(),
      resultado: revertida ? 'revertida' : 'confirmada',
    };
    const antes = original.slice(0, revisiones[0].index).trim();
    const despues = original.slice(ultima.index + ultima[0].length).trim();
    if (revertida) efectivo = despues.length > 12 ? despues : antes;
    else efectivo = `${antes} ${despues}`.trim();
  }
  h.efectivo = efectivo;

  // 2. Penales.
  h.penales = leerPenales(efectivo);
  h.sinJugada = h.penales.some((p) => p.sinJugada) || /- No Play/.test(efectivo);
  const iPenal = efectivo.search(/(?:PENALTY|Penalty) on /);
  const principal = limpiarPrincipal(iPenal >= 0 ? efectivo.slice(0, iPenal) : efectivo);
  h.principal = principal;
  const p = principal;

  // 3. Anotaciones y detalles que pueden venir en cualquier jugada.
  h.touchdownAnulado = /TOUCHDOWN NULLIFIED/.test(efectivo) || /SAFETY NULLIFIED/.test(efectivo);
  h.touchdown = /TOUCHDOWN(?! NULLIFIED)/.test(efectivo);
  h.safety = /\bSAFETY(?! NULLIFIED)/.test(efectivo);
  h.fueraDelCampo = /\b(?:pushed|ran) ob\b/.test(p);
  h.lateral = /\bLateral to\b/.test(p);
  const pe = /extra point is (GOOD|No Good|Blocked|BLOCKED)/.exec(efectivo);
  if (pe) h.puntoExtra = pe[1] === 'GOOD' ? 'bueno' : /blocked/i.test(pe[1]) ? 'bloqueado' : 'fallado';
  const c2 = /TWO-POINT CONVERSION ATTEMPT\.\s*(.*?)ATTEMPT (SUCCEEDS|FAILS)/.exec(efectivo);
  if (c2) h.conversion2 = { tipo: /\bpass\b/.test(c2[1]) ? 'pase' : 'carrera', exito: c2[2] === 'SUCCEEDS' };
  h.balonSuelto = leerBalonSuelto(p);
  h.muff = /\bMUFFS\b/.test(p);

  // 4. La acción principal.
  let m;
  if (!p) {
    h.accion = h.penales.length ? 'solo-penal' : 'desconocida';
  } else if (/^END GAME/i.test(p)) {
    h.accion = 'fin-de-partido';
  } else if ((m = /^END (?:OF )?QUARTER (\d)/i.exec(p)) || (m = /^End of (?:the )?(\d)(?:st|nd|rd|th) Quarter/i.exec(p))) {
    h.accion = 'fin-de-periodo';
    h.periodoTerminado = Number(m[1]);
  } else if (/^Two-Minute Warning/i.test(p)) {
    h.accion = 'aviso-dos-minutos';
  } else if ((m = /^Timeout #(\d) by ([A-Z]{2,3})/.exec(p))) {
    h.accion = 'tiempo-fuera';
    h.tiempoFuera = { numero: Number(m[1]), equipo: m[2] };
  } else if (/^Official Timeout/i.test(p)) {
    h.accion = 'tiempo-fuera-oficial';
  } else if ((m = /^(.+?) kicks (onside )?(-?\d+) yards? from (?:[A-Z]{2,3} )?\d+ to /.exec(p))) {
    h.accion = 'patada-de-salida';
    const tb = /Touchback(?: to the (?:[A-Z]{2,3} )?(\d+))?/.exec(p);
    const resto = p.slice(m[0].length);
    h.patada = {
      pateador: m[1],
      yardas: Number(m[3]),
      corta: !!m[2],
      touchback: !!tb,
      yardaTouchback: tb && tb[1] ? Number(tb[1]) : null,
      cortaDeZona: /short of landing zone/.test(p),
      fuera: /out of bounds/.test(p) && !h.balonSuelto,
      retorno: tb ? null : leerRetorno(resto),
    };
  } else if ((m = /^(.+?) punt is BLOCKED(?: by (.+?))?,/.exec(p))) {
    h.accion = 'despeje';
    h.patada = { pateador: m[1], bloqueada: true, bloqueadaPor: m[2] || '', yardas: 0, retorno: leerRetorno(p.slice(m[0].length)) };
  } else if ((m = /^(.+?) punts (-?\d+) yards? to /.exec(p))) {
    h.accion = 'despeje';
    const resto = p.slice(m[0].length);
    const fc = /fair catch by ([^.,]+(?:\.[A-Za-z][^.,]*)?)/.exec(p);
    h.patada = {
      pateador: m[1],
      yardas: Number(m[2]),
      touchback: /Touchback/.test(p),
      recepcionLibre: !!fc,
      receptor: fc ? fc[1].trim() : '',
      muerta: /downed by/.test(p),
      fuera: /out of bounds/.test(p) && !h.balonSuelto,
      retorno: /Touchback|fair catch|downed by/.test(p) ? null : leerRetorno(resto.replace(/^[^.]*\.\s?/, (x) => (/(?:Center-|end zone)/.test(x) ? '. ' : x))),
    };
  } else if ((m = /^(.+?) (\d+) yard field goal is (GOOD|No Good|BLOCKED|Blocked)(?:, ([A-Za-z ]+?),| \(([^)]+)\))?/.exec(p))) {
    h.accion = 'gol-de-campo';
    h.golDeCampo = {
      pateador: m[1],
      yardas: Number(m[2]),
      resultado: m[3] === 'GOOD' ? 'bueno' : /blocked/i.test(m[3]) ? 'bloqueado' : 'fallado',
      detalle: m[4] || '',
      bloqueadoPor: m[5] || '',
    };
  } else if ((m = /^(.+?) spiked the ball/.exec(p))) {
    h.accion = 'spike';
    h.pasador = m[1];
  } else if ((m = /^(.+?) kneels/.exec(p))) {
    h.accion = 'arrodillarse';
    h.corredor = m[1];
    const yd = /for (-?\d+) yards?/.exec(p);
    h.yardas = yd ? Number(yd[1]) : -1;
  } else if ((m = /^(.+?) pass (?:(short|deep) )?(?:(left|middle|right) )?(?:intended for (.+?) )?INTERCEPTED by (.+?)(?: \([^)]*\))?(?: \[[^\]]*\])? at (?:[A-Z]{2,3} )?-?\d+\./.exec(p))) {
    h.accion = 'intercepcion';
    h.pasador = m[1];
    h.profundidad = m[2] === 'deep' ? 'profundo' : m[2] === 'short' ? 'corto' : null;
    h.direccion = DIRECCION[m[3]] || null;
    h.receptor = m[4] || '';
    h.interceptor = m[5];
    const resto = p.slice(m[0].length);
    h.intercepcion = { touchback: /Touchback/.test(resto), retorno: leerRetorno(resto) };
  } else if ((m = /^(.+?) sacked (?:ob )?at (?:[A-Z]{2,3} )?-?\d+ for (-?\d+) yards?(?: \((?:sack split by (.+?) and (.+?)|([^)]+))\))?/.exec(p))) {
    h.accion = 'captura';
    h.pasador = m[1];
    h.yardas = Number(m[2]);
    h.capturadores = m[3] ? [m[3], m[4]] : m[5] ? [m[5]] : [];
  } else if ((m = /^(.+?) pass incomplete(?: (short|deep))?(?: (left|middle|right))?(?: to ([^(\[]+?))?\s*(?:\(([^)]+)\))?\s*(?:\[([^\]]+)\])?\s*(?:(?<!St)\.(?=\s|$)|$)/.exec(p))) {
    h.accion = 'pase-incompleto';
    h.pasador = m[1];
    h.profundidad = m[2] === 'deep' ? 'profundo' : m[2] === 'short' ? 'corto' : null;
    h.direccion = DIRECCION[m[3]] || null;
    h.receptor = (m[4] || '').trim();
    h.defensores = m[5] ? m[5].split(/[,;] ?/) : [];
    h.presion = m[6] || '';
  } else if ((m = new RegExp(`^(.+?) pass (?:(short|deep) )?(?:(left|middle|right) )?to (.+?)${TRAMO_FINAL} ${GANANCIA}`).exec(p))) {
    h.accion = 'pase-completo';
    h.pasador = m[1];
    h.profundidad = m[2] === 'deep' ? 'profundo' : m[2] === 'short' ? 'corto' : null;
    h.direccion = DIRECCION[m[3]] || null;
    h.receptor = m[4];
    h.yardas = m[6] ? 0 : Number(m[5]);
  } else if ((m = /^(.+?) FUMBLES \(Aborted\)/.exec(p)) || (m = /^(.+?) Aborted\. /.exec(p))) {
    h.accion = 'centro-fallido';
    h.corredor = m[1];
  } else if ((m = new RegExp(`^(.+?) (scrambles )?(up the middle|(?:left|right) (?:end|tackle|guard))${TRAMO_FINAL} ${GANANCIA}`).exec(p))) {
    h.accion = 'carrera';
    h.corredor = m[1];
    h.escapada = !!m[2];
    h.hueco = m[3];
    h.yardas = m[5] ? 0 : Number(m[4]);
  } else if ((m = new RegExp(`^([A-Z][A-Za-z.'\\- ]*?) (scrambles |rushes )?(?:to|pushed ob at|ran ob at) (?:[A-Z]{2,3} )?-?\\d+ ${GANANCIA}`).exec(p))) {
    h.accion = 'carrera';
    h.corredor = m[1];
    h.escapada = /scrambles/.test(m[2] || '');
    h.hueco = '';
    h.yardas = m[4] ? 0 : Number(m[3]);
  } else if (!leerFormatoCorto(p, h)) {
    h.accion = h.safety ? 'safety' : 'desconocida';
  }
  return h;
}

// ---------------------------------------------------------------------------
// Tipos de ESPN: etiqueta en español y acción de respaldo cuando el texto no alcanza
// ---------------------------------------------------------------------------

export const TIPOS_ESPN = {
  'Rush': { accion: 'carrera', etiqueta: 'Carrera' },
  'Pass Reception': { accion: 'pase-completo', etiqueta: 'Pase completo' },
  'Pass Incompletion': { accion: 'pase-incompleto', etiqueta: 'Pase incompleto' },
  'Pass': { accion: 'pase', etiqueta: 'Pase' },
  'Sack': { accion: 'captura', etiqueta: 'Captura (sack)' },
  'Official Timeout': { accion: 'tiempo-fuera-oficial', etiqueta: 'Pausa oficial' },
  'Timeout': { accion: 'tiempo-fuera', etiqueta: 'Tiempo fuera' },
  'Kickoff': { accion: 'patada-de-salida', etiqueta: 'Patada de salida' },
  'Kickoff Return (Offense)': { accion: 'patada-de-salida', etiqueta: 'Patada de salida' },
  'Kickoff Return Touchdown': { accion: 'patada-de-salida', etiqueta: 'Touchdown en regreso de patada' },
  'Penalty': { accion: 'solo-penal', etiqueta: 'Penal' },
  'Punt': { accion: 'despeje', etiqueta: 'Despeje (punt)' },
  'Punt Return Touchdown': { accion: 'despeje', etiqueta: 'Touchdown en regreso de despeje' },
  'Blocked Punt': { accion: 'despeje', etiqueta: 'Despeje bloqueado' },
  'Blocked Punt Touchdown': { accion: 'despeje', etiqueta: 'Touchdown tras despeje bloqueado' },
  'Muffed Punt Recovery (Opponent)': { accion: 'despeje', etiqueta: 'Despeje mal recibido' },
  'Field Goal Good': { accion: 'gol-de-campo', etiqueta: 'Gol de campo' },
  'Field Goal Missed': { accion: 'gol-de-campo', etiqueta: 'Gol de campo fallado' },
  'Blocked Field Goal': { accion: 'gol-de-campo', etiqueta: 'Gol de campo bloqueado' },
  'Blocked Field Goal Touchdown': { accion: 'gol-de-campo', etiqueta: 'Touchdown tras gol de campo bloqueado' },
  'Missed Field Goal Return': { accion: 'gol-de-campo', etiqueta: 'Gol de campo fallado' },
  'Missed Field Goal Return Touchdown': { accion: 'gol-de-campo', etiqueta: 'Touchdown tras gol de campo fallado' },
  'Passing Touchdown': { accion: 'pase-completo', etiqueta: 'Touchdown por pase' },
  'Rushing Touchdown': { accion: 'carrera', etiqueta: 'Touchdown por carrera' },
  'Pass Interception Return': { accion: 'intercepcion', etiqueta: 'Intercepción' },
  'Interception': { accion: 'intercepcion', etiqueta: 'Intercepción' },
  'Interception Return Touchdown': { accion: 'intercepcion', etiqueta: 'Intercepción para touchdown' },
  'Fumble Recovery (Own)': { accion: 'balon-suelto', etiqueta: 'Balón suelto recuperado' },
  'Fumble Recovery (Opponent)': { accion: 'balon-suelto', etiqueta: 'Balón perdido (fumble)' },
  'Fumble Return Touchdown': { accion: 'balon-suelto', etiqueta: 'Touchdown tras balón suelto' },
  'Sack Opp Fumble Recovery': { accion: 'captura', etiqueta: 'Captura y balón perdido' },
  'Safety': { accion: 'safety', etiqueta: 'Safety' },
  'Two-minute warning': { accion: 'aviso-dos-minutos', etiqueta: 'Aviso de los dos minutos' },
  'End Period': { accion: 'fin-de-periodo', etiqueta: 'Fin del cuarto' },
  'End of Half': { accion: 'fin-de-periodo', etiqueta: 'Medio tiempo' },
  'End of Regulation': { accion: 'fin-de-periodo', etiqueta: 'Fin del tiempo regular' },
  'End of Game': { accion: 'fin-de-partido', etiqueta: 'Final del partido' },
  'Two Point Pass': { accion: 'conversion-2', etiqueta: 'Conversión de 2 puntos' },
  'Two Point Rush': { accion: 'conversion-2', etiqueta: 'Conversión de 2 puntos' },
  'Defensive 2pt Conversion': { accion: 'conversion-2-defensiva', etiqueta: 'Conversión defensiva de 2 puntos' },
  'Extra Point Good': { accion: 'punto-extra', etiqueta: 'Punto extra' },
  'Extra Point Missed': { accion: 'punto-extra', etiqueta: 'Punto extra fallado' },
  'Blocked PAT': { accion: 'punto-extra', etiqueta: 'Punto extra bloqueado' },
  'Coin Toss': { accion: 'volado', etiqueta: 'Volado inicial' },
};

// ---------------------------------------------------------------------------
// Situación de la jugada (quién ataca, qué necesita, cuánto falta, cómo va el marcador)
// ---------------------------------------------------------------------------

function situar(jugada, ctx, h) {
  const inicio = jugada.start || {};
  const fin = jugada.end || {};
  const esPatadaDeSalida = h.accion === 'patada-de-salida';
  const sinPosesionClara = ['tiempo-fuera', 'tiempo-fuera-oficial', 'aviso-dos-minutos', 'fin-de-periodo', 'fin-de-partido'].includes(h.accion);
  const idInicio = inicio.team?.id ? String(inicio.team.id) : '';
  const idAtaque = sinPosesionClara ? String(ctx.equipoDrive || idInicio) : idInicio || String(ctx.equipoDrive || '');
  const ataque = equipoPorId(idAtaque, ctx);
  const defensa = rivalDe(ataque, ctx);
  const down = Number(inicio.down) || 0;
  const distancia = Number(inicio.distance) || 0;
  const ypa = yardasParaAnotar(inicio.yardLine, idAtaque, ctx);
  const periodo = Number(jugada.period?.number) || 0;
  const segundos = segundosDeReloj(jugada.clock?.displayValue);

  // Marcador antes y después, visto desde el ataque.
  const antes = ctx.marcadorAntes || null;
  const despues = typeof jugada.homeScore === 'number' && typeof jugada.awayScore === 'number'
    ? { local: jugada.homeScore, visitante: jugada.awayScore }
    : null;
  let anota = null;
  let puntos = 0;
  if (antes && despues) {
    const dl = despues.local - antes.local;
    const dv = despues.visitante - antes.visitante;
    if (dl > 0 && dl >= dv) { anota = ctx.local || null; puntos = dl; }
    else if (dv > 0) { anota = ctx.visitante || null; puntos = dv; }
  }
  const esLocalAtaque = ataque && ctx.local ? ataque.id === ctx.local.id : null;
  const diferenciaAntes = antes && esLocalAtaque !== null
    ? (esLocalAtaque ? antes.local - antes.visitante : antes.visitante - antes.local)
    : null;

  const mismoEquipo = !!idInicio && !!fin.team?.id && String(fin.team.id) === idInicio;
  let ganadas = null;
  if (typeof inicio.yardLine === 'number' && typeof fin.yardLine === 'number' && esLocalAtaque !== null) {
    ganadas = esLocalAtaque ? fin.yardLine - inicio.yardLine : inicio.yardLine - fin.yardLine;
  }
  const deScrimmage = down >= 1 && down <= 4 && !esPatadaDeSalida;
  const primerDown = deScrimmage && !h.sinJugada && !h.touchdown && mismoEquipo && Number(fin.down) === 1
    && (ganadas === null ? true : ganadas >= distancia || distancia <= 0);
  const ypaFinal = mismoEquipo ? yardasParaAnotar(fin.yardLine, idAtaque, ctx) : null;

  return {
    ataque, defensa, idAtaque, down, distancia, ypa, ypaFinal, periodo, segundos, antes, despues,
    anota, puntos, diferenciaAntes, mismoEquipo, ganadas, primerDown, deScrimmage,
    golONada: deScrimmage && ypa !== null && distancia >= ypa,
    finalDeMitad: (periodo === 2 || periodo >= 4) && segundos !== null && segundos <= 120,
    cierre: periodo >= 4 && segundos !== null && segundos <= 300,
    finDown: Number(fin.down) || 0,
    finDistancia: Number(fin.distance) || 0,
    finYardLine: typeof fin.yardLine === 'number' ? fin.yardLine : null,
    finEquipo: equipoPorId(fin.team?.id, ctx),
  };
}

// ---------------------------------------------------------------------------
// Piezas de redacción compartidas
// ---------------------------------------------------------------------------

function textoPase(h) {
  const prof = h.profundidad === 'profundo' ? 'profundo' : h.profundidad === 'corto' ? 'corto' : '';
  const dir = h.direccion === 'centro' ? 'por el centro' : h.direccion ? `a la ${h.direccion}` : '';
  return ['pase', prof, dir].filter(Boolean).join(' ');
}

function textoHueco(hueco) {
  if (!hueco) return '';
  if (hueco === 'up the middle') return 'por el centro';
  const lado = hueco.startsWith('left') ? 'izquierda' : 'derecha';
  return hueco.endsWith('end') ? `por la banda ${lado}` : `por la ${lado}`;
}

function fraseMarcador(s, ctx) {
  if (!s.anota || !s.despues || !s.antes || !ctx.local || !ctx.visitante) return '';
  const esLocal = s.anota.id === ctx.local.id;
  const a = esLocal ? s.despues.local : s.despues.visitante;
  const b = esLocal ? s.despues.visitante : s.despues.local;
  const a0 = esLocal ? s.antes.local : s.antes.visitante;
  const b0 = esLocal ? s.antes.visitante : s.antes.local;
  const rival = esLocal ? ctx.visitante : ctx.local;
  const marcador = `${s.anota.nombre} ${a}, ${rival.nombre} ${b}`;
  if (a > b && a0 < b0) return `Le dan la vuelta al marcador: ${marcador}`;
  if (a > b && a0 === b0) return a0 === 0 ? `Abren el marcador: ${marcador}` : `Rompen el empate: ${marcador}`;
  if (a > b) return `Amplían su ventaja: ${marcador}`;
  if (a === b) return `Empatan el partido: ${marcador}`;
  return `Se acercan en el marcador: ${marcador}`;
}

// Intento extra después de un touchdown, leído de los datos estructurados o del texto.
function fraseIntentoExtra(jugada, h) {
  const paa = jugada.pointAfterAttempt;
  let puntoExtra = h.puntoExtra || null;
  let conversion = h.conversion2 || null;
  if (paa && typeof paa.id !== 'undefined') {
    const id = Number(paa.id);
    if (id === 61) puntoExtra = 'bueno';
    else if (id === 62) puntoExtra = 'fallado';
    else if (id === 43) puntoExtra = 'bloqueado';
    else if (id === 15 || id === 16) conversion = { tipo: id === 15 ? 'pase' : 'carrera', exito: Number(paa.value) > 0 };
  }
  if (conversion) {
    return conversion.exito
      ? { texto: 'En lugar de patear, van por la conversión de 2 puntos y la consiguen: 8 puntos en total', conceptos: ['conversion-de-2'] }
      : { texto: 'En lugar de patear, intentan la conversión de 2 puntos, pero la defensa la detiene: se quedan con los 6 del touchdown', conceptos: ['conversion-de-2'] };
  }
  if (puntoExtra === 'bueno') return { texto: 'El punto extra es bueno: 7 puntos en total', conceptos: ['punto-extra'] };
  if (puntoExtra === 'fallado') return { texto: 'Fallan la patada del punto extra, así que se quedan solo con los 6 del touchdown', conceptos: ['punto-extra'] };
  if (puntoExtra === 'bloqueado') return { texto: 'La defensa bloquea la patada del punto extra: se quedan solo con los 6 del touchdown', conceptos: ['punto-extra', 'patada-bloqueada'] };
  return { texto: '', conceptos: [] };
}

function fraseTouchdown(jugada, h, s, ctx, quien) {
  const equipo = s.anota || quien || s.ataque;
  const extra = fraseIntentoExtra(jugada, h);
  return {
    frases: [`¡Touchdown ${deLos(equipo)}! Vale 6 puntos`, extra.texto, fraseMarcador(s, ctx)],
    conceptos: ['touchdown', ...extra.conceptos],
  };
}

function fraseBalonSuelto(h, s, ctx, jugada) {
  const b = h.balonSuelto;
  if (!b) return null;
  const recupera = equipoPorAbrev(b.equipoRecupera, ctx);
  const loTeniaElAtaque = h.accion !== 'intercepcion' && h.accion !== 'patada-de-salida' && h.accion !== 'despeje';
  const forzado = b.forzadoPor ? `, forzado por ${nombreJugador(b.forzadoPor.split(/[,;]/)[0])}` : '';
  if (b.recuperaElMismo || b.fueraDelCampo || (recupera && s.finEquipo && recupera.id === s.finEquipo.id && s.mismoEquipo && loTeniaElAtaque)) {
    const como = b.fueraDelCampo ? 'pero el balón sale del campo y lo conservan' : 'pero lo recupera su propio equipo y conservan el balón';
    return { texto: `Se le suelta el balón (fumble)${forzado}, ${como}`, perdida: false };
  }
  if (recupera) {
    const perdida = jugada.isTurnover === true || !s.mismoEquipo;
    if (perdida) {
      return {
        texto: `Pierde el balón (fumble)${forzado} y lo recupera ${nombreJugador(b.jugadorRecupera)} para ${los(recupera)}: cambio de posesión`,
        perdida: true,
        recupera,
      };
    }
    return { texto: `Se le suelta el balón (fumble)${forzado}, pero ${los(recupera)} lo recuperan y siguen con la posesión`, perdida: false };
  }
  return { texto: `Se le suelta el balón (fumble)${forzado}`, perdida: jugada.isTurnover === true };
}

function fraseRevision(h) {
  if (!h.revision) return '';
  if (h.revision.resultado === 'revertida') {
    return h.revision.quien
      ? 'Los árbitros habían marcado otra cosa, pero un entrenador pidió revisar el video y la decisión se cambió'
      : 'Los árbitros habían marcado otra cosa, pero la revisión en video cambió la decisión';
  }
  return h.revision.quien
    ? 'Un entrenador pidió revisar la jugada en video y los árbitros mantuvieron su decisión; ese reclamo fallido le cuesta un tiempo fuera'
    : 'Los árbitros revisaron la jugada en video y mantuvieron su decisión';
}

// Qué pasó con las oportunidades después de una jugada de ataque normal.
function fraseDowns(jugada, h, s, semilla) {
  if (!s.deScrimmage || h.sinJugada || h.touchdown || s.puntos) return { texto: '', conceptos: [] };
  if (s.primerDown) {
    if (s.down === 4) return { texto: 'Se la jugaron en cuarta oportunidad y les salió: primer down y conservan el balón', conceptos: ['cuarta-oportunidad', 'primer-down'] };
    if (s.down === 3) {
      return {
        texto: elegir([
          'Era tercera oportunidad y la convierten: primer down, siguen atacando',
          'Con eso superan la marca en tercera oportunidad: primer down y cuatro intentos nuevos',
          'Lo necesitaban en tercera oportunidad y lo consiguen: primer down',
        ], semilla + 'd3'),
        conceptos: ['tercera-oportunidad', 'primer-down'],
      };
    }
    return {
      texto: elegir([
        'Alcanza para primer down: cuatro oportunidades nuevas',
        'Primer down: la cuenta de oportunidades vuelve a empezar',
        'Con eso consiguen el primer down y siguen avanzando',
        'Superan la marca: primer down',
      ], semilla + 'd1'),
      conceptos: ['primer-down'],
    };
  }
  const perdioPorDowns = s.down === 4 && !s.mismoEquipo && jugada.isTurnover !== true && !(h.balonSuelto && h.balonSuelto.equipoRecupera);
  if (perdioPorDowns) {
    return {
      texto: `Era cuarta oportunidad y no llegaron: el balón pasa a ${los(s.defensa)} en ese mismo punto`,
      conceptos: ['cuarta-oportunidad', 'entrega-por-downs'],
    };
  }
  if (s.down === 3 && s.mismoEquipo && s.finDown === 4) {
    return {
      texto: elegir([
        `No alcanza: queda cuarta oportunidad y ${yardasTexto(s.finDistancia)} por ganar, así que toca decidir si patean o se la juegan`,
        `Se quedan cortos en tercera oportunidad. Viene la cuarta, con ${yardasTexto(s.finDistancia)} por ganar: lo normal es patear`,
        `Fallan en tercera oportunidad: les faltaron ${yardasTexto(s.finDistancia)} y ahora casi seguro patean`,
      ], semilla + 'f3'),
      conceptos: ['tercera-oportunidad', 'cuarta-oportunidad'],
    };
  }
  return { texto: '', conceptos: [] };
}

// Por qué tiene sentido la decisión que se tomó en cuarta oportunidad.
function porQueCuarta(tipo, s) {
  const dGol = s.ypa !== null ? s.ypa + 18 : null;
  if (tipo === 'despeje') {
    if (s.ypa === null) return 'En cuarta oportunidad, si se la juegan y fallan entregan el balón ahí mismo. Con la patada lo alejan de su zona de anotación.';
    if (s.ypa >= 80) return `Es cuarta oportunidad y están en ${describirYardaRelativa(s.ypa)}, muy cerca de su propia zona de anotación. Si se la juegan y fallan, el rival recibe el balón a un paso de anotar; por eso lo alejan con una patada.`;
    if (s.ypa >= 65) return `Es cuarta oportunidad${s.distancia ? ` con ${yardasTexto(s.distancia)} por ganar` : ''} y están en ${describirYardaRelativa(s.ypa)}. Si se la juegan y fallan, el rival recibe el balón ya en posición de sumar puntos; por eso lo alejan con una patada.`;
    if (s.ypa > 45) return `Es cuarta oportunidad y faltaban ${yardasTexto(s.distancia)}. Fallar sería entregar el balón aquí mismo, y un gol de campo sería de unas ${dGol} yardas, demasiado lejos. Con el despeje obligan al rival a recorrer casi todo el campo.`;
    return `Ya están en terreno rival, pero un gol de campo sería de unas ${dGol} yardas y faltaban ${yardasTexto(s.distancia)} para renovar. Prefieren despejar corto y dejar al rival encerrado junto a su propia zona de anotación.`;
  }
  if (tipo === 'gol') {
    const seAcaba = s.segundos !== null && s.segundos <= 20 && (s.periodo === 2 || s.periodo >= 4);
    if (s.down !== 4) {
      if (s.periodo >= 5) return 'No hacía falta esperar a la cuarta oportunidad: en tiempo extra, estos 3 puntos pueden decidir el partido.';
      if (seAcaba) return 'No era cuarta oportunidad, pero el reloj estaba por agotarse: era patear ahora o irse sin puntos.';
      return 'Patean antes de la cuarta oportunidad para asegurar los puntos mientras todavía hay tiempo en el reloj.';
    }
    if (seAcaba) return 'Era cuarta oportunidad y casi no quedaba tiempo: la patada era la única forma de sumar.';
    if (s.distancia <= 2) return `Faltaba poco (${yardasTexto(s.distancia)}) para el primer down, pero prefieren asegurar 3 puntos antes que arriesgarse a quedarse sin nada.`;
    if (s.ypa !== null && s.ypa <= 10) return `Estaban a ${yardasTexto(s.ypa)} del touchdown, pero en cuarta oportunidad y con ${yardasTexto(s.distancia)} por ganar eligen lo seguro: 3 puntos casi garantizados.`;
    return `En cuarta oportunidad y con ${yardasTexto(s.distancia)} por ganar, jugársela era arriesgado. Desde aquí la patada está al alcance, así que aseguran 3 puntos.`;
  }
  // Se la juegan.
  if (s.cierre && s.diferenciaAntes !== null && s.diferenciaAntes < 0) return 'Van perdiendo y queda poco tiempo: patear sería devolverle el balón al rival, así que se la juegan en cuarta oportunidad.';
  if (s.golONada && s.ypa !== null && s.ypa <= 3) return `Están a ${yardasTexto(s.ypa)} de la zona de anotación: en cuarta oportunidad prefieren buscar el touchdown antes que conformarse con 3 puntos.`;
  if (s.distancia <= 2) return `Es cuarta oportunidad, pero ${s.distancia === 1 ? 'falta solo 1 yarda' : `faltan solo ${yardasTexto(s.distancia)}`}: con tan poco por ganar, se la juegan en lugar de patear.`;
  if (s.ypa !== null && s.ypa >= 33 && s.ypa <= 45) return 'Es cuarta oportunidad en tierra de nadie: demasiado lejos para un gol de campo seguro y demasiado cerca para que un despeje sirva de mucho. Por eso se la juegan.';
  if (s.diferenciaAntes !== null && s.diferenciaAntes < -8) return 'Van abajo por más de una anotación: en cuarta oportunidad arriesgan porque necesitan puntos, no solo alejar al rival.';
  return 'Decisión agresiva: en cuarta oportunidad lo habitual es patear, pero aquí se la juegan sabiendo que, si fallan, entregan el balón en este punto.';
}

// Contexto de reloj y marcador en momentos clave. Devuelve { clave, texto } o null.
function porQueReloj(h, s) {
  if (s.diferenciaAntes === null || s.segundos === null) return null;
  const ganando = s.diferenciaAntes > 0;
  const perdiendo = s.diferenciaAntes < 0;
  if (h.accion === 'carrera' && ganando && s.cierre) {
    return { clave: 'reloj-correr', texto: 'Van ganando y queda poco: corren porque, mientras el balón no salga del campo ni toque el suelo, el reloj sigue avanzando.' };
  }
  if ((perdiendo || s.diferenciaAntes === 0) && s.finalDeMitad && s.periodo >= 4) {
    if (h.accion === 'pase-completo' && h.fueraDelCampo) return { clave: 'reloj-banda', texto: 'El receptor sale del campo a propósito: así se detiene el reloj sin gastar un tiempo fuera.' };
    if (h.accion === 'pase-incompleto') return { clave: 'reloj-incompleto', texto: 'Al menos el pase incompleto detiene el reloj, que ahora es lo que más les importa.' };
  }
  if (s.finalDeMitad && s.periodo === 2 && h.accion === 'pase-completo' && h.fueraDelCampo) {
    return { clave: 'reloj-banda', texto: 'Con poco tiempo antes del medio tiempo, salir del campo detiene el reloj y les deja margen para otra jugada.' };
  }
  return null;
}

function fraseDefensa(nombres, semilla) {
  const quien = listaNombres(nombres.slice(0, 2));
  if (!quien) return '';
  return elegir([
    `${quien} defendió bien la jugada`,
    `Buena cobertura de ${quien}`,
    `${quien} llegó a tiempo para impedir la recepción`,
  ], semilla + 'def');
}

// ---------------------------------------------------------------------------
// Penales
// ---------------------------------------------------------------------------

function describirPenal(pen, jugada, s, ctx) {
  const info = buscarPenal(jugada.penalty?.type?.slug && pen.esPrincipal ? jugada.penalty.type.slug : pen.nombre) || buscarPenal(pen.nombre);
  const equipo = equipoPorAbrev(pen.equipo, ctx);
  const nombre = info ? info.nombre : `una falta (${pen.nombre})`;
  const explica = info ? info.explica : '';
  const jugador = pen.jugador ? ` (${nombreJugador(pen.jugador)})` : '';
  return { info, equipo, nombre, explica, jugador, concepto: info?.concepto || 'bandera' };
}

function explicarPenales(jugada, h, s, ctx, hayJugadaAntes) {
  const frases = [];
  const conceptos = ['bandera'];
  const penales = h.penales.map((p, i) => ({ ...p, esPrincipal: i === 0 && h.penales.length === 1 }));
  const compensados = penales.filter((p) => p.estado === 'compensado');
  const aceptados = penales.filter((p) => p.estado === 'aceptado');
  const rechazados = penales.filter((p) => p.estado === 'rechazado');

  if (compensados.length >= 2) {
    const nombres = compensados.slice(0, 2).map((p) => describirPenal(p, jugada, s, ctx));
    frases.push(`Hubo faltas de los dos equipos (${nombres.map((n) => n.nombre).join(' y ')}), así que se compensan${h.sinJugada ? ' y la jugada se repite' : ''}`);
    conceptos.push('penal-rechazado');
  }

  for (const pen of aceptados) {
    const d = describirPenal(pen, jugada, s, ctx);
    conceptos.push(d.concepto);
    const esDelAtaque = d.equipo && s.ataque ? d.equipo.id === s.ataque.id : null;
    const yd = pen.yardas ?? jugada.penalty?.yards ?? null;
    const cabeza = hayJugadaAntes
      ? `Pero hay bandera amarilla contra ${los(d.equipo)}${d.jugador}: ${d.nombre}`
      : `Bandera amarilla contra ${los(d.equipo)}${d.jugador}: ${d.nombre}`;
    frases.push(cabeza);
    if (d.explica) frases.push(mayuscula(d.explica));
    let costo = '';
    if (yd) {
      if (pen.sinJugada) {
        const primerDownRegalado = esDelAtaque === false && s.mismoEquipo && s.finDown === 1 && s.down !== 1;
        const primerDownIgual = esDelAtaque === false && s.mismoEquipo && s.finDown === 1 && s.down === 1;
        const son = yd === 1 ? 'Es' : 'Son';
        const soloYardas = /offside|encroachment|neutral zone|delay of game|too many men|12 on-?field|illegal substitution|running into the kicker|illegal formation|illegal shift/i.test(pen.nombre || '');
        if (primerDownRegalado && soloYardas) costo = `${son} ${yardasTexto(yd)} a favor ${deLos(s.ataque)}, suficientes para alcanzar el primer down`;
        else if (primerDownRegalado || (primerDownIgual && d.info?.extra)) costo = `${son} ${yardasTexto(yd)} a favor ${deLos(s.ataque)} y primer down automático`;
        else if (esDelAtaque === false) costo = `${son} ${yardasTexto(yd)} a favor ${deLos(s.ataque)} y la oportunidad se repite`;
        else if (h.accion === 'patada-de-salida') costo = `Les cuesta ${yardasTexto(yd)} y la patada se repite desde más atrás`;
        else if (esDelAtaque === true && s.mismoEquipo && s.finDown >= 1 && s.finDown <= 4) costo = `Retroceden ${yardasTexto(yd)} y se repite la oportunidad: ahora es ${ordinalCorto(s.finDown)} y ${s.finDistancia}`;
        else costo = `Les cuesta ${yardasTexto(yd)} y la jugada no cuenta`;
      } else if (pen.entreDowns) {
        costo = `Las ${yardasTexto(yd)} se cobran en la siguiente jugada`;
      } else {
        costo = `Les cuesta ${yardasTexto(yd)}, que se cobran al terminar la jugada`;
      }
    } else if (d.info?.extra) {
      costo = d.info.extra;
    } else if (pen.sinJugada) {
      costo = 'La jugada no cuenta';
    }
    if (costo) frases.push(costo);
    if (d.info?.extra && yd && pen.sinJugada && !/primer down automático/.test(costo) && /pierden|Pierden/.test(d.info.extra)) frases.push(d.info.extra);
  }

  for (const pen of rechazados) {
    const d = describirPenal(pen, jugada, s, ctx);
    const rival = rivalDe(d.equipo, ctx);
    frases.push(`También hubo bandera contra ${los(d.equipo)} por ${d.nombre}, pero ${rival ? `${los(rival)} la rechazan: les` : 'el rival la rechaza: le'} conviene más el resultado de la jugada`);
    conceptos.push('penal-rechazado');
  }
  return { frases, conceptos };
}

// ---------------------------------------------------------------------------
// Explicación por tipo de acción
// ---------------------------------------------------------------------------

function nuevaExplicacion(categoria, etiqueta) {
  return { categoria, etiqueta, frases: [], conceptos: [], porQue: null, destacada: false, menor: false };
}

function accionPase(jugada, h, s, ctx, semilla) {
  const e = nuevaExplicacion('pase', 'Pase completo');
  const q = nombreJugador(h.pasador) || 'El mariscal de campo';
  const r = nombreJugador(h.receptor) || 'su receptor';
  const y = h.lateral && typeof jugada.statYardage === 'number' ? jugada.statYardage : (h.yardas ?? jugada.statYardage ?? 0);
  const pase = textoPase(h);
  e.conceptos.push('pase-completo');
  if (h.profundidad === 'profundo') e.conceptos.push('pase-profundo');

  if (h.touchdown && !h.balonSuelto) {
    const como = y <= 12
      ? elegir([`${q} lanza un ${pase} y ${r} lo atrapa en la zona de anotación`, `${r} atrapa el ${pase} de ${q} dentro de la zona de anotación`], semilla)
      : elegir([`${q} conecta un ${pase} con ${r}, que llega hasta la zona de anotación: jugada de ${yardasTexto(y)}`, `${r} atrapa el ${pase} de ${q} y nadie lo alcanza: ${yardasTexto(y)} hasta la zona de anotación`], semilla);
    e.frases.push(como);
    return e;
  }
  if (y >= 20) {
    e.destacada = true;
    e.conceptos.push('jugada-grande');
    e.frases.push(elegir([
      `¡Jugada grande! ${q} conecta un ${pase} con ${r} y ganan ${yardasTexto(y)}`,
      `${q} encuentra a ${r} con un ${pase} y la jugada se estira ${yardasTexto(y)}`,
      `${r} atrapa el ${pase} de ${q} para una ganancia de ${yardasTexto(y)}, una de las jugadas largas de la serie`,
    ], semilla));
  } else if (y > 0) {
    e.frases.push(elegir([
      `${q} completa un ${pase} con ${r}: ${yardasTexto(y)}`,
      `${mayuscula(pase)} de ${q} para ${r}, que avanza ${yardasTexto(y)}`,
      `${r} atrapa el ${pase} de ${q} y ganan ${yardasTexto(y)}`,
      `${q} lanza un ${pase}, ${r} lo atrapa y suman ${yardasTexto(y)}`,
    ], semilla));
  } else if (y === 0) {
    e.frases.push(`${q} completa un ${pase} con ${r}, pero la defensa lo derriba de inmediato: sin ganancia`);
  } else {
    e.frases.push(`${q} completa un ${pase} con ${r}, pero lo derriban detrás de la línea de golpeo: pierden ${yardasTexto(y)}`);
    e.conceptos.push('linea-de-golpeo');
  }
  const yac = Number(jugada.yardsAfterCatch);
  if (y >= 12 && yac >= 10 && yac >= y * 0.6) {
    e.frases.push(yac >= y ? 'Todo el avance lo consiguió corriendo después de atrapar el balón' : `La mayor parte (${yardasTexto(yac)}) la ganó corriendo después de atrapar el balón`);
    e.conceptos.push('yardas-tras-la-recepcion');
  }
  if (h.lateral) {
    e.frases.push('Antes de caer, le pasó el balón hacia atrás a un compañero que siguió corriendo');
    e.conceptos.push('lateral');
  }
  return e;
}

function accionIncompleto(jugada, h, s, ctx, semilla) {
  const e = nuevaExplicacion('pase', 'Pase incompleto');
  const q = nombreJugador(h.pasador) || 'El mariscal de campo';
  const r = nombreJugador(h.receptor);
  const pase = textoPase(h);
  e.conceptos.push('pase-incompleto');
  if (r) {
    e.frases.push(elegir([
      `${q} busca a ${r} con un ${pase}, pero no se completa`,
      `${mayuscula(pase)} incompleto de ${q} para ${r}: el balón tocó el suelo antes de que alguien lo atrapara`,
      `${q} lanza un ${pase} hacia ${r} y cae incompleto`,
      `${q} le lanza a ${r}, pero el ${pase} no llega a sus manos: incompleto`,
    ], semilla));
  } else {
    e.frases.push(elegir([
      `${q} lanza un ${pase} sin ningún compañero cerca y cae incompleto`,
      `${mayuscula(pase)} incompleto de ${q}, lejos de cualquier receptor`,
    ], semilla));
  }
  if (h.defensores?.length) e.frases.push(fraseDefensa(h.defensores, semilla));
  else if (h.presion && !r) e.frases.push(`Lanzó apurado por la presión de ${nombreJugador(h.presion)}`);
  if (s.down === 1 || s.down === 2) {
    e.frases.push(elegir(['No se ganan yardas y se gasta una oportunidad', 'Se gasta una oportunidad sin avanzar', '', ''], semilla + 'g'));
  }
  return e;
}

function accionSpike(jugada, h) {
  const e = nuevaExplicacion('pase', 'Balón clavado (spike)');
  const q = nombreJugador(h.pasador) || 'El mariscal de campo';
  e.frases.push(`${q} clava el balón en el suelo a propósito para detener el reloj`, 'Les cuesta una oportunidad, pero ahorran segundos valiosos');
  e.conceptos.push('spike', 'manejo-del-reloj');
  return e;
}

function accionCarrera(jugada, h, s, ctx, semilla) {
  const e = nuevaExplicacion('carrera', h.escapada ? 'Carrera del mariscal' : 'Carrera');
  const r = nombreJugador(h.corredor) || 'El corredor';
  const y = h.yardas ?? jugada.statYardage ?? 0;
  const lado = textoHueco(h.hueco);
  e.conceptos.push(h.escapada ? 'scramble' : 'carrera');

  if (h.touchdown && !h.balonSuelto) {
    e.frases.push(y <= 5
      ? elegir([`${r} entra a la zona de anotación ${lado || 'por tierra'} desde ${yardasTexto(y)}`, `${r} empuja ${lado || 'por tierra'} y cruza la línea de gol desde ${yardasTexto(y)}`], semilla)
      : `${r} corre ${lado || 'por tierra'} y no lo detienen hasta la zona de anotación: ${yardasTexto(y)}`);
    return e;
  }
  if (h.escapada) {
    const base = `${r}, el mariscal de campo, no encuentra a quién lanzarle y sale corriendo${lado ? ` ${lado}` : ''}`;
    if (y > 0) e.frases.push(`${base}: gana ${yardasTexto(y)}`);
    else if (y === 0) e.frases.push(`${base}, pero no logra avanzar`);
    else e.frases.push(`${base}, pero lo alcanzan y pierde ${yardasTexto(y)}`);
    if (y >= 15) e.destacada = true;
    return e;
  }
  if (y >= 15) {
    e.destacada = true;
    if (y >= 20) e.conceptos.push('jugada-grande');
    e.frases.push(elegir([
      `¡Gran carrera! ${r} encuentra un hueco ${lado || 'en la defensa'} y se escapa ${yardasTexto(y)}`,
      `${r} rompe ${lado || 'la línea'} y no lo alcanzan hasta ${yardasTexto(y)} después`,
    ], semilla));
  } else if (y > 0) {
    e.frases.push(elegir([
      `${r} corre ${lado || 'con el balón'} y gana ${yardasTexto(y)}`,
      `Carrera de ${r}${lado ? ` ${lado}` : ''}: ${yardasTexto(y)}`,
      `${r} avanza ${yardasTexto(y)} por tierra${lado ? `, ${lado}` : ''}`,
      `Le entregan el balón a ${r}, que gana ${yardasTexto(y)}${lado ? ` ${lado}` : ''}`,
    ], semilla));
  } else if (y === 0) {
    e.frases.push(elegir([
      `${r} lo intenta ${lado || 'por tierra'}, pero la defensa lo frena en la línea: sin ganancia`,
      `Carrera de ${r}${lado ? ` ${lado}` : ''} sin ganancia: la defensa cerró el hueco`,
    ], semilla));
  } else {
    e.frases.push(elegir([
      `La defensa se mete y derriba a ${r} detrás de la línea de golpeo: pierden ${yardasTexto(y)}`,
      `${r} no encuentra por dónde pasar y lo derriban antes de la línea: ${yardasTexto(y)} de pérdida`,
    ], semilla));
    e.conceptos.push('linea-de-golpeo');
  }
  return e;
}

function accionArrodillarse(jugada, h, s) {
  const e = nuevaExplicacion('carrera', 'Rodilla al suelo');
  const q = nombreJugador(h.corredor) || 'El mariscal de campo';
  e.frases.push(`${q} recibe el balón y pone la rodilla en el suelo a propósito`, 'Pierden una yarda, pero el reloj sigue corriendo sin ningún riesgo');
  e.conceptos.push('arrodillarse', 'manejo-del-reloj');
  if (s.periodo === 2) e.porQue = { clave: 'rodilla', texto: 'Queda muy poco para el medio tiempo y prefieren irse al descanso sin arriesgar el balón.' };
  else if (s.diferenciaAntes !== null && s.diferenciaAntes > 0) e.porQue = { clave: 'rodilla', texto: 'Van ganando y al rival ya no le alcanzan los tiempos fuera para parar el reloj: así se termina el partido sin exponerse a perder el balón.' };
  else if (s.diferenciaAntes === 0) e.porQue = { clave: 'rodilla', texto: 'Con el partido empatado y tan poco tiempo, prefieren no arriesgar y llevar el partido al tiempo extra.' };
  return e;
}

function accionCaptura(jugada, h, s, ctx, semilla) {
  const e = nuevaExplicacion('pase', 'Captura (sack)');
  const q = nombreJugador(h.pasador) || 'el mariscal de campo';
  const quienes = listaNombres(h.capturadores || []);
  const y = Math.abs(h.yardas ?? jugada.statYardage ?? 0);
  e.conceptos.push('sack');
  e.destacada = y >= 8;
  const perdida = y > 0 ? `pierden ${yardasTexto(y)}` : 'no pierden yardas, pero sí la oportunidad';
  if (quienes) {
    e.frases.push(elegir([
      `¡Captura! ${quienes} ${h.capturadores.length > 1 ? 'derriban' : 'derriba'} a ${q} antes de que pueda lanzar: ${perdida}`,
      `${quienes} ${h.capturadores.length > 1 ? 'llegan' : 'llega'} hasta ${q} y lo ${h.capturadores.length > 1 ? 'derriban' : 'derriba'} con el balón en la mano: ${perdida}`,
      `La defensa atrapa a ${q} detrás de la línea de golpeo (captura de ${quienes}): ${perdida}`,
    ], semilla));
  } else {
    e.frases.push(`¡Captura! La defensa derriba a ${q} antes de que pueda lanzar: ${perdida}`);
  }
  return e;
}

function accionIntercepcion(jugada, h, s, ctx) {
  const e = nuevaExplicacion('perdida', 'Intercepción');
  const q = nombreJugador(h.pasador) || 'el mariscal de campo';
  const d = nombreJugador(h.interceptor) || 'un defensor';
  const r = nombreJugador(h.receptor);
  e.destacada = true;
  e.conceptos.push('intercepcion', 'perdida-de-balon');
  e.frases.push(`¡Intercepción! ${d} atrapa el ${textoPase(h)} de ${q}${r ? ` que iba para ${r}` : ''}`);
  const ret = h.intercepcion?.retorno;
  if (h.touchdown) {
    e.frases.push(`Y lo lleva${ret?.yardas ? ` ${yardasTexto(ret.yardas)}` : ''} hasta la zona de anotación contraria`);
    e.conceptos.push('pick-six');
    e.categoria = 'anotacion';
    e.etiqueta = 'Intercepción para touchdown';
    return e;
  }
  const nuevo = s.finEquipo && s.ataque && s.finEquipo.id !== s.ataque.id ? s.finEquipo : s.defensa;
  if (h.intercepcion?.touchback) {
    e.frases.push(`La atrapó dentro de su propia zona de anotación y no salió (touchback): ${los(nuevo)} empiezan a atacar desde su yarda 20`);
    e.conceptos.push('touchback');
  } else if (h.balonSuelto?.equipoRecupera && s.mismoEquipo) {
    e.frases.push('Pero en el regreso se le suelta el balón y lo recupera el equipo que había lanzado: conservan la posesión');
    e.conceptos.push('fumble');
  } else {
    const regreso = ret && ret.yardas > 0 ? ` Lo regresó ${yardasTexto(ret.yardas)}` : '';
    const donde = s.finYardLine !== null ? ` desde ${describirYardaPara(s.finYardLine, nuevo, ctx)}` : '';
    e.frases.push(`El balón cambia de manos: ahora atacan ${los(nuevo)}${donde}.${regreso}`);
  }
  return e;
}

function accionPatadaDeSalida(jugada, h, s, ctx, semilla) {
  const e = nuevaExplicacion('patada', 'Patada de salida');
  const pat = h.patada || {};
  const k = nombreJugador(pat.pateador) || 'El pateador';
  const patea = s.ataque;
  const recibe = s.defensa;
  e.conceptos.push('patada-de-salida');

  let apertura = '';
  if (s.segundos === 900 && s.periodo === 1) apertura = '¡Arranca el partido!';
  else if (s.segundos === 900 && s.periodo === 3) apertura = 'Arranca la segunda mitad.';
  else if (s.periodo >= 5 && s.segundos === 600) apertura = 'Arranca el tiempo extra.';

  if (pat.corta) {
    e.etiqueta = 'Patada corta (onside)';
    e.conceptos.push('patada-corta');
    e.destacada = true;
    const recupero = s.finEquipo && patea && s.finEquipo.id === patea.id;
    e.frases.push(`${k} patea corto a propósito (onside kick): ${los(patea)} intentan recuperar el balón ellos mismos en lugar de entregarlo`);
    e.frases.push(recupero ? '¡Y lo recuperan! Conservan el balón' : `No funciona: lo atrapan ${los(recibe)}, que empiezan a atacar con muy buena posición de campo`);
    e.porQue = { clave: 'patada-corta', texto: 'Una patada corta casi nunca sale bien, así que solo se intenta cuando vas perdiendo y no queda tiempo para esperar otra oportunidad.' };
    return e;
  }

  const inicioFrase = `${apertura ? `${apertura} ` : ''}${k} patea de salida para ${los(patea)}`;
  if (pat.touchback) {
    const yd = pat.yardaTouchback || 35;
    e.conceptos.push('touchback');
    e.frases.push(elegir([
      `${inicioFrase} y el balón llega a la zona de anotación sin regreso (touchback): ${los(recibe)} empiezan en su yarda ${yd}`,
      `${inicioFrase}. Nadie la regresa (touchback), así que ${los(recibe)} arrancan desde su yarda ${yd}`,
    ], semilla));
    return e;
  }
  if (pat.cortaDeZona || pat.fuera) {
    e.frases.push(`${inicioFrase}, pero ${pat.fuera ? 'el balón sale del campo por un costado' : 'la patada se queda corta de la zona donde debe caer'}`);
    return e;
  }
  const ret = pat.retorno;
  if (h.touchdown && ret) {
    e.categoria = 'anotacion';
    e.etiqueta = 'Touchdown en regreso de patada';
    e.destacada = true;
    e.conceptos.push('regreso');
    e.frases.push(`${inicioFrase} y ${nombreJugador(ret.jugador)} la regresa ${yardasTexto(ret.yardas)} hasta la zona de anotación contraria, algo que pasa muy pocas veces`);
    return e;
  }
  if (ret) {
    e.conceptos.push('regreso');
    const donde = s.finYardLine !== null && !h.balonSuelto && !h.penales.length ? `, hasta ${describirYarda(s.finYardLine, ctx)}` : '';
    const muff = h.muff ? ' Se le escapa al recibirla, pero la recupera.' : '';
    e.frases.push(elegir([
      `${inicioFrase}.${muff} ${nombreJugador(ret.jugador)} la regresa ${yardasTexto(ret.yardas)}${donde}`,
      `${inicioFrase}.${muff} ${nombreJugador(ret.jugador)} la recibe y avanza ${yardasTexto(ret.yardas)}${donde}`,
    ], semilla));
    if (ret.yardas >= 40) e.destacada = true;
    return e;
  }
  e.frases.push(inicioFrase);
  if (s.finYardLine !== null && s.finEquipo) e.frases.push(`${mayuscula(los(s.finEquipo))} empiezan a atacar desde ${describirYardaPara(s.finYardLine, s.finEquipo, ctx)}`);
  return e;
}

function accionDespeje(jugada, h, s, ctx, semilla) {
  const e = nuevaExplicacion('patada', 'Despeje (punt)');
  const pat = h.patada || {};
  const k = nombreJugador(pat.pateador) || 'El despejador';
  const recibe = s.defensa;
  e.conceptos.push('punt');
  if (s.down === 4) {
    e.porQue = { clave: 'cuarta-despeje', texto: porQueCuarta('despeje', s) };
    e.conceptos.push('cuarta-oportunidad');
  }

  if (pat.bloqueada) {
    e.etiqueta = 'Despeje bloqueado';
    e.destacada = true;
    e.conceptos.push('patada-bloqueada');
    e.frases.push(`¡Despeje bloqueado! ${pat.bloqueadaPor ? nombreJugador(pat.bloqueadaPor) : 'La defensa'} alcanza a tapar la patada de ${k} y el balón queda suelto`);
    if (h.touchdown) {
      e.categoria = 'anotacion';
      e.etiqueta = 'Touchdown tras despeje bloqueado';
      e.frases.push('Lo recogen y lo llevan hasta la zona de anotación');
    } else if (s.finEquipo && s.finYardLine !== null) {
      e.frases.push(`Se lo quedan ${los(s.finEquipo)} en ${describirYardaPara(s.finYardLine, s.finEquipo, ctx)}`);
    }
    return e;
  }

  const base = `${k} despeja (punt) ${yardasTexto(pat.yardas)}`;
  const ret = pat.retorno;
  if (h.touchdown && ret) {
    e.categoria = 'anotacion';
    e.etiqueta = 'Touchdown en regreso de despeje';
    e.destacada = true;
    e.conceptos.push('regreso');
    e.frases.push(`${base}, pero ${nombreJugador(ret.jugador)} lo atrapa y lo regresa ${yardasTexto(ret.yardas)} hasta la zona de anotación contraria`);
    return e;
  }
  if (h.muff && h.balonSuelto === null && /RECOVERED by/.test(h.principal)) {
    e.etiqueta = 'Despeje mal recibido';
    e.destacada = true;
    e.conceptos.push('muff');
    const loRecupera = s.finEquipo;
    const esElQuePateo = loRecupera && s.ataque && loRecupera.id === s.ataque.id;
    e.frases.push(`${base} y al jugador que iba a recibirlo se le escapa el balón`);
    e.frases.push(esElQuePateo
      ? `Lo recupera el equipo que había pateado: ${los(loRecupera)} conservan el balón, ahora mucho más cerca de anotar`
      : `Por suerte para ${los(recibe)}, lo recuperan ellos mismos`);
    return e;
  }
  const donde = s.finYardLine !== null && s.finEquipo && !h.penales.some((p) => p.estado === 'aceptado') && !h.balonSuelto
    ? describirYardaPara(s.finYardLine, s.finEquipo, ctx)
    : '';
  if (pat.touchback) {
    e.conceptos.push('touchback');
    e.frases.push(`${base} y el balón entra a la zona de anotación (touchback): ${los(recibe)} empiezan en su yarda 20`);
  } else if (pat.recepcionLibre) {
    e.conceptos.push('recepcion-libre');
    e.frases.push(elegir([
      `${base}. ${nombreJugador(pat.receptor) || 'El receptor'} pide recepción libre (fair catch): nadie puede tocarlo, pero tampoco puede avanzar`,
      `${base} y ${nombreJugador(pat.receptor) || 'el receptor'} lo atrapa con recepción libre (fair catch), sin intentar regresarlo`,
    ], semilla));
    if (donde) e.frases.push(`${mayuscula(los(recibe))} empiezan en ${donde}`);
  } else if (pat.muerta) {
    e.frases.push(`${base}. Nadie lo atrapa y el equipo que pateó lo detiene antes de que llegue a la zona de anotación${donde ? `: ${los(recibe)} empiezan en ${donde}` : ''}`);
  } else if (pat.fuera) {
    e.frases.push(`${base} y el balón sale del campo${donde ? ` en ${donde}: ahí empiezan ${los(recibe)}` : ''}`);
  } else if (ret) {
    e.conceptos.push('regreso');
    const regreso = ret.yardas > 0 ? `lo regresa ${yardasTexto(ret.yardas)}` : ret.yardas < 0 ? `pierde ${yardasTexto(ret.yardas)} en el regreso` : 'lo atrapa, pero lo derriban de inmediato';
    e.frases.push(`${base}. ${nombreJugador(ret.jugador)} ${regreso}${donde ? `: ${los(recibe)} empiezan en ${donde}` : ''}`);
    if (ret.yardas >= 25) e.destacada = true;
  } else {
    e.frases.push(base);
    if (donde) e.frases.push(`${mayuscula(los(s.finEquipo))} empiezan en ${donde}`);
  }
  return e;
}

const DETALLE_FALLO = {
  'wide left': 'se fue desviado a la izquierda',
  'wide right': 'se fue desviado a la derecha',
  'hit right upright': 'pegó en el poste derecho',
  'hit left upright': 'pegó en el poste izquierdo',
  'hit crossbar': 'pegó en el travesaño',
  short: 'se quedó corto',
};

function accionGolDeCampo(jugada, h, s, ctx) {
  const g = h.golDeCampo || { yardas: s.ypa !== null ? s.ypa + 18 : null, resultado: jugada.scoringType?.name === 'field-goal' ? 'bueno' : 'fallado' };
  const k = nombreJugador(g.pateador) || 'El pateador';
  const dist = g.yardas ? ` de ${yardasTexto(g.yardas)}` : '';
  const e = nuevaExplicacion('patada', 'Gol de campo');
  e.conceptos.push('gol-de-campo');
  e.destacada = true;
  const larga = g.yardas >= 50 ? ', una patada larga' : '';
  if (g.resultado === 'bueno') {
    e.categoria = 'anotacion';
    e.frases.push(`¡Gol de campo${dist}! ${k} mete la patada entre los postes${larga}: 3 puntos para ${los(s.anota || s.ataque)}`);
    e.frases.push(fraseMarcador(s, ctx));
  } else if (g.resultado === 'bloqueado') {
    e.etiqueta = 'Gol de campo bloqueado';
    e.conceptos.push('patada-bloqueada');
    e.frases.push(`¡Bloqueado! ${g.bloqueadoPor ? nombreJugador(g.bloqueadoPor) : 'La defensa'} alcanza a tapar el intento de gol de campo${dist} de ${k}: no hay puntos`);
    if (h.touchdown) {
      e.categoria = 'anotacion';
      e.etiqueta = 'Touchdown tras gol de campo bloqueado';
      e.frases.push('La defensa recoge el balón y lo lleva hasta la zona de anotación contraria');
    } else if (s.finEquipo && s.ataque && s.finEquipo.id !== s.ataque.id) {
      e.frases.push(`El balón pasa a ${los(s.finEquipo)}`);
    }
  } else {
    e.etiqueta = 'Gol de campo fallado';
    const detalle = DETALLE_FALLO[String(g.detalle || '').toLowerCase()];
    e.frases.push(`${k} falla el gol de campo${dist}${detalle ? `: ${detalle}` : ''}`);
    e.frases.push(`No hay puntos y el balón pasa a ${los(s.defensa)}, que empiezan donde se intentó la patada`);
  }
  if (s.deScrimmage) {
    const metio = e.categoria === 'anotacion';
    const yardasPatada = Number(g.yardas) || null;
    e.porQue = metio
      ? { clave: 'cuarta-gol', texto: porQueCuarta('gol', s) }
      : { clave: 'cuarta-gol-fallado', texto: s.down === 4
        ? `Era cuarta oportunidad${s.distancia ? ` con ${yardasTexto(s.distancia)} por ganar` : ''}: en lugar de jugársela o despejar, buscaron los 3 puntos${yardasPatada && yardasPatada >= 50 ? `. Desde ${yardasPatada} yardas es una patada larga y difícil` : ''}. Al fallar, el rival se queda con el balón.`
        : 'Buscaban 3 puntos antes de que se acabara el tiempo. Al fallar, se van sin nada.' };
    if (s.down === 4) e.conceptos.push('cuarta-oportunidad');
  }
  return e;
}

function accionCentroFallido(jugada, h) {
  const e = nuevaExplicacion('carrera', 'Balón suelto');
  e.frases.push(`A ${nombreJugador(h.corredor) || 'el mariscal de campo'} se le escapa el balón en el intercambio con el centro, al arrancar la jugada`);
  e.conceptos.push('fumble');
  return e;
}

function accionTiempoFuera(jugada, h, s, ctx) {
  const e = nuevaExplicacion('pausa', 'Tiempo fuera');
  const t = h.tiempoFuera || {};
  const equipo = equipoPorAbrev(t.equipo, ctx);
  const cual = { 1: 'el primero', 2: 'el segundo', 3: 'el tercero y último' }[t.numero] || '';
  const quedan = t.numero >= 1 && t.numero <= 3 ? 3 - t.numero : null;
  e.conceptos.push('tiempo-fuera');
  e.frases.push(`Tiempo fuera ${deLos(equipo)}${cual ? `: es ${cual} que gastan en esta mitad` : ''}`);
  if (quedan !== null && s.periodo < 5) e.frases.push(quedan === 0 ? 'Ya no les queda ninguno' : `Les ${quedan === 1 ? 'queda 1' : `quedan ${quedan}`}`);
  // ¿Por qué ahora?
  const esDelAtaque = equipo && ctx.equipoDrive ? equipo.id === String(ctx.equipoDrive) : null;
  const defensaNecesitaTiempo = s.diferenciaAntes === null || s.diferenciaAntes >= 0;
  if (s.finalDeMitad && s.segundos !== null && s.segundos <= 10 && esDelAtaque !== null) {
    e.porQue = { clave: 'tf-final', texto: esDelAtaque
      ? 'Con tan pocos segundos, el ataque lo pide para preparar con calma su última jugada.'
      : 'Con tan pocos segundos, la defensa lo pide para acomodarse antes de la última jugada o, si viene una patada, para poner nervioso al pateador.' };
    e.conceptos.push('manejo-del-reloj');
  } else if (s.finalDeMitad && esDelAtaque === false && s.periodo >= 4 && defensaNecesitaTiempo) {
    e.porQue = { clave: 'tf-defensa', texto: 'Lo pide la defensa para detener el reloj: quiere que le quede tiempo cuando recupere el balón.' };
    e.conceptos.push('manejo-del-reloj');
  } else if (s.finalDeMitad && esDelAtaque === false && s.periodo === 2) {
    e.porQue = { clave: 'tf-defensa', texto: 'Lo pide la defensa para parar el reloj y tener tiempo de atacar antes del medio tiempo.' };
    e.conceptos.push('manejo-del-reloj');
  } else if (s.finalDeMitad && esDelAtaque === true) {
    e.porQue = { clave: 'tf-ataque', texto: 'Lo pide el ataque para detener el reloj y organizar la siguiente jugada sin perder segundos.' };
    e.conceptos.push('manejo-del-reloj');
  }
  e.menor = !e.porQue;
  return e;
}

function nombrePeriodo(n) {
  return { 1: 'primer cuarto', 2: 'segundo cuarto', 3: 'tercer cuarto', 4: 'último cuarto' }[n] || 'tiempo extra';
}

function accionFinDePeriodo(jugada, h, s, ctx) {
  const n = h.periodoTerminado || s.periodo;
  const e = nuevaExplicacion('pausa', 'Fin del cuarto');
  if (n === 2) {
    e.conceptos.push('medio-tiempo');
    e.etiqueta = 'Medio tiempo';
    e.frases.push('Termina la primera mitad', 'Al volver del descanso todo se reinicia con una patada de salida: la serie que estaba en curso no continúa');
  } else if (n === 4) {
    const empate = s.despues && s.despues.local === s.despues.visitante;
    if (empate || jugada.type?.text === 'End of Regulation') {
      e.etiqueta = 'Fin del tiempo regular';
      e.conceptos.push('tiempo-extra');
      e.frases.push('Se acaba el último cuarto con el marcador empatado: habrá tiempo extra', 'Son 10 minutos más y los dos equipos tienen derecho a una serie con el balón');
    } else {
      e.frases.push('Termina el último cuarto');
    }
  } else if (n === 1 || n === 3) {
    e.frases.push(`Termina el ${nombrePeriodo(n)}`, 'Los equipos solo cambian de lado: el ataque sigue con el balón donde lo tenía');
  } else {
    e.frases.push('Termina el periodo');
  }
  return e;
}

function accionFinDePartido(jugada, h, s, ctx) {
  const e = nuevaExplicacion('pausa', 'Final del partido');
  const m = s.despues;
  if (m && ctx.local && ctx.visitante) {
    if (m.local === m.visitante) e.frases.push(`Final del partido: empate ${m.local}-${m.visitante} entre ${los(ctx.local)} y ${los(ctx.visitante)}`);
    else {
      const gana = m.local > m.visitante ? ctx.local : ctx.visitante;
      const pierde = m.local > m.visitante ? ctx.visitante : ctx.local;
      e.frases.push(`Final del partido: ganan ${los(gana)} ${Math.max(m.local, m.visitante)}-${Math.min(m.local, m.visitante)} sobre ${los(pierde)}`);
    }
  } else {
    e.frases.push('Final del partido');
  }
  e.destacada = true;
  return e;
}

function accionSafety(jugada, h, s, ctx) {
  const e = nuevaExplicacion('anotacion', 'Safety');
  const equipo = s.anota || s.defensa;
  e.destacada = true;
  e.conceptos.push('safety');
  e.frases.push(`¡Safety! El ataque se queda atrapado con el balón dentro de su propia zona de anotación: 2 puntos para ${los(equipo)}`);
  e.frases.push('Además, el equipo que lo sufrió tiene que patearle el balón al rival');
  e.frases.push(fraseMarcador(s, ctx));
  return e;
}

// Respaldo: nunca rompe, aunque falte todo.
function accionRespaldo(jugada, h, s, ctx) {
  const tipo = TIPOS_ESPN[jugada?.type?.text];
  const e = nuevaExplicacion('otro', tipo ? tipo.etiqueta : 'Jugada');
  const y = typeof jugada?.statYardage === 'number' ? jugada.statYardage : null;
  const quien = s?.ataque ? los(s.ataque) : 'el ataque';
  if (tipo?.accion === 'conversion-2-defensiva') {
    e.categoria = 'anotacion';
    e.accion = 'conversion-2-defensiva';
    e.conceptos.push('conversion-de-2');
    e.destacada = true;
    e.frases.push('Jugada rarísima: la defensa recupera el balón durante el intento extra y lo lleva hasta la otra zona de anotación. Vale 2 puntos para el equipo que defendía');
    e.frases.push(fraseMarcador(s, ctx));
  } else if (tipo?.accion === 'conversion-2') {
    e.categoria = 'anotacion';
    e.conceptos.push('conversion-de-2');
    e.frases.push(`Intento de conversión de 2 puntos ${deLos(s?.ataque)}: una sola jugada desde la yarda 2 en lugar de patear el punto extra`);
  } else if (tipo?.accion === 'punto-extra') {
    e.categoria = 'anotacion';
    e.conceptos.push('punto-extra');
    e.frases.push(/Good/.test(jugada.type.text) ? 'El punto extra es bueno: suma 1 punto después del touchdown' : 'No entra la patada del punto extra');
  } else if (tipo?.accion === 'volado') {
    e.categoria = 'pausa';
    e.frases.push('Volado inicial: se lanza una moneda para decidir quién recibe el balón primero y qué lado defiende cada equipo');
  } else if (tipo?.accion === 'pase' || tipo?.accion === 'pase-completo') {
    e.categoria = 'pase';
    e.conceptos.push('pase-completo');
    e.frases.push(y !== null && y !== 0 ? `Pase ${deLos(s?.ataque)} para ${y > 0 ? 'una ganancia' : 'una pérdida'} de ${yardasTexto(y)}` : `Jugada de pase ${deLos(s?.ataque)}`);
  } else if (tipo?.accion === 'pase-incompleto') {
    e.categoria = 'pase';
    e.conceptos.push('pase-incompleto');
    e.frases.push(`Pase incompleto ${deLos(s?.ataque)}: no se ganan yardas`);
  } else if (tipo?.accion === 'carrera') {
    e.categoria = 'carrera';
    e.conceptos.push('carrera');
    e.frases.push(y !== null && y !== 0 ? `Carrera ${deLos(s?.ataque)} para ${y > 0 ? 'una ganancia' : 'una pérdida'} de ${yardasTexto(y)}` : `Jugada por tierra ${deLos(s?.ataque)}`);
  } else if (tipo?.accion === 'captura') {
    e.categoria = 'pase';
    e.conceptos.push('sack');
    e.frases.push(`Captura: la defensa derriba al mariscal de campo ${deLos(s?.ataque)} antes de que pueda lanzar`);
  } else if (tipo?.accion === 'intercepcion') {
    e.categoria = 'perdida';
    e.conceptos.push('intercepcion');
    e.frases.push('Intercepción: la defensa atrapa el pase y se queda con el balón');
  } else if (tipo?.accion === 'balon-suelto') {
    e.categoria = jugada.isTurnover ? 'perdida' : 'otro';
    e.conceptos.push('fumble');
    e.frases.push(jugada.isTurnover ? 'Balón suelto (fumble) que recupera la defensa: cambio de posesión' : 'Balón suelto (fumble), pero el ataque lo recupera');
  } else if (tipo?.accion === 'patada-de-salida') {
    e.categoria = 'patada';
    e.conceptos.push('patada-de-salida');
    e.frases.push('Patada de salida: un equipo le entrega el balón al otro para que empiece a atacar');
  } else if (tipo?.accion === 'despeje') {
    e.categoria = 'patada';
    e.conceptos.push('punt');
    e.frases.push(`Despeje (punt): ${quien} patean el balón para alejar al rival`);
  } else if (tipo?.accion === 'gol-de-campo') {
    e.categoria = 'patada';
    e.conceptos.push('gol-de-campo');
    e.frases.push('Intento de gol de campo: una patada entre los postes que vale 3 puntos');
  } else if (tipo) {
    e.frases.push(`${tipo.etiqueta}`);
  } else {
    e.frases.push('Jugada registrada. Todavía no tenemos una explicación para este tipo de jugada, pero puedes leer la descripción original');
  }
  if (jugada?.scoringType?.name === 'touchdown' && !e.frases.some((f) => /Touchdown/.test(f))) {
    e.categoria = 'anotacion';
    e.conceptos.push('touchdown');
    e.destacada = true;
  }
  return e;
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

const ACCIONES = {
  'pase-completo': accionPase,
  'pase-incompleto': accionIncompleto,
  spike: accionSpike,
  carrera: accionCarrera,
  arrodillarse: accionArrodillarse,
  captura: accionCaptura,
  intercepcion: accionIntercepcion,
  'patada-de-salida': accionPatadaDeSalida,
  despeje: accionDespeje,
  'gol-de-campo': accionGolDeCampo,
  'centro-fallido': accionCentroFallido,
  'tiempo-fuera': accionTiempoFuera,
  'fin-de-periodo': accionFinDePeriodo,
  'fin-de-partido': accionFinDePartido,
  safety: accionSafety,
};

function explicarSinRed(jugada, ctx) {
  const h = analizarTexto(jugada.text);
  const tipoTexto = jugada.type?.text || '';
  const tipo = TIPOS_ESPN[tipoTexto];

  // Si el texto no dijo qué pasó, se usa el tipo de ESPN para las pausas (son inequívocas).
  if (h.accion === 'desconocida' && tipo && ['tiempo-fuera-oficial', 'aviso-dos-minutos', 'fin-de-periodo', 'fin-de-partido', 'tiempo-fuera', 'safety'].includes(tipo.accion)) {
    h.accion = tipo.accion;
  }
  const s = situar(jugada, ctx, h);
  const semilla = String(jugada.id || jugada.text || '');
  let e;

  if (h.accion === 'tiempo-fuera-oficial') {
    e = nuevaExplicacion('pausa', 'Pausa oficial');
    e.menor = true;
    e.frases.push(elegir([
      'Pausa de los árbitros. Suele ser para la televisión, para atender a un jugador o para ordenar algo en el campo; no le cuesta un tiempo fuera a nadie',
      'Los árbitros detienen el partido un momento. No cuenta como tiempo fuera de ningún equipo',
      'Pausa oficial: el reloj se detiene sin que ningún equipo gaste un tiempo fuera',
    ], semilla));
  } else if (h.accion === 'aviso-dos-minutos') {
    e = nuevaExplicacion('pausa', 'Aviso de los dos minutos');
    e.frases.push(`Aviso de los dos minutos: pausa automática cuando quedan 2 minutos en ${s.periodo === 2 ? 'la primera mitad' : 'el partido'}`, 'Funciona como un tiempo fuera gratis para los dos equipos');
    e.conceptos.push('aviso-de-dos-minutos');
  } else if (h.sinJugada || h.accion === 'solo-penal') {
    // La jugada no cuenta: lo que importa es el penal.
    e = nuevaExplicacion('penal', 'Penal');
    let previa = '';
    if (/extra point is|TWO-POINT CONVERSION/.test(h.principal || '')) { previa = 'La bandera cayó durante el intento extra que sigue al touchdown, así que ese intento se repite'; e.accion = 'intento-extra-anulado'; }
    else if (h.touchdownAnulado) previa = 'Habían llegado a la zona de anotación, pero la jugada no cuenta';
    else if (h.accion === 'pase-incompleto') previa = 'El pase fue incompleto, pero la jugada no termina ahí';
    else if (h.accion === 'pase-completo' && h.yardas !== null) previa = `El pase de ${yardasTexto(h.yardas)} no cuenta`;
    else if (h.accion === 'carrera' && h.yardas !== null && h.yardas > 0) previa = `La carrera de ${yardasTexto(h.yardas)} no cuenta`;
    else if (h.accion === 'captura') previa = 'La captura no cuenta';
    else if (h.accion === 'intercepcion') previa = 'La intercepción no cuenta';
    else if (h.accion === 'despeje') previa = 'El despeje se tiene que repetir o anular';
    else if (h.accion === 'patada-de-salida') previa = 'La patada de salida no cuenta';
    if (previa) e.frases.push(previa);
    const pen = explicarPenales(jugada, h, s, ctx, false);
    if (pen.frases.length) e.frases.push(...pen.frases);
    else if (jugada.penalty?.type?.text) {
      const info = buscarPenal(jugada.penalty.type.slug || jugada.penalty.type.text);
      e.frases.push(`Bandera amarilla: ${info ? info.nombre : jugada.penalty.type.text}`, info ? mayuscula(info.explica) : '');
    } else e.frases.push('Bandera amarilla: hubo una falta y la jugada no cuenta');
    e.conceptos.push(...pen.conceptos);
    if (!e.conceptos.includes('bandera')) e.conceptos.push('bandera');
    e.destacada = h.touchdownAnulado;
  } else {
    let accion = h.accion;
    if (accion === 'desconocida' || accion === 'regreso-corto') {
      // Sin texto útil: se confía en el tipo de ESPN.
      e = h.safety || tipo?.accion === 'safety' ? accionSafety(jugada, h, s, ctx) : accionRespaldo(jugada, h, s, ctx);
      if (accion === 'regreso-corto' && h.regresador) {
        e.frases.unshift(`${nombreJugador(h.regresador)} recupera el balón y lo lleva ${yardasTexto(h.yardas)} hasta la zona de anotación`);
      }
    } else {
      e = (ACCIONES[accion] || accionRespaldo)(jugada, h, s, ctx, semilla);
    }

    // Balón suelto dentro de la jugada.
    const bs = fraseBalonSuelto(h, s, ctx, jugada);
    if (bs && accion !== 'centro-fallido') {
      e.frases.push(bs.texto);
      e.conceptos.push('fumble');
      if (bs.perdida) {
        e.categoria = 'perdida';
        e.etiqueta = accion === 'captura' ? 'Captura y balón perdido' : 'Balón perdido (fumble)';
        e.conceptos.push('perdida-de-balon');
        e.destacada = true;
      }
    } else if (bs && accion === 'centro-fallido') {
      const b = h.balonSuelto;
      const recupera = equipoPorAbrev(b.equipoRecupera, ctx);
      if (jugada.isTurnover === true || (recupera && s.ataque && recupera.id !== s.ataque.id)) {
        e.frases.push(`${recupera ? `Lo recuperan ${los(recupera)}` : 'Lo recupera la defensa'}: cambio de posesión`);
        e.categoria = 'perdida';
        e.etiqueta = 'Balón perdido (fumble)';
        e.conceptos.push('perdida-de-balon');
        e.destacada = true;
      } else {
        e.frases.push('Lo recupera su propio equipo, así que conservan el balón, aunque la jugada se echó a perder');
      }
    }

    // Anotaciones.
    const esTd = (h.touchdown || jugada.scoringType?.name === 'touchdown') && !h.touchdownAnulado;
    if (esTd) {
      const td = fraseTouchdown(jugada, h, s, ctx);
      e.frases.push(...td.frases);
      e.conceptos.push(...td.conceptos);
      e.categoria = 'anotacion';
      if (e.etiqueta === 'Pase completo') e.etiqueta = 'Touchdown por pase';
      else if (e.etiqueta === 'Carrera' || e.etiqueta === 'Carrera del mariscal') e.etiqueta = 'Touchdown por carrera';
      else if (!/Touchdown|touchdown/.test(e.etiqueta)) e.etiqueta = 'Touchdown';
      e.destacada = true;
    } else if ((h.safety || jugada.scoringType?.name === 'safety') && accion !== 'safety' && accion !== 'desconocida') {
      const sf = accionSafety(jugada, h, s, ctx);
      e.frases.push(...sf.frases);
      e.conceptos.push('safety');
      e.categoria = 'anotacion';
      e.etiqueta = 'Safety';
      e.destacada = true;
    }

    // Oportunidades: primer down, tercera fallida, entrega por downs.
    if (['pase-completo', 'pase-incompleto', 'carrera', 'captura', 'centro-fallido'].includes(accion) && e.categoria !== 'perdida') {
      const d = fraseDowns(jugada, h, s, semilla);
      if (d.texto) { e.frases.push(d.texto); e.conceptos.push(...d.conceptos); }
      if (s.down === 4 && accion !== 'centro-fallido') {
        e.porQue = { clave: 'cuarta-jugarsela', texto: porQueCuarta('jugarsela', s) };
        e.destacada = true;
        if (!e.conceptos.includes('cuarta-oportunidad')) e.conceptos.push('cuarta-oportunidad');
      }
    } else if (s.down === 4 && ['pase-completo', 'pase-incompleto', 'carrera', 'captura'].includes(accion)) {
      e.porQue = { clave: 'cuarta-jugarsela', texto: porQueCuarta('jugarsela', s) };
    }

    // Penales que acompañan a una jugada que sí contó.
    if (h.penales.length) {
      const pen = explicarPenales(jugada, h, s, ctx, true);
      e.frases.push(...pen.frases);
      e.conceptos.push(...pen.conceptos);
    }

    // Entrada a la zona roja (solo se avisa una vez por serie; lo filtra modelo.js).
    if (!e.porQue && s.deScrimmage && s.mismoEquipo && s.ypa !== null && s.ypa > 20 && s.ypaFinal !== null && s.ypaFinal <= 20 && s.ypaFinal > 0 && !esTd) {
      e.porQue = { clave: 'zona-roja', texto: `Con esto entran a la zona roja: están a ${yardasTexto(s.ypaFinal)} de anotar y, como mínimo, ya tienen cerca el gol de campo.` };
      e.conceptos.push('zona-roja');
    }
    if (!e.porQue) e.porQue = porQueReloj(h, s);
    if (e.porQue?.clave?.startsWith('reloj') && !e.conceptos.includes('manejo-del-reloj')) e.conceptos.push('manejo-del-reloj');
  }

  // Revisión en video.
  const rev = fraseRevision(h);
  if (rev) { e.frases.push(rev); e.conceptos.push('revision'); }
  if (h.sinReunion && !e.menor && e.categoria !== 'penal' && s.finalDeMitad) e.conceptos.push('sin-reunion');

  return terminar(e, jugada, s, h);
}

function terminar(e, jugada, s, h) {
  const explicacion = unir(e.frases);
  return {
    id: jugada?.id ?? null,
    categoria: e.categoria,
    etiqueta: e.etiqueta,
    explicacion: explicacion || 'Jugada registrada.',
    porQue: e.porQue || null,
    conceptos: [...new Set(e.conceptos)].slice(0, 5),
    destacada: !!e.destacada,
    menor: !!e.menor,
    equipo: s?.anota?.id || s?.ataque?.id || null,
    anotacion: s?.puntos ? { equipo: s.anota?.id || null, puntos: s.puntos } : null,
    cambioDePosesion: !!(jugada?.isTurnover || e.categoria === 'perdida' || e.conceptos.includes('entrega-por-downs')),
    accion: e.accion || h?.accion || 'desconocida',
    original: jugada?.text || '',
  };
}

// Igual que explicarJugada, pero deja pasar los errores. Solo para las pruebas:
// así un fallo del motor no queda escondido detrás de la explicación genérica.
export function explicarJugadaEstricta(jugada, contexto = {}) {
  return explicarSinRed(jugada, contexto || {});
}

// Explica una jugada. Nunca lanza errores: ante cualquier dato inesperado devuelve una explicación genérica.
export function explicarJugada(jugada, contexto = {}) {
  const ctx = contexto || {};
  try {
    if (!jugada || typeof jugada !== 'object') throw new Error('jugada vacía');
    return explicarSinRed(jugada, ctx);
  } catch (error) {
    try {
      const e = accionRespaldo(jugada || {}, {}, null, ctx);
      return terminar(e, jugada || {}, null, null);
    } catch {
      return {
        id: jugada?.id ?? null, categoria: 'otro', etiqueta: 'Jugada', explicacion: 'Jugada registrada.', porQue: null,
        conceptos: [], destacada: false, menor: false, equipo: null, anotacion: null, cambioDePosesion: false,
        accion: 'desconocida', original: String(jugada?.text || ''),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Situación actual explicada ("2nd & 7" -> frase para alguien que empieza)
// ---------------------------------------------------------------------------

// `punto` es un objeto como `play.end`: { down, distance, yardLine, team: { id } }.
export function explicarSituacion(punto, contexto = {}) {
  const ctx = contexto || {};
  const vacio = { titulo: '', texto: '', conceptos: [], equipo: null };
  try {
    if (!punto || typeof punto !== 'object') return vacio;
    const down = Number(punto.down);
    const distancia = Number(punto.distance);
    const equipo = equipoPorId(punto.team?.id, ctx);
    if (!(down >= 1 && down <= 4)) return { ...vacio, equipo: equipo?.id || null };
    const ypa = yardasParaAnotar(punto.yardLine, punto.team?.id, ctx);
    const golONada = ypa !== null && distancia >= ypa;
    const donde = describirYarda(punto.yardLine, ctx);
    const conceptos = ['down'];
    const titulo = `${ordinalCorto(down)} y ${golONada ? 'gol' : distancia}${donde ? ` en ${donde}` : ''}`;
    const quedan = 5 - down;
    const quienes = equipo ? `a ${los(equipo)}` : 'al ataque';
    const frases = [];

    if (golONada) {
      frases.push(`${mayuscula(ORDINALES[down])} oportunidad y gol: ${quienes} les ${ypa === 1 ? 'falta 1 yarda' : `faltan ${yardasTexto(ypa)}`} para el touchdown`);
      frases.push('Tan cerca ya no hay primer down posible: solo sirve anotar');
      conceptos.push('gol-o-nada');
    } else {
      frases.push(`${mayuscula(ORDINALES[down])} oportunidad: ${quienes} les ${distancia === 1 ? 'falta 1 yarda' : `faltan ${yardasTexto(distancia)}`} para renovar sus cuatro intentos`);
      conceptos.push('primer-down');
    }
    if (down === 4) {
      frases.push('Es el último intento: lo normal es patear, porque si se la juegan y fallan, el rival recibe el balón aquí mismo');
      conceptos.push('cuarta-oportunidad');
    } else if (down === 3) {
      frases.push(`Les quedan 2 intentos, pero este es el decisivo: si no llegan, casi seguro patean${!golONada && distancia >= 7 ? '. Con tantas yardas por ganar, lo esperado es un pase' : !golONada && distancia <= 2 ? '. Con tan poco por ganar, pueden correr o lanzar' : ''}`);
      conceptos.push('tercera-oportunidad');
    } else {
      frases.push(`Les quedan ${quedan} intentos`);
    }
    if (ypa !== null && ypa <= 20 && !golONada) {
      frases.push('Están en zona roja, a un paso de anotar');
      conceptos.push('zona-roja');
    } else if (ypa !== null && ypa <= 20) {
      conceptos.push('zona-roja');
    }
    return { titulo, texto: unir(frases), conceptos, equipo: equipo?.id || null, down, distancia, yardasParaAnotar: ypa, golONada };
  } catch {
    return vacio;
  }
}

// ---------------------------------------------------------------------------
// Resumen de un drive
// ---------------------------------------------------------------------------

const RESULTADOS_DRIVE = [
  [/blocked punt.*td|blocked punt touchdown/i, 'les bloquearon el despeje y el rival anotó'],
  [/blocked fg.*td|blocked field goal touchdown/i, 'les bloquearon el gol de campo y el rival anotó'],
  [/interception.*(touchdown|td)|int td/i, 'terminó en una intercepción que el rival regresó para touchdown'],
  [/fumble.*(touchdown|td)/i, 'terminó en un balón perdido que el rival convirtió en touchdown'],
  [/punt.*(touchdown|td)/i, 'terminó en un despeje que el rival regresó para touchdown'],
  [/blocked punt/i, 'les bloquearon el despeje'],
  [/blocked fg|blocked field goal/i, 'les bloquearon el gol de campo'],
  [/missed fg|missed field goal/i, 'falló el gol de campo'],
  [/touchdown|^td$/i, 'terminó en touchdown'],
  [/field goal|^fg$/i, 'terminó en gol de campo'],
  [/punt/i, 'terminó en despeje (punt)'],
  [/interception|^int$/i, 'terminó en intercepción'],
  [/fumble/i, 'terminó en balón perdido (fumble)'],
  [/downs/i, 'se quedó sin oportunidades y entregó el balón'],
  [/safety|^sf$/i, 'terminó en safety'],
  [/end of half/i, 'se acabó la primera mitad'],
  [/end of game/i, 'se acabó el partido'],
  [/end of regulation/i, 'se acabó el tiempo regular'],
];

export function resultadoDeDrive(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  for (const [re, frase] of RESULTADOS_DRIVE) if (re.test(t)) return frase;
  return '';
}

// `drive` como lo entrega ESPN: { team, offensivePlays, yards, displayResult, plays, description }.
export function resumirDrive(drive, contexto = {}) {
  const ctx = contexto || {};
  try {
    const equipo = equipoPorId(drive?.team?.id, ctx) || (drive?.team?.name ? { nombre: drive.team.name } : null);
    const jugadas = Number(drive?.offensivePlays ?? (drive?.plays?.length || 0));
    const yardas = Number(drive?.yards ?? 0);
    const resultado = resultadoDeDrive(drive?.displayResult || drive?.result);
    const partes = [`${jugadas === 1 ? '1 jugada' : `${jugadas} jugadas`}`, `${yardas < 0 ? `${yardasTexto(yardas)} perdidas` : yardasTexto(yardas)}`];
    const enCurso = !resultado;
    const texto = `Avance ${deLos(equipo)}: ${partes.join(', ')}${resultado ? `, ${resultado}` : ', en curso'}.`;
    return { texto, equipo: equipo?.id || drive?.team?.id || null, jugadas, yardas, resultado, enCurso, anoto: !!drive?.isScore };
  } catch {
    return { texto: 'Avance', equipo: null, jugadas: 0, yardas: 0, resultado: '', enCurso: false, anoto: false };
  }
}
