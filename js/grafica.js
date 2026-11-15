// Gráfica "Probabilidad de ganar": SVG dibujado con código, sin librerías. Arriba gana el visitante y abajo el local.
// Interactiva (mouse, dedo y teclado) y pensada para crecer en vivo: la línea y los puntos son siempre los mismos
// nodos, que se actualizan en su lugar; nada se borra y se vuelve a crear en cada sondeo.
// Los datos y la geometría salen de js/probabilidad.js (puro y con pruebas).
import { crear } from './ui.js';
import { nodo } from './cancha.js';
import {
  fraseDeTV, lecturaDePunto, textoDePunto, descripcionDeSerie, escalas, rutaDeLinea, rutaDeArea, masCercano, saltarAMomento, coloresDeGrafica,
} from './probabilidad.js';

let cuenta = 0;
const RADIO_DE_TOQUE = 18; // px alrededor de un punto marcado dentro de los cuales un toque lo abre
const DURACION = 900; // ms de la animación con que aparece la línea la primera vez

const sinMovimiento = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// opciones.alAbrir(id): abrir esa jugada (vista 3D o pizarra) · opciones.sePuedeAbrir(id) · opciones.etiquetaAbrir(): texto del botón
export function crearGraficaDeProbabilidad({ alAbrir = () => {}, sePuedeAbrir = () => false, etiquetaAbrir = () => 'Ver esta jugada' } = {}) {
  const n = ++cuenta;
  const id = (x) => `prob-${n}-${x}`;

  // --- Piezas fijas de la sección ---
  const frase = crear('p', { class: 'prob-frase' });
  const chip = (donde) => {
    const color = crear('span', { class: 'prob-color', 'aria-hidden': 'true' });
    const nombre = crear('span', { class: 'prob-equipo-nombre' });
    return { el: crear('span', { class: 'prob-equipo' }, color, nombre, crear('span', { class: 'prob-donde' }, donde)), color, nombre };
  };
  const chips = { visitante: chip('arriba'), local: chip('abajo') };

  const svg = nodo('svg', { class: 'prob-svg', 'aria-hidden': 'true', focusable: 'false' });
  const lienzo = crear('div', {
    class: 'prob-lienzo', tabindex: '0', role: 'slider', 'aria-orientation': 'horizontal',
    'aria-label': 'Probabilidad de ganar, jugada por jugada', 'aria-describedby': id('descripcion'), 'aria-valuemin': '1',
  }, svg);

  const lectura = {
    cuando: crear('span', { class: 'prob-cuando' }),
    momento: crear('span', { class: 'prob-momento', hidden: true }),
    colorV: crear('span', { class: 'prob-color', 'aria-hidden': 'true' }), pctV: crear('span', {}),
    colorL: crear('span', { class: 'prob-color', 'aria-hidden': 'true' }), pctL: crear('span', {}),
    marcador: crear('p', { class: 'prob-marcador' }),
    texto: crear('p', { class: 'prob-texto' }),
    boton: crear('button', { type: 'button', class: 'boton prob-ver', hidden: true }, 'Ver esta jugada'),
  };
  const cajaLectura = crear('div', { class: 'prob-lectura' },
    crear('p', { class: 'prob-linea-cuando' }, lectura.cuando, lectura.momento),
    crear('p', { class: 'prob-porcentajes' },
      crear('span', { class: 'prob-pct' }, lectura.colorV, lectura.pctV),
      crear('span', { class: 'prob-pct' }, lectura.colorL, lectura.pctL)),
    lectura.marcador, lectura.texto, lectura.boton);

  const descripcion = crear('p', { class: 'solo-lectores', id: id('descripcion') });
  const seccion = crear('section', { class: 'probabilidad', 'aria-labelledby': id('titulo'), hidden: true, dataset: { puntos: '0', estado: 'vacia' } },
    crear('h2', { id: id('titulo') }, 'Probabilidad de ganar'),
    frase,
    crear('p', { class: 'prob-equipos' }, chips.visitante.el, chips.local.el),
    lienzo,
    cajaLectura,
    crear('p', { class: 'prob-leyenda' },
      crear('span', { class: 'prob-ley prob-ley-anotacion' }, 'Anotación'),
      crear('span', { class: 'prob-ley prob-ley-perdida' }, 'Pérdida de balón'),
      crear('span', { class: 'prob-ley prob-ley-clave' }, 'Jugada clave')),
    crear('p', { class: 'nota prob-nota' }, 'Desliza el dedo o usa las flechas para recorrer el partido; toca un punto marcado para ver esa jugada. La probabilidad la calcula ESPN.'),
    descripcion);

  // --- Capas del SVG (se crean una sola vez) ---
  const recorte = { arriba: nodo('rect', {}), abajo: nodo('rect', {}), revela: nodo('rect', { x: 0, y: 0, width: 0, height: 0 }) };
  const defs = nodo('defs', {});
  for (const [k, r] of Object.entries(recorte)) { const c = nodo('clipPath', { id: id(k), clipPathUnits: 'userSpaceOnUse' }); c.append(r); defs.append(c); }
  const capaFondo = nodo('g', { class: 'prob-fondo' });
  const areaV = nodo('path', { class: 'prob-area', 'clip-path': `url(#${id('arriba')})` });
  const areaL = nodo('path', { class: 'prob-area', 'clip-path': `url(#${id('abajo')})` });
  const linea = nodo('path', { class: 'prob-linea' });
  const capaMarcas = nodo('g', { class: 'prob-marcas' });
  const revelado = nodo('g', { 'clip-path': `url(#${id('revela')})` });
  revelado.append(areaV, areaL, linea, capaMarcas);
  const cursorLinea = nodo('line', { class: 'prob-cursor-linea' });
  const cursorPunto = nodo('circle', { class: 'prob-cursor-punto', r: 5 });
  const cursor = nodo('g', { class: 'prob-cursor' });
  cursor.append(cursorLinea, cursorPunto);
  svg.append(defs, capaFondo, revelado, cursor);

  // --- Estado ---
  let serie = null;
  let colores = { local: '#888888', visitante: '#bbbbbb' };
  let ancho = 0; let alto = 0; let e = null;
  let seleccion = 0;
  let siguiendo = true; // el cursor va con la última jugada hasta que la persona elige otra
  let revelada = false; let cuadro = 0; let respaldo = 0;
  let firmaFondo = '';
  const marcas = new Map(); // id de jugada -> { g, firma }

  function leerTema() {
    let fondo = ''; let texto = '';
    try { const cs = getComputedStyle(seccion); fondo = cs.getPropertyValue('--superficie').trim(); texto = cs.getPropertyValue('--texto').trim(); } catch { /* sin estilos: colores por defecto */ }
    return { fondo, texto };
  }

  function medir() {
    const w = Math.round(lienzo.clientWidth) || 328;
    return { w, h: w >= 560 ? 250 : w >= 420 ? 220 : 196 };
  }

  function dibujarFondo() {
    const firma = [ancho, alto, serie.total, serie.cuartos.length, serie.local.abrev, serie.visitante.abrev].join('|');
    if (firma === firmaFondo) return;
    firmaFondo = firma;
    while (capaFondo.firstChild) capaFondo.removeChild(capaFondo.firstChild);
    capaFondo.append(nodo('rect', { class: 'prob-marco', x: e.izq, y: e.arriba, width: e.w, height: e.h, rx: 4 }));
    for (const c of serie.cuartos) {
      const x0 = e.x(c.desde); const x1 = e.x(c.hasta);
      if (c.periodo > 1) capaFondo.append(nodo('line', { class: 'prob-division', x1: x0, y1: e.arriba, x2: x0, y2: e.abajo }));
      capaFondo.append(nodo('text', { class: 'prob-rotulo', x: (x0 + x1) / 2, y: e.abajo + 14, 'text-anchor': 'middle' }, c.rotulo));
    }
    capaFondo.append(nodo('line', { class: 'prob-mitad', x1: e.izq, y1: e.medio, x2: e.der, y2: e.medio }));
    capaFondo.append(nodo('text', { class: 'prob-eje prob-eje-equipo', x: e.izq - 6, y: e.arriba + 9, 'text-anchor': 'end' }, serie.visitante.abrev));
    capaFondo.append(nodo('text', { class: 'prob-eje', x: e.izq - 6, y: e.medio + 4, 'text-anchor': 'end' }, '50 %'));
    capaFondo.append(nodo('text', { class: 'prob-eje prob-eje-equipo', x: e.izq - 6, y: e.abajo - 1, 'text-anchor': 'end' }, serie.local.abrev));
  }

  function formaDeMarca(p) {
    const partes = [];
    if (p.clave) partes.push(nodo('circle', p.anotacion || p.perdida ? { class: 'prob-halo', r: 8.5 } : { class: 'prob-halo prob-halo-solo', r: 5 }));
    if (p.anotacion) {
      const quien = p.anota === serie.local.id ? colores.local : p.anota === serie.visitante.id ? colores.visitante : '';
      partes.push(nodo('circle', { class: 'prob-punto-anotacion', r: 4.5, style: quien ? `fill:${quien}` : null }));
    } else if (p.perdida) {
      partes.push(nodo('rect', { class: 'prob-punto-perdida', x: -4, y: -4, width: 8, height: 8, transform: 'rotate(45)' }));
    }
    return partes;
  }

  function dibujarMarcas() {
    const vigentes = new Set();
    for (const p of serie.puntos) {
      if (!p.importante || !p.id) continue;
      vigentes.add(p.id);
      const firma = `${p.anotacion ? 'a' : ''}${p.perdida ? 'p' : ''}${p.clave ? 'c' : ''}|${p.anota}|${colores.local}|${colores.visitante}`;
      let m = marcas.get(p.id);
      if (!m) {
        m = { g: nodo('g', { class: 'prob-marca', 'data-id': p.id }), firma: '' };
        marcas.set(p.id, m);
        capaMarcas.append(m.g);
      }
      if (m.firma !== firma) {
        m.firma = firma;
        while (m.g.firstChild) m.g.removeChild(m.g.firstChild);
        m.g.append(...formaDeMarca(p));
      }
      m.g.setAttribute('transform', `translate(${e.x(p.t)} ${e.y(p.local)})`);
    }
    for (const [idJugada, m] of marcas) if (!vigentes.has(idJugada)) { m.g.remove(); marcas.delete(idJugada); }
  }

  function terminarRevelado() {
    if (cuadro) { try { cancelAnimationFrame(cuadro); } catch { /* nada */ } cuadro = 0; }
    if (respaldo) { clearTimeout(respaldo); respaldo = 0; }
    recorte.revela.setAttribute('width', '100000');
    seccion.dataset.estado = 'lista';
  }

  // La línea aparece de izquierda a derecha solo la primera vez; después crece sin animación (y sin parpadeo).
  function revelar() {
    recorte.revela.setAttribute('height', String(alto));
    if (revelada) { if (seccion.dataset.estado === 'lista') recorte.revela.setAttribute('width', '100000'); return; }
    revelada = true;
    if (sinMovimiento() || typeof requestAnimationFrame !== 'function') { terminarRevelado(); return; }
    seccion.dataset.estado = 'animando';
    let t0 = 0;
    const paso = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / DURACION);
      recorte.revela.setAttribute('width', String(Math.round(ancho * (1 - (1 - k) ** 3))));
      if (k < 1) cuadro = requestAnimationFrame(paso); else terminarRevelado();
    };
    cuadro = requestAnimationFrame(paso);
    respaldo = setTimeout(terminarRevelado, DURACION + 500); // por si el navegador no entrega cuadros
  }

  function dibujar() {
    if (!serie) return;
    const { w, h } = medir();
    ancho = w; alto = h;
    e = escalas(serie, ancho, alto);
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
    svg.setAttribute('width', String(ancho));
    svg.setAttribute('height', String(alto));
    const mitadAlta = { x: 0, y: 0, width: ancho, height: e.medio };
    const mitadBaja = { x: 0, y: e.medio, width: ancho, height: Math.max(0, alto - e.medio) };
    for (const [k, v] of Object.entries(mitadAlta)) recorte.arriba.setAttribute(k, String(v));
    for (const [k, v] of Object.entries(mitadBaja)) recorte.abajo.setAttribute(k, String(v));
    dibujarFondo();
    const area = rutaDeArea(serie.puntos, e);
    areaV.setAttribute('d', area); areaV.style.fill = colores.visitante;
    areaL.setAttribute('d', area); areaL.style.fill = colores.local;
    linea.setAttribute('d', rutaDeLinea(serie.puntos, e));
    dibujarMarcas();
    revelar();
  }

  function seleccionar(i) {
    if (!serie || !e) return;
    seleccion = Math.max(0, Math.min(serie.puntos.length - 1, i));
    siguiendo = seleccion === serie.puntos.length - 1;
    const p = serie.puntos[seleccion];
    const x = e.x(p.t); const y = e.y(p.local);
    cursorLinea.setAttribute('x1', x); cursorLinea.setAttribute('x2', x);
    cursorLinea.setAttribute('y1', e.arriba); cursorLinea.setAttribute('y2', e.abajo);
    cursorPunto.setAttribute('cx', x); cursorPunto.setAttribute('cy', y);
    cursorPunto.style.display = p.importante && p.id ? 'none' : ''; // sobre un punto marcado se resalta la marca, sin taparla
    lienzo.setAttribute('aria-valuemax', String(serie.puntos.length));
    lienzo.setAttribute('aria-valuenow', String(seleccion + 1));
    lienzo.setAttribute('aria-valuetext', textoDePunto(p, serie));
    const l = lecturaDePunto(p, serie);
    lectura.cuando.textContent = l.cuando;
    lectura.momento.textContent = l.momento;
    lectura.momento.hidden = !l.momento;
    lectura.pctV.textContent = `${serie.visitante.nombre} ${p.pct.visitante} %`;
    lectura.pctL.textContent = `${serie.local.nombre} ${p.pct.local} %`;
    lectura.marcador.textContent = `Marcador: ${l.marcador}`;
    lectura.texto.textContent = l.texto;
    let abrible = false;
    try { abrible = !!p.id && !!sePuedeAbrir(p.id); } catch { abrible = false; }
    lectura.boton.hidden = !abrible;
    if (abrible) lectura.boton.textContent = etiquetaAbrir(p.id);
    seccion.dataset.seleccion = String(seleccion);
    seccion.dataset.siguiendo = siguiendo ? '1' : '0';
    for (const [idJugada, m] of marcas) m.g.classList.toggle('prob-marca-elegida', idJugada === p.id);
  }

  function abrir(i) {
    const p = serie?.puntos[i];
    if (!p?.id) return;
    try { if (sePuedeAbrir(p.id)) alAbrir(p.id); } catch { /* si la jugada no se puede abrir, la gráfica sigue igual */ }
  }

  // --- Interacción ---
  const posicion = (ev) => {
    const caja = svg.getBoundingClientRect();
    const fx = caja.width ? ancho / caja.width : 1; const fy = caja.height ? alto / caja.height : 1;
    return { px: (ev.clientX - caja.left) * fx, py: (ev.clientY - caja.top) * fy };
  };
  const alPuntero = (ev) => {
    if (!serie || !e) return;
    seleccionar(masCercano(serie.puntos, e.tDe(posicion(ev).px)));
  };
  lienzo.addEventListener('pointermove', alPuntero);
  lienzo.addEventListener('pointerdown', alPuntero);
  lienzo.addEventListener('click', (ev) => {
    if (!serie || !e) return;
    const { px, py } = posicion(ev);
    let mejor = -1; let d = RADIO_DE_TOQUE;
    serie.puntos.forEach((p, i) => {
      if (!p.importante || !p.id) return;
      const di = Math.hypot(e.x(p.t) - px, e.y(p.local) - py);
      if (di <= d) { d = di; mejor = i; }
    });
    if (mejor >= 0) { seleccionar(mejor); abrir(mejor); }
  });
  lienzo.addEventListener('keydown', (ev) => {
    if (!serie || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const ultimo = serie.puntos.length - 1;
    let i = null;
    if (ev.key === 'ArrowRight') i = seleccion + 1;
    else if (ev.key === 'ArrowLeft') i = seleccion - 1;
    else if (ev.key === 'ArrowUp' || ev.key === 'PageUp') i = saltarAMomento(serie.puntos, seleccion, 1);
    else if (ev.key === 'ArrowDown' || ev.key === 'PageDown') i = saltarAMomento(serie.puntos, seleccion, -1);
    else if (ev.key === 'Home') i = 0;
    else if (ev.key === 'End') i = ultimo;
    else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(seleccion); return; }
    if (i === null) return;
    ev.preventDefault();
    seleccionar(i);
  });
  lectura.boton.addEventListener('click', () => abrir(seleccion));

  // Si cambia el ancho (giro del celular) o el tema (claro u oscuro), se vuelve a trazar con las mismas piezas.
  const retrazar = () => {
    if (!serie || seccion.hidden) return;
    const { fondo, texto } = leerTema();
    colores = coloresDeGrafica(serie.local, serie.visitante, fondo, texto);
    pintarColores();
    dibujar();
    seleccionar(seleccion);
  };
  try { if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (serie && Math.round(lienzo.clientWidth) !== ancho) retrazar(); }).observe(lienzo); } catch { /* sin observador: se queda con el primer ancho */ }
  try { if (typeof MutationObserver === 'function') new MutationObserver(retrazar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] }); } catch { /* sin observador */ }

  function pintarColores() {
    chips.visitante.color.style.background = colores.visitante;
    chips.local.color.style.background = colores.local;
    lectura.colorV.style.background = colores.visitante;
    lectura.colorL.style.background = colores.local;
  }

  // serie: lo que devuelve serieDeProbabilidad (o null si ESPN no trae la probabilidad: la sección se oculta).
  function actualizar(nueva) {
    if (!nueva?.puntos?.length) {
      serie = null;
      seccion.hidden = true;
      seccion.dataset.puntos = '0';
      return;
    }
    const idElegido = serie && !siguiendo ? serie.puntos[seleccion]?.id : undefined;
    serie = nueva;
    seccion.hidden = false;
    const { fondo, texto } = leerTema();
    colores = coloresDeGrafica(serie.local, serie.visitante, fondo, texto);
    frase.textContent = fraseDeTV(serie);
    chips.visitante.nombre.textContent = serie.visitante.nombre;
    chips.local.nombre.textContent = serie.local.nombre;
    descripcion.textContent = descripcionDeSerie(serie);
    pintarColores();
    dibujar();
    let i = serie.puntos.length - 1;
    if (idElegido !== undefined) { const k = serie.puntos.findIndex((p) => p.id === idElegido); if (k >= 0) i = k; }
    seleccionar(i);
    seccion.dataset.puntos = String(serie.puntos.length);
    seccion.dataset.momentos = String(marcas.size);
  }

  return { elemento: seccion, actualizar, seleccionar: (i) => seleccionar(i), abrir: (i) => abrir(i), enfocar: () => { try { lienzo.focus(); } catch { /* nada */ } } };
}
