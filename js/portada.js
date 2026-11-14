// Portada: partidos de la semana (en vivo arriba) y partidos guardados para el modo repetición.
import { traerCartelera, traerIndiceGuardados } from './api.js';
import { construirCartelera } from './modelo.js';
import { crear, vaciar, montarBotonGlosario, aviso, fechaLocal, fechaCorta } from './ui.js';

const zonaSemana = document.getElementById('semana');
const zonaGuardados = document.getElementById('guardados');
const tituloSemana = document.getElementById('titulo-semana');
const botonDemo = document.getElementById('boton-demo');

let guardados = new Set();
let hayCartelera = false;
let hayEnVivo = false;

function filaEquipo(equipo, mostrarPuntos) {
  return crear('div', { class: `fila-equipo${equipo.gano ? ' gano' : ''}` },
    crear('span', { class: 'franja', style: equipo.color ? { background: equipo.color } : null, 'aria-hidden': 'true' }),
    crear('span', { class: 'nombre' }, equipo.nombre || equipo.abrev),
    crear('span', { class: 'detalle' }, equipo.ciudad),
    mostrarPuntos ? crear('span', { class: 'puntos' }, String(equipo.puntos)) : null);
}

function tarjetaDeLaSemana(p) {
  let sello; let accion;
  const enlace = `partido.html?id=${encodeURIComponent(p.id)}`;
  if (p.estado === 'en-vivo') {
    sello = crear('span', { class: 'sello sello-vivo' }, p.medioTiempo ? 'En vivo · medio tiempo' : `En vivo · ${p.periodoTexto}${p.reloj ? ` · ${p.reloj}` : ''}`);
    accion = crear('a', { class: 'boton boton-principal', href: enlace }, 'Seguir en vivo');
  } else if (p.estado === 'final') {
    sello = crear('span', { class: 'sello sello-final' }, 'Final');
    accion = crear('a', { class: 'boton', href: enlace }, 'Ver jugadas explicadas');
  } else {
    sello = crear('span', { class: 'sello' }, `Programado · ${fechaLocal(p.fecha)}`);
    accion = crear('a', { class: 'boton boton-suave', href: enlace }, 'Abrir partido');
  }
  const repeticion = guardados.has(p.id)
    ? crear('a', { class: 'boton boton-suave', href: `${enlace}&modo=repeticion` }, 'Modo repetición')
    : null;
  return crear('article', { class: `tarjeta estado-${p.estado}` },
    crear('p', { class: 'tarjeta-estado' }, sello),
    filaEquipo(p.visitante, p.estado !== 'programado'),
    filaEquipo(p.local, p.estado !== 'programado'),
    crear('div', { class: 'tarjeta-acciones' }, accion, repeticion));
}

function tarjetaGuardada(p) {
  return crear('article', { class: 'tarjeta estado-final' },
    crear('p', { class: 'tarjeta-estado' }, crear('span', { class: 'sello sello-repeticion' }, `Semana ${p.semana} · ${fechaCorta(p.fecha)}`)),
    filaEquipo(p.visitante, true),
    filaEquipo(p.local, true),
    crear('div', { class: 'tarjeta-acciones' },
      crear('a', { class: 'boton boton-principal', href: `partido.html?id=${encodeURIComponent(p.id)}&modo=repeticion` }, 'Repetir jugada por jugada')));
}

async function cargarGuardados() {
  try {
    const indice = await traerIndiceGuardados();
    const lista = Array.isArray(indice.partidos) ? indice.partidos : [];
    guardados = new Set(lista.map((p) => p.id));
    vaciar(zonaGuardados).append(...lista.map(tarjetaGuardada));
    if (lista[0] && botonDemo) botonDemo.href = `partido.html?id=${encodeURIComponent(lista[0].id)}&modo=repeticion`;
    if (!lista.length) zonaGuardados.append(aviso('Todavía no hay partidos guardados.'));
  } catch {
    vaciar(zonaGuardados).append(aviso('No pudimos cargar los partidos guardados.', 'error'));
  }
  document.body.dataset.guardados = '1';
}

async function cargarSemana() {
  try {
    const cartelera = construirCartelera(await traerCartelera());
    hayEnVivo = cartelera.partidos.some((p) => p.estado === 'en-vivo');
    if (cartelera.semana) tituloSemana.textContent = `Partidos de la semana ${cartelera.semana}`;
    vaciar(zonaSemana).append(...cartelera.partidos.map(tarjetaDeLaSemana));
    if (!cartelera.partidos.length) zonaSemana.append(aviso('Esta semana no hay partidos en el calendario. Prueba el modo repetición.'));
    hayCartelera = true;
  } catch {
    if (!hayCartelera) vaciar(zonaSemana).append(aviso('No pudimos cargar los partidos de la semana desde la fuente de datos. Mientras tanto puedes usar el modo repetición, que no depende de internet.', 'error'));
  }
  document.body.dataset.semana = '1';
}

// La portada se refresca sola: cada 30 s si hay partidos en vivo y cada 2 minutos si no. Solo con la pestaña visible.
let ultima = 0;
async function ciclo() {
  if (!document.hidden && Date.now() - ultima >= (hayEnVivo ? 30000 : 120000)) {
    ultima = Date.now();
    await cargarSemana();
  }
}

montarBotonGlosario();
await cargarGuardados();
ultima = Date.now();
await cargarSemana();
setInterval(ciclo, 10000);
document.addEventListener('visibilitychange', ciclo);
