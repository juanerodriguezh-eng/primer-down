// Vista de partido: marcador, situación explicada, mini cancha y feed de jugadas.
// Funciona en dos modos: en vivo (consulta a ESPN cada 20 s) y repetición (partido guardado).
import { traerPartido, traerPartidoGuardado, traerIndiceGuardados } from './api.js';
import { construirPartido, contarJugadas, construirResumen, textoPeriodo } from './modelo.js';
import { explicarSituacion } from './motor.js';
import { crear, vaciar, etiquetaConcepto, montarBotonGlosario, aviso, fechaLocal, fechaCorta } from './ui.js';
import { dibujarCancha } from './cancha.js';
import { crearRepeticion } from './repeticion.js';
import { trazoDeJugada, dibujarPizarra } from './pizarra.js';
import { crearSondeo, mensajeDeFallo } from './vivo.js';
import { lineaDeTiempo } from './jugada3d.js';
import { puedeUsar3D, mostrarJugada3D, cerrarVista3D } from './vista3d.js';
import { simularEnCurso, FORMAS_EN_VIVO } from './simulador.js';

const parametros = new URLSearchParams(location.search);
const idPartido = (parametros.get('id') || '').trim();
const enRepeticion = parametros.get('modo') === 'repeticion';
// ?fuente=guardado muestra el partido guardado completo por el mismo camino que usa el modo en vivo.
// Sirve para ver un partido sin conexión y para probar esa parte sin depender de ESPN.
const desdeGuardado = parametros.get('fuente') === 'guardado';
// ?fuente=simulado convierte el partido guardado en uno "en curso" que avanza solo (demostración y pruebas del modo en vivo).
const simulado = parametros.get('fuente') === 'simulado';

let abrirAlCargar = { abierta: '2d', '3d': '3d' }[parametros.get('pizarra')] || '';

const $ = (id) => document.getElementById(id);
const zonas = { avisos: $('avisos'), marcador: $('marcador'), controles: $('controles'), situacion: $('situacion'), resumen: $('resumen'), feed: $('feed') };

const NOMBRES_CATEGORIA = { pase: 'Pase', carrera: 'Carrera', patada: 'Patada', penal: 'Penal', perdida: 'Pérdida de balón', anotacion: 'Anotación', pausa: 'Pausa', otro: 'Jugada' };

// ---------------------------------------------------------------------------
// Marcador
// ---------------------------------------------------------------------------

// Puntos que se vieron la última vez: si un equipo suma, su número late y aparece un "+7" un momento.
let puntosVistos = null;

function filaEquipo(equipo, tieneBalon, esLocal, suma = 0) {
  return crear('div', { class: `marcador-equipo${equipo.gano ? ' gano' : ''}` },
    crear('span', { class: 'franja', style: equipo.color ? { background: equipo.color } : null, 'aria-hidden': 'true' }),
    crear('span', { class: 'marcador-nombre' },
      crear('span', { class: 'nombre' }, equipo.nombre || equipo.abrev || 'Equipo'),
      crear('span', { class: 'detalle' }, `${equipo.ciudad}${equipo.ciudad ? ' · ' : ''}${esLocal ? 'local' : 'visitante'}`)),
    tieneBalon ? crear('span', { class: 'balon', title: 'Tiene el balón' }, crear('span', { class: 'solo-lectores' }, 'Tiene el balón')) : null,
    suma > 0 ? crear('span', { class: 'puntos-suma', 'aria-hidden': 'true' }, `+${suma}`) : null,
    crear('span', { class: `puntos${suma > 0 ? ' puntos-cambio' : ''}` }, String(equipo.puntos)));
}

function pintarMarcador(p) {
  const conBalon = p.situacion?.punto?.equipoId || '';
  let estado; let clase;
  if (p.estado === 'en-vivo') {
    estado = `${p.enRepeticion ? 'Repetición' : 'En vivo'} · ${p.periodoTexto}${p.reloj ? ` · ${p.reloj}` : ''}`;
    clase = p.enRepeticion ? 'sello sello-repeticion' : 'sello sello-vivo';
  } else if (p.estado === 'final') {
    estado = p.periodo >= 5 ? 'Final en tiempo extra' : 'Final';
    clase = 'sello sello-final';
  } else {
    estado = p.enRepeticion ? 'Repetición · por empezar' : `Programado${p.fecha ? ` · ${fechaLocal(p.fecha)}` : ''}`;
    clase = 'sello';
  }
  // Solo se celebra el cambio entre dos pintadas seguidas del mismo partido (no al cargar ni al saltar hacia atrás).
  const antes = puntosVistos;
  const suma = (lado) => (antes && antes.id === p.id && p[lado].puntos > antes[lado] && p[lado].puntos - antes[lado] <= 8 ? p[lado].puntos - antes[lado] : 0);
  const sumas = { visitante: suma('visitante'), local: suma('local') };
  puntosVistos = { id: p.id, visitante: p.visitante.puntos, local: p.local.puntos };
  vaciar(zonas.marcador).append(
    crear('p', { class: 'marcador-estado' }, crear('span', { class: clase }, estado)),
    filaEquipo(p.visitante, conBalon === p.visitante.id, false, sumas.visitante),
    filaEquipo(p.local, conBalon === p.local.id, true, sumas.local));
  zonas.marcador.dataset.cambio = sumas.visitante || sumas.local ? '1' : '0';
  document.title = `${p.visitante.nombre} ${p.visitante.puntos}, ${p.local.nombre} ${p.local.puntos} · Primer Down`;
}

// ---------------------------------------------------------------------------
// Situación actual
// ---------------------------------------------------------------------------

function pintarSituacion(p) {
  const zona = vaciar(zonas.situacion);
  if (p.situacion) {
    zona.append(
      crear('h2', {}, 'Situación actual'),
      crear('p', { class: 'situacion-titulo' }, p.situacion.titulo),
      crear('p', { class: 'situacion-texto' }, p.situacion.texto),
      dibujarCancha(p),
      crear('p', { class: 'cancha-leyenda' },
        crear('span', { class: 'leyenda leyenda-golpeo' }, 'Balón'),
        crear('span', { class: 'leyenda leyenda-marca' }, 'Línea a conseguir')),
      crear('div', { class: 'conceptos' }, p.situacion.conceptos.map(etiquetaConcepto)));
    return;
  }
  if (p.estado === 'final') {
    const ganador = p.local.puntos === p.visitante.puntos ? null : (p.local.puntos > p.visitante.puntos ? p.local : p.visitante);
    const perdedor = ganador === p.local ? p.visitante : p.local;
    zona.append(crear('h2', {}, 'Partido terminado'),
      crear('p', { class: 'situacion-texto' }, ganador
        ? `Ganaron los ${ganador.nombre}, ${ganador.puntos} a ${perdedor.puntos}. Abajo está el partido completo, jugada por jugada.`
        : `Terminó empatado a ${p.local.puntos}. Abajo está el partido completo, jugada por jugada.`));
  } else if (p.estado === 'programado') {
    zona.append(crear('h2', {}, 'Todavía no empieza'),
      crear('p', { class: 'situacion-texto' }, p.enRepeticion
        ? 'Toca “Reproducir” para ver el partido jugada por jugada, o “Siguiente jugada” para ir a tu ritmo.'
        : `Empieza ${p.fecha ? `el ${fechaLocal(p.fecha)} (tu hora local)` : 'pronto'}. Esta página se actualiza sola cuando arranque.`));
  } else {
    zona.append(crear('h2', {}, 'Entre jugadas'),
      crear('p', { class: 'situacion-texto' }, 'Ahora mismo no hay una oportunidad en curso: viene una patada, un cambio de posesión o una pausa.'));
  }
}

// ---------------------------------------------------------------------------
// Resumen al final del partido
// ---------------------------------------------------------------------------

function pintarResumen(p) {
  const zona = vaciar(zonas.resumen);
  const resumen = construirResumen(p);
  zona.hidden = !resumen;
  if (!resumen) return;
  const copiar = crear('button', { type: 'button', class: 'boton' }, 'Copiar resumen');
  copiar.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resumen.texto);
      copiar.textContent = 'Resumen copiado';
    } catch {
      copiar.textContent = 'No se pudo copiar';
    }
    setTimeout(() => { copiar.textContent = 'Copiar resumen'; }, 2500);
  });
  zona.append(crear('h2', {}, resumen.titulo), crear('p', { class: 'resumen-relato' }, resumen.cabecera), crear('p', {}, resumen.encabezadoLista), crear('ol', { class: 'resumen-lista' }, resumen.lineas.map((l) => crear('li', {}, l))), copiar);
}

// ---------------------------------------------------------------------------
// Feed de jugadas, agrupado por drive, lo más reciente arriba
// ---------------------------------------------------------------------------

const pintadas = new Map(); // id de jugada -> { el, firma }
const secciones = new Map(); // id de drive -> { el, titulo, lista }
let ordenPintado = [];

// Botón para ver la jugada: abre debajo la recreación en 3D (22 jugadores, cámara de transmisión) y, si el
// dispositivo no puede con ella (sin WebGL, error al cargar o "reducir movimiento"), la pizarra 2D de siempre.
let hay3D = null; // se averigua una sola vez
const puede3D = () => { if (hay3D === null) hay3D = puedeUsar3D(); return hay3D; };
let abierta3D = null; // { zona, boton } de la jugada que tiene la vista 3D (solo hay una a la vez)

const contexto3D = (p) => ({
  local: { ...p.ctx.local, color: p.local.color, colorAlterno: p.local.colorAlterno },
  visitante: { ...p.ctx.visitante, color: p.visitante.color, colorAlterno: p.visitante.colorAlterno },
  dorsales: p.dorsales || null,
});

function cerrarZona(zona, boton) {
  zona.hidden = true;
  boton.setAttribute('aria-expanded', 'false');
  boton.textContent = boton.dataset.texto;
  if (abierta3D?.zona === zona) { cerrarVista3D(); abierta3D = null; vaciar(zona); }
}

async function abrirVista(zona, boton, j, p, trazo, en3D, opciones = {}) {
  if (abierta3D?.zona === zona) { cerrarVista3D(); abierta3D = null; }
  vaciar(zona);
  if (en3D && !puede3D()) { en3D = false; opciones = { nota: true }; } // pedida por la dirección en un dispositivo sin WebGL
  const cambiar = (texto, a3D) => {
    const b = crear('button', { type: 'button', class: 'boton-enlace' }, texto);
    b.addEventListener('click', () => abrirVista(zona, boton, j, p, trazo, a3D));
    return b;
  };
  if (en3D) {
    const linea = lineaDeTiempo(j, contexto3D(p));
    const caja = crear('div', {});
    zona.append(caja, cambiar('Ver la pizarra 2D', false));
    try {
      if (!linea) throw new Error('Jugada sin recreación');
      if (abierta3D && abierta3D.zona !== zona) cerrarZona(abierta3D.zona, abierta3D.boton);
      abierta3D = { zona, boton };
      await mostrarJugada3D(caja, linea, { ...opciones, alFallar: () => abrirVista(zona, boton, j, p, trazo, false, { nota: true }) });
      return;
    } catch {
      if (abierta3D?.zona === zona) abierta3D = null;
      hay3D = false; // no se vuelve a intentar en esta visita
      vaciar(zona);
      opciones = { nota: true };
    }
  }
  const bloque = dibujarPizarra(trazo, p);
  if (opciones.nota) zona.append(crear('p', { class: 'vista3d-aviso' }, 'La vista 3D no está disponible en este dispositivo: te mostramos la pizarra.'));
  zona.append(bloque);
  if (puede3D()) zona.append(cambiar('Ver en 3D', true));
  bloque.animar();
}

function botonPizarra(j, p) {
  const trazo = trazoDeJugada(j, p.ctx);
  if (!trazo) return null;
  const zona = crear('div', { class: 'pizarra-zona', hidden: true });
  const texto = puede3D() ? 'Ver la jugada en 3D' : 'Ver en la pizarra';
  const boton = crear('button', { type: 'button', class: 'boton-pizarra', 'aria-expanded': 'false', dataset: { texto } }, texto);
  boton.addEventListener('click', (ev) => {
    if (!zona.hidden) { cerrarZona(zona, boton); return; }
    zona.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    boton.textContent = 'Ocultar la jugada';
    const forzada = ev.detail && typeof ev.detail === 'object' ? ev.detail : null; // apertura automática por la dirección
    abrirVista(zona, boton, j, p, trazo, forzada ? forzada.en3D : puede3D(), forzada?.opciones);
  });
  return crear('div', { class: 'pizarra-contenedor' }, boton, zona);
}

function tarjetaJugada(j, p) {
  const e = j.explicacion;
  const previa = j.inicio && j.inicio.down >= 1 && j.inicio.down <= 4 ? explicarSituacion(j.inicio, p.ctx).titulo : '';
  const cuando = `${textoPeriodo(j.periodo)}${j.reloj ? ` · ${j.reloj}` : ''}`;
  const favorecido = j.favorece === p.local.id ? p.local : j.favorece === p.visitante.id ? p.visitante : null;
  return crear('article', { class: `jugada cat-${e.categoria}${j.clave ? ' clave' : ''}${e.menor ? ' menor' : ''}`, dataset: { id: j.id } },
    crear('header', { class: 'jugada-cabecera' },
      crear('span', { class: 'tipo', title: NOMBRES_CATEGORIA[e.categoria] || 'Jugada' }, e.etiqueta),
      crear('span', { class: 'cuando' }, cuando)),
    j.clave ? crear('p', { class: 'sello-clave' }, `Jugada clave${favorecido ? ` · sube ${Math.round(Math.abs(j.cambio) * 100)} puntos la probabilidad de ganar de los ${favorecido.nombre}` : ''}`) : null,
    previa ? crear('p', { class: 'previa' }, previa) : null,
    crear('p', { class: 'explicacion' }, e.explicacion),
    e.porQue ? crear('p', { class: 'porque' }, crear('strong', {}, '¿Por qué? '), e.porQue.texto) : null,
    e.anotacion ? crear('p', { class: 'marcador-mini' }, `${p.visitante.nombre} ${j.marcador.visitante} · ${p.local.nombre} ${j.marcador.local}`) : null,
    e.conceptos.length ? crear('div', { class: 'conceptos' }, e.conceptos.map(etiquetaConcepto)) : null,
    botonPizarra(j, p),
    e.original ? crear('details', { class: 'original' }, crear('summary', {}, 'Texto original en inglés'), crear('p', { lang: 'en' }, e.original)) : null);
}

function firmaDe(j) {
  return `${j.explicacion.explicacion}|${j.explicacion.porQue?.texto || ''}|${j.clave ? 1 : 0}`;
}

function pintarFeed(p, animar) {
  const orden = p.drives.flatMap((d) => d.jugadas.map((j) => j.id));
  // Si lo pintado ya no es el comienzo de lo nuevo (la repetición retrocedió), se empieza de cero.
  const sigue = ordenPintado.length <= orden.length && ordenPintado.every((id, i) => id === orden[i]);
  if (!sigue) {
    vaciar(zonas.feed);
    pintadas.clear();
    secciones.clear();
  }
  const esPrimeraVez = pintadas.size === 0;
  for (const d of p.drives) {
    let seccion = secciones.get(d.id);
    if (!seccion) {
      const titulo = crear('h3', { class: 'drive-titulo' });
      const lista = crear('div', { class: 'drive-jugadas' });
      const equipo = d.equipoId === p.local.id ? p.local : d.equipoId === p.visitante.id ? p.visitante : null;
      const el = crear('section', { class: 'drive', style: equipo?.color ? { '--color-equipo': equipo.color } : null }, titulo, lista);
      seccion = { el, titulo, lista };
      secciones.set(d.id, seccion);
      zonas.feed.prepend(el);
    }
    seccion.titulo.textContent = d.resumen.texto;
    seccion.el.classList.toggle('en-curso', d.enCurso);
    for (const j of d.jugadas) {
      const firma = firmaDe(j);
      const previa = pintadas.get(j.id);
      if (previa && previa.firma === firma) continue;
      const tarjeta = tarjetaJugada(j, p);
      if (previa) {
        previa.el.replaceWith(tarjeta);
      } else {
        if (animar && !esPrimeraVez) tarjeta.classList.add('nueva');
        seccion.lista.prepend(tarjeta);
      }
      pintadas.set(j.id, { el: tarjeta, firma });
    }
  }
  ordenPintado = orden;
  if (!orden.length) vaciar(zonas.feed).append(crear('p', { class: 'vacio' }, 'Aquí van a aparecer las jugadas, la más reciente arriba.'));
  else zonas.feed.querySelector(':scope > .vacio')?.remove();
}

function pintar(p, { animar = true } = {}) {
  pintarMarcador(p);
  pintarSituacion(p);
  pintarResumen(p);
  pintarFeed(p, animar);
  document.body.dataset.estado = p.estado;
  document.body.dataset.listo = '1';
  // ?pizarra=abierta abre la pizarra 2D de la jugada más reciente al cargar y ?pizarra=3d abre la vista 3D
  // (enlaces directos y verificación automática). Con &t3d=2.5 la vista 3D se congela en ese segundo.
  if (abrirAlCargar) {
    const boton = zonas.feed.querySelector('.boton-pizarra');
    if (boton) {
      const en3D = abrirAlCargar === '3d';
      const opciones = en3D && parametros.has('t3d') ? { congelarEn: Number(parametros.get('t3d')) || 0, camara: parametros.get('camara') || '' } : {};
      abrirAlCargar = '';
      boton.dispatchEvent(new CustomEvent('click', { detail: { en3D, opciones } }));
    }
  }
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

function ponerAviso(clave, nodo) {
  zonas.avisos.querySelector(`[data-clave="${clave}"]`)?.remove();
  if (nodo) { nodo.dataset.clave = clave; zonas.avisos.append(nodo); }
}

// ---------------------------------------------------------------------------
// Modo repetición
// ---------------------------------------------------------------------------

async function iniciarRepeticion() {
  let summary;
  try {
    summary = await traerPartidoGuardado(idPartido);
  } catch {
    ponerAviso('carga', aviso('No encontramos este partido entre los guardados. Vuelve a la portada y elige otro.', 'error'));
    return;
  }
  const total = contarJugadas(summary);
  const completo = construirPartido(summary);
  ponerAviso('modo', aviso(`Repetición del partido del ${fechaCorta(completo.fecha)}. Ya se jugó: lo reproducimos jugada por jugada, como si fuera en vivo.`));
  const inicio = Math.max(0, Math.min(total, Number(parametros.get('jugada')) || 0));
  const repeticion = crearRepeticion({
    total,
    inicio,
    alCambiar: (n, { automatico } = {}) => pintar(construirPartido(summary, { hasta: n }), { animar: !!automatico }),
  });
  vaciar(zonas.controles).append(repeticion.elemento);
  repeticion.ir(inicio);
}

// ---------------------------------------------------------------------------
// Modo en vivo
// ---------------------------------------------------------------------------

// El sondeo (cada cuánto se consulta, pausa con la pestaña oculta, reintentos) vive en js/vivo.js, con pruebas.

// Partido simulado "en curso": el guardado cortado en una jugada que avanza en cada consulta.
// partido.html?id=...&fuente=simulado&desde=150&paso=3&cada=2&forma=con-current
let jugadaSimulada = Math.max(0, Number(parametros.get('desde')) || 0);
const pasoSimulado = Math.max(0, parametros.has('paso') ? Number(parametros.get('paso')) || 0 : 2);
const formaSimulada = FORMAS_EN_VIVO.includes(parametros.get('forma')) ? parametros.get('forma') : 'con-current';
let guardadoSimulado = null;

async function traerSimulado() {
  if (!guardadoSimulado) guardadoSimulado = await traerPartidoGuardado(idPartido);
  const summary = simularEnCurso(guardadoSimulado, jugadaSimulada, { forma: formaSimulada });
  jugadaSimulada += pasoSimulado;
  return summary;
}

const traerDatos = () => (simulado ? traerSimulado() : desdeGuardado ? traerPartidoGuardado(idPartido) : traerPartido(idPartido));

function recibir(summary, { primeraVez }) {
  const p = construirPartido(summary);
  if (!p.local.nombre && !p.visitante.nombre) throw new Error('La respuesta no trae el partido');
  pintar(p, { animar: !primeraVez });
  ponerAviso('red', null);
  ponerAviso('modo', p.estado === 'en-vivo'
    ? aviso(simulado ? 'Demostración: un partido guardado que avanza solo, como si fuera en vivo.' : 'En vivo: esta página se actualiza sola cada 20 segundos.')
    : null);
  if (p.estado === 'final') ofrecerRepeticion();
  return p.estado;
}

function fallar({ hayDatos }) {
  ponerAviso('red', aviso(mensajeDeFallo(hayDatos), 'error'));
  document.body.dataset.listo = '1';
}

async function ofrecerRepeticion() {
  try {
    const indice = await traerIndiceGuardados();
    if (!indice.partidos?.some((x) => x.id === idPartido)) return;
    ponerAviso('repeticion', crear('p', { class: 'aviso aviso-info' }, 'Este partido está guardado. ',
      crear('a', { href: `partido.html?id=${encodeURIComponent(idPartido)}&modo=repeticion` }, 'Verlo en modo repetición, jugada por jugada')));
  } catch { /* sin índice no se ofrece la repetición */ }
}

// ---------------------------------------------------------------------------

montarBotonGlosario();
if (!/^\d{1,15}$/.test(idPartido)) {
  ponerAviso('carga', aviso('Falta indicar qué partido quieres ver. Vuelve a la portada y elige uno.', 'error'));
  document.body.dataset.listo = '1';
} else if (enRepeticion) {
  iniciarRepeticion();
} else {
  const cadaSimulado = Math.max(0.2, Number(parametros.get('cada')) || 4) * 1000;
  const sondeo = crearSondeo({
    traer: traerDatos,
    alRecibir: recibir,
    alFallar: fallar,
    estaOculta: () => document.hidden,
    ...(simulado ? { cadaEnVivo: cadaSimulado, cadaEnEspera: cadaSimulado } : {}),
  });
  document.addEventListener('visibilitychange', sondeo.programar);
  sondeo.consultar();
}
