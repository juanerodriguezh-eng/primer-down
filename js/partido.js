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
import { simularEnCurso, FORMAS_EN_VIVO } from './simulador.js';

const parametros = new URLSearchParams(location.search);
const idPartido = (parametros.get('id') || '').trim();
const enRepeticion = parametros.get('modo') === 'repeticion';
// ?fuente=guardado muestra el partido guardado completo por el mismo camino que usa el modo en vivo.
// Sirve para ver un partido sin conexión y para probar esa parte sin depender de ESPN.
const desdeGuardado = parametros.get('fuente') === 'guardado';
// ?fuente=simulado convierte el partido guardado en uno "en curso" que avanza solo (demostración y pruebas del modo en vivo).
const simulado = parametros.get('fuente') === 'simulado';

let abrirPizarraAlCargar = parametros.get('pizarra') === 'abierta';

const $ = (id) => document.getElementById(id);
const zonas = { avisos: $('avisos'), marcador: $('marcador'), controles: $('controles'), situacion: $('situacion'), resumen: $('resumen'), feed: $('feed') };

const NOMBRES_CATEGORIA = { pase: 'Pase', carrera: 'Carrera', patada: 'Patada', penal: 'Penal', perdida: 'Pérdida de balón', anotacion: 'Anotación', pausa: 'Pausa', otro: 'Jugada' };

// ---------------------------------------------------------------------------
// Marcador
// ---------------------------------------------------------------------------

function filaEquipo(equipo, tieneBalon, esLocal) {
  return crear('div', { class: `marcador-equipo${equipo.gano ? ' gano' : ''}` },
    crear('span', { class: 'franja', style: equipo.color ? { background: equipo.color } : null, 'aria-hidden': 'true' }),
    crear('span', { class: 'marcador-nombre' },
      crear('span', { class: 'nombre' }, equipo.nombre || equipo.abrev || 'Equipo'),
      crear('span', { class: 'detalle' }, `${equipo.ciudad}${equipo.ciudad ? ' · ' : ''}${esLocal ? 'local' : 'visitante'}`)),
    tieneBalon ? crear('span', { class: 'balon', title: 'Tiene el balón' }, crear('span', { class: 'solo-lectores' }, 'Tiene el balón')) : null,
    crear('span', { class: 'puntos' }, String(equipo.puntos)));
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
  vaciar(zonas.marcador).append(
    crear('p', { class: 'marcador-estado' }, crear('span', { class: clase }, estado)),
    filaEquipo(p.visitante, conBalon === p.visitante.id, false),
    filaEquipo(p.local, conBalon === p.local.id, true));
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
  zona.append(crear('h2', {}, resumen.titulo), crear('p', {}, resumen.cabecera), crear('ol', { class: 'resumen-lista' }, resumen.lineas.map((l) => crear('li', {}, l))), copiar);
}

// ---------------------------------------------------------------------------
// Feed de jugadas, agrupado por drive, lo más reciente arriba
// ---------------------------------------------------------------------------

const pintadas = new Map(); // id de jugada -> { el, firma }
const secciones = new Map(); // id de drive -> { el, titulo, lista }
let ordenPintado = [];

// Botón "Ver en la pizarra": abre debajo de la jugada una cancha con el movimiento real del balón.
function botonPizarra(j, p) {
  const trazo = trazoDeJugada(j, p.ctx);
  if (!trazo) return null;
  const zona = crear('div', { class: 'pizarra-zona', hidden: true });
  const boton = crear('button', { type: 'button', class: 'boton-pizarra', 'aria-expanded': 'false' }, 'Ver en la pizarra');
  boton.addEventListener('click', () => {
    const abrir = zona.hidden;
    zona.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
    boton.textContent = abrir ? 'Ocultar la pizarra' : 'Ver en la pizarra';
    if (!abrir) return;
    if (!zona.firstChild) zona.append(dibujarPizarra(trazo, p));
    zona.firstChild.animar();
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
  // ?pizarra=abierta abre la pizarra de la jugada más reciente al cargar (enlaces directos y verificación automática).
  if (abrirPizarraAlCargar) {
    const boton = zonas.feed.querySelector('.boton-pizarra');
    if (boton) { abrirPizarraAlCargar = false; boton.click(); }
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
