// Vista 3D de una jugada: cancha, estadio, 22 jugadores articulados, balón y cámara de transmisión.
// Solo dibuja: todo lo que pasa en la jugada viene de js/jugada3d.js (lineaDeTiempo y muestrear).
// Three.js se carga de forma diferida la primera vez que se abre una vista 3D.
// Unidades: yardas. X = yardLine (0 a 100, zonas hasta -10 y 110), Z = ancho (0 a 53,33), Y = altura.
import { muestrear, ANCHO_CANCHA } from './jugada3d.js';
import { crearMedidorDeCalidad, NIVELES, nivelPorNombre } from './calidad.js';

const MEDIO = ANCHO_CANCHA / 2;
const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
const mezclar = (a, b, u) => a + (b - a) * u;
const grados = (rad) => rad * 180 / Math.PI;
// Cámara principal (en yardas): 30 de alto (27 m) y 48 detrás de la banda cercana (unos 74 m hasta el centro de la cancha).
const ALTO_CAMARA = 30;
const FONDO_CAMARA = 48;
const LEJOS_CAMARA = Math.hypot(ALTO_CAMARA, FONDO_CAMARA + ANCHO_CANCHA / 2);
const suave = (u) => { const x = limitar(u, 0, 1); return x * x * (3 - 2 * x); };

let THREE = null;
let EXTRA = null; // addons de Three.js (entorno, bloom, grano); si no cargan, la vista funciona sin ellos
let cargaDeThree = null;
const cargarThree = () => {
  if (!cargaDeThree) {
    cargaDeThree = import('./vendor/three.module.min.js').then(async (m) => {
      THREE = m;
      try {
        const partes = await Promise.all([
          import('./vendor/RoomEnvironment.js'), import('./vendor/EffectComposer.js'), import('./vendor/RenderPass.js'), import('./vendor/ShaderPass.js'),
          import('./vendor/UnrealBloomPass.js'), import('./vendor/OutputPass.js'),
        ]);
        EXTRA = Object.assign({}, ...partes);
      } catch { EXTRA = null; }
      return m;
    });
  }
  return cargaDeThree;
};

// Grano fino de cámara y un leve oscurecimiento en las esquinas (último paso de la imagen, solo en calidad alta).
const SOMBREADOR_DE_GRANO = {
  uniforms: { tDiffuse: { value: null }, tiempo: { value: 0 }, fuerza: { value: 0.03 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float tiempo; uniform float fuerza; varying vec2 vUv;',
    'float azar(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main() {',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  float n = azar(vUv * vec2(913.0, 677.0) + fract(tiempo) * 7.0) - 0.5;',
    '  vec2 d = vUv - 0.5;',
    '  c.rgb = (c.rgb + n * fuerza) * (1.0 - dot(d, d) * 0.42);',
    '  gl_FragColor = c;',
    '}',
  ].join('\n'),
};

// "Reducir movimiento" del sistema: sin temblor de cámara, sin estela, sin cortina animada.
const sinMovimiento = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// ¿Se puede mostrar la vista 3D en este dispositivo? Si no, quien llama muestra la pizarra 2D.
export function puedeUsar3D() {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (typeof WebGLRenderingContext === 'undefined') return false;
    const lienzo = document.createElement('canvas');
    const gl = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Texturas dibujadas con código (sin imágenes)
// ---------------------------------------------------------------------------

function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  return c;
}

const luminancia = (hex) => {
  const n = parseInt(String(hex || '#000').replace('#', ''), 16) || 0;
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

// Cancha completa: pasto con franjas de corte, líneas, marcas, números y zonas de anotación con los colores de los equipos.
function texturaDeCancha(local, visitante, chica) {
  const W = chica ? 1536 : 2048;
  const H = chica ? 682 : 910;
  const c = lienzo(W, H);
  const g = c.getContext('2d');
  const px = W / 120; // píxeles por yarda a lo largo
  const pz = H / ANCHO_CANCHA; // píxeles por yarda a lo ancho
  const x = (yarda) => (yarda + 10) * px;
  // Pasto: franjas de 5 yardas en dos tonos.
  for (let y = -10; y < 110; y += 5) {
    g.fillStyle = ((y + 10) / 5) % 2 === 0 ? '#2f7d3a' : '#286f33';
    g.fillRect(x(y), 0, 5 * px + 1, H);
  }
  // Zonas de anotación con el color de cada equipo y su nombre.
  const zona = (desde, equipo, giro) => {
    g.fillStyle = equipo.color || '#24324f';
    g.fillRect(x(desde), 0, 10 * px, H);
    g.save();
    g.translate(x(desde + 5), H / 2);
    g.rotate(giro);
    g.fillStyle = luminancia(equipo.color) > 0.62 ? '#10151f' : '#ffffff';
    g.font = `800 ${Math.round(5.6 * px)}px system-ui, "Segoe UI", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const texto = String(equipo.nombre || equipo.abrev || '').toUpperCase();
    g.fillText(texto, 0, 0, H * 0.86);
    g.restore();
  };
  zona(-10, local, -Math.PI / 2);
  zona(100, visitante, Math.PI / 2);
  // Textura del pasto: motas claras y oscuras.
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  for (let i = 0; i < (chica ? 9000 : 16000); i++) {
    g.fillStyle = azar() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
    g.fillRect(azar() * W, azar() * H, 1 + azar() * 2, 1 + azar() * 3);
  }
  // Líneas: borde, cada 5 yardas, líneas de gol más gruesas.
  g.fillStyle = '#f4f6f4';
  const grosor = Math.max(2, 0.22 * px);
  g.fillRect(0, 0, W, 0.7 * pz); g.fillRect(0, H - 0.7 * pz, W, 0.7 * pz);
  g.fillRect(0, 0, 0.7 * px, H); g.fillRect(W - 0.7 * px, 0, 0.7 * px, H);
  for (let y = 0; y <= 100; y += 5) {
    const ancho = y === 0 || y === 100 ? grosor * 2.2 : grosor;
    g.fillRect(x(y) - ancho / 2, 0, ancho, H);
  }
  // Marcas de cada yarda: junto a las bandas y en las dos filas interiores.
  const filas = [1.2, 23.58, ANCHO_CANCHA - 23.58 - 0.7, ANCHO_CANCHA - 1.9];
  for (let y = 1; y < 100; y++) {
    if (y % 5 === 0) continue;
    for (const f of filas) g.fillRect(x(y) - grosor * 0.35, f * pz, grosor * 0.7, 0.7 * pz);
  }
  // Números cada 10 yardas: los de la banda cercana se leen desde la cámara; los de la lejana, desde el otro lado.
  g.font = `700 ${Math.round(3 * pz)}px system-ui, "Segoe UI", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let y = 10; y <= 90; y += 10) {
    const texto = String(y <= 50 ? y : 100 - y).split('').join(' ');
    g.save(); g.translate(x(y), (ANCHO_CANCHA - 10.5) * pz); g.fillText(texto, 0, 0); g.restore();
    g.save(); g.translate(x(y), 10.5 * pz); g.rotate(Math.PI); g.fillText(texto, 0, 0); g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Tribuna: filas de gente como puntos de colores.
function texturaDeTribuna() {
  const c = lienzo(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#10141f'; g.fillRect(0, 0, 512, 128);
  let semilla = 99;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const tonos = ['#c9ced9', '#8d97ab', '#59647c', '#d7b98c', '#a56b5a', '#3d4b6b', '#e8e2d2', '#7a2d2d', '#2d4d7a'];
  for (let fila = 0; fila < 21; fila++) {
    for (let i = 0; i < 128; i++) {
      if (azar() < 0.12) continue;
      g.fillStyle = tonos[Math.floor(azar() * tonos.length)];
      g.globalAlpha = 0.5 + azar() * 0.4;
      g.fillRect(i * 4 + azar() * 1.5, fila * 6 + 2, 2.4, 3.4);
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

const texturasDeNumero = new Map();
function texturaDeNumero(numero, color) {
  const clave = `${numero}|${color}`;
  if (texturasDeNumero.has(clave)) return texturasDeNumero.get(clave);
  const c = lienzo(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.font = `800 ${String(numero).length > 1 ? 44 : 50}px system-ui, "Segoe UI", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(numero), 32, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texturasDeNumero.set(clave, t);
  return t;
}

// Pliegues de tela: trazos suaves, oscuros y claros, en diagonal. `g` ya tiene el color de fondo.
function pintarPliegues(g, W, H, semillaInicial, fuerza) {
  let semilla = semillaInicial;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  g.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const x = azar() * W; const y = azar() * H; const largo = 14 + azar() * 30; const caida = (azar() - 0.5) * 16;
    g.strokeStyle = i % 3 === 0 ? `rgba(255,255,255,${0.1 * fuerza})` : `rgba(0,0,0,${(0.1 + azar() * 0.12) * fuerza})`;
    g.lineWidth = 2 + azar() * 4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + largo / 2, y + caida, x + largo, y + caida * 0.4 + (azar() - 0.5) * 6); g.stroke();
  }
}

// Relieve de los pliegues (compartido por todos los uniformes).
let texturaDePliegues = null;
function pliegues() {
  if (texturaDePliegues) return texturaDePliegues;
  const c = lienzo(64, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 64, 128);
  pintarPliegues(g, 64, 128, 17, 2.2);
  texturaDePliegues = new THREE.CanvasTexture(c);
  texturaDePliegues.wrapS = texturaDePliegues.wrapT = THREE.RepeatWrapping;
  return texturaDePliegues;
}

// Tela de uniforme: color liso con pliegues sombreados y, si se pide, una franja a los costados (pantalón).
// En las cápsulas, u = 0 y u = 0,5 caen en los costados del cuerpo.
const texturasDeTela = new Map();
function texturaDeTela(color, franja) {
  const clave = `${color}|${franja || ''}`;
  if (texturasDeTela.has(clave)) return texturasDeTela.get(clave);
  const c = lienzo(64, 128);
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 64, 128);
  // Sombreado suave: más oscuro abajo y bajo los brazos, como una prenda con volumen.
  const sombra = g.createLinearGradient(0, 0, 0, 128);
  sombra.addColorStop(0, 'rgba(255,255,255,0.06)'); sombra.addColorStop(1, 'rgba(0,0,0,0.16)');
  g.fillStyle = sombra; g.fillRect(0, 0, 64, 128);
  pintarPliegues(g, 64, 128, 17, 1);
  if (franja) { g.fillStyle = franja; g.fillRect(0, 0, 2.5, 128); g.fillRect(61.5, 0, 2.5, 128); g.fillRect(29.5, 0, 5, 128); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texturasDeTela.set(clave, t);
  return t;
}

function texturaDeBalon() {
  const c = lienzo(128, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#7a4420'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#f2efe6';
  g.fillRect(0, 9, 128, 4); g.fillRect(0, 51, 128, 4); // franjas blancas cerca de las puntas
  g.fillRect(58, 22, 3, 20); // costura
  for (let i = 0; i < 5; i++) g.fillRect(54, 23 + i * 4.3, 11, 1.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Panel de focos de estadio: filas de lámparas redondas sobre un bastidor oscuro.
function texturaDeFocos() {
  const c = lienzo(256, 96);
  const g = c.getContext('2d');
  g.fillStyle = '#05070c'; g.fillRect(0, 0, 256, 96);
  for (let fila = 0; fila < 3; fila++) {
    for (let i = 0; i < 9; i++) {
      const x = 16 + i * 28; const y = 17 + fila * 31;
      const brillo = g.createRadialGradient(x, y, 1, x, y, 12);
      brillo.addColorStop(0, '#ffffff'); brillo.addColorStop(0.55, '#fff6da'); brillo.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = brillo; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Línea de transmisión (azul o amarilla): pintura sobre el pasto, con bordes suaves y el moteado del césped.
function texturaDeLineaTV() {
  const c = lienzo(32, 256);
  const g = c.getContext('2d');
  const borde = g.createLinearGradient(0, 0, 32, 0);
  borde.addColorStop(0, 'rgba(255,255,255,0)'); borde.addColorStop(0.22, 'rgba(255,255,255,1)');
  borde.addColorStop(0.78, 'rgba(255,255,255,1)'); borde.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = borde; g.fillRect(0, 0, 32, 256);
  let semilla = 31;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + azar() * 0.28})`; g.fillRect(azar() * 32, azar() * 256, 1 + azar() * 2, 1 + azar() * 4); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 6);
  return t;
}

// Cartel de la oportunidad ("3.ª y 7") pintado sobre el pasto como en la tele: una flecha con el color del
// equipo que ataca, que apunta hacia donde ataca.
function texturaDeOportunidad(texto, color, sentido) {
  const W = 512; const H = 224;
  const c = lienzo(W, H);
  const g = c.getContext('2d');
  const punta = 86;
  g.beginPath();
  if (sentido > 0) { g.moveTo(6, 6); g.lineTo(W - punta, 6); g.lineTo(W - 6, H / 2); g.lineTo(W - punta, H - 6); g.lineTo(6, H - 6); }
  else { g.moveTo(W - 6, 6); g.lineTo(punta, 6); g.lineTo(6, H / 2); g.lineTo(punta, H - 6); g.lineTo(W - 6, H - 6); }
  g.closePath();
  const claro = luminancia(color) > 0.62;
  g.fillStyle = color || '#24324f';
  g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
  g.lineWidth = 10; g.strokeStyle = claro ? '#10151f' : '#ffffff'; g.stroke();
  g.fillStyle = claro ? '#10151f' : '#ffffff';
  g.font = '800 128px system-ui, "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, W / 2 - sentido * punta * 0.32, H / 2 + 8, W - punta - 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------
// Jugador articulado. Mira hacia +X; +Z es su derecha. Medidas en yardas (mide unas 2,05: 1,88 m).
// ---------------------------------------------------------------------------

const ALTO_CADERA = 1.0;
const PIEL = ['#c58c62', '#8d5a3b', '#e0b08a', '#6e4630', '#a8714c'];
const DE_LINEA = new Set(['C', 'LG', 'RG', 'LT', 'RT', 'DE', 'DT']);
let geo = null;

function geometrias() {
  if (geo) return geo;
  geo = {
    // Proporciones de atleta: muslos y pantorrillas gruesos, cintura angosta, pecho y hombros anchos.
    muslo: new THREE.CapsuleGeometry(0.108, 0.29, 3, 10),
    pierna: new THREE.CapsuleGeometry(0.06, 0.34, 3, 8),
    gemelo: new THREE.SphereGeometry(0.08, 8, 6),
    pie: new THREE.BoxGeometry(0.27, 0.085, 0.11),
    torso: new THREE.CapsuleGeometry(0.2, 0.2, 4, 12),
    cintura: new THREE.CapsuleGeometry(0.155, 0.12, 3, 10),
    cuello: new THREE.CylinderGeometry(0.07, 0.085, 0.12, 8),
    deltoide: new THREE.SphereGeometry(0.1, 8, 6),
    cadera: new THREE.SphereGeometry(0.175, 10, 8),
    hombreras: new THREE.SphereGeometry(0.2, 12, 8),
    casco: new THREE.SphereGeometry(0.158, 14, 12),
    cara: new THREE.SphereGeometry(0.105, 10, 8),
    barra: new THREE.TorusGeometry(0.118, 0.011, 4, 10, Math.PI * 1.02),
    franja: new THREE.TorusGeometry(0.16, 0.017, 4, 12, Math.PI),
    brazo: new THREE.CapsuleGeometry(0.076, 0.17, 3, 8),
    antebrazo: new THREE.CapsuleGeometry(0.056, 0.2, 3, 8),
    mano: new THREE.SphereGeometry(0.058, 8, 6),
    numero: new THREE.PlaneGeometry(0.3, 0.3),
  };
  return geo;
}

function uniforme(equipo) {
  const color = equipo.color || (equipo.esLocal ? '#1d3c8f' : '#8f1d1d');
  const alterno = equipo.colorAlterno || '#d9d9d9';
  const camiseta = equipo.esLocal ? color : '#f1f2f4';
  const numero = equipo.esLocal ? (luminancia(color) > 0.6 ? '#10151f' : '#ffffff') : (luminancia(color) > 0.75 ? '#10151f' : color);
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, envMapIntensity: 0.5, ...extra });
  // Tela: el color va en una textura con pliegues sombreados, y los mismos pliegues dan relieve a la luz.
  const tela = (c, franja) => mat('#ffffff', { map: texturaDeTela(c, franja), bumpMap: pliegues(), bumpScale: 1.6, roughness: 0.78 });
  const colorPantalon = equipo.esLocal ? '#e6e7ea' : color;
  return {
    numero,
    camiseta: tela(camiseta, null),
    pantalon: tela(colorPantalon, luminancia(colorPantalon) > 0.6 ? color : alterno),
    calceta: mat(equipo.esLocal ? color : '#f1f2f4'),
    // Casco: pintura brillante con barniz, que refleja las luces del estadio.
    casco: new THREE.MeshPhysicalMaterial({ color: equipo.esLocal ? (luminancia(alterno) > 0.9 ? color : alterno) : color, roughness: 0.2, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.5 }),
    franja: mat(equipo.esLocal ? color : alterno),
    barra: mat('#8b93a3', { roughness: 0.35, metalness: 0.85, envMapIntensity: 1.2 }),
    guante: mat('#f4f4f4'),
    zapato: mat('#16181d', { roughness: 0.45 }),
    pieles: PIEL.map((p) => mat(p)),
  };
}

function crearJugador(datos, u, indice, sombras) {
  const G = geometrias();
  const piel = u.pieles[indice % u.pieles.length];
  const malla = (g, m, proyecta = false) => { const x = new THREE.Mesh(g, m); x.castShadow = proyecta && sombras; return x; };
  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group(); // todo el cuerpo: se inclina al caer o al lanzarse
  raiz.add(cuerpo);
  const cadera = new THREE.Group();
  cadera.position.y = ALTO_CADERA;
  cuerpo.add(cadera);
  const pelvis = malla(G.cadera, u.pantalon, true);
  pelvis.scale.set(0.98, 0.84, 1.14);
  pelvis.position.x = -0.015; // glúteos
  cadera.add(pelvis);
  // Cada jugador tiene su talla: los linieros son más anchos y pesados; los demás varían un poco de estatura.
  const linero = DE_LINEA.has(datos.rol);
  const talla = 0.97 + ((indice * 7) % 5) * 0.015;
  cuerpo.scale.set(linero ? 1.16 : 1, linero ? 1.03 : talla, linero ? 1.14 : 1);

  const pierna = (lado) => {
    const muslo = new THREE.Group();
    muslo.position.set(0, -0.03, lado * 0.115);
    const m = malla(G.muslo, u.pantalon, true); m.position.y = -0.24; m.scale.set(1.1, 1, 0.98);
    const rodilla = new THREE.Group(); rodilla.position.y = -0.5;
    const p = malla(G.pierna, u.calceta, true); p.position.y = -0.23;
    const gemelo = malla(G.gemelo, u.calceta); gemelo.position.set(-0.03, -0.15, 0); gemelo.scale.set(1, 1.6, 0.95);
    const pie = malla(G.pie, u.zapato); pie.position.set(0.07, -0.455, 0);
    rodilla.add(p, gemelo, pie);
    muslo.add(m, rodilla);
    cadera.add(muslo);
    return { muslo, rodilla };
  };
  const piernaIzq = pierna(-1);
  const piernaDer = pierna(1);

  const torso = new THREE.Group();
  torso.position.y = 0.06;
  cadera.add(torso);
  // Torso en V: cintura angosta, pecho ancho y hombreras que sobresalen.
  const cintura = malla(G.cintura, u.camiseta, true); cintura.position.y = 0.15; cintura.scale.set(0.8, 1, 1.06);
  const pecho = malla(G.torso, u.camiseta, true); pecho.position.y = 0.38; pecho.scale.set(0.8, 1, 1.24);
  const hombreras = malla(G.hombreras, u.camiseta, true); hombreras.position.y = 0.58; hombreras.scale.set(0.9, 0.52, 1.62);
  const cuello = malla(G.cuello, piel); cuello.position.y = 0.7;
  torso.add(cintura, pecho, hombreras, cuello);
  if (datos.numero !== '') {
    const mNumero = new THREE.MeshLambertMaterial({ map: texturaDeNumero(datos.numero, u.numero), transparent: true, alphaTest: 0.4 });
    const frente = new THREE.Mesh(G.numero, mNumero); frente.position.set(0.164, 0.38, 0); frente.rotation.y = Math.PI / 2;
    const espalda = new THREE.Mesh(G.numero, mNumero); espalda.position.set(-0.164, 0.4, 0); espalda.rotation.y = -Math.PI / 2;
    torso.add(frente, espalda);
  }
  const cabeza = new THREE.Group();
  cabeza.position.y = 0.83;
  const casco = malla(G.casco, u.casco, true); casco.scale.set(1.08, 1, 0.96);
  const cara = malla(G.cara, piel); cara.position.set(0.075, -0.035, 0);
  const franja = malla(G.franja, u.franja); franja.scale.set(1.08, 1, 1);
  const barra1 = malla(G.barra, u.barra); barra1.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - 0.02); barra1.position.set(0.06, -0.035, 0);
  const barra2 = malla(G.barra, u.barra); barra2.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - 0.02); barra2.position.set(0.06, -0.095, 0);
  cabeza.add(casco, cara, franja, barra1, barra2);
  torso.add(cabeza);

  const brazo = (lado) => {
    const hombro = new THREE.Group();
    hombro.position.set(0, 0.56, lado * 0.31);
    const deltoide = malla(G.deltoide, u.camiseta); deltoide.position.y = -0.01; deltoide.scale.set(1.05, 1, 1.05);
    const b = malla(G.brazo, piel, true); b.position.y = -0.16;
    const codo = new THREE.Group(); codo.position.y = -0.31;
    const a = malla(G.antebrazo, piel); a.position.y = -0.14; a.scale.set(1, 1, 0.9);
    const mano = malla(G.mano, u.guante); mano.position.y = -0.3;
    codo.add(a, mano);
    hombro.add(deltoide, b, codo);
    torso.add(hombro);
    return { hombro, codo };
  };
  const brazoIzq = brazo(-1);
  const brazoDer = brazo(1);

  return {
    id: datos.id, raiz, cuerpo, cadera, torso, cabeza, piernaIzq, piernaDer, brazoIzq, brazoDer,
    deLinea: linero, fase: indice * 1.7, rumbo: null, x: 0, z: 0, rapidezAnt: null, acel: 0, rumboAnt: null, ladeo: 0,
  };
}

// Pone la pose del cuerpo según lo que está haciendo el jugador (ciclos procedurales, sin archivos de animación).
function posar(j, e, dt, antesDelCentro, llevaBalon) {
  const amp = limitar(e.rapidez / 6.5, 0, 1);
  const sprint = limitar((e.rapidez - 5) / 4, 0, 1); // a toda velocidad la zancada se alarga y el cuerpo se echa adelante
  j.fase += dt * (e.rapidez > 0.3 ? 5 + e.rapidez * 1.75 : 0);
  const s = Math.sin(j.fase);
  const paso = e.retrocede ? 0.55 : 1;
  // Aceleración y giro (suavizados): al arrancar el cuerpo se inclina hacia adelante, al frenar se endereza,
  // y en las curvas se ladea hacia adentro.
  const k6 = 1 - Math.exp(-dt * 6);
  const acelAhora = j.rapidezAnt === null || dt <= 0 ? 0 : limitar((e.rapidez - j.rapidezAnt) / dt, -14, 14);
  j.rapidezAnt = e.rapidez;
  j.acel += (acelAhora - j.acel) * k6;
  let giro = j.rumboAnt === null || dt <= 0 || j.rumbo === null ? 0 : j.rumbo - j.rumboAnt;
  while (giro > Math.PI) giro -= Math.PI * 2;
  while (giro < -Math.PI) giro += Math.PI * 2;
  j.rumboAnt = j.rumbo;
  j.ladeo += (limitar((giro / Math.max(dt, 1e-3)) * 0.07 * amp, -0.32, 0.32) - j.ladeo) * k6;
  // Base: carrera (si va quieto, amp = 0 y queda de pie). Brazos opuestos a las piernas.
  let musloI = (s * (0.95 + 0.2 * sprint) + 0.14) * amp * paso;
  let musloD = (-s * (0.95 + 0.2 * sprint) + 0.14) * amp * paso;
  let rodillaI = -(0.2 + (1.15 + 0.45 * sprint) * Math.max(0, Math.sin(j.fase - 1.2))) * amp;
  let rodillaD = -(0.2 + (1.15 + 0.45 * sprint) * Math.max(0, Math.sin(j.fase - 1.2 + Math.PI))) * amp;
  let hombroI = -s * (0.85 + 0.25 * sprint) * amp;
  let hombroD = s * (0.85 + 0.25 * sprint) * amp;
  let codoI = 0.25 + (1.2 + 0.35 * Math.max(0, -s)) * amp; // el codo se cierra más cuando la mano sube al frente
  let codoD = 0.25 + (1.2 + 0.35 * Math.max(0, s)) * amp;
  let abrirBrazos = 0.08;
  let inclinacion = e.retrocede ? 0.04 : 0.1 + 0.22 * amp + 0.1 * sprint + limitar(j.acel * 0.035, -0.14, 0.3) * (amp > 0.1 ? 1 : 0.3);
  let altura = Math.abs(Math.cos(j.fase)) * 0.06 * amp;
  let caida = 0; // 0 de pie, 1 tendido boca abajo
  let cabeceo = e.retrocede ? 0 : inclinacion * 0.55; // la cabeza sigue mirando al frente aunque el torso se incline
  let torsion = e.retrocede ? 0 : -s * 0.24 * amp; // los hombros giran al revés que la cadera
  let rodar = 0;

  if (amp < 0.15) {
    if (antesDelCentro && j.deLinea) {
      // Postura de tres puntos de los linieros.
      musloI = 1.05; musloD = 0.85; rodillaI = -1.65; rodillaD = -1.5; inclinacion = 1.0; altura = -0.3;
      hombroI = 0.55; hombroD = 0.15; codoI = 0.2; codoD = 1.1; cabeceo = 0.7;
    } else if (antesDelCentro) {
      // Listos: rodillas un poco flexionadas y manos al frente.
      musloI = 0.45; musloD = 0.3; rodillaI = -0.75; rodillaD = -0.6; inclinacion = 0.33; altura = -0.09;
      hombroI = 0.25; hombroD = 0.25; codoI = 0.9; codoD = 0.9; cabeceo = 0.2;
    } else {
      musloI = 0.12; musloD = 0.06; rodillaI = -0.22; rodillaD = -0.16; inclinacion = 0.1; codoI = 0.5; codoD = 0.5;
    }
  }
  // Con el balón: lo aprieta contra el cuerpo y el otro brazo sigue braceando.
  if (llevaBalon && !e.gesto) { hombroD = 0.35 + 0.12 * s * amp; codoD = 2.0; abrirBrazos = -0.05; torsion *= 0.6; }

  const f = e.fase;
  switch (e.gesto) {
    case 'lanzar': { // paso al frente, hombros que giran, brazo atrás y latigazo hacia adelante
      const carga = suave(f / 0.4); const suelta = suave((f - 0.4) / 0.35);
      hombroD = mezclar(0.4, -1.0, carga) + suelta * 3.4; codoD = mezclar(1.6, 1.9, carga) - suelta * 1.5;
      hombroI = 0.4 + 0.9 * carga - suelta * 1.1; codoI = 0.5 + suelta * 0.9; inclinacion = -0.14 * carga + suelta * 0.42;
      musloI = 0.3 + 0.3 * suelta; musloD = -0.2 - 0.15 * suelta; rodillaI = -0.3 - 0.25 * suelta; rodillaD = -0.2;
      torsion = -0.75 * carga + 1.35 * suelta; cabeceo = 0.05; altura = -0.04 * suelta;
      break;
    }
    case 'atrapar': { // brazos arriba hacia el balón, mirada al cielo y un saltito
      const u = Math.sin(Math.min(1, f * 1.3) * Math.PI);
      hombroI = hombroD = 0.6 + 1.95 * u; codoI = codoD = 0.7 - 0.3 * u; abrirBrazos = -0.12; altura += 0.16 * u;
      inclinacion = mezclar(inclinacion, -0.08, u); cabeceo = 0.45 * u; torsion *= 1 - u;
      break;
    }
    case 'bloquear': {
      const empuje = 0.15 * Math.sin(f * 30);
      hombroI = hombroD = 1.25 + empuje; codoI = codoD = 0.55; inclinacion = 0.42; altura = -0.14;
      if (amp < 0.3) { musloI = 0.6; musloD = 0.15; rodillaI = -0.95; rodillaD = -0.6; }
      break;
    }
    case 'taclear': { // se lanza con el hombro por delante y cierra los brazos alrededor del rival
      const u = suave(f * 2.2); const cierra = suave((f - 0.12) * 4);
      hombroI = hombroD = 1.55; codoI = codoD = 0.3 + 0.8 * cierra; caida = 0.8 * u; abrirBrazos = 0.55 - 0.75 * cierra;
      inclinacion = 0.55 * (1 - u); musloI = 0.5 * (1 - u); musloD = -0.35 * (1 - u); rodillaD = -0.5; torsion = 0.25 * (1 - u); cabeceo = 0.35;
      break;
    }
    case 'caer': { // cae de costado y rueda un poco, sin soltar el balón
      const u = suave(f * 3);
      caida = u; rodar = 0.55 * u; hombroI = 1.9; hombroD = 0.6; codoD = 1.8; musloI = 0.3 * u; rodillaI = -0.4 * u; rodillaD = -0.7 * u; torsion = 0; cabeceo = 0.3 * u;
      break;
    }
    case 'patear': {
      const u = suave(f / 0.3); const v = suave((f - 0.3) / 0.3);
      musloD = mezclar(-0.9, 1.75, u) - v * 0.9; rodillaD = mezclar(-1.3, -0.05, u); musloI = -0.1; rodillaI = -0.15;
      hombroI = 1.2 * u; hombroD = -0.6 * u; inclinacion = -0.18 * u; abrirBrazos = 0.5;
      break;
    }
    case 'arrodillar': { const u = suave(f * 6); altura = -0.43 * u; musloI = 1.45 * u; rodillaI = -1.5 * u; musloD = 0.05; rodillaD = -1.55 * u; inclinacion = 0.15; break; }
    case 'celebrar': { const u = Math.abs(Math.sin(f * 16)); hombroI = hombroD = 2.9; codoI = codoD = 0.25; abrirBrazos = 0.35; altura = 0.22 * u; inclinacion = -0.05; break; }
    default:
  }

  // Los cambios de pose se suavizan para que no haya saltos.
  const k = 1 - Math.exp(-dt * 16);
  const a = (obj, eje, valor) => { obj.rotation[eje] += (valor - obj.rotation[eje]) * k; };
  a(j.piernaIzq.muslo, 'z', musloI); a(j.piernaDer.muslo, 'z', musloD);
  a(j.piernaIzq.rodilla, 'z', rodillaI); a(j.piernaDer.rodilla, 'z', rodillaD);
  a(j.brazoIzq.hombro, 'z', hombroI); a(j.brazoDer.hombro, 'z', hombroD);
  a(j.brazoIzq.hombro, 'x', abrirBrazos); a(j.brazoDer.hombro, 'x', -abrirBrazos);
  a(j.brazoIzq.codo, 'z', codoI); a(j.brazoDer.codo, 'z', codoD);
  a(j.torso, 'z', -inclinacion);
  a(j.torso, 'y', torsion);
  a(j.cabeza, 'z', cabeceo);
  a(j.cabeza, 'y', -torsion * 0.8); // la cabeza no gira con los hombros
  a(j.cuerpo, 'z', -caida * 1.5);
  a(j.cuerpo, 'x', j.ladeo * (1 - caida) + rodar);
  j.cuerpo.position.y += ((altura + caida * 0.2) - j.cuerpo.position.y) * k;
  j.cadera.position.y += ((ALTO_CADERA - caida * 0.25) - j.cadera.position.y) * k;
}

// ---------------------------------------------------------------------------
// La vista: una sola por página (un solo contexto WebGL), que se mueve de una jugada a otra.
// ---------------------------------------------------------------------------

let vista = null;

function construirVista() {
  const chica = Math.min(window.innerWidth, window.innerHeight) < 700;
  const lienzoGL = document.createElement('canvas');
  lienzoGL.className = 'vista3d-lienzo';
  lienzoGL.setAttribute('role', 'img');
  const render = new THREE.WebGLRenderer({ canvas: lienzoGL, antialias: true, powerPreference: 'high-performance' });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.shadowMap.enabled = true;
  render.shadowMap.type = THREE.PCFSoftShadowMap;
  // Respuesta de cámara de cine (ACES): las luces fuertes se queman con suavidad, como en una transmisión.
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 0.92;
  const escena = new THREE.Scene();
  escena.background = new THREE.Color('#0d1424');
  escena.fog = new THREE.Fog('#0d1424', 190, 420);
  const camara = new THREE.PerspectiveCamera(22, 16 / 10, 1, 600);

  // Luces de estadio: una principal con sombras suaves y luz de ambiente del cielo y del pasto.
  // El entorno (una sala con paneles de luz, filtrada con PMREM) da la luz de relleno y los reflejos de los cascos.
  let entorno = null;
  if (EXTRA?.RoomEnvironment) {
    try {
      const pmrem = new THREE.PMREMGenerator(render);
      entorno = pmrem.fromScene(new EXTRA.RoomEnvironment(), 0.04).texture;
      escena.environment = entorno;
      escena.environmentIntensity = 0.4;
      pmrem.dispose();
    } catch { entorno = null; }
  }
  escena.add(new THREE.HemisphereLight('#dbe6ff', '#2c5a34', entorno ? 0.85 : 1.4));
  const foco = new THREE.DirectionalLight('#fff1d6', 2.7);
  foco.shadow.radius = 3.5;
  foco.castShadow = true;
  foco.shadow.mapSize.set(chica ? 1024 : 2048, chica ? 1024 : 2048);
  Object.assign(foco.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 10, far: 200 });
  foco.shadow.bias = -0.0006;
  foco.shadow.normalBias = 0.04;
  escena.add(foco, foco.target);
  const relleno = new THREE.DirectionalLight('#cfe0ff', 0.7);
  relleno.position.set(60, 50, 140);
  escena.add(relleno);

  // Alrededores: borde de la cancha y tribunas con gente (planos inclinados con puntos de colores).
  const borde = new THREE.Mesh(new THREE.PlaneGeometry(190, 110), new THREE.MeshStandardMaterial({ color: '#1f5a2b', roughness: 1, envMapIntensity: 0.2 }));
  borde.rotation.x = -Math.PI / 2; borde.position.set(50, -0.03, MEDIO); borde.receiveShadow = true;
  escena.add(borde);
  const matTribuna = new THREE.MeshBasicMaterial({ map: texturaDeTribuna() });
  const tribuna = (ancho, x, z, giroY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, 46), matTribuna);
    m.rotation.order = 'YXZ'; m.rotation.y = giroY; m.rotation.x = -0.62;
    m.position.set(x, 17, z);
    escena.add(m);
    const muro = new THREE.Mesh(new THREE.PlaneGeometry(ancho, 3.4), new THREE.MeshLambertMaterial({ color: '#17223c' }));
    muro.rotation.y = giroY; muro.position.set(x + Math.sin(giroY) * 15.5, 1.7, z + Math.cos(giroY) * 15.5);
    escena.add(muro);
  };
  tribuna(190, 50, -34, 0); // banda lejana
  tribuna(120, -48, MEDIO, Math.PI / 2); // detrás de la zona del local
  tribuna(120, 148, MEDIO, -Math.PI / 2); // detrás de la zona del visitante

  // Torres de focos sobre las tribunas: paneles de lámparas muy brillantes (en calidad alta, el bloom las hace resplandecer).
  const matFocos = new THREE.MeshBasicMaterial({ map: texturaDeFocos(), color: new THREE.Color(7, 6.6, 5.6), fog: false });
  const matTorre = new THREE.MeshBasicMaterial({ color: '#0a0f1a', fog: false });
  const torre = (x, z, giroY) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(17, 6.5), matFocos);
    panel.position.set(x, 47, z); panel.rotation.order = 'YXZ'; panel.rotation.y = giroY; panel.rotation.x = 0.25;
    const palo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 16), matTorre);
    palo.position.set(x, 36, z); palo.rotation.y = giroY;
    escena.add(panel, palo);
  };
  for (const x of [-12, 29, 71, 112]) torre(x, -58, 0);
  for (const z of [MEDIO - 26, MEDIO + 26]) { torre(-70, z, Math.PI / 2); torre(170, z, -Math.PI / 2); }

  // Postes amarillos al fondo de cada zona de anotación.
  const matPoste = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.4, metalness: 0.3 });
  const postes = [];
  for (const [px, signo] of [[-10, 1], [110, -1]]) {
    const grupoPoste = new THREE.Group();
    postes.push(grupoPoste);
    escena.add(grupoPoste);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.33, 8), matPoste); base.position.set(px - signo * 1.2, 1.66, MEDIO);
    const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), matPoste); cuello.rotation.z = Math.PI / 2; cuello.position.set(px - signo * 0.6, 3.33, MEDIO);
    const travesano = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.17, 8), matPoste); travesano.rotation.x = Math.PI / 2; travesano.position.set(px, 3.33, MEDIO);
    grupoPoste.add(base, cuello, travesano);
    for (const lado of [-1, 1]) {
      const vertical = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 10, 8), matPoste);
      vertical.position.set(px, 8.33, MEDIO + lado * 3.085);
      grupoPoste.add(vertical);
    }
    for (const m of [base, travesano]) m.castShadow = true;
  }

  // Cancha (la textura se pinta con los colores de los equipos del partido).
  const cancha = new THREE.Mesh(new THREE.PlaneGeometry(120, ANCHO_CANCHA), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0, envMapIntensity: 0.22 }));
  cancha.rotation.x = -Math.PI / 2; cancha.position.set(50, 0, MEDIO); cancha.receiveShadow = true;
  escena.add(cancha);

  // Líneas de transmisión: azul donde empieza la jugada, amarilla la que hay que alcanzar.
  // Como en la tele, van pintadas sobre el pasto y debajo de los jugadores: reciben su sombra, dejan ver
  // el moteado del césped y nunca tapan a nadie.
  const pinturaTV = texturaDeLineaTV();
  const lineaTV = (color, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, ANCHO_CANCHA - 1.4), new THREE.MeshLambertMaterial({
      color, map: pinturaTV, emissive: color, emissiveIntensity: 0.22, transparent: true, opacity: 0.86, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.position.z = MEDIO; m.visible = false; m.receiveShadow = true; m.renderOrder = 1;
    escena.add(m);
    return m;
  };
  const lineaGolpeo = lineaTV('#2f7dff', 0.02);
  const lineaMarca = lineaTV('#ffd21f', 0.022);
  // Cartel de la oportunidad sobre el pasto (la textura se pinta para cada jugada).
  const cartelPasto = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.8), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  cartelPasto.rotation.x = -Math.PI / 2; cartelPasto.position.y = 0.024; cartelPasto.visible = false; cartelPasto.renderOrder = 2;
  escena.add(cartelPasto);

  // Balón.
  const balon = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), new THREE.MeshStandardMaterial({ map: texturaDeBalon(), roughness: 0.6, envMapIntensity: 0.6 }));
  balon.scale.set(1.5, 2.5, 1.5); // alargado sobre su eje Y; se orienta al dibujar. Va un 50 % más grande que el real para que se vea en el celular.
  balon.castShadow = true;
  const ejeBalon = new THREE.Group();
  ejeBalon.add(balon);
  escena.add(ejeBalon);

  // Estela del balón en los pases largos y las patadas: copias que se apagan detrás del balón.
  const ESTELA = 40;
  const estelaBalon = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), ESTELA);
  estelaBalon.visible = false; estelaBalon.frustumCulled = false;
  estelaBalon.setColorAt(0, new THREE.Color(0, 0, 0));
  escena.add(estelaBalon);

  // Bandera amarilla de los penales.
  const bandera =new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.3), new THREE.MeshLambertMaterial({ color: '#ffd400' }));
  bandera.castShadow = true; bandera.visible = false;
  escena.add(bandera);

  // Confeti del touchdown.
  const CONFETI = 150;
  const confeti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONFETI);
  confeti.visible = false; confeti.frustumCulled = false;
  escena.add(confeti);

  const grupoJugadores = new THREE.Group();
  escena.add(grupoJugadores);

  // Calidad: empieza en alta (o en la que ya se midió en esta visita) y baja sola si la imagen se traba.
  let guardada = null;
  try { guardada = nivelPorNombre(sessionStorage.getItem('primer-down-calidad-3d')); } catch { /* sin almacenamiento */ }
  const medidor = crearMedidorDeCalidad({ nivel: guardada ?? 2 });

  vista = {
    medidor, calidad: -1, compositor: null, grano: null, bloom: null, estelaBalon, ESTELA,
    lienzoGL, render, escena, camara, foco, cancha, postes, lineaGolpeo, lineaMarca, cartelPasto, texturaCartel: null, claveCartel: '', ejeBalon, balon, bandera, confeti, CONFETI, grupoJugadores,
    chica, jugadores: [], uniformes: new Map(), texturaCancha: null, claveCancha: '', sesion: null,
  };
  return vista;
}

// Cadena de efectos de la calidad alta: escena -> bloom de los focos -> ACES -> grano. Se arma la primera vez que hace falta.
function armarCompositor(v) {
  if (v.compositor || !EXTRA?.EffectComposer) return v.compositor;
  try {
    const destino = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EXTRA.EffectComposer(v.render, destino);
    c.addPass(new EXTRA.RenderPass(v.escena, v.camara));
    v.bloom = new EXTRA.UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 1.7);
    c.addPass(v.bloom);
    c.addPass(new EXTRA.OutputPass());
    v.grano = new EXTRA.ShaderPass(SOMBREADOR_DE_GRANO);
    c.addPass(v.grano);
    v.compositor = c;
  } catch { v.compositor = null; }
  return v.compositor;
}

// Aplica un nivel de calidad (0 baja, 1 media, 2 alta). Devuelve el nivel que quedó de verdad.
function aplicarCalidad(v, nivel) {
  let n = limitar(Math.round(nivel), 0, 2);
  if (n === 2 && !armarCompositor(v)) n = 1; // sin addons no hay calidad alta
  if (v.calidad === n) return n;
  v.calidad = n;
  const tipo = n === 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const conSombras = n >= 1;
  if (v.render.shadowMap.type !== tipo || v.foco.castShadow !== conSombras) {
    v.render.shadowMap.type = tipo;
    v.foco.castShadow = conSombras;
    v.foco.shadow.map?.dispose();
    v.foco.shadow.map = null;
    v.render.shadowMap.needsUpdate = true;
    v.escena.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  const dpr = Math.min(window.devicePixelRatio || 1, n === 2 ? 2 : n === 1 ? 1.5 : 1);
  v.render.setPixelRatio(dpr);
  v.compositor?.setPixelRatio(dpr);
  try { sessionStorage.setItem('primer-down-calidad-3d', NIVELES[n]); } catch { /* sin almacenamiento */ }
  return n;
}

// Dibuja un cuadro con los efectos del nivel de calidad actual.
function pintarCuadro(v, segundos = 0) {
  if (v.calidad === 2 && v.compositor) {
    v.grano.uniforms.tiempo.value = segundos;
    v.compositor.render();
  } else v.render.render(v.escena, v.camara);
}

// Deja la vista sin sesión activa (se llama al abrir otra jugada o al cerrar).
function soltar() {
  const s = vista?.sesion;
  if (!s) return;
  s.detener();
  vista.sesion = null;
}

// Muestra una jugada en 3D dentro de `contenedor`. Lanza un error si no se puede (quien llama pone la pizarra 2D).
// opciones: { congelarEn: segundos } dibuja un solo cuadro en ese instante (capturas y verificación).
export async function mostrarJugada3D(contenedor, linea, opciones = {}) {
  await cargarThree();
  if (!vista) construirVista();
  soltar();
  const v = vista;

  // --- Estructura en la página ---
  contenedor.textContent = '';
  contenedor.classList.add('vista3d');
  contenedor.dataset.estado = 'cargando';
  const marco = document.createElement('div');
  marco.className = 'vista3d-marco';
  const capa = document.createElement('div');
  capa.className = 'vista3d-capa';
  capa.setAttribute('aria-hidden', 'true');
  const cartel = document.createElement('p');
  cartel.className = 'vista3d-cartel';
  cartel.hidden = true;
  const sello = document.createElement('p');
  sello.className = 'vista3d-sello';
  sello.hidden = true;
  // Gráficos de transmisión: marcador de esquina (equipos, puntos, cuarto, reloj y oportunidad) y cortina de repetición.
  const tv = opciones.tv || null;
  const marcadorTV = document.createElement('div');
  marcadorTV.className = 'tv-marcador';
  marcadorTV.setAttribute('aria-hidden', 'true');
  marcadorTV.hidden = !tv;
  const puntosTV = {};
  if (tv) {
    const fila = document.createElement('div');
    fila.className = 'tv-fila';
    for (const lado of ['visitante', 'local']) {
      const e = tv[lado];
      const caja = document.createElement('span');
      caja.className = `tv-equipo${e.ataca ? ' tv-ataca' : ''}`;
      caja.style.setProperty('--tv-color', e.color || '#24324f');
      caja.style.setProperty('--tv-texto', luminancia(e.color || '#24324f') > 0.62 ? '#10151f' : '#ffffff');
      const abrev = document.createElement('span'); abrev.className = 'tv-abrev'; abrev.textContent = e.abrev;
      const puntos = document.createElement('span'); puntos.className = 'tv-puntos'; puntos.textContent = String(e.puntos);
      caja.append(abrev, puntos);
      fila.append(caja);
      puntosTV[lado] = puntos;
    }
    const tiempo = document.createElement('span');
    tiempo.className = 'tv-tiempo';
    tiempo.textContent = [tv.periodo, tv.reloj].filter(Boolean).join(' ');
    if (tiempo.textContent) fila.append(tiempo);
    marcadorTV.append(fila);
    if (tv.oportunidad) {
      const op = document.createElement('span');
      op.className = 'tv-oportunidad';
      op.textContent = tv.oportunidad;
      marcadorTV.append(op);
    }
  }
  // El marcador muestra los puntos de antes de la jugada y, si alguien anota, los de después cuando termina.
  const ponerPuntosTV = (alFinal) => {
    if (!tv) return;
    for (const lado of ['visitante', 'local']) {
      const valor = String(alFinal ? tv[lado].puntosDespues : tv[lado].puntos);
      const sube = alFinal && tv[lado].puntosDespues !== tv[lado].puntos;
      puntosTV[lado].parentElement.classList.toggle('tv-anota', sube);
      if (puntosTV[lado].textContent !== valor) puntosTV[lado].textContent = valor;
    }
    contenedor.dataset.marcador = `${puntosTV.visitante.textContent}-${puntosTV.local.textContent}`;
  };
  const cortina = document.createElement('div');
  cortina.className = 'tv-cortina';
  cortina.setAttribute('aria-hidden', 'true');
  cortina.hidden = true;
  const textoCortina = document.createElement('span');
  textoCortina.textContent = 'Repetición';
  cortina.append(textoCortina);
  marco.append(v.lienzoGL, capa, marcadorTV, sello, cartel, cortina);
  v.lienzoGL.setAttribute('aria-label', `${linea.descripcion}${tv ? ` ${tv.descripcion}` : ''} ${linea.aviso}`);
  const texto = document.createElement('p');
  texto.className = 'pizarra-texto';
  texto.textContent = linea.descripcion;
  texto.hidden = linea.forma === 'clasica'; // en La Pizarra ese texto ya está escrito arriba de la cancha
  const aviso = document.createElement('p');
  aviso.className = 'vista3d-aviso';
  aviso.textContent = linea.aviso + (linea.forma !== 'clasica' && linea.jugadores.some((j) => j.numero !== '' && !j.nombre) ? ' Los números de los demás jugadores son de adorno.' : '');
  const botones = document.createElement('div');
  botones.className = 'vista3d-botones';
  const boton = (t) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'boton boton-chico'; b.textContent = t; return b; };
  const bRepetir = boton('Ver de nuevo');
  const bRepeticion = boton('Repetición');
  bRepeticion.title = 'Otro ángulo, desde detrás de la zona de anotación, en cámara lenta';
  const bCancha = boton('A ras de cancha');
  bCancha.title = 'Desde la banda, a la altura de los jugadores, en cámara lenta';
  botones.append(bRepetir, bRepeticion, bCancha);
  // Narrador: la voz en español del propio navegador. El botón solo existe si hay una voz; lo que se dice va
  // también escrito sobre la imagen. Si la voz falla, la vista sigue igual.
  const narrador = opciones.narrador && Array.isArray(opciones.relato) && opciones.relato.length ? opciones.narrador : null;
  const relato = narrador ? opciones.relato : [];
  const subtitulo = document.createElement('p');
  subtitulo.className = 'vista3d-subtitulo';
  subtitulo.setAttribute('aria-hidden', 'true');
  subtitulo.hidden = true;
  const bNarrador = boton('🔊 Narrador');
  bNarrador.classList.add('boton-narrador');
  bNarrador.title = 'Relato de la jugada con la voz en español de tu navegador';
  bNarrador.hidden = true;
  let frasesDichas = 0;
  const pintarNarrador = () => {
    const hay = !!narrador?.disponible();
    const si = hay && narrador.encendido();
    bNarrador.hidden = !hay;
    bNarrador.setAttribute('aria-pressed', si ? 'true' : 'false');
    contenedor.dataset.narrador = !hay ? 'sin-voz' : si ? 'encendido' : 'apagado';
    if (!si) subtitulo.hidden = true;
  };
  const dejarDeOir = [
    narrador?.alCambiar(pintarNarrador),
    narrador?.alDecir((frase) => { subtitulo.textContent = frase.texto; subtitulo.hidden = false; frasesDichas++; contenedor.dataset.narrado = String(frasesDichas); }),
  ];
  pintarNarrador();
  botones.append(bNarrador);
  marco.append(subtitulo);
  if (opciones.compacto) { botones.hidden = true; texto.hidden = true; } // "Jugadas clave" trae sus propios controles
  contenedor.append(marco, texto, aviso, botones);

  // --- Escena de esta jugada ---
  const local = linea.ataque.esLocal ? linea.ataque : linea.defensa;
  const visitante = linea.ataque.esLocal ? linea.defensa : linea.ataque;
  const claveCancha = `${local.id}|${local.color}|${visitante.id}|${visitante.color}`;
  if (v.claveCancha !== claveCancha) {
    v.texturaCancha?.dispose();
    v.texturaCancha = texturaDeCancha(local, visitante, v.chica);
    v.cancha.material.map = v.texturaCancha;
    v.cancha.material.needsUpdate = true;
    v.claveCancha = claveCancha;
    v.uniformes.clear();
  }
  const uniformeDe = (equipo) => {
    if (!v.uniformes.has(equipo.id)) v.uniformes.set(equipo.id, uniforme(equipo));
    return v.uniformes.get(equipo.id);
  };
  v.grupoJugadores.clear();
  v.jugadores = linea.jugadores.map((d, i) => {
    const j = crearJugador(d, uniformeDe(d.bando === 'ataque' ? linea.ataque : linea.defensa), i, true);
    v.grupoJugadores.add(j.raiz);
    return j;
  });
  v.lineaGolpeo.visible = linea.scrimmage !== null;
  if (linea.scrimmage !== null) v.lineaGolpeo.position.x = linea.scrimmage;
  v.lineaMarca.visible = linea.marca !== null;
  if (linea.marca !== null) v.lineaMarca.position.x = linea.marca;
  v.bandera.visible = false;
  v.confeti.visible = false;
  // "3.ª y 7" sobre el pasto, detrás de la línea de golpeo y del lado de la cámara. Solo en jugadas con oportunidad.
  const conCartelPasto = !!tv?.oportunidad && linea.scrimmage !== null && linea.tSnap !== null && linea.forma !== 'gol-de-campo';
  v.cartelPasto.visible = false;
  if (conCartelPasto) {
    const clave = `${tv.oportunidad}|${linea.ataque.color}|${linea.sentido}`;
    if (v.claveCartel !== clave) {
      v.texturaCartel?.dispose();
      v.texturaCartel = texturaDeOportunidad(tv.oportunidad, linea.ataque.color || '#24324f', linea.sentido);
      v.cartelPasto.material.map = v.texturaCartel;
      v.cartelPasto.material.needsUpdate = true;
      v.claveCartel = clave;
    }
    v.cartelPasto.position.x = limitar(linea.scrimmage - linea.sentido * 7.2, -3.5, 103.5);
    v.cartelPasto.position.z = ANCHO_CANCHA - 15.8; // entre las marcas interiores y los números de la banda cercana
  }

  // Rótulos de los protagonistas (pasador, receptor, corredor...) sobre la imagen.
  const rotulos = linea.rotulos.map((r) => {
    const el = document.createElement('span');
    el.className = `vista3d-rotulo vista3d-rotulo-${linea.jugadores.find((j) => j.id === r.jugador)?.bando || 'ataque'}`;
    el.textContent = `${r.numero ? `${r.numero} ` : ''}${r.nombre}`;
    el.title = r.papel;
    capa.append(el);
    return { el, jugador: v.jugadores.find((j) => j.id === r.jugador) };
  });

  // --- Estado de la reproducción ---
  const mirada = new THREE.Vector3(linea.desde, 1, MEDIO);
  const deseo = new THREE.Vector3(linea.desde, 1, MEDIO);
  const anteriorBalon = new THREE.Vector3(linea.desde, 0, MEDIO);
  const tmp = new THREE.Vector3();
  const tmpObj = new THREE.Object3D();
  let t = 0;
  let velocidad = 1;
  let modo = 'transmision'; // o 'repeticion'
  let fov = 24;
  let cuadro = 0;
  let respaldo = 0;
  let ultimo = 0;
  let activo = true;
  let visible = true;
  let cuadros = 0;
  let giroBalon = 0;
  let fovFijo = true; // el primer cuadro después de un salto pone el plano directo, sin transición
  let confetiDesde = -1;
  const piezas = [];
  const eventosDeZoom = linea.eventos.filter((e) => ['atrapada', 'tacleo', 'intercepcion', 'touchdown', 'incompleto'].includes(e.tipo));
  const tTouchdown = linea.eventos.find((e) => e.tipo === 'touchdown')?.t ?? null;
  const esClasica = linea.forma === 'clasica';
  const esGolDeCampo = linea.forma === 'gol-de-campo';
  const posteX = linea.sentido > 0 ? 110 : -10;
  const camaraFondo = (linea.desde + linea.hasta) / 2 < 50 ? -24 : 124; // la cámara de repetición no cambia de lado a media jugada
  const banderaEv = linea.eventos.find((e) => e.tipo === 'bandera') || null;

  // vuelos largos del balón (pases de 18 yardas o más y patadas): ahí va la estela.
  // Con "reducir movimiento" no hay estela ni temblor de cámara.
  const quieto = sinMovimiento();
  const vuelosLargos = [];
  if (!quieto) {
    let inicio = null;
    for (let s = 0; s <= linea.duracion + 0.05; s += 0.05) {
      const b = muestrear(linea, Math.min(s, linea.duracion)).balon;
      if (b.enAire && !inicio) inicio = { t: s, x: b.x, z: b.z };
      if ((!b.enAire || s >= linea.duracion) && inicio) {
        if (Math.hypot(b.x - inicio.x, b.z - inicio.z) >= 18) vuelosLargos.push({ t0: inicio.t, t1: s });
        inicio = null;
      }
    }
  }
  contenedor.dataset.vuelosLargos = String(vuelosLargos.length);
  const rastro = []; // posiciones recientes del balón en un vuelo largo
  const colorEstela = new THREE.Color();
  const temblor = !quieto && !opciones.porTramos; // cámara en mano: solo en las repeticiones
  const medir = () => {
    const ancho = Math.max(200, Math.round(marco.clientWidth || contenedor.clientWidth || 328));
    const alto = Math.round(ancho * (ancho < 520 ? 0.75 : 0.56));
    v.render.setSize(ancho, alto, false);
    v.compositor?.setSize(ancho, alto);
    v.lienzoGL.style.width = '100%';
    v.lienzoGL.style.height = 'auto';
    v.camara.aspect = ancho / alto;
    return { ancho, alto };
  };
  // Calidad de esta jugada: la que pida quien llama (enlaces y capturas) o la automática.
  const calidadPedida = nivelPorNombre(opciones.calidad);
  const ponerCalidad = (n) => { contenedor.dataset.calidad = NIVELES[aplicarCalidad(v, n)]; };
  ponerCalidad(calidadPedida ?? v.medidor.nivel);
  let tamano = medir();

  const textoCartel = () => {
    if (tTouchdown !== null) return '¡TOUCHDOWN!';
    if (linea.forma === 'clasica') return '';
    const tipos = linea.eventos.map((e) => e.tipo);
    if (tipos.includes('gol-de-campo-bueno')) return '¡Gol de campo!';
    if (tipos.includes('gol-de-campo-fallado')) return 'Gol de campo fallado';
    if (tipos.includes('intercepcion')) return '¡Intercepción!';
    if (tipos.includes('incompleto')) return 'Pase incompleto';
    if (linea.forma === 'penal') return 'Castigo';
    const yardas = Math.round(linea.sentido * (linea.hasta - linea.desde));
    if (linea.forma === 'patada') return '';
    if (yardas > 0) return `+${yardas} ${yardas === 1 ? 'yarda' : 'yardas'}`;
    if (yardas < 0) return `${yardas} ${yardas === -1 ? 'yarda' : 'yardas'}`;
    return 'Sin avance';
  };

  // Avanza la cámara dt segundos hacia donde debe mirar. La cámara es un camarógrafo: sigue al balón con retraso,
  // se adelanta un poco hacia donde va la jugada y cierra el plano en la atrapada y en el tacleo.
  const moverCamara = (m, dt) => {
    const b = m.balon;
    tmp.set(b.x - anteriorBalon.x, 0, b.z - anteriorBalon.z).divideScalar(Math.max(dt, 1e-3));
    anteriorBalon.set(b.x, 0, b.z);
    const anticipo = 0.55;
    const antes = linea.tSnap !== null && t < linea.tSnap;
    deseo.set(
      b.x + limitar(tmp.x * anticipo, -7, 7) + (antes ? linea.sentido * 3 : 0),
      0.9 + Math.min(6, b.y * 0.32),
      modo === 'repeticion' ? mezclar(b.z, MEDIO, 0.2) : mezclar(b.z + limitar(tmp.z * anticipo, -4, 4), MEDIO, 0.35) + 3.5,
    );
    if (esClasica && modo !== 'cancha') {
      // En las jugadas de pizarra importa ver la jugada entera: la cámara se queda entre el balón y la línea.
      deseo.x = b.x + limitar(((linea.scrimmage ?? linea.desde) - b.x) * 0.45, -7, 7); // sin alejarse más de 7 yardas del balón
      deseo.z = mezclar(deseo.z, MEDIO + (modo === 'transmision' ? 3.5 : 0), 0.5);
    }
    if (modo === 'repeticion') {
      // La cámara del fondo no mira a sus pies: lo más cerca que apunta es a 34 yardas de ella.
      deseo.x = camaraFondo < 50 ? Math.max(deseo.x, camaraFondo + 34) : Math.min(deseo.x, camaraFondo - 34);
    } else if (modo === 'transmision' && esGolDeCampo) {
      // Gol de campo: plano fijo desde atrás del pateador, con la línea y los postes a la vista.
      deseo.set(mezclar(linea.scrimmage ?? linea.desde, posteX, 0.4), 1.5 + Math.min(2.5, b.y * 0.2), MEDIO);
    }
    const k = 1 - Math.exp(-dt * (modo === 'transmision' ? 2.6 : 4));
    mirada.lerp(deseo, k);
    let fovObjetivo;
    if (modo === 'repeticion') {
      // Segundo ángulo: cámara alta detrás de la zona de anotación más cercana a la jugada, con teleobjetivo.
      // El plano se cierra hasta abarcar unas 23 yardas de ancho a la altura del balón, esté lejos o cerca.
      const lejos = Math.max(18, Math.abs(mirada.x - camaraFondo));
      v.camara.position.set(camaraFondo, 8 + lejos * 0.14, MEDIO + 1.5);
      fovObjetivo = limitar(grados(2 * Math.atan(((esClasica ? 30 : 23) / v.camara.aspect) / 2 / lejos)), 4, 38);
    } else if (modo === 'transmision' && esGolDeCampo) {
      v.camara.position.set((linea.scrimmage ?? linea.desde) - linea.sentido * 36, 11, MEDIO + 1.2);
      fovObjetivo = 28;
    } else if (modo === 'cancha') {
      // Tercer ángulo: a ras de cancha, desde la banda cercana, como el camarógrafo de la línea lateral.
      v.camara.position.set(mirada.x - linea.sentido * 5, 2.1, Math.min(ANCHO_CANCHA + 5, mirada.z + 17));
      fovObjetivo = 30 / Math.min(1.5, Math.max(1, v.camara.aspect / 1.33));
    } else {
      // Cámara principal: en la tribuna lateral, a unos 27 m de alto y 70 m del centro de la cancha.
      // El teleobjetivo se cierra en pantallas chicas para que un jugador mida unos 27 px de alto.
      v.camara.position.set(limitar(50 + (mirada.x - 50) * 0.88, -6, 106), ALTO_CAMARA, ANCHO_CANCHA + FONDO_CAMARA);
      const base = limitar(grados(2 * Math.atan((tamano.alto / 27) * 1.9 / 2 / LEJOS_CAMARA)), 11, 13.5);
      fovObjetivo = base * (antes ? 1.1 : 1) * (esClasica ? 1.45 : 1);
      if (b.enAire && b.y > 5) fovObjetivo *= 1.25; // las patadas y los pases altos necesitan más aire
      for (const e of eventosDeZoom) if (t > e.t - 0.15 && t < e.t + 1.1) fovObjetivo *= 0.8;
    }
    fov = fovFijo ? fovObjetivo : fov + (fovObjetivo - fov) * (1 - Math.exp(-dt * 2.4));
    fovFijo = false;
    v.camara.fov = fov;
    v.camara.lookAt(mirada);
    if (temblor && modo !== 'transmision') {
      // Cámara en mano: un vaivén leve e irregular, proporcional al zoom para que se note igual de cerca que de lejos.
      const a = (fov * Math.PI / 180) * 0.011;
      const r = t / velocidad;
      v.camara.rotateX(a * (Math.sin(r * 5.1) + 0.6 * Math.sin(r * 11.3 + 1.2)) * 0.55);
      v.camara.rotateY(a * (Math.sin(r * 4.3 + 2) + 0.6 * Math.sin(r * 9.7)) * 0.55);
      v.camara.rotateZ(a * 0.45 * Math.sin(r * 3.1 + 0.5));
    }
    v.camara.updateProjectionMatrix();
    v.foco.position.set(mirada.x - 26, 62, mirada.z + 34);
    v.foco.target.position.set(mirada.x, 0, mirada.z);
  };

  const ponerEscena = (dt) => {
    const m = muestrear(linea, t);
    const antes = linea.tSnap === null || t < linea.tSnap;
    for (let i = 0; i < v.jugadores.length; i++) {
      const j = v.jugadores[i];
      const e = m.jugadores[i];
      j.raiz.position.set(e.x, 0, e.z);
      // Giro suave hacia donde mira.
      if (j.rumbo === null) j.rumbo = e.rumbo;
      let d = e.rumbo - j.rumbo;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      j.rumbo += d * (1 - Math.exp(-dt * 11));
      j.raiz.rotation.y = -j.rumbo;
      posar(j, e, dt, antes, m.balon.portador === j.id);
    }
    // Balón: en espiral en los pases, dando tumbos en las patadas.
    const b = m.balon;
    v.ejeBalon.position.set(b.x, Math.max(0.12, b.y), b.z);
    if (b.enAire) {
      giroBalon += dt * (b.giro === 'tumbo' ? 13 : 26);
      v.ejeBalon.rotation.set(0, -b.rumbo, 0);
      if (b.giro === 'tumbo') v.balon.rotation.set(0, 0, giroBalon);
      else v.balon.rotation.set(giroBalon, 0, -Math.PI / 2 + (b.inclinacion || 0));
    } else {
      v.ejeBalon.rotation.set(0, linea.sentido > 0 ? 0 : Math.PI, 0);
      v.balon.rotation.set(0, 0, -Math.PI / 2 + (b.portador ? 0.5 : 0));
    }
    // Estela del balón en los vuelos largos.
    const enVueloLargo = vuelosLargos.some((x) => t >= x.t0 && t <= x.t1);
    if (rastro.length && t < rastro[rastro.length - 1].t) rastro.length = 0; // la jugada volvió a empezar
    if (enVueloLargo && b.enAire && (!rastro.length || t - rastro[rastro.length - 1].t >= 0.02)) rastro.push({ t, x: b.x, y: b.y, z: b.z });
    while (rastro.length && (t - rastro[0].t > 0.5 || rastro.length > 60)) rastro.shift();
    v.estelaBalon.visible = rastro.length > 1 && v.calidad >= 1;
    if (v.estelaBalon.visible) {
      // La estela es continua: sus copias se reparten por el camino reciente del balón, no por cuadros dibujados.
      const DURA = 0.42;
      let k = rastro.length - 1;
      for (let i = 0; i < v.ESTELA; i++) {
        const cuando = t - ((i + 1) / v.ESTELA) * DURA;
        while (k > 0 && rastro[k - 1].t >= cuando) k--;
        const p1 = rastro[k]; const p0 = rastro[Math.max(0, k - 1)];
        const hay = cuando >= rastro[0].t;
        const u = hay && p1.t > p0.t ? limitar((cuando - p0.t) / (p1.t - p0.t), 0, 1) : 1;
        const vida = hay ? 1 - (i + 1) / v.ESTELA : 0;
        tmpObj.position.set(mezclar(p0.x, p1.x, u), hay ? mezclar(p0.y, p1.y, u) : -50, mezclar(p0.z, p1.z, u));
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(0.3 + 0.7 * vida);
        tmpObj.updateMatrix();
        v.estelaBalon.setMatrixAt(i, tmpObj.matrix);
        v.estelaBalon.setColorAt(i, colorEstela.setScalar(0.1 * vida * vida));
      }
      tmpObj.scale.setScalar(1);
      v.estelaBalon.instanceMatrix.needsUpdate = true;
      v.estelaBalon.instanceColor.needsUpdate = true;
    }
    // Bandera amarilla: sale volando y cae cerca de la falta.
    if (banderaEv && t >= banderaEv.t) {
      const u = limitar((t - banderaEv.t) / 0.8, 0, 1);
      v.bandera.visible = true;
      v.bandera.position.set(banderaEv.x - linea.sentido * 4 * (1 - u), 0.06 + Math.sin(u * Math.PI) * 3.2, banderaEv.z + 3 * (1 - u));
      v.bandera.rotation.set(u < 1 ? t * 9 : 0, u < 1 ? t * 7 : 0.6, 0);
    } else v.bandera.visible = false;
    // Confeti con los colores del equipo que anota.
    if (tTouchdown !== null && t >= tTouchdown && t < tTouchdown + 3.2) {
      if (confetiDesde !== tTouchdown || !piezas.length) {
        confetiDesde = tTouchdown;
        piezas.length = 0;
        const colores = [linea.ataque.color || '#ffd43b', linea.ataque.colorAlterno || '#ffffff', '#ffffff'];
        const color = new THREE.Color();
        for (let i = 0; i < v.CONFETI; i++) {
          const ang = (i * 2.399) % (Math.PI * 2);
          const fuerza = 2 + ((i * 37) % 60) / 12;
          piezas.push({ x: b.x, y: 2.2, z: b.z, vx: Math.cos(ang) * fuerza, vy: 6 + ((i * 53) % 50) / 9, vz: Math.sin(ang) * fuerza, giro: i });
          v.confeti.setColorAt(i, color.set(colores[i % colores.length]));
        }
        v.confeti.instanceColor.needsUpdate = true;
      }
      v.confeti.visible = true;
      const edad = t - tTouchdown;
      for (let i = 0; i < piezas.length; i++) {
        const p = piezas[i];
        const y = Math.max(0.05, p.y + p.vy * edad - 4.9 * edad * edad * 0.9);
        tmpObj.position.set(p.x + p.vx * edad, y, p.z + p.vz * edad);
        tmpObj.rotation.set(y > 0.06 ? edad * 7 + p.giro : -Math.PI / 2, p.giro, edad * 5);
        tmpObj.updateMatrix();
        v.confeti.setMatrixAt(i, tmpObj.matrix);
      }
      v.confeti.instanceMatrix.needsUpdate = true;
    } else v.confeti.visible = false;
    // Cartel de la oportunidad: visible antes del centro, se desvanece cuando arranca la jugada. Solo con la cámara de TV.
    if (conCartelPasto) {
      const opacidad = modo === 'transmision' ? limitar(1 - (t - linea.tSnap) / 0.6, 0, 1) : 0;
      v.cartelPasto.visible = opacidad > 0.01;
      v.cartelPasto.material.opacity = opacidad;
    }
    // En la repetición la cámara está detrás de un poste: ese poste no se dibuja para que no tape la jugada.
    v.postes[0].visible = !(modo === 'repeticion' && camaraFondo < 50);
    v.postes[1].visible = !(modo === 'repeticion' && camaraFondo > 50);
    moverCamara(m, dt);
    return m;
  };

  // Los rótulos van sobre la cabeza de cada protagonista. Si dos quedarían encimados, solo se muestra el primero.
  const ponerRotulos = () => {
    const puestos = [];
    for (const r of rotulos) {
      if (!r.jugador) continue;
      tmp.set(r.jugador.raiz.position.x, 2.75, r.jugador.raiz.position.z).project(v.camara);
      const px = (tmp.x + 1) / 2 * tamano.ancho;
      const py = (1 - tmp.y) / 2 * tamano.alto;
      const medio = (r.el.textContent.length * 6.4 + 14) / 2; // medio ancho aproximado del rótulo en píxeles
      const dentro = tmp.z < 1 && px > medio && px < tamano.ancho - medio && py > 18 && py < tamano.alto
        && !puestos.some((o) => Math.abs(o.px - px) < o.medio + medio && Math.abs(o.py - py) < 19);
      r.el.hidden = !dentro;
      if (!dentro) continue;
      puestos.push({ px, py, medio });
      r.el.style.left = `${(px / tamano.ancho * 100).toFixed(2)}%`;
      r.el.style.top = `${(py / tamano.alto * 100).toFixed(2)}%`;
    }
  };

  const dibujar = (dt) => {
    ponerEscena(dt);
    pintarCuadro(v, t);
    ponerRotulos();
    cuadros++;
    contenedor.dataset.cuadros = String(cuadros);
  };

  let tFin = linea.duracion; // hasta dónde llega la reproducción en curso (un tramo o la jugada entera)

  const terminar = () => {
    cancelAnimationFrame(cuadro);
    clearTimeout(respaldo);
    cuadro = 0;
    const c = t >= linea.duracion - 0.01 ? textoCartel() : ''; // el cartel solo sale cuando la jugada terminó de verdad
    cartel.textContent = c;
    cartel.hidden = !c;
    cartel.classList.toggle('vista3d-cartel-anotacion', tTouchdown !== null);
    ponerPuntosTV(t >= linea.duracion - 0.01);
    contenedor.dataset.estado = 'fin';
    try { opciones.alTerminar?.(modo); } catch { /* quien escucha no puede romper la vista */ }
  };

  const paso = (ahora) => {
    cuadro = 0;
    if (!activo) return;
    const dt = Math.min(0.05, Math.max(0.001, (ahora - ultimo) / 1000));
    // Calidad automática: si la imagen va a menos de unos 40 cuadros por segundo, se apagan efectos.
    if (calidadPedida === null) {
      const nueva = v.medidor.cuadro(ahora - ultimo);
      if (nueva !== null) { ponerCalidad(nueva); tamano = medir(); }
    }
    ultimo = ahora;
    t = Math.min(tFin, t + dt * velocidad);
    dibujar(dt * velocidad);
    narrador?.avanzar(t);
    if (t >= tFin) { terminar(); return; }
    if (visible && !enPausa) cuadro = requestAnimationFrame(paso);
  };

  // Lleva la escena al segundo `hasta` sin dibujar cada cuadro (para saltar o congelar) y dibuja uno.
  const saltarA = (hasta) => {
    const fin = limitar(hasta, 0, linea.duracion);
    for (const j of v.jugadores) { j.rumbo = null; j.rumboAnt = null; j.rapidezAnt = null; j.acel = 0; j.ladeo = 0; }
    ponerPuntosTV(false);
    t = 0;
    mirada.set(linea.desde, 1, MEDIO);
    anteriorBalon.set(linea.desde, 0, MEDIO);
    fovFijo = true;
    ponerEscena(1 / 30);
    while (t < fin) { t = Math.min(fin, t + 1 / 30); ponerEscena(1 / 30); }
    v.medidor.pausa();
    pintarCuadro(v, t);
    ponerRotulos();
    cuadros++;
    contenedor.dataset.cuadros = String(cuadros);
  };

  const ponerSello = () => {
    sello.hidden = modo === 'transmision';
    sello.textContent = opciones.porTramos
      ? (modo === 'cancha' ? 'A ras de cancha' : 'Desde el fondo')
      : (modo === 'cancha' ? 'A ras de cancha · cámara lenta' : 'Repetición · cámara lenta');
    contenedor.dataset.camara = modo;
  };

  // Cortina de "REPETICIÓN": cruza la imagen y, cuando la tapa, cambia el ángulo y arranca la cámara lenta.
  let esperaCortina = 0;
  const pasarCortina = (alTapar) => {
    clearTimeout(esperaCortina);
    cortina.hidden = false;
    cortina.classList.remove('tv-cortina-pasa');
    void cortina.offsetWidth; // reinicia la animación
    cortina.classList.add('tv-cortina-pasa');
    contenedor.dataset.cortina = 'vista';
    esperaCortina = setTimeout(alTapar, 330);
    clearTimeout(finCortina);
    finCortina = setTimeout(() => { cortina.hidden = true; }, 1000); // por si el navegador no avisa del fin de la animación
  };
  let finCortina = 0;
  cortina.addEventListener('animationend', () => { cortina.hidden = true; });

  let enPausa = false;
  // extra.desde: segundo en que arranca (repetición corta) · extra.mudo: sin relato (para no decir dos veces lo mismo).
  const reproducir = (nuevoModo = 'transmision', conCortina = nuevoModo !== 'transmision', extra = {}) => {
    cancelAnimationFrame(cuadro);
    clearTimeout(respaldo);
    clearTimeout(esperaCortina);
    if (conCortina && !sinMovimiento()) {
      contenedor.dataset.estado = 'animando';
      pasarCortina(() => reproducir(nuevoModo, false, extra));
      return;
    }
    modo = nuevoModo;
    velocidad = modo === 'transmision' ? 1 : 0.45;
    tFin = linea.duracion;
    cartel.hidden = true;
    ponerSello();
    contenedor.dataset.estado = 'animando';
    activo = true;
    tamano = medir();
    const desde = limitar(Number(extra?.desde) || 0, 0, linea.duracion);
    saltarA(desde);
    enPausa = false;
    subtitulo.hidden = true;
    narrador?.cargar(extra?.mudo ? [] : relato, desde); // calla lo anterior y empieza el relato con la jugada (también en la repetición)
    ultimo = performance.now();
    cuadro = requestAnimationFrame(paso);
    // Si el navegador casi no entrega cuadros (pestaña en segundo plano, ahorro de batería), la jugada igual llega al final.
    respaldo = setTimeout(() => { if (contenedor.dataset.estado !== 'fin') { saltarA(linea.duracion); narrador?.avanzar(t); terminar(); } }, ((linea.duracion - desde) / velocidad) * 1000 + 1500);
  };

  // Reproduce solo un tramo de la jugada (un paso de una jugada clásica), a velocidad normal y con la cámara elegida.
  const tramo = (desde, hasta) => {
    cancelAnimationFrame(cuadro);
    clearTimeout(respaldo);
    velocidad = 1;
    cartel.hidden = true;
    contenedor.dataset.estado = 'animando';
    activo = true;
    tamano = medir();
    saltarA(desde);
    tFin = limitar(hasta, t, linea.duracion);
    ultimo = performance.now();
    cuadro = requestAnimationFrame(paso);
    const destino = tFin;
    respaldo = setTimeout(() => { if (contenedor.dataset.estado !== 'fin') { saltarA(destino); terminar(); } }, (destino - t) * 1000 + 1500);
  };

  // Cambia de cámara sin reiniciar: si la jugada está quieta, vuelve a dibujar el mismo instante desde el otro ángulo.
  const cambiarCamara = (nuevoModo) => {
    modo = nuevoModo;
    ponerSello();
    if (contenedor.dataset.estado === 'animando') { fovFijo = true; return; }
    const estado = contenedor.dataset.estado;
    saltarA(t);
    contenedor.dataset.estado = estado;
  };

  if (opciones.porTramos) {
    bRepetir.textContent = 'Cámara de TV';
    bRepeticion.textContent = 'Desde el fondo';
    bRepeticion.title = 'Desde detrás de la zona de anotación';
    bCancha.title = 'Desde la banda, a la altura de los jugadores';
    bRepetir.addEventListener('click', () => cambiarCamara('transmision'));
    bRepeticion.addEventListener('click', () => cambiarCamara('repeticion'));
    bCancha.addEventListener('click', () => cambiarCamara('cancha'));
  } else {
    bRepetir.addEventListener('click', () => reproducir('transmision'));
    bRepeticion.addEventListener('click', () => reproducir('repeticion'));
    bCancha.addEventListener('click', () => reproducir('cancha'));
  }
  // Al encender el narrador a media jugada sigue desde ese instante; si la jugada ya terminó, se vuelve a ver narrada.
  bNarrador.addEventListener('click', () => {
    if (!narrador) return;
    narrador.encender(!narrador.encendido());
    if (!narrador.encendido()) return;
    if (contenedor.dataset.estado === 'animando' && cuadro) narrador.cargar(relato, t); else reproducir(modo, false);
  });
  // Pausa y continúa la reproducción en curso (lo usa "Jugadas clave"). En pausa el narrador se calla.
  const pausa = (si) => {
    if (si === enPausa) return;
    enPausa = si;
    if (si) {
      cancelAnimationFrame(cuadro); cuadro = 0;
      clearTimeout(respaldo);
      narrador?.pausar();
    } else {
      narrador?.continuar();
      if (contenedor.dataset.estado !== 'animando') return;
      ultimo = performance.now();
      cuadro = requestAnimationFrame(paso);
      respaldo = setTimeout(() => { if (contenedor.dataset.estado !== 'fin' && !enPausa) { saltarA(tFin); narrador?.avanzar(t); terminar(); } }, ((tFin - t) / velocidad) * 1000 + 1500);
    }
  };

  // Pausa cuando no se ve: pestaña oculta o la vista fuera de la pantalla.
  const alCambiarVisibilidad = () => {
    const ahoraVisible = !document.hidden && enPantalla;
    if (!ahoraVisible) narrador?.pausar(); else if (!enPausa) narrador?.continuar(); // con la pestaña oculta no se habla
    if (ahoraVisible && !visible && contenedor.dataset.estado === 'animando' && !cuadro && !enPausa) { ultimo = performance.now(); cuadro = requestAnimationFrame(paso); }
    visible = ahoraVisible;
  };
  let enPantalla = true;
  const observador = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entradas) => { enPantalla = entradas.some((x) => x.isIntersecting); alCambiarVisibilidad(); })
    : null;
  observador?.observe(marco);
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  const alRedimensionar = () => { tamano = medir(); if (contenedor.dataset.estado === 'fin') { v.camara.updateProjectionMatrix(); pintarCuadro(v, t); ponerRotulos(); } };
  window.addEventListener('resize', alRedimensionar);
  const alPerderContexto = (ev) => { ev.preventDefault(); sesion.detener(); contenedor.dataset.estado = 'error'; opciones.alFallar?.(); };
  v.lienzoGL.addEventListener('webglcontextlost', alPerderContexto);

  const sesion = {
    detener() {
      activo = false;
      cancelAnimationFrame(cuadro);
      clearTimeout(respaldo);
      clearTimeout(esperaCortina);
      narrador?.callar();
      for (const dejar of dejarDeOir) dejar?.();
      observador?.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('resize', alRedimensionar);
      v.lienzoGL.removeEventListener('webglcontextlost', alPerderContexto);
      if (contenedor.dataset.estado === 'animando') contenedor.dataset.estado = 'detenida';
      v.lienzoGL.remove();
    },
  };
  v.sesion = sesion;
  contenedor.dataset.jugadores = String(v.jugadores.length);

  if (typeof opciones.congelarEn === 'number') {
    modo = ['repeticion', 'cancha'].includes(opciones.camara) ? opciones.camara : 'transmision';
    ponerSello();
    saltarA(opciones.congelarEn);
    if (opciones.congelarEn >= linea.duracion) terminar(); else contenedor.dataset.estado = 'congelada';
  } else {
    // opciones.camara sin congelar: la jugada arranca directo en ese ángulo, con su cortina (enlaces y verificación).
    reproducir(['repeticion', 'cancha'].includes(opciones.camara) ? opciones.camara : 'transmision');
  }
  // irA: deja la jugada congelada en un segundo y con una cámara (revisión y capturas).
  const irA = (segundo, camara = 'transmision') => {
    cancelAnimationFrame(cuadro); clearTimeout(respaldo); cuadro = 0;
    narrador?.callar();
    modo = ['repeticion', 'cancha'].includes(camara) ? camara : 'transmision';
    ponerSello();
    saltarA(segundo);
    if (segundo >= linea.duracion) terminar(); else { cartel.hidden = true; contenedor.dataset.estado = 'congelada'; }
  };
  return { reproducir, irA, tramo, pausa, camara: () => modo, cerrar: () => { if (v.sesion === sesion) soltar(); }, contenedor };
}

// Cierra la vista 3D que esté abierta (si hay alguna).
export function cerrarVista3D() { soltar(); }
