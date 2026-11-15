// "Jugadas clave" en reproducción continua: una capa a pantalla completa que muestra, una tras otra, las jugadas
// que decidieron el partido. Por cada una: tarjeta de título, la jugada con cámara de transmisión, una repetición
// corta y una cortina; al final, el marcador. Qué jugadas son y en qué orden lo decide js/clave.js (puro, con pruebas).
// Sin WebGL o con "reducir movimiento" la misma secuencia usa la pizarra 2D.
import { crear, vaciar } from './ui.js';
import { elegirJugadasClave, tarjetaDeClave, tarjetaFinal, pasosDeClave, inicioDeRepeticion } from './clave.js';
import { separarFrases } from './modelo.js';
import { lineaDeTiempo } from './jugada3d.js';
import { graficaDeTV } from './graficatv.js';
import { relatoDeJugada } from './narrador.js';
import { narradorDelNavegador } from './voz.js';
import { trazoDeJugada, dibujarPizarra } from './pizarra.js';
import { nodo } from './cancha.js';
import { serieDeProbabilidad, miniDeClave, coloresDeGrafica } from './probabilidad.js';
import { puedeUsar3D, mostrarJugada3D, cerrarVista3D } from './vista3d.js';

const sinMovimiento = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

let abierta = null; // solo una a la vez

// Abre la reproducción. opciones: { desde: índice de la jugada en que arranca, alSalir }. Devuelve null si el
// partido no tiene jugadas para mostrar.
export function abrirJugadasClave(partido, opciones = {}) {
  const claves = elegirJugadasClave(partido, 5);
  if (!claves.length) return null;
  abierta?.salir();

  const quieto = sinMovimiento();
  let usar3D = puedeUsar3D();
  const pasos = pasosDeClave(claves.length, { sinMovimiento: quieto });
  const narrador = narradorDelNavegador();
  const ctx3D = {
    local: { ...partido.ctx.local, color: partido.local.color, colorAlterno: partido.local.colorAlterno },
    visitante: { ...partido.ctx.visitante, color: partido.visitante.color, colorAlterno: partido.visitante.colorAlterno },
    dorsales: partido.dorsales || null,
  };

  // --- Estructura ---
  const progreso = crear('p', { class: 'clave-progreso', 'aria-live': 'polite' }, 'Jugadas clave');
  const caja = crear('div', { class: 'clave-jugada' });
  const tarjeta = crear('div', { class: 'clave-tarjeta', hidden: true });
  const sello = crear('p', { class: 'clave-sello', hidden: true }, 'Repetición');
  const cortina = crear('div', { class: 'tv-cortina clave-cortina', 'aria-hidden': 'true', hidden: true }, crear('span', {}, 'Jugada clave'));
  const escena = crear('div', { class: 'clave-escena' }, caja, sello, tarjeta, cortina);
  const pie = crear('p', { class: 'clave-pie' });
  const bPausa = crear('button', { type: 'button', class: 'boton boton-chico', 'aria-pressed': 'false' }, '⏸ Pausa');
  const bSiguiente = crear('button', { type: 'button', class: 'boton boton-chico' }, '⏭ Siguiente');
  const bNarrador = crear('button', { type: 'button', class: 'boton boton-chico boton-narrador', 'aria-pressed': 'false', hidden: true, title: 'Relato con la voz en español de tu navegador' }, '🔊 Narrador');
  const bSalir = crear('button', { type: 'button', class: 'boton boton-chico' }, '✕ Salir');
  const controles = crear('div', { class: 'clave-controles' }, bPausa, bSiguiente, bNarrador, bSalir);
  const capa = crear('div', { class: 'clave-capa', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Jugadas clave del partido', tabindex: '-1' },
    crear('div', { class: 'clave-interior' }, progreso, escena, pie, controles));

  // --- Estado ---
  let indice = -1; // paso actual
  let pausado = false;
  let cerrada = false;
  let vista = null; // control de la vista 3D de la jugada en curso
  let lineaActual = null;
  let pizarra = null; // bloque 2D de la jugada en curso
  let turno = 0; // cambia en cada paso: lo que quedó esperando de un paso anterior se descarta
  let espera = null; // { id, fn, hasta, restante }
  let relojVoz = 0; // en 2D, el reloj que le marca el paso al narrador
  let tVoz = 0;

  const marcar = (estado) => { capa.dataset.paso = estado; capa.dataset.indice = String(pasos[indice]?.i ?? 0); };

  // Espera que se puede pausar: en pausa conserva lo que faltaba.
  const esperar = (ms, fn) => {
    clearTimeout(espera?.id);
    const mio = turno;
    const disparar = () => { espera = null; if (!cerrada && mio === turno) fn(); };
    espera = { fn: disparar, restante: ms, hasta: Date.now() + ms, id: 0 };
    if (!pausado) espera.id = setTimeout(disparar, ms);
  };
  // Espera a que se cumpla una condición (o a que pase el tope) y sigue.
  const esperarA = (condicion, tope, fn, cada = 200) => {
    let vueltas = 0; // se cuentan vueltas y no reloj: así el tiempo en pausa no gasta el tope
    const mirar = () => {
      let lista = false;
      try { lista = !!condicion(); } catch { lista = true; }
      if (lista || ++vueltas * cada >= tope) fn(); else esperar(cada, mirar);
    };
    esperar(cada, mirar);
  };
  const vozOcupada = () => { try { return narrador.encendido() && narrador.ocupado(); } catch { return false; } };
  const decir = (texto) => { try { if (narrador.encendido()) { narrador.cargar([{ t: 0, momento: 'tarjeta', texto }], 0); narrador.avanzar(0); } } catch { /* sin voz, sigue igual */ } };
  const callar = () => { try { narrador.callar(); } catch { /* nada que callar */ } };

  const soltarJugada = () => {
    clearInterval(relojVoz); relojVoz = 0;
    if (vista) { try { vista.cerrar(); } catch { /* ya estaba cerrada */ } vista = null; }
    pizarra = null;
    lineaActual = null;
    vaciar(caja);
    caja.className = 'clave-jugada';
    for (const k of Object.keys(caja.dataset)) delete caja.dataset[k]; // sin restos de la vista anterior
    sello.hidden = true;
  };

  const ponerTarjeta = (nodos, clase = '') => {
    vaciar(tarjeta).append(...nodos);
    tarjeta.className = `clave-tarjeta${clase ? ` ${clase}` : ''}`;
    tarjeta.hidden = false;
  };

  // Mini gráfica de la tarjeta: la probabilidad de ganar de todo el partido con el punto de esta jugada.
  // Es un adorno: si ESPN no trae el dato o algo falla, la tarjeta va sin ella.
  let serieProb; // undefined = todavía sin calcular
  const miniGrafica = (i) => {
    try {
      if (serieProb === undefined) serieProb = serieDeProbabilidad(partido);
      const m = miniDeClave(serieProb, claves[i].id);
      if (!m) return null;
      const c = coloresDeGrafica(serieProb.local, serieProb.visitante, '#0b1326', '#ffffff');
      const svg = nodo('svg', { class: 'clave-mini', viewBox: `0 0 ${m.ancho} ${m.alto}`, width: m.ancho, height: m.alto, role: 'img', 'aria-label': m.descripcion });
      const defs = nodo('defs', {});
      const recorte = (id, y, h) => { const cp = nodo('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }); cp.append(nodo('rect', { x: 0, y, width: m.ancho, height: h })); defs.append(cp); };
      recorte('clave-mini-arriba', 0, m.medio);
      recorte('clave-mini-abajo', m.medio, m.alto - m.medio);
      svg.append(defs,
        nodo('path', { class: 'clave-mini-area', d: m.area, fill: c.visitante, 'clip-path': 'url(#clave-mini-arriba)' }),
        nodo('path', { class: 'clave-mini-area', d: m.area, fill: c.local, 'clip-path': 'url(#clave-mini-abajo)' }),
        nodo('line', { class: 'clave-mini-mitad', x1: m.izq, y1: m.medio, x2: m.der, y2: m.medio }),
        nodo('path', { class: 'clave-mini-linea', d: m.linea }),
        nodo('circle', { class: 'clave-mini-punto', cx: m.punto.x, cy: m.punto.y, r: 5 }));
      return crear('div', { class: 'clave-mini-caja' },
        crear('span', { class: 'clave-mini-equipo', 'aria-hidden': 'true' }, serieProb.visitante.abrev),
        svg,
        crear('span', { class: 'clave-mini-equipo', 'aria-hidden': 'true' }, serieProb.local.abrev));
    } catch { return null; }
  };

  // --- Pasos ---
  const pasoTitulo = (i) => {
    soltarJugada();
    const t = tarjetaDeClave(claves[i], i, claves.length, partido);
    progreso.textContent = `Jugadas clave · ${i + 1} de ${claves.length}`;
    pie.textContent = '';
    ponerTarjeta([
      crear('p', { class: 'clave-tarjeta-titulo' }, t.titulo),
      crear('p', { class: 'clave-tarjeta-cuando' }, t.cuando),
      crear('p', { class: 'clave-tarjeta-marcador' }, t.marcador),
      crear('p', { class: 'clave-tarjeta-motivo' }, t.motivo),
      miniGrafica(i),
    ].filter(Boolean));
    marcar('titulo');
    decir(`${t.cuando.replace(' · ', ', ')}. ${t.motivo}`);
    // Se queda lo que tarde en leerse (o en decirse, con el narrador encendido).
    esperar(quieto ? 4200 : 3400, () => esperarA(() => !vozOcupada(), 9000, siguientePaso));
  };

  const textoDeJugada = (j) => separarFrases(j.explicacion.explicacion).slice(0, 2).join(' ');

  const jugadaEn2D = (i, conNota) => {
    const j = claves[i];
    usar3D = false;
    vaciar(caja);
    caja.className = 'clave-jugada clave-jugada-2d';
    const trazo = trazoDeJugada(j, partido.ctx);
    if (conNota) caja.append(crear('p', { class: 'vista3d-aviso' }, 'La vista 3D no está disponible en este dispositivo: te mostramos la pizarra.'));
    if (trazo) {
      pizarra = dibujarPizarra(trazo, partido);
      caja.append(pizarra);
      pizarra.animar();
    }
    // El narrador sigue un reloj propio, al ritmo de la jugada.
    let relato = [];
    try { relato = lineaActual ? relatoDeJugada(j, lineaActual, partido) : []; } catch { relato = []; }
    const duracion = lineaActual?.duracion || 3;
    tVoz = 0;
    try { narrador.cargar(relato, 0); } catch { /* sin voz */ }
    clearInterval(relojVoz);
    relojVoz = setInterval(() => { if (pausado) return; tVoz += 0.1; try { narrador.avanzar(tVoz); } catch { /* sin voz */ } }, 100);
    const dibujoListo = () => !pizarra || pizarra.querySelector('svg')?.dataset.estado === 'fin';
    const vozLista = () => !narrador.encendido() || (tVoz >= duracion && !narrador.ocupado());
    esperarA(() => dibujoListo() && vozLista(), (duracion + 8) * 1000, () => esperar(quieto ? 3000 : 1300, siguientePaso));
  };

  const pasoJugada = async (i) => {
    const j = claves[i];
    const mio = turno;
    tarjeta.hidden = true;
    pie.textContent = textoDeJugada(j);
    marcar('jugada');
    try { lineaActual = lineaDeTiempo(j, ctx3D); } catch { lineaActual = null; }
    if (!usar3D || !lineaActual) { jugadaEn2D(i, false); return; }
    try {
      const control = await mostrarJugada3D(caja, lineaActual, {
        compacto: true,
        tv: graficaDeTV(j, partido),
        narrador,
        relato: relatoDeJugada(j, lineaActual, partido),
        alTerminar: (modo) => {
          if (cerrada || pasos[indice]?.i !== i) return;
          const tipo = pasos[indice]?.tipo;
          // Termina la jugada (cámara de TV) o su repetición: un respiro, que el narrador acabe la frase, y sigue.
          if ((tipo === 'jugada' && modo === 'transmision') || (tipo === 'repeticion' && modo !== 'transmision')) {
            esperar(tipo === 'jugada' ? 900 : 600, () => esperarA(() => !vozOcupada(), 6000, siguientePaso));
          }
        },
        alFallar: () => { if (!cerrada && pasos[indice]?.i === i) { vista = null; jugadaEn2D(i, true); } },
      });
      if (cerrada || mio !== turno) { try { control.cerrar(); } catch { /* ya cerrada */ } return; }
      vista = control;
      if (pausado) vista.pausa(true);
    } catch {
      if (cerrada || mio !== turno) return;
      jugadaEn2D(i, true); // no se pudo cargar el 3D: la misma secuencia con la pizarra
    }
  };

  const pasoRepeticion = (i) => {
    marcar('repeticion');
    sello.hidden = false;
    if (vista && lineaActual) {
      sello.hidden = true; // la vista 3D pone su propio sello de cámara lenta
      vista.reproducir('repeticion', true, { desde: inicioDeRepeticion(lineaActual), mudo: true });
      return; // sigue cuando la vista avisa que terminó
    }
    if (pizarra) {
      pizarra.animar();
      esperarA(() => pizarra?.querySelector('svg')?.dataset.estado === 'fin', 4000, () => esperar(900, siguientePaso));
    } else esperar(300, siguientePaso);
  };

  const pasoCortina = () => {
    marcar('cortina');
    cortina.hidden = false;
    cortina.classList.remove('tv-cortina-pasa');
    void cortina.offsetWidth; // reinicia la animación
    cortina.classList.add('tv-cortina-pasa');
    setTimeout(() => { cortina.hidden = true; }, 1000);
    esperar(340, siguientePaso); // con la pantalla tapada entra la tarjeta de la jugada siguiente
  };

  const pasoFinal = () => {
    soltarJugada();
    callar();
    const f = tarjetaFinal(partido);
    progreso.textContent = 'Jugadas clave';
    pie.textContent = '';
    const otraVez = crear('button', { type: 'button', class: 'boton boton-principal' }, '↺ Ver de nuevo');
    otraVez.addEventListener('click', () => irA(0));
    ponerTarjeta([
      crear('p', { class: 'clave-tarjeta-titulo' }, f.titulo),
      crear('p', { class: 'clave-tarjeta-marcador clave-tarjeta-final' }, f.marcador),
      f.texto ? crear('p', { class: 'clave-tarjeta-motivo' }, f.texto) : null,
      crear('p', { class: 'clave-tarjeta-firma' }, 'Explicado por Primer Down'),
      otraVez,
    ].filter(Boolean), 'clave-tarjeta-fin');
    marcar('final');
    bPausa.disabled = true;
    bSiguiente.disabled = true;
    decir(`${f.titulo}: ${f.marcador.replace(' · ', ', ')}. ${f.texto}`);
  };

  const irA = (n) => {
    if (cerrada) return;
    turno++;
    clearTimeout(espera?.id); espera = null;
    indice = Math.max(0, Math.min(pasos.length - 1, n));
    const paso = pasos[indice];
    bPausa.disabled = false;
    bSiguiente.disabled = false;
    if (paso.tipo === 'titulo') { callar(); pasoTitulo(paso.i); }
    else if (paso.tipo === 'jugada') pasoJugada(paso.i);
    else if (paso.tipo === 'repeticion') pasoRepeticion(paso.i);
    else if (paso.tipo === 'cortina') pasoCortina();
    else pasoFinal();
  };
  const siguientePaso = () => irA(indice + 1);

  // --- Controles ---
  const ponerPausa = (si) => {
    if (cerrada || si === pausado || pasos[indice]?.tipo === 'final') return;
    pausado = si;
    bPausa.textContent = si ? '▶ Seguir' : '⏸ Pausa';
    bPausa.setAttribute('aria-pressed', si ? 'true' : 'false');
    capa.dataset.pausa = si ? '1' : '0';
    if (si) {
      if (espera) { clearTimeout(espera.id); espera.restante = Math.max(0, espera.hasta - Date.now()); }
      try { vista?.pausa(true); } catch { /* sin vista */ }
      try { narrador.pausar(); } catch { /* sin voz */ }
    } else {
      try { narrador.continuar(); } catch { /* sin voz */ }
      try { vista?.pausa(false); } catch { /* sin vista */ }
      if (espera) { espera.hasta = Date.now() + espera.restante; espera.id = setTimeout(espera.fn, espera.restante); }
    }
  };
  bPausa.addEventListener('click', () => ponerPausa(!pausado));
  // "Siguiente" salta a la tarjeta de la jugada que sigue (o al marcador final).
  bSiguiente.addEventListener('click', () => {
    const actual = pasos[indice]?.i ?? 0;
    const destino = pasos.findIndex((p, k) => k > indice && (p.tipo === 'final' || (p.tipo === 'titulo' && p.i > actual)));
    if (pausado) ponerPausa(false);
    irA(destino < 0 ? pasos.length - 1 : destino);
  });
  const pintarNarrador = () => {
    let hay = false; let si = false;
    try { hay = narrador.disponible(); si = narrador.encendido(); } catch { hay = false; }
    bNarrador.hidden = !hay;
    bNarrador.setAttribute('aria-pressed', si ? 'true' : 'false');
    capa.dataset.narrador = !hay ? 'sin-voz' : si ? 'encendido' : 'apagado';
  };
  let dejarDeOir = null;
  try { dejarDeOir = narrador.alCambiar(pintarNarrador); } catch { dejarDeOir = null; }
  bNarrador.addEventListener('click', () => { try { narrador.encender(!narrador.encendido()); } catch { /* sin voz */ } });
  pintarNarrador();

  const alTeclear = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); salir(); } };
  const antes = document.activeElement;
  function salir() {
    if (cerrada) return;
    cerrada = true;
    turno++;
    clearTimeout(espera?.id); espera = null;
    soltarJugada();
    callar();
    try { cerrarVista3D(); } catch { /* nada abierto */ }
    dejarDeOir?.();
    document.removeEventListener('keydown', alTeclear);
    capa.remove();
    document.body.classList.remove('con-jugadas-clave');
    if (abierta === control) abierta = null;
    try { antes?.focus?.(); } catch { /* el foco se queda donde esté */ }
    try { opciones.alSalir?.(); } catch { /* quien escucha no puede romper la salida */ }
  }
  bSalir.addEventListener('click', salir);
  document.addEventListener('keydown', alTeclear);

  document.body.append(capa);
  document.body.classList.add('con-jugadas-clave');
  try { capa.focus({ preventScroll: true }); } catch { /* sin foco, igual funciona */ }

  const control = { salir, pausa: ponerPausa, total: claves.length, capa };
  abierta = control;
  const desde = Math.max(0, Math.min(claves.length - 1, Math.floor(Number(opciones.desde) || 0)));
  irA(pasos.findIndex((p) => p.tipo === 'titulo' && p.i === desde));
  return control;
}
