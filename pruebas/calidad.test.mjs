// Pruebas de la calidad automática de la vista 3D (js/calidad.js): cuándo se apagan los efectos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMedidorDeCalidad, NIVELES, nivelPorNombre } from '../js/calidad.js';

const correr = (m, cuadros, dtMs) => { const cambios = []; for (let i = 0; i < cuadros; i++) { const n = m.cuadro(dtMs); if (n !== null) cambios.push(n); } return cambios; };

test('a 60 cuadros por segundo la calidad se queda en alta', () => {
  const m = crearMedidorDeCalidad();
  assert.deepEqual(correr(m, 2000, 1000 / 60), []);
  assert.equal(m.nombre, 'alta');
});

test('a 45 cuadros por segundo (arriba del umbral de 40) tampoco baja', () => {
  const m = crearMedidorDeCalidad();
  assert.deepEqual(correr(m, 1000, 1000 / 45), []);
});

test('a 30 cuadros por segundo baja a media en menos de 2 segundos, y si sigue lento, a baja', () => {
  const m = crearMedidorDeCalidad();
  const dt = 1000 / 30;
  let cuadros = 0;
  while (m.cuadro(dt) === null) cuadros++;
  assert.equal(m.nombre, 'media');
  assert.ok(cuadros * dt < 2000, `tardó ${Math.round(cuadros * dt)} ms en bajar`);
  assert.deepEqual(correr(m, 200, dt), [0]);
  assert.equal(m.nombre, 'baja');
  // En baja ya no hay nada más que apagar.
  assert.deepEqual(correr(m, 500, 200), []);
});

test('si al bajar a media recupera la fluidez, se queda en media y no vuelve a subir', () => {
  const m = crearMedidorDeCalidad();
  while (m.cuadro(1000 / 25) === null) { /* lento hasta que baja */ }
  assert.equal(m.nombre, 'media');
  assert.deepEqual(correr(m, 3000, 1000 / 60), []);
  assert.equal(m.nombre, 'media');
});

test('una pausa (pestaña oculta) no cuenta como lentitud', () => {
  const m = crearMedidorDeCalidad();
  for (let i = 0; i < 300; i++) { m.cuadro(1000 / 60); if (i % 20 === 0) m.cuadro(5000); }
  assert.equal(m.nombre, 'alta');
  m.pausa();
  assert.deepEqual(correr(m, 3, 240), []);
});

test('los primeros cuadros (compilación de sombreadores) no cuentan', () => {
  const m = crearMedidorDeCalidad();
  assert.deepEqual(correr(m, 10, 200), []);
  assert.deepEqual(correr(m, 1000, 16), []);
  assert.equal(m.nombre, 'alta');
});

test('calidad fija: no cambia aunque vaya lento; y los nombres de nivel', () => {
  const m = crearMedidorDeCalidad({ nivel: 2, fija: true });
  assert.deepEqual(correr(m, 500, 100), []);
  assert.equal(m.nombre, 'alta');
  assert.deepEqual(NIVELES, ['baja', 'media', 'alta']);
  assert.equal(nivelPorNombre('Media'), 1);
  assert.equal(nivelPorNombre('ultra'), null);
  assert.equal(crearMedidorDeCalidad({ nivel: 9 }).nombre, 'alta');
  assert.equal(crearMedidorDeCalidad({ nivel: 0 }).cuadro(500), null);
});
