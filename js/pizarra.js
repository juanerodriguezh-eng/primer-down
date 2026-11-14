// La Pizarra: anima sobre una cancha el movimiento real del balón en una jugada,
// de start.yardLine a end.yardLine, con un arco para los pases y las patadas y una línea para las carreras.
// trazoDeJugada y describirTrazo son puras (se prueban con Node); dibujarPizarra toca el DOM.
// Convención de los datos: yardLine va de 0 (zona de anotación del local) a 100 (la del visitante).
import { canchaBase, nodo } from './cancha.js';

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

const FORMA_POR_ACCION = {
  'pase-completo': 'pase',
  intercepcion: 'pase',
  'pase-incompleto': 'pase-incompleto',
  carrera: 'carrera',
  arrodillarse: 'carrera',
  captura: 'carrera',
  despeje: 'patada',
  'patada-de-salida': 'patada',
  'patada-corta': 'patada',
  'gol-de-campo': 'gol-de-campo',
  'solo-penal': 'penal',
};

const NOMBRE_FORMA = {
  pase: 'Pase',
  'pase-incompleto': 'Pase incompleto',
  carrera: 'Carrera',
  patada: 'Patada',
  'gol-de-campo': 'Gol de campo',
  penal: 'Penal',
  movimiento: 'Movimiento del balón',
};

// Devuelve qué hay que dibujar para una jugada, o null si no hay nada que animar
// (tiempos fuera, fin de cuarto, jugadas sin posición).
// ctx: { local: { id, nombre }, visitante: { id, nombre } }
export function trazoDeJugada(jugada, ctx) {
  const inicio = jugada?.inicio;
  const fin = jugada?.fin;
  const e = jugada?.explicacion || {};
  if (!inicio || !esNumero(inicio.yardLine) || e.categoria === 'pausa') return null;
  const desde = limitar(inicio.yardLine, 0, 100);
  const localId = String(ctx?.local?.id ?? '');
  const equipoId = String(inicio.team?.id ?? e.equipo ?? '');
  if (!localId || !equipoId) return null;
  const haciaDerecha = equipoId === localId;
  const sentido = haciaDerecha ? 1 : -1;

  let forma = FORMA_POR_ACCION[e.accion] || null;
  // Jugadas con varias cosas (pase con balón suelto, carrera con penal): manda la categoría.
  if (!forma) forma = e.categoria === 'pase' ? 'pase' : e.categoria === 'patada' ? 'patada' : 'movimiento';

  // Al cierre de un cuarto o del partido ESPN a veces manda el final en blanco (yarda 0, sin equipo ni oportunidad).
  // Ese dato no sirve: se usa el avance de la jugada (statYardage) y, si tampoco está, el balón no se mueve.
  const finEnBlanco = !!fin && fin.yardLine === 0 && !fin.team && !(Number(fin.down) > 0);
  let hasta = desde;
  if (esNumero(fin?.yardLine) && !finEnBlanco) hasta = limitar(fin.yardLine, 0, 100);
  else if (esNumero(jugada.yardas)) hasta = limitar(desde + sentido * jugada.yardas, 0, 100);
  let resultado = '';
  if (forma === 'gol-de-campo') {
    // El dato de llegada no sirve en los goles de campo: la patada siempre va hacia los postes.
    hasta = haciaDerecha ? 100 : 0;
    resultado = e.categoria === 'anotacion' ? 'bueno' : 'fallado';
  } else if (forma === 'pase-incompleto') {
    // El balón vuelve al mismo lugar; se dibuja el intento hacia adelante, más largo si fue un pase profundo.
    const largo = /\bdeep\b/i.test(e.original || '') ? 22 : 7;
    hasta = limitar(desde + sentido * largo, 0, 100); // cerca de la zona de anotación, el pase iba hacia ella
    resultado = 'incompleto';
  } else if (hasta === desde) {
    return null; // el balón no se movió y no hay nada que mostrar
  }

  const down = Number(inicio.down) || 0;
  const distancia = Number(inicio.distance) || 0;
  const yardasAlGol = haciaDerecha ? 100 - desde : desde;
  const hayOportunidad = down >= 1 && down <= 4;
  const scrimmage = hayOportunidad ? desde : null;
  const marca = hayOportunidad && distancia > 0 && distancia < yardasAlGol ? desde + sentido * distancia : null;

  const trazo = { forma, desde, hasta, haciaDerecha, scrimmage, marca, resultado, cambioDePosesion: !!e.cambioDePosesion, anotacion: !!e.anotacion };
  trazo.descripcion = describirTrazo(trazo, ctx);
  return trazo;
}

function lugar(yardLine, ctx) {
  const local = ctx?.local?.nombre || 'local';
  const visitante = ctx?.visitante?.nombre || 'visitante';
  const y = Math.round(yardLine);
  if (y <= 0) return `la zona de anotación de los ${local}`;
  if (y >= 100) return `la zona de anotación de los ${visitante}`;
  if (y === 50) return 'el medio campo';
  return y < 50 ? `la yarda ${y} de los ${local}` : `la yarda ${100 - y} de los ${visitante}`;
}

// Texto que acompaña a la animación y sirve de texto alternativo.
export function describirTrazo(trazo, ctx) {
  const yardas = Math.abs(Math.round(trazo.hasta - trazo.desde));
  const plural = yardas === 1 ? 'yarda' : 'yardas';
  const lado = trazo.hasta > trazo.desde ? 'derecha' : 'izquierda';
  if (trazo.forma === 'gol-de-campo') {
    return `Patada desde ${lugar(trazo.desde, ctx)} hacia los postes de la ${lado}: ${trazo.resultado === 'bueno' ? 'entra entre los postes' : 'no entra'}.`;
  }
  if (trazo.forma === 'pase-incompleto') {
    return `Pase desde ${lugar(trazo.desde, ctx)} hacia la ${lado} que nadie atrapa: el balón vuelve al mismo lugar.`;
  }
  const avanza = (trazo.hasta > trazo.desde) === trazo.haciaDerecha;
  const como = trazo.forma === 'pase' ? 'por aire' : trazo.forma === 'patada' ? 'con una patada' : trazo.forma === 'penal' ? 'por el castigo' : 'por tierra';
  const extra = trazo.forma === 'patada' || trazo.forma === 'penal' ? '' : avanza ? '' : ' (hacia atrás)';
  return `El balón va ${como} de ${lugar(trazo.desde, ctx)} a ${lugar(trazo.hasta, ctx)}: ${yardas} ${plural} hacia la ${lado}${extra}.`;
}

// ---------------------------------------------------------------------------
// Dibujo y animación (solo navegador)
// ---------------------------------------------------------------------------

const Y_BALON = 26;

// Camino del balón dentro del viewBox de la cancha (0 0 120 44).
function caminoDe(trazo, x) {
  const x0 = x(trazo.desde);
  let x1 = x(trazo.hasta);
  let y1 = Y_BALON;
  if (trazo.forma === 'gol-de-campo') {
    x1 = trazo.haciaDerecha ? 118 : 2; // los postes están al fondo de la zona de anotación
    if (trazo.resultado === 'fallado') y1 = 9; // se va desviada
  }
  const largo = Math.abs(x1 - x0);
  let altura = 0;
  if (trazo.forma === 'pase' || trazo.forma === 'pase-incompleto') altura = limitar(5 + largo * 0.35, 6, 18);
  if (trazo.forma === 'patada' || trazo.forma === 'gol-de-campo') altura = limitar(10 + largo * 0.3, 12, 21);
  const d = altura
    ? `M ${x0} ${Y_BALON} Q ${(x0 + x1) / 2} ${Y_BALON - altura * 2} ${x1} ${y1}`
    : `M ${x0} ${Y_BALON} L ${x1} ${y1}`;
  return { d, x0, x1, y1 };
}

const suavizar = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

// Devuelve un bloque con la cancha animada, la descripción y un botón para repetir la animación.
export function dibujarPizarra(trazo, partido) {
  const { svg, x } = canchaBase(partido, trazo.descripcion, 'cancha pizarra-cancha');
  const { d, x0, x1, y1 } = caminoDe(trazo, x);

  if (trazo.marca !== null) svg.append(nodo('line', { x1: x(trazo.marca), y1: 4, x2: x(trazo.marca), y2: 40, class: 'cancha-marca' }));
  if (trazo.scrimmage !== null) svg.append(nodo('line', { x1: x(trazo.scrimmage), y1: 4, x2: x(trazo.scrimmage), y2: 40, class: 'cancha-golpeo' }));
  if (trazo.forma === 'gol-de-campo') {
    const px = trazo.haciaDerecha ? 118 : 2;
    svg.append(nodo('line', { x1: px, y1: 18, x2: px, y2: 34, class: 'pizarra-postes' }));
  }

  const camino = nodo('path', { d, class: `pizarra-camino pizarra-${trazo.forma}`, fill: 'none' });
  svg.append(camino);
  svg.append(nodo('circle', { cx: x0, cy: Y_BALON, r: 1.4, class: 'pizarra-origen' }));
  const fin = nodo('g', { class: 'pizarra-fin', opacity: 0 });
  if (trazo.resultado === 'incompleto' || trazo.resultado === 'fallado') {
    fin.append(nodo('line', { x1: x1 - 2, y1: y1 - 2, x2: x1 + 2, y2: y1 + 2, class: 'pizarra-cruz' }),
      nodo('line', { x1: x1 - 2, y1: y1 + 2, x2: x1 + 2, y2: y1 - 2, class: 'pizarra-cruz' }));
  } else {
    fin.append(nodo('circle', { cx: x1, cy: y1, r: 3.4, class: 'pizarra-llegada' }));
  }
  svg.append(fin);
  const balon = nodo('ellipse', { cx: x0, cy: Y_BALON, rx: 2.6, ry: 1.7, class: 'cancha-balon' });
  svg.append(balon);

  const largo = typeof camino.getTotalLength === 'function' ? (() => { try { return camino.getTotalLength(); } catch { return 0; } })() : 0;
  let cuadro = 0;
  let respaldo = 0;

  const poner = (t) => {
    // Fuera del documento getTotalLength puede dar 0: en ese caso se mide al animar.
    const total = largo || (() => { try { return camino.getTotalLength(); } catch { return 0; } })();
    if (total) {
      const p = camino.getPointAtLength(total * t);
      balon.setAttribute('cx', p.x.toFixed(2));
      balon.setAttribute('cy', p.y.toFixed(2));
      camino.setAttribute('stroke-dasharray', `${(total * t).toFixed(2)} ${total.toFixed(2)}`);
    } else {
      balon.setAttribute('cx', t >= 1 ? x1 : x0);
      balon.setAttribute('cy', t >= 1 ? y1 : Y_BALON);
    }
    fin.setAttribute('opacity', t >= 1 ? 1 : 0);
    svg.dataset.estado = t >= 1 ? 'fin' : 'animando';
  };

  const animar = () => {
    cancelAnimationFrame(cuadro);
    clearTimeout(respaldo);
    const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento) { poner(1); return; }
    const duracion = 900 + Math.min(1100, Math.abs(x1 - x0) * 22);
    let arranque = 0;
    const paso = (ahora) => {
      if (!arranque) arranque = ahora;
      const t = Math.min(1, (ahora - arranque) / duracion);
      poner(suavizar(t));
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    poner(0);
    cuadro = requestAnimationFrame(paso);
    // Si el navegador frena los cuadros (pestaña en segundo plano, ahorro de batería), el balón igual llega a su destino.
    respaldo = setTimeout(() => { cancelAnimationFrame(cuadro); poner(1); }, duracion + 400);
  };

  const repetir = document.createElement('button');
  repetir.type = 'button';
  repetir.className = 'boton boton-chico';
  repetir.textContent = 'Repetir animación';
  repetir.addEventListener('click', animar);

  const texto = document.createElement('p');
  texto.className = 'pizarra-texto';
  texto.textContent = trazo.descripcion;

  const leyenda = document.createElement('p');
  leyenda.className = 'cancha-leyenda';
  const item = (clase, t) => { const s = document.createElement('span'); s.className = `leyenda ${clase}`; s.textContent = t; return s; };
  if (trazo.scrimmage !== null) leyenda.append(item('leyenda-golpeo', 'Inicio de la jugada'));
  if (trazo.marca !== null) leyenda.append(item('leyenda-marca', 'Línea a conseguir'));

  const bloque = document.createElement('div');
  bloque.className = 'pizarra';
  bloque.dataset.forma = trazo.forma;
  bloque.append(svg, texto, leyenda, repetir);
  bloque.animar = animar;
  bloque.nombreForma = NOMBRE_FORMA[trazo.forma] || NOMBRE_FORMA.movimiento;
  return bloque;
}
