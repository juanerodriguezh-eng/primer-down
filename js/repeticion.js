// Modo repetición: reproduce un partido guardado jugada por jugada, como si fuera en vivo.
// Este módulo solo lleva la cuenta de por cuál jugada vamos y pinta los controles;
// quien lo usa recibe el número en `alCambiar(n)` y vuelve a pintar el partido.
import { crear } from './ui.js';

const VELOCIDADES = [
  { id: 'lenta', nombre: 'Lenta', ms: 6000 },
  { id: 'normal', nombre: 'Normal', ms: 3000 },
  { id: 'rapida', nombre: 'Rápida', ms: 1000 },
];

export function crearRepeticion({ total, inicio = 0, alCambiar }) {
  let actual = Math.max(0, Math.min(total, inicio));
  let reproduciendo = false;
  let temporizador = null;
  let velocidad = VELOCIDADES[1];

  const botonPlay = crear('button', { type: 'button', class: 'boton boton-principal' }, 'Reproducir');
  const botonSiguiente = crear('button', { type: 'button', class: 'boton' }, 'Siguiente jugada');
  const botonInicio = crear('button', { type: 'button', class: 'boton boton-suave boton-chico' }, 'Reiniciar');
  const botonFinal = crear('button', { type: 'button', class: 'boton boton-suave boton-chico' }, 'Ir al final');
  const barra = crear('input', { type: 'range', min: 0, max: total, step: 1, value: actual, class: 'barra', 'aria-label': 'Avance del partido' });
  const cuenta = crear('span', { class: 'cuenta', 'aria-live': 'off' });
  const selector = crear('select', { class: 'selector', 'aria-label': 'Velocidad de la repetición' },
    VELOCIDADES.map((v) => crear('option', { value: v.id, selected: v.id === velocidad.id }, v.nombre)));

  const elemento = crear('section', { class: 'repeticion', 'aria-label': 'Controles de la repetición' },
    crear('div', { class: 'repeticion-fila' }, botonPlay, botonSiguiente),
    crear('div', { class: 'repeticion-fila' }, barra),
    crear('div', { class: 'repeticion-fila' }, cuenta, crear('label', { class: 'velocidad' }, 'Velocidad ', selector)),
    crear('div', { class: 'repeticion-fila' }, botonInicio, botonFinal));

  function pintarControles() {
    barra.value = String(actual);
    cuenta.textContent = actual === 0 ? `Antes de empezar · ${total} jugadas` : `Jugada ${actual} de ${total}`;
    botonPlay.textContent = reproduciendo ? 'Pausar' : (actual >= total ? 'Ver de nuevo' : 'Reproducir');
    botonPlay.setAttribute('aria-pressed', reproduciendo ? 'true' : 'false');
    botonSiguiente.disabled = actual >= total;
  }

  function detener() {
    reproduciendo = false;
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
  }

  function programar() {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    if (!reproduciendo || document.hidden) return;
    temporizador = setTimeout(() => {
      if (actual >= total) { detener(); pintarControles(); return; }
      ir(actual + 1, true);
      programar();
    }, velocidad.ms);
  }

  function ir(n, automatico = false) {
    actual = Math.max(0, Math.min(total, Math.round(Number(n) || 0)));
    if (actual >= total) detener();
    pintarControles();
    alCambiar(actual, { automatico });
  }

  botonPlay.addEventListener('click', () => {
    if (reproduciendo) { detener(); pintarControles(); return; }
    if (actual >= total) ir(0);
    reproduciendo = true;
    ir(actual + 1, true);
    programar();
  });
  botonSiguiente.addEventListener('click', () => { detener(); ir(actual + 1); });
  botonInicio.addEventListener('click', () => { detener(); ir(0); });
  botonFinal.addEventListener('click', () => { detener(); ir(total); });
  barra.addEventListener('input', () => { detener(); ir(barra.value); });
  selector.addEventListener('change', () => {
    velocidad = VELOCIDADES.find((v) => v.id === selector.value) || VELOCIDADES[1];
    programar();
  });
  // Si la pestaña se oculta, la repetición espera; al volver, sigue.
  document.addEventListener('visibilitychange', programar);

  pintarControles();
  return { elemento, ir, pausar: () => { detener(); pintarControles(); }, get actual() { return actual; } };
}
