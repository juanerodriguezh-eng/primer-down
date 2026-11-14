// Piezas de pantalla compartidas por todas las páginas: crear elementos, fechas y el panel del glosario.
import { GLOSARIO, GRUPOS, buscarTermino } from './glosario.js';

// Crea un elemento. Los textos siempre entran como nodos de texto (nunca como HTML),
// así que nada de lo que venga de la API puede inyectar código.
export function crear(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class') el.className = valor;
    else if (clave === 'dataset') Object.assign(el.dataset, valor);
    else if (clave === 'style' && typeof valor === 'object') { for (const [k, v] of Object.entries(valor)) el.style.setProperty(k, v); }
    else if (clave.startsWith('on') && typeof valor === 'function') el.addEventListener(clave.slice(2), valor);
    else if (valor === true) el.setAttribute(clave, '');
    else el.setAttribute(clave, String(valor));
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

export function vaciar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// "dom 15 nov, 1:00 p. m." en la hora de quien mira el sitio.
export function fechaLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(/[.,]/g, '');
  const hora = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' }).format(d);
  return `${dia}, ${hora}`;
}

export function fechaCorta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

// Nombre corto de un término para las etiquetas: "Primer down (primero y diez)" -> "Primer down".
export function nombreCorto(termino) {
  return String(termino || '').replace(/\s*\(.*\)\s*$/, '');
}

// ---------------------------------------------------------------------------
// Glosario: panel que se abre desde las etiquetas y desde el botón fijo
// ---------------------------------------------------------------------------

let panel = null;

function fichaDeTermino(t, abierta = false) {
  return crear('details', { class: 'termino', id: `g-${t.id}`, open: abierta },
    crear('summary', {}, t.termino),
    crear('p', {}, t.definicion),
    t.ejemplo ? crear('p', { class: 'ejemplo' }, crear('strong', {}, 'Ejemplo: '), t.ejemplo) : null);
}

function construirPanel() {
  const buscador = crear('input', { type: 'search', class: 'buscador', placeholder: 'Buscar un término…', 'aria-label': 'Buscar en el glosario' });
  const lista = crear('div', { class: 'glosario-lista' });
  const pintar = (filtro = '') => {
    vaciar(lista);
    const f = filtro.trim().toLowerCase();
    let hay = false;
    for (const grupo of GRUPOS) {
      const terminos = GLOSARIO.filter((t) => t.grupo === grupo.id && (!f || `${t.termino} ${t.definicion}`.toLowerCase().includes(f)));
      if (!terminos.length) continue;
      hay = true;
      lista.append(crear('h3', {}, grupo.titulo), ...terminos.map((t) => fichaDeTermino(t)));
    }
    if (!hay) lista.append(crear('p', { class: 'vacio' }, 'No encontramos ese término. Prueba con otra palabra.'));
  };
  buscador.addEventListener('input', () => pintar(buscador.value));
  pintar();
  const cerrar = crear('button', { type: 'button', class: 'boton-cerrar', 'aria-label': 'Cerrar el glosario', onclick: () => panel.close() }, 'Cerrar');
  const dialogo = crear('dialog', { class: 'panel-glosario', 'aria-labelledby': 'titulo-glosario' },
    crear('div', { class: 'panel-cabecera' }, crear('h2', { id: 'titulo-glosario' }, 'Glosario'), cerrar),
    buscador,
    lista);
  // Tocar fuera del panel lo cierra.
  dialogo.addEventListener('click', (ev) => { if (ev.target === dialogo) dialogo.close(); });
  dialogo.pintar = pintar;
  dialogo.buscador = buscador;
  document.body.append(dialogo);
  return dialogo;
}

// Abre el glosario; si se pasa un id, muestra ese término abierto y a la vista.
export function abrirGlosario(id) {
  if (!panel) panel = construirPanel();
  panel.buscador.value = '';
  panel.pintar();
  if (typeof panel.showModal === 'function') { if (!panel.open) panel.showModal(); } else panel.setAttribute('open', '');
  if (id && buscarTermino(id)) {
    const ficha = panel.querySelector(`#g-${CSS.escape(id)}`);
    if (ficha) { ficha.open = true; ficha.scrollIntoView({ block: 'start' }); ficha.querySelector('summary')?.focus(); }
  } else {
    panel.buscador.focus();
  }
}

// Etiqueta de un concepto que abre su explicación.
export function etiquetaConcepto(id) {
  const t = buscarTermino(id);
  if (!t) return null;
  return crear('button', { type: 'button', class: 'etiqueta', title: `¿Qué es ${nombreCorto(t.termino)}?`, onclick: () => abrirGlosario(id) }, nombreCorto(t.termino));
}

// Botón fijo del glosario, presente en todas las páginas.
export function montarBotonGlosario() {
  montarBotonTema();
  document.body.append(crear('button', { type: 'button', class: 'boton-glosario', onclick: () => abrirGlosario() }, 'Glosario'));
}

// Botón de tema: el sitio es oscuro por defecto (se usa de noche); quien prefiera el claro lo elige y se recuerda.
export function montarBotonTema() {
  const boton = document.querySelector('[data-tema-boton]');
  if (!boton) return;
  const pintar = () => {
    const claro = document.documentElement.dataset.tema === 'claro';
    boton.textContent = claro ? 'Oscuro' : 'Claro';
    boton.title = claro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    boton.setAttribute('aria-label', claro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  };
  boton.addEventListener('click', () => {
    const claro = document.documentElement.dataset.tema === 'claro';
    if (claro) delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = 'claro';
    try { localStorage.setItem('tema', claro ? 'oscuro' : 'claro'); } catch { /* sin almacenamiento, el cambio dura esta visita */ }
    pintar();
  });
  pintar();
}

// Aviso de estado o de error, accesible para lectores de pantalla.
export function aviso(texto, tipo = 'info') {
  return crear('p', { class: `aviso aviso-${tipo}`, role: tipo === 'error' ? 'alert' : 'status' }, texto);
}
