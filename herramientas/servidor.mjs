// Servidor estático mínimo para abrir el sitio en la computadora. Sin dependencias.
// Uso: node herramientas/servidor.mjs [puerto]   (por defecto 8080)  ->  http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.argv[2] || process.env.PORT || 8080);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

const servidor = createServer(async (req, res) => {
  try {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let archivo = path.normalize(path.join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end('Prohibido'); return; }
    const info = await stat(archivo).catch(() => null);
    if (info?.isDirectory()) archivo = path.join(archivo, 'index.html');
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(cuerpo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
});

servidor.listen(PUERTO, () => console.log(`Primer Down en http://localhost:${PUERTO}  (Ctrl+C para detener)`));
