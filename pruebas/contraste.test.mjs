// Contraste de las dos paletas (oscura y clara) según WCAG 2: el texto necesita 4,5:1 contra su fondo
// y lo que no es texto (el borde de foco, las líneas de la cancha) necesita 3:1.
// Lee los colores directamente de css/estilos.css, así que si alguien cambia la paleta, esto lo revisa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'css', 'estilos.css'), 'utf8');

function paleta(selector) {
  const inicio = css.indexOf(`${selector} {`);
  assert.ok(inicio >= 0, `no encontré ${selector} en el CSS`);
  const bloque = css.slice(inicio, css.indexOf('}', inicio));
  return Object.fromEntries([...bloque.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}

const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminancia = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};
export const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};
// Mezcla como color-mix(in srgb, a p%, b).
const mezcla = (a, b, p) => {
  const na = parseInt(a.slice(1), 16); const nb = parseInt(b.slice(1), 16);
  const c = (d) => Math.round((((na >> d) & 255) * p + ((nb >> d) & 255) * (100 - p)) / 100);
  return `#${[16, 8, 0].map((d) => c(d).toString(16).padStart(2, '0')).join('')}`;
};

// Color de trazo (stroke) de una regla del CSS, para revisar lo que se dibuja sobre el pasto.
const color = (clase) => {
  const inicio = css.indexOf(`.${clase} {`);
  const m = inicio < 0 ? null : /stroke: (#[0-9a-f]{6})/i.exec(css.slice(inicio, css.indexOf('}', inicio)));
  assert.ok(m, `no encontré el trazo de .${clase}`);
  return m[1].toLowerCase();
};

const oscura = paleta(':root');
const clara = { ...oscura, ...paleta(':root[data-tema="claro"]') };

test('la fórmula de contraste da los valores conocidos', () => {
  assert.equal(Math.round(contraste('#000000', '#ffffff')), 21);
  assert.equal(contraste('#777777', '#777777'), 1);
  assert.ok(Math.abs(contraste('#767676', '#ffffff') - 4.54) < 0.01);
});

for (const [nombre, p] of [['oscura', oscura], ['clara', clara]]) {
  const fondos = { fondo: p.fondo, superficie: p.superficie, 'superficie-2': p['superficie-2'] };
  const anotacion = mezcla(p.anotacion, p.superficie, 9); // fondo de las tarjetas de anotación
  const repeticion = mezcla(p.patada, p['superficie-2'], 22); // fondo del sello "Repetición"

  test(`paleta ${nombre}: el texto se lee sobre todos los fondos (4,5:1 o más)`, () => {
    const pares = [];
    for (const [f, color] of Object.entries(fondos)) {
      for (const t of ['texto', 'texto-suave', 'enlace']) pares.push([`${t} sobre ${f}`, p[t], color]);
    }
    // Etiquetas de tipo de jugada, sellos y avisos: texto de color sobre las tarjetas.
    for (const t of ['pase', 'carrera', 'patada', 'penal', 'perdida', 'anotacion', 'pausa', 'acento']) {
      pares.push([`${t} sobre superficie`, p[t], p.superficie], [`${t} sobre superficie-2`, p[t], p['superficie-2']]);
    }
    pares.push(
      ['texto del botón principal', p['acento-texto'], p.acento],
      ['sello "En vivo"', p['vivo-texto'] || '#ffffff', p.vivo],
      ['"+7" del marcador', p.fondo, p.anotacion],
      ['texto sobre tarjeta de anotación', p.texto, anotacion],
      ['texto suave sobre tarjeta de anotación', p['texto-suave'], anotacion],
      ['verde de anotación sobre su tarjeta', p.anotacion, anotacion],
      ['jugada clave sobre tarjeta de anotación', p.penal, anotacion],
      ['enlace sobre tarjeta de anotación', p.enlace, anotacion],
      ['sello "Repetición"', p.texto, repeticion],
    );
    const malos = pares.map(([que, a, b]) => [que, contraste(a, b)]).filter(([, c]) => c < 4.5);
    assert.deepEqual(malos.map(([que, c]) => `${que}: ${c.toFixed(2)}`), []);
  });

  test(`paleta ${nombre}: el borde de foco y los bordes de los botones se distinguen (3:1 o más)`, () => {
    const malos = Object.entries(fondos).map(([f, color]) => [`foco sobre ${f}`, contraste(p.penal, color)]).filter(([, c]) => c < 3);
    assert.deepEqual(malos.map(([que, c]) => `${que}: ${c.toFixed(2)}`), []);
  });
}

test('colores fijos de la cancha, la pizarra y la vista 3D (iguales en los dos temas)', () => {
  const pares = [
    ['números y líneas sobre el pasto oscuro', '#ffffff', oscura.pasto, 3],
    ['números y líneas sobre el pasto claro', '#ffffff', clara.pasto, 3],
    ['rótulo de jugador en la vista 3D', '#ffffff', '#080c16', 4.5],
    ['sello de repetición en la vista 3D', '#ffd43b', '#080c16', 4.5],
    ['cartel de touchdown', '#1a1500', '#ffd43b', 4.5],
    ['fichas O de la pizarra', '#0b1220', '#f4f7ff', 4.5],
    ['fichas X sobre el pasto oscuro', '#ffb3b3', oscura.pasto, 3],
    ['fichas X sobre el pasto claro', '#ffb3b3', clara.pasto, 3],
    ...[['línea de inicio', color('cancha-golpeo')], ['línea a conseguir', color('cancha-marca')], ['trazo de pase', color('pizarra-pase, .pizarra-pase-incompleto')],
      ['trazo de carrera', color('pizarra-carrera, .pizarra-movimiento')], ['trazo de patada', color('pizarra-patada, .pizarra-gol-de-campo')],
      ['cruz de pase incompleto', color('pizarra-cruz')], ['rutas de la defensa', color('ruta-x')]]
      .flatMap(([que, c]) => [[`${que} sobre el pasto oscuro`, c, oscura.pasto, 3], [`${que} sobre el pasto claro`, c, clara.pasto, 3]]),
  ];
  const malos = pares.map(([que, a, b, min]) => [que, contraste(a, b), min]).filter(([, c, min]) => c < min);
  assert.deepEqual(malos.map(([que, c]) => `${que}: ${c.toFixed(2)}`), []);
});
