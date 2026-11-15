// Probabilidad de ganar a lo largo del partido: la serie de puntos, los momentos importantes, la frase de
// arriba y la geometría de la gráfica. Todo es puro (sin DOM ni red); el dibujo vive en js/grafica.js.
// La probabilidad sale SOLO de `winprobability` de ESPN: si ESPN no la entrega, no hay serie y no se calcula nada propio.
import { separarFrases, textoPeriodo } from './modelo.js';
import { elegirJugadasClave, esPerdida } from './clave.js';

const SEGUNDOS_CUARTO = 900;
const SEGUNDOS_EXTRA = 600;
const LARGO_TEXTO = 150;
const UMBRAL_CLAVE_EN_VIVO = 0.05;

// Segundos de juego transcurridos según el cuarto y el reloj. Nunca retrocede: si el dato viene mal o en
// blanco (pasa al cierre de un cuarto), el punto se queda donde iba el anterior.
export function segundosDeJuego(periodo, reloj, previo = 0) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(reloj || ''));
  const n = Number(periodo);
  if (!m || !(n >= 1)) return previo;
  const duracion = n <= 4 ? SEGUNDOS_CUARTO : SEGUNDOS_EXTRA;
  const base = n <= 4 ? (n - 1) * SEGUNDOS_CUARTO : 4 * SEGUNDOS_CUARTO + (n - 5) * SEGUNDOS_EXTRA;
  const resta = Math.min(duracion, Number(m[1]) * 60 + Number(m[2]));
  return Math.max(previo, base + duracion - resta);
}

// Porcentajes enteros que siempre suman 100.
export function porcentajes(local) {
  const l = Math.max(0, Math.min(100, Math.round(local * 100)));
  return { local: l, visitante: 100 - l };
}

const FRASE_DE_PERDIDA = /Intercepción|Pierde el balón|quita el balón/;

function textoCorto(explicacion, perdida) {
  const frases = separarFrases(explicacion);
  // Una exclamación suelta ("¡Intercepción!") no dice nada sola: va con la frase que le sigue.
  let texto = frases.slice(0, frases[0] && frases[0].length < 28 ? 2 : 1).join(' ');
  if (texto.length > LARGO_TEXTO) texto = `${texto.slice(0, LARGO_TEXTO - 1).replace(/\s+\S*$/, '')}…`;
  // En una pérdida de balón la primera frase suele contar solo el pase o la carrera: se agrega la que dice cómo se perdió.
  if (perdida && !FRASE_DE_PERDIDA.test(texto)) {
    const como = frases.find((f) => FRASE_DE_PERDIDA.test(f));
    if (como && texto.length + como.length < 2 * LARGO_TEXTO) texto = `${texto} ${como}`;
  }
  return texto;
}

// La serie: un punto por cada jugada para la que ESPN entregó probabilidad, más el pronóstico previo al partido.
// Devuelve null si no hay al menos dos puntos (sin `winprobability` la sección no aparece).
//   puntos[i] = { id, t, local, visitante, pct: { local, visitante }, periodo, reloj, cuando, marcador,
//                 texto, anotacion, anota, perdida, clave, importante }
export function serieDeProbabilidad(partido) {
  if (!partido?.drives || !partido.local || !partido.visitante) return null;
  const jugadas = partido.drives.flatMap((d) => d.jugadas || []);
  if (!jugadas.some((j) => j.conProb)) return null;

  let claves = new Set();
  // Con el partido en curso solo se marca como clave lo que de verdad pesó (5 puntos o más), igual que el botón
  // "Jugadas clave": al principio de un partido "las 5 que más movieron" pueden ser movimientos mínimos.
  const pesa = (c) => partido.estado === 'final' || Math.abs(c.cambio || 0) >= UMBRAL_CLAVE_EN_VIVO;
  try { claves = new Set(elegirJugadasClave(partido, 5).filter((c) => c.criterio === 'probabilidad' && pesa(c)).map((c) => c.id)); } catch { claves = new Set(); }

  const puntos = [];
  const vistos = new Set();
  const valido = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
  if (valido(partido.probInicial)) {
    puntos.push({
      id: '', t: 0, local: partido.probInicial, visitante: 1 - partido.probInicial, pct: porcentajes(partido.probInicial),
      periodo: 0, reloj: '', cuando: 'Antes del partido', marcador: { local: 0, visitante: 0 },
      texto: 'Pronóstico antes de la patada inicial.', anotacion: false, anota: '', perdida: false, clave: false, importante: false,
    });
  }
  let t = 0;
  let maxPeriodo = 4;
  for (const j of jugadas) {
    t = segundosDeJuego(j.periodo, j.reloj, t);
    if (j.periodo > maxPeriodo) maxPeriodo = j.periodo;
    if (!j.conProb || !valido(j.probLocal) || vistos.has(j.id)) continue;
    vistos.add(j.id);
    const e = j.explicacion || {};
    const anotacion = !!e.anotacion;
    // Pérdida de balón: manda lo que dice ESPN (isTurnover); si no lo dice, lo que entendió el motor.
    let perdida = false;
    try { perdida = typeof j.perdidaEspn === 'boolean' ? j.perdidaEspn : esPerdida(j); } catch { perdida = false; }
    const clave = claves.has(j.id);
    puntos.push({
      id: j.id, t, local: j.probLocal, visitante: 1 - j.probLocal, pct: porcentajes(j.probLocal),
      periodo: j.periodo, reloj: j.reloj,
      cuando: `${textoPeriodo(j.periodo) || 'Partido'}${j.reloj ? ` · ${j.reloj}` : ''}`,
      marcador: { local: j.marcador.local, visitante: j.marcador.visitante },
      texto: textoCorto(e.explicacion, perdida),
      anotacion, anota: anotacion ? String(e.anotacion.equipo ?? '') : '', perdida, clave,
      importante: anotacion || perdida || clave,
    });
  }
  if (puntos.length < 2) return null;
  const total = 4 * SEGUNDOS_CUARTO + Math.max(0, maxPeriodo - 4) * SEGUNDOS_EXTRA;
  const cuartos = [];
  for (let n = 1; n <= maxPeriodo; n++) {
    const desde = n <= 4 ? (n - 1) * SEGUNDOS_CUARTO : 4 * SEGUNDOS_CUARTO + (n - 5) * SEGUNDOS_EXTRA;
    cuartos.push({ periodo: n, desde, hasta: desde + (n <= 4 ? SEGUNDOS_CUARTO : SEGUNDOS_EXTRA), rotulo: n <= 4 ? `${n}.º` : 'TE' });
  }
  const equipo = (x) => ({ id: x.id, nombre: x.nombre || x.abrev || 'Equipo', abrev: x.abrev || '', color: x.color || '', colorAlterno: x.colorAlterno || '' });
  return {
    puntos, total, cuartos,
    estado: partido.estado,
    local: equipo(partido.local), visitante: equipo(partido.visitante),
    final: partido.estado === 'final' ? { local: partido.local.puntos, visitante: partido.visitante.puntos } : null,
    momentos: puntos.filter((p) => p.importante).length,
  };
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

const soloUn = (pct) => (pct < 1 ? 'menos de un 1 %' : `solo un ${pct} %`);
const al = (pct) => (pct < 1 ? 'a menos del 1 %' : `al ${pct} %`);
const cuandoFue = (p) => (p.periodo >= 1 ? ` (${p.cuando.replace(' · ', ', ')})` : ' (antes de empezar)');

// La frase de arriba, al estilo de la tele. Cada número sale de la serie; no se adorna.
export function fraseDeTV(serie) {
  if (!serie?.puntos?.length) return '';
  const ultimo = serie.puntos[serie.puntos.length - 1];
  const minimo = (lado) => serie.puntos.reduce((a, b) => (b[lado] < a[lado] ? b : a));
  if (serie.estado === 'final' && serie.final) {
    if (serie.final.local === serie.final.visitante) {
      const m = minimo('local'); const M = minimo('visitante');
      return `Terminó empatado: la probabilidad de ganar de los ${serie.local.nombre} se movió entre el ${porcentajes(m.local).local} % y el ${porcentajes(M.local).local} %.`;
    }
    const lado = serie.final.local > serie.final.visitante ? 'local' : 'visitante';
    const g = serie[lado];
    const peor = minimo(lado);
    const pct = Math.round(peor[lado] * 100);
    if (peor[lado] <= 0.25) return `Los ${g.nombre} llegaron a tener ${soloUn(pct)} de probabilidad de ganar${cuandoFue(peor)} y lo ganaron.`;
    // Si el punto más bajo fue el pronóstico del arranque, no "bajaron": empezaron ahí.
    if (peor[lado] < 0.5 && peor.t === 0) return `Los ${g.nombre} no eran los favoritos al empezar (${pct} % de probabilidad de ganar) y se quedaron con el partido.`;
    if (peor[lado] < 0.5) return `Los ${g.nombre} llegaron a bajar ${al(pct)} de probabilidad de ganar${cuandoFue(peor)}, pero se quedaron con el partido.`;
    return `Los ${g.nombre} fueron favoritos de principio a fin: su probabilidad de ganar nunca bajó del ${pct} %.`;
  }
  const lado = ultimo.local >= 0.5 ? 'local' : 'visitante';
  const f = serie[lado];
  const ahora = ultimo.pct[lado];
  const peor = minimo(lado);
  const base = ahora <= 55
    ? `Partido parejo: ahora mismo los ${f.nombre} tienen un ${ahora} % de probabilidad de ganar.`
    : `Ahora mismo los ${f.nombre} tienen un ${ahora} % de probabilidad de ganar.`;
  return peor[lado] <= 0.3 && ahora > 55 ? `${base} Llegaron a tener ${soloUn(Math.round(peor[lado] * 100))}${cuandoFue(peor)}.` : base;
}

const tipoDeMomento = (p) => [p.anotacion ? 'Anotación' : '', p.perdida ? 'Pérdida de balón' : '', p.clave ? 'Jugada clave' : ''].filter(Boolean).join(' y ');

// Lo que se muestra (y lo que oye un lector de pantalla) al pararse en un punto.
export function lecturaDePunto(p, serie) {
  const { local, visitante } = serie;
  return {
    cuando: p.cuando,
    marcador: `${visitante.nombre} ${p.marcador.visitante} · ${local.nombre} ${p.marcador.local}`,
    porcentajes: `${visitante.nombre} ${p.pct.visitante} % · ${local.nombre} ${p.pct.local} %`,
    momento: tipoDeMomento(p),
    texto: p.texto,
  };
}

export function textoDePunto(p, serie) {
  const l = lecturaDePunto(p, serie);
  return [l.momento, l.cuando.replace(' · ', ', '), l.marcador.replace(' · ', ', '), l.porcentajes.replace(' · ', ', '), l.texto]
    .filter(Boolean).map((x) => x.replace(/[.…]$/, '')).join('. ') + '.';
}

// Descripción de toda la gráfica para quien no la ve.
export function descripcionDeSerie(serie) {
  if (!serie?.puntos?.length) return '';
  const { puntos, local, visitante } = serie;
  const primero = puntos[0]; const ultimo = puntos[puntos.length - 1];
  const maxLocal = puntos.reduce((a, b) => (b.local > a.local ? b : a));
  const maxVisita = puntos.reduce((a, b) => (b.visitante > a.visitante ? b : a));
  const par = (p) => `${visitante.nombre} ${p.pct.visitante} %, ${local.nombre} ${p.pct.local} %`;
  return [
    `Gráfica de la probabilidad de ganar de cada equipo, jugada por jugada (${puntos.length} puntos)`,
    `Al empezar: ${par(primero)}`,
    `Punto más alto de los ${visitante.nombre}: ${maxVisita.pct.visitante} %${cuandoFue(maxVisita)}`,
    `Punto más alto de los ${local.nombre}: ${maxLocal.pct.local} %${cuandoFue(maxLocal)}`,
    `${serie.estado === 'final' ? 'Al final' : 'Ahora'}: ${par(ultimo)}`,
    `${serie.momentos} ${serie.momentos === 1 ? 'momento importante marcado' : 'momentos importantes marcados'}`,
    'Con las flechas izquierda y derecha se recorre jugada por jugada; con arriba y abajo se salta entre los momentos importantes; con Enter se abre la jugada',
  ].join('. ') + '.';
}

// ---------------------------------------------------------------------------
// Geometría (para el SVG)
// ---------------------------------------------------------------------------

const r1 = (n) => Math.round(n * 10) / 10;

// Escalas de la gráfica: el tiempo de juego va de izquierda a derecha; arriba gana el visitante y abajo el local.
export function escalas(serie, ancho, alto, margen = { izq: 38, der: 10, arriba: 10, abajo: 20 }) {
  const w = Math.max(40, ancho - margen.izq - margen.der);
  const h = Math.max(40, alto - margen.arriba - margen.abajo);
  return {
    izq: margen.izq, der: margen.izq + w, arriba: margen.arriba, abajo: margen.arriba + h, medio: margen.arriba + h / 2, w, h,
    x: (t) => r1(margen.izq + (Math.max(0, Math.min(serie.total, t)) / serie.total) * w),
    y: (local) => r1(margen.arriba + Math.max(0, Math.min(1, local)) * h),
    tDe: (px) => ((px - margen.izq) / w) * serie.total,
  };
}

export function rutaDeLinea(puntos, e) {
  return puntos.map((p, i) => `${i ? 'L' : 'M'}${e.x(p.t)} ${e.y(p.local)}`).join('');
}

// Área entre la línea y el 50 %: se pinta con el color de quien va ganando en cada tramo.
export function rutaDeArea(puntos, e) {
  if (!puntos.length) return '';
  return `${rutaDeLinea(puntos, e)}L${e.x(puntos[puntos.length - 1].t)} ${r1(e.medio)}L${e.x(puntos[0].t)} ${r1(e.medio)}Z`;
}

// Índice del punto más cercano a un instante t. Varias jugadas pueden compartir el mismo segundo de reloj (una
// intercepción y el tiempo fuera que le sigue): entre ellas gana la que es un momento importante y, si no hay, la última.
export function masCercano(puntos, t) {
  let mejor = -1; let d = Infinity;
  for (let i = 0; i < puntos.length; i++) {
    const di = Math.abs(puntos[i].t - t);
    if (di < d || (di === d && (puntos[i].importante || !puntos[mejor].importante))) { d = di; mejor = i; }
  }
  return mejor;
}

// Siguiente (dir = 1) o anterior (dir = -1) momento importante desde i; si no hay, se queda en i.
export function saltarAMomento(puntos, i, dir) {
  for (let k = i + dir; k >= 0 && k < puntos.length; k += dir) if (puntos[k].importante) return k;
  return i;
}

// Mini gráfica para la tarjeta de una jugada clave: la línea de todo el partido y el punto de esa jugada.
// Devuelve null si no hay serie o si esa jugada no tiene dato de ESPN (entonces la tarjeta va sin mini gráfica).
export function miniDeClave(serie, idJugada, ancho = 240, alto = 64) {
  if (!serie?.puntos?.length || idJugada == null) return null;
  const p = serie.puntos.find((x) => x.id === String(idJugada));
  if (!p) return null;
  const e = escalas(serie, ancho, alto, { izq: 3, der: 3, arriba: 6, abajo: 6 });
  return {
    ancho, alto, izq: e.izq, der: e.der, medio: r1(e.medio),
    linea: rutaDeLinea(serie.puntos, e),
    area: rutaDeArea(serie.puntos, e),
    punto: { x: e.x(p.t), y: e.y(p.local) },
    descripcion: `Probabilidad de ganar a lo largo del partido. Después de esta jugada: ${serie.visitante.nombre} ${p.pct.visitante} %, ${serie.local.nombre} ${p.pct.local} %.`,
  };
}

// ---------------------------------------------------------------------------
// Colores: los de cada equipo, pero que se vean sobre el fondo y no se confundan entre sí
// ---------------------------------------------------------------------------

const esHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminancia = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b); };
export function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}
const mezclar = (a, b, p) => {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v * (1 - p) + y[i] * p).toString(16).padStart(2, '0')).join('')}`;
};
const distancia = (a, b) => { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

const conColor = (hex) => { const c = rgb(hex); return Math.max(...c) - Math.min(...c) >= 60; };
const PARECIDOS = 80; // distancia entre dos colores por debajo de la cual se confunden

const CONTRASTE_MINIMO = 3; // lo que pide WCAG para elementos gráficos

// Acerca un color al del texto hasta que se distinga del fondo (conserva el tono todo lo posible).
function hacerVisible(color, fondo, texto) {
  let c = color;
  for (let p = 0.15; contraste(c, fondo) < CONTRASTE_MINIMO && p <= 1; p += 0.15) c = mezclar(color, texto, p);
  return c;
}

// Elige el color de cada equipo para la gráfica: el principal si se ve sobre el fondo; si no, el alterno; si
// ninguno alcanza, se aclara u oscurece. Si los dos equipos quedan con colores parecidos, el visitante cambia.
export function coloresDeGrafica(local, visitante, fondo = '#141d30', texto = '#eef2fa') {
  const f = esHex(fondo) ? fondo : '#141d30';
  const tx = esHex(texto) ? texto : '#eef2fa';
  const opciones = (eq) => {
    const seVe = (c) => contraste(c, f) >= CONTRASTE_MINIMO;
    const [principal, alterno] = [esHex(eq?.color) ? eq.color : '', esHex(eq?.colorAlterno) ? eq.colorAlterno : ''];
    // Orden de preferencia: el principal tal cual; el alterno si tiene color (no blanco, gris ni negro); el principal
    // aclarado u oscurecido; y al final el alterno sin color.
    const lista = [];
    if (principal && seVe(principal)) lista.push(principal);
    if (alterno && seVe(alterno) && conColor(alterno)) lista.push(alterno);
    if (principal && !seVe(principal)) lista.push(hacerVisible(principal, f, tx));
    if (alterno && !lista.includes(alterno)) lista.push(seVe(alterno) ? alterno : hacerVisible(alterno, f, tx));
    return lista.length ? lista : [mezclar(f, tx, 0.6)];
  };
  const ol = opciones(local); const ov = opciones(visitante);
  const cl = ol[0];
  let cv = ov[0];
  if (distancia(cl, cv) < PARECIDOS) {
    const otro = ov.slice(1).find((c) => distancia(cl, c) >= PARECIDOS);
    if (otro) cv = otro;
    else {
      // Último recurso: el visitante va en el tono del texto, que siempre se distingue del fondo.
      const neutro = mezclar(f, tx, 0.75);
      if (distancia(cl, neutro) > distancia(cl, cv)) cv = neutro;
    }
  }
  return { local: cl, visitante: cv };
}
