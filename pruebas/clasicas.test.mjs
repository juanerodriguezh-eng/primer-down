// Pruebas de las jugadas clásicas de La Pizarra (js/clasicas.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASICAS, LETRAS, estadosDe } from '../js/clasicas.js';
import { existeTermino } from '../js/glosario.js';

test('hay al menos 4 jugadas clásicas, con las cinco de la especificación', () => {
  assert.ok(CLASICAS.length >= 4);
  for (const id of ['play-action', 'screen', 'blitz', 'hail-mary', 'onside-kick']) assert.ok(CLASICAS.some((c) => c.id === id), `falta ${id}`);
  assert.equal(new Set(CLASICAS.map((c) => c.id)).size, CLASICAS.length);
});

for (const jugada of CLASICAS) {
  test(`${jugada.id}: 11 contra 11, pasos completos y todo dentro de la cancha`, () => {
    const lista = Object.values(jugada.jugadores);
    assert.equal(lista.filter((j) => j[2] === 'o').length, 11, 'ataque');
    assert.equal(lista.filter((j) => j[2] === 'x').length, 11, 'defensa');
    for (const j of lista) if (j[3]) assert.ok(LETRAS[j[3]], `letra sin leyenda: ${j[3]}`);
    assert.ok(existeTermino(jugada.concepto), `el concepto ${jugada.concepto} no está en el glosario`);
    assert.ok(jugada.nombre && jugada.resumen.length > 60 && jugada.cuando.length > 40);

    const estados = estadosDe(jugada);
    assert.ok(estados.length >= 4, 'paso a paso: al menos 4 pasos');
    assert.equal(estados[0].movidos.length, 0, 'el primer paso es la formación');
    assert.ok(estados.some((e) => e.vuelo), 'en algún paso el balón viaja por el aire');
    for (const [i, e] of estados.entries()) {
      assert.ok(e.titulo && e.texto.length > 60, `paso ${i + 1} sin explicación suficiente`);
      assert.ok(e.texto.length < 330, `paso ${i + 1} demasiado largo para el celular (${e.texto.length})`);
      assert.ok(Array.isArray(e.balon), `paso ${i + 1} sin balón`);
      for (const [id, [x, y]] of [...Object.entries(e.posiciones), ['balón', e.balon]]) {
        assert.ok(x >= 4 && x <= 96 && y >= 4 && y <= 66, `${id} fuera de la cancha en el paso ${i + 1}: ${x}, ${y}`);
      }
      if (i > 0) assert.ok(e.movidos.length > 0 || e.vuelo, `en el paso ${i + 1} no pasa nada`);
      // Nadie queda encimado con otro jugador (se leería mal en el celular).
      const ps = Object.entries(e.posiciones);
      for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) {
        const d = Math.hypot(ps[a][1][0] - ps[b][1][0], ps[a][1][1] - ps[b][1][1]);
        assert.ok(d >= 3, `${ps[a][0]} y ${ps[b][0]} encimados en el paso ${i + 1} (${d.toFixed(1)})`);
      }
    }
  });
}

test('estadosDe avisa si un paso nombra a un jugador que no existe y aguanta datos vacíos', () => {
  assert.throws(() => estadosDe({ id: 'x', jugadores: { A: [10, 10, 'o'] }, balon: 'A', pasos: [{ titulo: 't', texto: 't', mover: { B: [1, 1] } }] }), /no existe: B/);
  assert.deepEqual(estadosDe(null), []);
  assert.deepEqual(estadosDe({}), []);
});
