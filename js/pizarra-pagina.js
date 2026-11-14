// Página de La Pizarra: jugadas clásicas animadas con X y O, paso a paso.
import { CLASICAS, LETRAS, estadosDe } from './clasicas.js';
import { crear, montarBotonGlosario, abrirGlosario, nombreCorto } from './ui.js';
import { buscarTermino } from './glosario.js';
import { nodo } from './cancha.js';

const ANCHO = 100;
const ALTO = 70;
const DURACION = 1300;
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const suavizar = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const mezclar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// La vista 3D es opcional: se ofrece si el navegador tiene WebGL y la persona no pidió reducir el movimiento.
// Los módulos 3D (y Three.js) se cargan recién al tocar el botón, para que esta página siga liviana.
let hayWebGL = null; // se averigua una sola vez
const ofrecer3D = () => {
  if (sinMovimiento()) return false;
  if (hayWebGL === null) {
    try {
      const prueba = document.createElement('canvas');
      const gl = prueba.getContext('webgl2') || prueba.getContext('webgl');
      hayWebGL = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { hayWebGL = false; }
  }
  return hayWebGL;
};
let abierta3D = null; // solo una jugada a la vez puede estar en 3D (hay un único lienzo WebGL)

function construirJugada(jugada) {
  const estados = estadosDe(jugada);
  let actual = 0;
  let cuadro = 0;
  let respaldo = 0;

  // ----- Cancha -----
  const svg = nodo('svg', { viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'clasica-cancha', role: 'img' });
  const titulo = nodo('title', {});
  svg.append(titulo);
  svg.append(nodo('rect', { x: 0, y: 0, width: ANCHO, height: ALTO, rx: 2, class: 'cancha-pasto' }));
  if (jugada.zonaDeAnotacion) {
    svg.append(nodo('rect', { x: 0, y: 0, width: ANCHO, height: jugada.zonaDeAnotacion, class: 'clasica-zona' }));
    svg.append(nodo('text', { x: ANCHO / 2, y: jugada.zonaDeAnotacion / 2 + 1.2, class: 'clasica-rotulo' }, 'ZONA DE ANOTACIÓN'));
  }
  for (let y = 10; y < ALTO; y += 10) svg.append(nodo('line', { x1: 0, y1: y, x2: ANCHO, y2: y, class: 'cancha-linea' }));
  if (typeof jugada.linea === 'number') svg.append(nodo('line', { x1: 0, y1: jugada.linea, x2: ANCHO, y2: jugada.linea, class: 'cancha-golpeo' }));
  if (typeof jugada.marca === 'number') {
    svg.append(nodo('line', { x1: 0, y1: jugada.marca, x2: ANCHO, y2: jugada.marca, class: 'cancha-marca' }));
    if (jugada.textoMarca) svg.append(nodo('text', { x: 3, y: jugada.marca - 1.5, class: 'clasica-rotulo clasica-rotulo-izq' }, jugada.textoMarca));
  }
  // Flecha: hacia dónde ataca el equipo de las O.
  svg.append(nodo('line', { x1: 4, y1: 66, x2: 4, y2: 60, class: 'cancha-flecha' }));
  svg.append(nodo('polygon', { points: '2,60.5 4,57 6,60.5', class: 'cancha-flecha-punta' }));

  const capaRutas = nodo('g', { class: 'clasica-rutas' });
  const capaJugadores = nodo('g', {});
  svg.append(capaRutas, capaJugadores);

  const fichas = {};
  for (const [id, [, , bando, letra]] of Object.entries(jugada.jugadores)) {
    const g = nodo('g', { class: `ficha ficha-${bando}` });
    if (bando === 'o') {
      g.append(nodo('circle', { r: 2.5 }));
      if (letra) g.append(nodo('text', { y: 1.1 }, letra));
    } else {
      g.append(nodo('line', { x1: -1.9, y1: -1.9, x2: 1.9, y2: 1.9 }), nodo('line', { x1: -1.9, y1: 1.9, x2: 1.9, y2: -1.9 }));
    }
    fichas[id] = g;
    capaJugadores.append(g);
  }
  const lineaVuelo = nodo('line', { class: 'clasica-vuelo', opacity: 0 });
  const balon = nodo('ellipse', { rx: 1.5, ry: 2.2, class: 'cancha-balon' });
  svg.append(lineaVuelo, balon);

  // ----- Textos y controles -----
  const cuenta = crear('p', { class: 'clasica-cuenta' });
  const tituloPaso = crear('h3', { class: 'clasica-paso-titulo' });
  const textoPaso = crear('p', { class: 'clasica-paso-texto' });
  const anterior = crear('button', { type: 'button', class: 'boton boton-chico' }, 'Paso anterior');
  const siguiente = crear('button', { type: 'button', class: 'boton boton-principal boton-chico' }, 'Siguiente paso');

  // Coloca todo en un punto intermedio (t de 0 a 1) entre el paso anterior y el paso n.
  const colocar = (n, t) => {
    const desde = estados[Math.max(0, n - 1)];
    const hasta = estados[n];
    for (const [id, ficha] of Object.entries(fichas)) {
      const [x, y] = mezclar(desde.posiciones[id], hasta.posiciones[id], t);
      ficha.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    }
    const [bx, by] = mezclar(desde.balon, hasta.balon, t);
    // En el aire el balón se ve más grande, como si subiera hacia quien mira.
    const escala = hasta.vuelo ? 1 + Math.sin(Math.PI * t) * 0.9 : 1;
    const conPortador = t >= 1 ? hasta.portador : null;
    balon.setAttribute('transform', `translate(${(bx + (conPortador ? 2.6 : 0)).toFixed(2)} ${(by - (conPortador ? 2.2 : 0)).toFixed(2)}) scale(${escala.toFixed(2)})`);
    if (hasta.vuelo && n > 0) {
      lineaVuelo.setAttribute('x1', desde.balon[0]); lineaVuelo.setAttribute('y1', desde.balon[1]);
      lineaVuelo.setAttribute('x2', bx.toFixed(2)); lineaVuelo.setAttribute('y2', by.toFixed(2));
      lineaVuelo.setAttribute('opacity', 1);
    } else {
      lineaVuelo.setAttribute('opacity', 0);
    }
    svg.dataset.estado = t >= 1 ? 'fin' : 'animando';
  };

  // Rutas recorridas hasta el paso n (las del paso actual, más marcadas).
  const pintarRutas = (n) => {
    while (capaRutas.firstChild) capaRutas.removeChild(capaRutas.firstChild);
    for (let i = 1; i <= n; i++) {
      for (const id of estados[i].movidos) {
        const a = estados[i - 1].posiciones[id];
        const b = estados[i].posiciones[id];
        const bando = jugada.jugadores[id][2];
        capaRutas.append(nodo('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: `ruta ruta-${bando}${i === n ? ' ruta-actual' : ''}` }));
      }
    }
  };

  const pintarTextos = (n) => {
    const e = estados[n];
    cuenta.textContent = `Paso ${n + 1} de ${estados.length}`;
    tituloPaso.textContent = e.titulo;
    textoPaso.textContent = e.texto;
    titulo.textContent = `${jugada.nombre}. Paso ${n + 1} de ${estados.length}: ${e.titulo}. ${e.texto}`;
    svg.setAttribute('aria-label', titulo.textContent);
    anterior.disabled = n === 0;
    siguiente.textContent = n === estados.length - 1 ? 'Ver de nuevo' : 'Siguiente paso';
    svg.dataset.paso = String(n + 1);
  };

  // ----- Vista con jugadores 3D (opcional) -----
  let vista3d = null; // { control, linea } mientras esta jugada se ve en 3D
  const caja3d = crear('div', { class: 'clasica-3d', hidden: true });
  const lienzo3d = crear('div', {});
  const nota3d = crear('p', { class: 'vista3d-aviso' });
  caja3d.append(crear('p', { class: 'cancha-leyenda' }, jugada.id === 'onside-kick' ? 'De azul, el equipo que patea; de blanco, el que recibe.' : 'De azul, el ataque; de blanco, la defensa.'), lienzo3d);
  const boton3d = ofrecer3D() ? crear('button', { type: 'button', class: 'boton boton-chico boton-3d', 'aria-pressed': 'false' }, 'Ver con jugadores en 3D') : null;

  const volverAXyO = () => {
    if (!vista3d && caja3d.hidden) return;
    vista3d?.control.cerrar();
    vista3d = null;
    if (abierta3D === volverAXyO) abierta3D = null;
    caja3d.hidden = true;
    svg.removeAttribute('hidden');
    leyenda.hidden = false;
    if (boton3d) { boton3d.textContent = 'Ver con jugadores en 3D'; boton3d.setAttribute('aria-pressed', 'false'); }
    seccion.dataset.vista = 'xo';
  };

  const abrir3D = async (camara = 'transmision') => {
    abierta3D?.();
    abierta3D = volverAXyO;
    nota3d.remove();
    svg.setAttribute('hidden', '');
    leyenda.hidden = true;
    caja3d.hidden = false;
    boton3d.textContent = 'Volver a la vista de X y O';
    boton3d.setAttribute('aria-pressed', 'true');
    seccion.dataset.vista = '3d';
    try {
      const [{ mostrarJugada3D }, { lineaDeClasica }] = await Promise.all([import('./vista3d.js'), import('./clasica3d.js')]);
      const linea = lineaDeClasica(jugada);
      const control = await mostrarJugada3D(lienzo3d, linea, { porTramos: true, congelarEn: actual === estados.length - 1 ? linea.duracion : linea.tiempos[actual], camara, alFallar: () => fallo3D() });
      if (abierta3D !== volverAXyO) { control.cerrar(); return; } // mientras cargaba, abrieron otra o volvieron a X y O
      vista3d = { control, linea };
    } catch {
      fallo3D();
    }
  };

  const fallo3D = () => {
    volverAXyO();
    nota3d.textContent = 'La vista 3D no está disponible en este dispositivo: seguimos con las X y las O.';
    caja3d.before(nota3d);
    boton3d?.remove();
  };

  boton3d?.addEventListener('click', () => (seccion.dataset.vista === '3d' ? volverAXyO() : abrir3D()));

  const ir = (n, animar = true) => {
    cancelAnimationFrame(cuadro);
    clearTimeout(respaldo);
    const avanza = n === actual + 1;
    actual = Math.max(0, Math.min(estados.length - 1, n));
    pintarTextos(actual);
    pintarRutas(actual);
    if (vista3d) {
      // En 3D el paso se reproduce con los jugadores; la pizarra de X y O queda al día por si vuelven a ella.
      const { control, linea } = vista3d;
      const ultimo = actual === estados.length - 1;
      if (animar && avanza) control.tramo(linea.tiempos[actual - 1], ultimo ? linea.duracion : linea.tiempos[actual]);
      else control.irA(ultimo ? linea.duracion : linea.tiempos[actual], control.camara());
      colocar(actual, 1);
      return;
    }
    if (!animar || !avanza || sinMovimiento()) { colocar(actual, 1); return; }
    let arranque = 0;
    const paso = (ahora) => {
      if (!arranque) arranque = ahora;
      const t = Math.min(1, (ahora - arranque) / DURACION);
      colocar(actual, suavizar(t));
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    colocar(actual, 0);
    cuadro = requestAnimationFrame(paso);
    // Si el navegador frena los cuadros, igual se llega al final del paso.
    const destino = actual;
    respaldo = setTimeout(() => { cancelAnimationFrame(cuadro); if (actual === destino) colocar(destino, 1); }, DURACION + 400);
  };

  anterior.addEventListener('click', () => ir(actual - 1, false));
  siguiente.addEventListener('click', () => ir(actual === estados.length - 1 ? 0 : actual + 1));

  const termino = buscarTermino(jugada.concepto);
  const letrasUsadas = [...new Set(Object.values(jugada.jugadores).map((j) => j[3]).filter(Boolean))];

  let leyenda = null;
  const seccion = crear('section', { class: 'clasica', id: jugada.id, 'aria-labelledby': `titulo-${jugada.id}` },
    crear('h2', { id: `titulo-${jugada.id}` }, jugada.nombre),
    crear('p', { class: 'clasica-resumen' }, jugada.resumen),
    crear('p', { class: 'clasica-cuando' }, crear('strong', {}, '¿Cuándo se usa? '), jugada.cuando),
    boton3d,
    svg,
    caja3d,
    leyenda = crear('p', { class: 'cancha-leyenda clasica-leyenda' },
      crear('span', { class: 'leyenda-ficha leyenda-o' }, jugada.id === 'onside-kick' ? 'El equipo que patea' : 'Ataque'),
      crear('span', { class: 'leyenda-ficha leyenda-x' }, jugada.id === 'onside-kick' ? 'El equipo que recibe' : 'Defensa'),
      typeof jugada.linea === 'number' ? crear('span', { class: 'leyenda leyenda-golpeo' }, 'Donde empieza la jugada') : null,
      crear('span', {}, 'La flecha indica hacia dónde atacan las O.')),
    crear('div', { class: 'clasica-paso', 'aria-live': 'polite' }, cuenta, tituloPaso, textoPaso),
    crear('div', { class: 'clasica-controles' }, anterior, siguiente),
    letrasUsadas.length ? crear('ul', { class: 'clasica-letras' }, letrasUsadas.map((l) => crear('li', {}, crear('strong', {}, l), ` = ${LETRAS[l]}`))) : null,
    termino ? crear('p', {}, crear('button', { type: 'button', class: 'etiqueta', onclick: () => abrirGlosario(jugada.concepto) }, `Ver "${nombreCorto(termino.termino)}" en el glosario`)) : null);

  seccion.dataset.vista = 'xo';
  ir(0, false);
  return { seccion, ir, abrir3D: boton3d ? abrir3D : null };
}

const zona = document.getElementById('clasicas');
const indice = document.getElementById('indice-clasicas');
const construidas = new Map();
for (const jugada of CLASICAS) {
  const c = construirJugada(jugada);
  construidas.set(jugada.id, c);
  zona.append(c.seccion);
  indice.append(crear('li', {}, crear('a', { href: `#${jugada.id}` }, jugada.nombre)));
}

montarBotonGlosario();

// ?paso=final deja todas las jugadas en su último paso (enlaces y verificación automática);
// ?paso=N las deja en el paso N.
const parametros = new URLSearchParams(location.search);
const pedido = parametros.get('paso');
if (pedido) {
  for (const jugada of CLASICAS) {
    const total = jugada.pasos.length;
    const n = pedido === 'final' ? total : Math.max(1, Math.min(total, Number(pedido) || 1));
    construidas.get(jugada.id).ir(n - 1, false);
  }
}
// ?vista=3d abre en 3D la jugada del enlace (#id) o la primera; con &camara=repeticion o cancha elige el ángulo.
if (parametros.get('vista') === '3d') {
  const id = decodeURIComponent(location.hash.slice(1));
  await (construidas.get(id) || construidas.get(CLASICAS[0].id)).abrir3D?.(parametros.get('camara') || 'transmision');
}
if (location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
document.body.dataset.listo = '1';
