// Saca una captura de una página del sitio en Chrome o Edge sin ventana, con WebGL por software (para la vista 3D).
// Uso: node herramientas/capturar.mjs "/partido.html?id=401873052&modo=repeticion&jugada=60&pizarra=3d&t3d=2.5" nombre [ancho] [alto] [milisegundos de espera]
//   Sin ancho, la página se muestra en un marco de 360 px (como un celular). La imagen queda en herramientas/capturas/nombre.png.
//   Imprime también el estado de la vista 3D y los errores de consola.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8139;
const BASE = `http://localhost:${PUERTO}`;
const [ruta = '/index.html', nombre = 'captura', ancho = '', alto = '', tiempo = ''] = process.argv.slice(2);
const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const navegador = NAVEGADORES.find((n) => existsSync(n));
if (!navegador) { console.log('No se encontró Chrome ni Edge.'); process.exit(1); }

const servidor = spawn(process.execPath, [path.join(RAIZ, 'herramientas', 'servidor.mjs'), String(PUERTO)], { stdio: 'ignore' });
const perfil = mkdtempSync(path.join(tmpdir(), 'primer-down-'));
try {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE, { signal: AbortSignal.timeout(500) }); break; } catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  mkdirSync(path.join(RAIZ, 'herramientas', 'capturas'), { recursive: true });
  const destino = path.join(RAIZ, 'herramientas', 'capturas', `${nombre}.png`);
  const url = ancho ? BASE + ruta : `${BASE}/herramientas/marco.html?ruta=${encodeURIComponent(ruta)}`;
  const comunes = ['--headless=new', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${perfil}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', `--virtual-time-budget=${Number(tiempo) || 15000}`, '--enable-logging=stderr', '--v=0'];
  const tamano = `--window-size=${ancho || 520},${alto || 1640}`;
  const dom = spawnSync(navegador, [...comunes, tamano, '--dump-dom', BASE + ruta], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  const vista = /<div class="vista3d"[^>]*>/.exec(dom.stdout || '');
  console.log(vista ? `vista 3D: ${vista[0]}` : 'vista 3D: no está en la página');
  if (/La vista 3D no está disponible/.test(dom.stdout || '')) console.log('ojo: la página cayó en el respaldo 2D');
  const consola = (dom.stderr || '').split('\n').filter((l) => /CONSOLE/.test(l) && !/espn\.com/.test(l));
  for (const l of consola.slice(0, 8)) console.log(`consola: ${l.slice(l.indexOf('CONSOLE')).slice(0, 400)}`);
  spawnSync(navegador, [...comunes, tamano, `--screenshot=${destino}`, url], { encoding: 'utf8', timeout: 120000 });
  console.log(existsSync(destino) ? `captura: herramientas/capturas/${nombre}.png` : 'no se pudo guardar la captura');
} finally {
  servidor.kill();
  try { rmSync(perfil, { recursive: true, force: true, maxRetries: 3 }); } catch { /* se borra solo después */ }
}
