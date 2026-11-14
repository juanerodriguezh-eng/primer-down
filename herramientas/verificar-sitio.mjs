// Verifica el sitio de punta a punta: levanta el servidor local, pide cada archivo y abre las páginas
// en Chrome o Edge sin ventana (360 px de ancho) para revisar el contenido y los errores de consola.
// Uso: node herramientas/verificar-sitio.mjs [--capturas]
//   --capturas guarda una imagen de cada página en herramientas/capturas/ (no hace falta publicarlas).
// Nota: ESPN responde 403 a los navegadores sin ventana (se identifican como "HeadlessChrome").
// Este script respeta ese bloqueo: lo que depende de ESPN sale como "aviso: no comprobado" y hay que
// mirarlo en un navegador normal. Todo lo demás (repetición, glosario, mensajes de error) sí se comprueba.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8137;
const BASE = `http://localhost:${PUERTO}`;
const CAPTURAS = process.argv.includes('--capturas');
const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const ARCHIVOS = [
  '/', '/index.html', '/partido.html', '/glosario.html', '/pizarra.html', '/js/pizarra-pagina.js', '/js/clasicas.js', '/css/estilos.css',
  '/js/portada.js', '/js/partido.js', '/js/glosario-pagina.js', '/js/modelo.js', '/js/motor.js', '/js/api.js', '/js/ui.js',
  '/js/cancha.js', '/js/vivo.js', '/js/simulador.js', '/js/pizarra.js', '/js/jugada3d.js', '/js/clasica3d.js', '/js/vista3d.js', '/js/vendor/three.module.min.js', '/js/repeticion.js', '/js/glosario.js', '/js/penales.js', '/js/equipos.js',
  '/datos/partidos/indice.json', '/datos/partidos/401873052.json',
];

const contar = (texto, re) => (texto.match(re) || []).length;
const idsDeJugadas = (dom) => [...dom.matchAll(/<article class="jugada [^"]*" data-id="([^"]+)"/g)].map((m) => m[1]);

// Cada página: qué debe aparecer en el DOM ya pintado. `red: true` = depende de que ESPN responda.
const PAGINAS = [
  { nombre: 'portada', ruta: '/index.html', red: true, revisar: (dom) => [
    ['16 partidos guardados', contar(dom.split('id="guardados"')[1] || '', /class="tarjeta /g) === 16],
    ['partidos de la semana desde ESPN', contar((dom.split('id="semana"')[1] || '').split('id="repeticion"')[0], /class="tarjeta /g) >= 1, true],
    ['botón fijo del glosario', dom.includes('class="boton-glosario"')],
  ] },
  { nombre: 'repeticion-jugada-60', ruta: '/partido.html?id=401873052&modo=repeticion&jugada=60', revisar: (dom) => [
    ['60 jugadas pintadas', contar(dom, /<article class="jugada /g) === 60],
    ['situación actual explicada', dom.includes('Situación actual') && dom.includes('Segunda oportunidad: a los Giants les faltan 8 yardas')],
    ['mini cancha con texto alternativo', /<svg[^>]*class="cancha"[^>]*aria-label="Balón en/.test(dom)],
    ['marcador 3 a 0', />Commanders<[\s\S]*?class="puntos">3<[\s\S]*?>Giants<[\s\S]*?class="puntos">0</.test(dom)],
    ['controles de repetición', dom.includes('Jugada 60 de 188')],
    ['drives con resumen', dom.includes('Avance de los Commanders: 11 jugadas, 49 yardas, terminó en gol de campo.')],
    ['etiquetas de glosario', contar(dom, /class="etiqueta"/g) > 30],
    ['texto original plegado', contar(dom, /Texto original en inglés/g) === 60],
  ] },
  { nombre: 'pizarra-en-jugada', ruta: '/partido.html?id=401873052&modo=repeticion&jugada=60&pizarra=abierta', revisar: (dom) => [
    ['botón "Ver en la pizarra" en las jugadas de balón', contar(dom, /class="boton-pizarra"/g) >= 40],
    ['la pizarra de la jugada más reciente se abrió', dom.includes('Ocultar la jugada') && /<div class="pizarra" data-forma="carrera">/.test(dom)],
    ['la animación terminó (balón en su destino)', /class="cancha pizarra-cancha"[^>]*data-estado="fin"/.test(dom)],
    ['descripción del movimiento', dom.includes('El balón va por tierra de la yarda 39 de los Commanders a la yarda 37 de los Commanders: 2 yardas hacia la derecha.')],
  ] },
  // Vista 3D: con WebGL por software dibuja la jugada; sin WebGL (--disable-3d-apis) cae en la pizarra 2D.
  { nombre: 'vista-3d', ruta: '/partido.html?id=401873052&modo=repeticion&jugada=60&pizarra=3d&t3d=2.5', gl: true, revisar: (dom) => [
    ['la vista 3D dibujó la jugada con 22 jugadores', /<div class="vista3d" data-estado="congelada"[^>]*data-jugadores="22"/.test(dom) || /<div class="vista3d"[^>]*data-jugadores="22"[^>]*data-estado="congelada"/.test(dom)],
    ['el lienzo tiene texto alternativo con el aviso de recreación', /<canvas class="vista3d-lienzo"[^>]*aria-label="[^"]*Recreación ilustrada[^"]*"/.test(dom)],
    ['rótulo del protagonista sacado del texto', /class="vista3d-rotulo[^"]*"[^>]*>[^<]*Skattebo</.test(dom)],
    ['aviso visible de recreación ilustrada', /<p class="vista3d-aviso">Recreación ilustrada: ESPN no entrega la posición de cada jugador/.test(dom)],
    ['botones "Ver de nuevo", "Repetición" y "Ver la pizarra 2D"', dom.includes('>Ver de nuevo<') && dom.includes('>Repetición<') && dom.includes('>Ver la pizarra 2D<')],
  ] },
  { nombre: 'vista-3d-sin-webgl', ruta: '/partido.html?id=401873052&modo=repeticion&jugada=60&pizarra=3d', sinGl: true, revisar: (dom) => [
    ['sin WebGL aparece la pizarra 2D con una nota', dom.includes('La vista 3D no está disponible en este dispositivo') && /<div class="pizarra" data-forma="carrera">/.test(dom)],
    ['la pizarra 2D terminó su animación', /class="cancha pizarra-cancha"[^>]*data-estado="fin"/.test(dom)],
    ['no queda ninguna vista 3D a medias', !/class="vista3d"/.test(dom)],
  ] },
  { nombre: 'repeticion-final', ruta: '/partido.html?id=401873052&modo=repeticion&jugada=188', revisar: (dom) => [
    ['188 jugadas pintadas', contar(dom, /<article class="jugada /g) === 188],
    ['partido terminado', dom.includes('Partido terminado') && dom.includes('Ganaron los Commanders, 24 a 21')],
    ['resumen final con frases completas', dom.includes('Así se ganó el partido') && dom.includes('Copiar resumen') && dom.includes('<li>4.º cuarto, 8:13: I. Likely atrapa el pase profundo')],
    ['jugadas clave marcadas', contar(dom, /class="sello-clave"/g) >= 3],
  ] },
  { nombre: 'repeticion-inicio', ruta: '/partido.html?id=401873052&modo=repeticion', revisar: (dom) => [
    ['invita a reproducir', dom.includes('Toca “Reproducir”') && dom.includes('Antes de empezar · 188 jugadas')],
  ] },
  { nombre: 'partido-desde-espn', ruta: '/partido.html?id=401873052', red: true, revisar: (dom) => [
    ['partido final leído de ESPN', dom.includes('Partido terminado') && contar(dom, /<article class="jugada /g) >= 150, true],
    ['ofrece la repetición', dom.includes('Verlo en modo repetición'), true],
  ] },
  { nombre: 'partido-completo-guardado', ruta: '/partido.html?id=401873052&fuente=guardado', revisar: (dom) => [
    ['camino del modo en vivo con un partido guardado', dom.includes('Partido terminado') && contar(dom, /<article class="jugada /g) === 188],
    ['ofrece la repetición', dom.includes('Verlo en modo repetición')],
    ['resumen final', dom.includes('Así se ganó el partido')],
  ] },
  { nombre: 'glosario', ruta: '/glosario.html', revisar: (dom) => [
    ['40 términos o más', contar(dom, /class="termino termino-abierto"/g) >= 40],
  ] },
  { nombre: 'pizarra-clasicas', ruta: '/pizarra.html', revisar: (dom) => [
    ['5 jugadas clásicas', contar(dom, /<section class="clasica"/g) === 5],
    ['cada una con 11 O y 11 X', contar(dom, /class="ficha ficha-o"/g) === 55 && contar(dom, /class="ficha ficha-x"/g) === 55],
    ['empiezan en el paso 1 con su explicación', contar(dom, /class="clasica-cancha"[^>]*data-paso="1"/g) === 5 && dom.includes('Paso 1 de 4') && dom.includes('Antes de la jugada')],
    ['cancha con texto alternativo', contar(dom, /class="clasica-cancha"[^>]*aria-label="[^"]{60,}"/g) === 5],
    ['enlace al glosario en cada jugada', contar(dom, /Ver "[^"]+" en el glosario/g) === 5],
  ] },
  { nombre: 'pizarra-clasicas-final', ruta: '/pizarra.html?paso=final', revisar: (dom) => [
    ['todas llegan a su último paso', contar(dom, /Ver de nuevo/g) === 5 && dom.includes('Paso 4 de 4') && dom.includes('Paso 5 de 5')],
    ['rutas dibujadas', contar(dom, /class="ruta ruta-[ox]/g) > 100],
    ['texto del último paso del Hail Mary', dom.includes('Casi nunca sale… pero a veces sí')],
  ] },
  { nombre: 'pizarra-clasica-3d', ruta: '/pizarra.html?vista=3d&paso=final#hail-mary', gl: true, revisar: (dom) => [
    ['el Ave María se ve con 22 jugadores en 3D', /<section class="clasica" id="hail-mary"[^>]*data-vista="3d"/.test(dom) && /<div class="vista3d"[^>]*data-jugadores="22"/.test(dom)],
    ['llegó al final y muestra el touchdown', /<div class="vista3d"[^>]*data-estado="fin"/.test(dom) && /class="vista3d-cartel vista3d-cartel-anotacion">¡TOUCHDOWN!</.test(dom)],
    ['botón para volver a X y O y botones de cámara', dom.includes('>Volver a la vista de X y O<') && dom.includes('>Cámara de TV<') && dom.includes('>Desde el fondo<') && dom.includes('>A ras de cancha<')],
    ['aviso de que es una jugada de ejemplo', dom.includes('Jugada de pizarra con posiciones de ejemplo: no es de un partido real.')],
    ['las otras cuatro siguen en X y O con su botón 3D', contar(dom, /data-vista="xo"/g) === 4 && contar(dom, />Ver con jugadores en 3D</g) === 4],
  ] },
  { nombre: 'pizarra-clasica-sin-webgl', ruta: '/pizarra.html?vista=3d#hail-mary', sinGl: true, revisar: (dom) => [
    ['sin WebGL las cinco quedan en X y O', contar(dom, /data-vista="xo"/g) === 5 && !/class="vista3d"/.test(dom)],
    ['y no se ofrece el botón 3D', !dom.includes('Ver con jugadores en 3D') && contar(dom, /class="ficha ficha-o"/g) === 55],
  ] },
  // Modo en vivo con un partido simulado (el guardado cortado a la mitad, que avanza en cada consulta).
  ...['con-current', 'current-repetido', 'sin-current'].map((forma) => ({ nombre: `en-vivo-${forma}`, ruta: `/partido.html?id=401873052&fuente=simulado&desde=60&paso=0&forma=${forma}`, revisar: (dom) => [
    ['sello "En vivo" con cuarto y reloj', /class="sello sello-vivo">En vivo · 2\.º cuarto · \d+:\d\d</.test(dom)],
    ['60 jugadas, ninguna repetida aunque se consultó varias veces', idsDeJugadas(dom).length === 60 && new Set(idsDeJugadas(dom)).size === 60],
    ['situación actual', dom.includes('Situación actual') && dom.includes('Segunda oportunidad: a los Giants les faltan 8 yardas')],
    ['marcador parcial 3 a 0', />Commanders<[\s\S]*?class="puntos">3<[\s\S]*?>Giants<[\s\S]*?class="puntos">0</.test(dom)],
    ['sin resumen final todavía', !dom.includes('Así se ganó el partido')],
  ] })),
  { nombre: 'en-vivo-avanza', ruta: '/partido.html?id=401873052&fuente=simulado&desde=60&paso=3&cada=1.5', revisar: (dom) => [
    ['llegaron jugadas nuevas en cada consulta', idsDeJugadas(dom).length > 66 && idsDeJugadas(dom).length < 188],
    ['ninguna jugada duplicada al refrescar', new Set(idsDeJugadas(dom)).size === idsDeJugadas(dom).length],
    ['sigue en vivo', dom.includes('class="sello sello-vivo"')],
  ] },
  { nombre: 'en-vivo-a-final', ruta: '/partido.html?id=401873052&fuente=simulado&desde=180&paso=4&cada=1', revisar: (dom) => [
    ['pasó de en vivo a final', dom.includes('class="sello sello-final">Final<') && dom.includes('Ganaron los Commanders, 24 a 21')],
    ['188 jugadas sin duplicados', idsDeJugadas(dom).length === 188 && new Set(idsDeJugadas(dom)).size === 188],
    ['aparece el resumen final', dom.includes('Así se ganó el partido') && dom.includes('Copiar resumen')],
    ['ofrece la repetición', dom.includes('Verlo en modo repetición')],
  ] },
  // La jugada 71 es un touchdown: la segunda consulta la trae y el marcador debe celebrarlo.
  { nombre: 'marcador-cambia', ruta: '/partido.html?id=401873052&fuente=simulado&desde=70&paso=1&cada=8', revisar: (dom) => [
    ['llegó la jugada del touchdown', idsDeJugadas(dom).length === 71],
    ['el marcador marca el cambio', /id="marcador"[^>]*data-cambio="1"/.test(dom) && dom.includes('class="puntos puntos-cambio"')],
    ['muestra cuántos puntos sumó', /class="puntos-suma"[^>]*>\+7</.test(dom)],
  ] },
  // Modo claro: se puede pedir por la dirección (?tema=claro) y pinta lo mismo.
  { nombre: 'modo-claro-partido', ruta: '/partido.html?id=401873052&modo=repeticion&jugada=72&pizarra=abierta&tema=claro', revisar: (dom) => [
    ['la página está en modo claro', /<html[^>]*data-tema="claro"/.test(dom)],
    ['el botón ofrece volver al oscuro', /data-tema-boton[^>]*aria-label="Cambiar a modo oscuro"/.test(dom) || /aria-label="Cambiar a modo oscuro"[^>]*data-tema-boton/.test(dom)],
    ['72 jugadas y la pizarra abierta', contar(dom, /<article class="jugada /g) === 72 && /class="cancha pizarra-cancha"[^>]*data-estado="fin"/.test(dom)],
  ] },
  { nombre: 'modo-claro-pizarra', ruta: '/pizarra.html?tema=claro', revisar: (dom) => [
    ['la página está en modo claro', /<html[^>]*data-tema="claro"/.test(dom)],
    ['5 jugadas clásicas', contar(dom, /<section class="clasica"/g) === 5],
  ] },
  { nombre: 'partido-sin-id', ruta: '/partido.html', revisar: (dom) => [
    ['mensaje claro', dom.includes('Falta indicar qué partido quieres ver')],
  ] },
  { nombre: 'repeticion-id-desconocido', ruta: '/partido.html?id=999&modo=repeticion', revisar: (dom) => [
    ['mensaje claro', dom.includes('No encontramos este partido entre los guardados')],
  ] },
];

// Accesibilidad básica, en todas las páginas: idioma, textos alternativos y nombre en cada control.
function accesibilidad(dom) {
  const sinTexto = (html) => html.replace(/<[^>]*>/g, '').trim() === '';
  const graficos = [...dom.matchAll(/<(svg|canvas)\b[^>]*>/g)].map((m) => m[0]);
  const botones = [...dom.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  const campos = [...dom.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
  return [
    ['la página declara el idioma español', /<html[^>]*lang="es"/.test(dom)],
    [`canchas y lienzos con texto alternativo (${graficos.length})`, graficos.every((g) => /aria-hidden="true"/.test(g) || (/role="img"/.test(g) && /aria-label="[^"]{20,}"/.test(g)))],
    [`todos los botones tienen nombre (${botones.length})`, botones.every((b) => !sinTexto(b[2]) || /aria-label="[^"]+"/.test(b[1]))],
    [`todos los campos tienen nombre (${campos.length})`, campos.every((x) => /aria-label="[^"]+"/.test(x))],
    ['las imágenes tienen texto alternativo', [...dom.matchAll(/<img\b[^>]*>/g)].every((m) => /alt="/.test(m[0]))],
  ];
}

let fallas = 0; let avisos = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const mal = (t) => { fallas++; console.log(`  FALLA ${t}`); };
const ojo = (t) => { avisos++; console.log(`  aviso ${t}`); };

const servidor = spawn(process.execPath, [path.join(RAIZ, 'herramientas', 'servidor.mjs'), String(PUERTO)], { stdio: 'ignore' });
const perfil = mkdtempSync(path.join(tmpdir(), 'primer-down-'));
try {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE, { signal: AbortSignal.timeout(500) }); break; } catch { await new Promise((r) => setTimeout(r, 150)); }
  }

  console.log('Archivos del sitio');
  for (const ruta of ARCHIVOS) {
    const r = await fetch(BASE + ruta).catch(() => null);
    if (r?.status === 200) ok(ruta); else mal(`${ruta} -> ${r?.status ?? 'sin respuesta'}`);
  }

  const navegador = NAVEGADORES.find((n) => existsSync(n));
  if (!navegador) {
    ojo('no se encontró Chrome ni Edge: no se revisaron las páginas en un navegador');
  } else {
    if (CAPTURAS) mkdirSync(path.join(RAIZ, 'herramientas', 'capturas'), { recursive: true });
    const base = ['--headless=new', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${perfil}`, '--virtual-time-budget=12000', '--enable-logging=stderr', '--v=0'];
    for (const pagina of PAGINAS) {
      const comunes = [...base, ...(pagina.gl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--disable-gpu']), ...(pagina.sinGl ? ['--disable-3d-apis'] : [])];
      console.log(`Página: ${pagina.nombre}  (${pagina.ruta})`);
      const r = spawnSync(navegador, [...comunes, '--window-size=360,800', '--dump-dom', BASE + pagina.ruta], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 90000 });
      const dom = r.stdout || '';
      const consola = (r.stderr || '').split('\n').filter((l) => /CONSOLE/.test(l));
      const errores = consola.filter((l) => /Uncaught|Error|Failed|blocked/i.test(l));
      const deRed = errores.filter((l) => /espn\.com|net::ERR|CORS/i.test(l));
      const propios = errores.filter((l) => !deRed.includes(l));
      if (propios.length) propios.slice(0, 5).forEach((l) => mal(`error de consola: ${l.slice(l.indexOf('CONSOLE')).slice(0, 300)}`));
      else ok('sin errores de consola propios');
      if (deRed.length) ojo(`la red hacia ESPN falló (${deRed.length} mensaje/s); lo que depende de ESPN no se pudo comprobar`);
      for (const [nombre, pasa, dependeDeRed] of [...pagina.revisar(dom), ...accesibilidad(dom)]) {
        if (pasa) ok(nombre);
        else if (dependeDeRed && (deRed.length || !/data-(listo|semana)="1"/.test(dom))) ojo(`${nombre}: no comprobado (sin respuesta de ESPN)`);
        else mal(nombre);
      }
      // Ancho real de celular: la ventana de Chrome en Windows no baja de unos 500 px, así que se mide dentro de un marco de 360 px.
      const marco = `${BASE}/herramientas/marco.html?ruta=${encodeURIComponent(pagina.ruta)}`;
      const m = spawnSync(navegador, [...comunes, '--window-size=520,1700', '--dump-dom', marco], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 90000 });
      const medida = /ancho-contenido=(\d+) ancho-ventana=(\d+) se-salen=(\d+)([^<]*)/.exec(m.stdout || '');
      if (!medida) ojo('no se pudo medir el ancho a 360 px');
      else if (Number(medida[1]) > Number(medida[2]) || Number(medida[3]) > 0) mal(`a 360 px el contenido se desborda: ${medida[0]}`);
      else ok(`a 360 px no se desborda (contenido ${medida[1]} px, ventana ${medida[2]} px)`);
      if (CAPTURAS) {
        const destino = path.join(RAIZ, 'herramientas', 'capturas', `${pagina.nombre}.png`);
        spawnSync(navegador, [...comunes, '--window-size=520,1640', `--screenshot=${destino}`, marco], { encoding: 'utf8', timeout: 90000 });
        if (existsSync(destino)) ok(`captura: herramientas/capturas/${pagina.nombre}.png`); else ojo('no se pudo guardar la captura');
      }
    }
  }
} finally {
  servidor.kill();
  try { rmSync(perfil, { recursive: true, force: true, maxRetries: 3 }); } catch { /* el perfil temporal se borra solo después */ }
}

console.log(`\nResultado: ${fallas} falla(s), ${avisos} aviso(s).`);
process.exitCode = fallas ? 1 : 0;
