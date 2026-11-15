// El narrador de esta página: une js/narrador.js (puro) con la voz del navegador (Web Speech API).
// Sin servicios externos, sin claves y sin descargas. Si el navegador no tiene speechSynthesis o no tiene
// ninguna voz en español, el narrador queda "no disponible" y el botón no aparece.
import { crearNarrador } from './narrador.js';

let narrador = null;

// Voz muda para la verificación automática (partido.html?...&narrador=simulado): el navegador sin ventana no
// trae voces, así que esta "dice" cada frase en silencio y tarda lo que tardaría una voz real en decirla.
function vozSimulada() {
  let espera = 0;
  return {
    sintesis: {
      getVoices: () => [{ lang: 'es-MX', name: 'Voz simulada (sin sonido)', localService: true }],
      speak(u) { clearTimeout(espera); espera = setTimeout(() => u.onend?.(), 350 + String(u.text).length * 55); },
      cancel() { clearTimeout(espera); },
    },
    Enunciado: class { constructor(texto) { this.text = texto; } },
    memoria: null,
  };
}

export function narradorDelNavegador() {
  if (narrador) return narrador;
  try {
    if (new URLSearchParams(location.search).get('narrador') === 'simulado') {
      narrador = crearNarrador(vozSimulada());
      narrador.encender(true);
      return narrador;
    }
    let memoria = null;
    try { memoria = window.localStorage; } catch { memoria = null; } // hay navegadores que lo bloquean
    narrador = crearNarrador({
      sintesis: 'speechSynthesis' in window ? window.speechSynthesis : null,
      Enunciado: typeof window.SpeechSynthesisUtterance === 'function' ? window.SpeechSynthesisUtterance : null,
      memoria,
    });
  } catch {
    narrador = crearNarrador(); // sin voz: no disponible, y nada más cambia
  }
  return narrador;
}
