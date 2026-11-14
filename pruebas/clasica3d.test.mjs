// Pruebas de las jugadas clásicas con jugadores 3D (parte pura): de los pasos de la pizarra a una línea de tiempo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASICAS, estadosDe } from '../js/clasicas.js';
import { lineaDeClasica, AVISO_CLASICA, PAPELES } from '../js/clasica3d.js';
import { muestrear, ANCHO_CANCHA } from '../js/jugada3d.js';

const lineas = CLASICAS.map((j) => [j, lineaDeClasica(j)]);

test('cada jugada clásica tiene su línea de tiempo con 22 jugadores, 11 por bando', () => {
  for (const [j, l] of lineas) {
    assert.ok(l, j.id);
    assert.equal(l.forma, 'clasica');
    assert.equal(l.jugadores.length, 22, j.id);
    assert.equal(l.jugadores.filter((x) => x.bando === 'ataque').length, 11, j.id);
    assert.equal(l.aviso, AVISO_CLASICA);
    assert.ok(l.descripcion.startsWith(j.nombre));
  }
});

test('un tiempo por paso, siempre creciente, y la jugada dura un poco más que el último paso', () => {
  for (const [j, l] of lineas) {
    assert.equal(l.tiempos.length, estadosDe(j).length, j.id);
    for (let i = 1; i < l.tiempos.length; i++) assert.ok(l.tiempos[i] >= l.tiempos[i - 1] + 2, `${j.id}: paso ${i} demasiado corto`);
    assert.ok(l.duracion > l.tiempos.at(-1) && l.duracion < l.tiempos.at(-1) + 3.5, j.id);
  }
});

test('al final de cada paso, cada jugador está donde lo pone la pizarra (mismo orden relativo)', () => {
  for (const [j, l] of lineas) {
    const estados = estadosDe(j);
    estados.forEach((e, i) => {
      const m = muestrear(l, l.tiempos[i]);
      const ids = Object.keys(j.jugadores);
      // Quien está más arriba en la pizarra (menor y) está más adelante en la cancha (mayor x); igual de izquierda a derecha.
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
        const pa = e.posiciones[ids[a]]; const pb = e.posiciones[ids[b]];
        const ja = m.jugadores[a]; const jb = m.jugadores[b];
        if (Math.abs(pa[1] - pb[1]) > 1) assert.equal(Math.sign(pb[1] - pa[1]), Math.sign(ja.x - jb.x), `${j.id} paso ${i}: ${ids[a]} y ${ids[b]} cambiaron de orden a lo largo`);
        if (Math.abs(pa[0] - pb[0]) > 1) assert.equal(Math.sign(pa[0] - pb[0]), Math.sign(ja.z - jb.z), `${j.id} paso ${i}: ${ids[a]} y ${ids[b]} cambiaron de orden a lo ancho`);
      }
    });
  }
});

test('nadie sale de la cancha, nadie corre más rápido de lo creíble y nadie queda encimado al empezar', () => {
  for (const [j, l] of lineas) {
    const inicio = muestrear(l, 0).jugadores;
    for (let a = 0; a < inicio.length; a++) for (let b = a + 1; b < inicio.length; b++) {
      assert.ok(Math.hypot(inicio[a].x - inicio[b].x, inicio[a].z - inicio[b].z) > 0.9, `${j.id}: ${inicio[a].id} y ${inicio[b].id} encimados`);
    }
    for (let t = 0; t <= l.duracion; t += 0.1) {
      for (const e of muestrear(l, t).jugadores) {
        assert.ok(e.x >= -10 && e.x <= 110 && e.z >= -2 && e.z <= ANCHO_CANCHA + 2, `${j.id}: ${e.id} fuera de la cancha en t=${t.toFixed(1)}`);
        assert.ok(e.rapidez <= 11.5, `${j.id}: ${e.id} va a ${e.rapidez.toFixed(1)} yardas por segundo en t=${t.toFixed(1)}`);
      }
    }
  }
});

test('el balón nunca se teletransporta y al final de cada paso está con quien dice la pizarra', () => {
  for (const [j, l] of lineas) {
    let antes = muestrear(l, 0).balon;
    for (let t = 0.05; t <= l.duracion; t += 0.05) {
      const b = muestrear(l, t).balon;
      const salto = Math.hypot(b.x - antes.x, b.z - antes.z);
      assert.ok(salto < 2.6, `${j.id}: el balón salta ${salto.toFixed(1)} yardas en t=${t.toFixed(2)}`);
      antes = b;
    }
    estadosDe(j).forEach((e, i) => {
      const b = muestrear(l, l.tiempos[i] - 0.01).balon; // una centésima antes: en el instante exacto ya arranca el paso siguiente
      if (e.portador) assert.equal(b.portador, e.portador, `${j.id} paso ${i}`);
      else assert.equal(b.portador, '', `${j.id} paso ${i}: el balón debería estar suelto`);
    });
  }
});

test('los pases vuelan en espiral con arco y la patada corta va rastrera', () => {
  const de = (id) => lineas.find(([j]) => j.id === id)[1];
  const vuelos = (l) => l.balon.filter((s) => s.tipo === 'vuelo' && s.alto >= 0.5);
  const hail = vuelos(de('hail-mary')).at(-1);
  assert.equal(hail.giro, 'espiral');
  assert.ok(hail.alto >= 6, 'el Ave María va muy alto');
  assert.ok(Math.abs(hail.a.x - hail.de.x) > 35, 'y recorre más de 35 yardas');
  const corta = de('onside-kick').balon.find((s) => s.tipo === 'vuelo');
  assert.equal(corta.giro, 'tumbo');
  assert.ok(corta.alto <= 1);
  assert.ok(de('onside-kick').eventos.some((e) => e.tipo === 'patada'));
  assert.ok(de('play-action').eventos.some((e) => e.tipo === 'atrapada'));
});

test('el Ave María termina en touchdown dentro de la zona de anotación; las demás no anotan', () => {
  for (const [j, l] of lineas) {
    assert.equal(l.anotacion, j.id === 'hail-mary', j.id);
    assert.equal(l.eventos.some((e) => e.tipo === 'touchdown'), j.id === 'hail-mary', j.id);
  }
  const hail = lineas.find(([j]) => j.id === 'hail-mary')[1];
  assert.ok(muestrear(hail, hail.duracion).balon.x > 100);
  assert.ok(hail.scrimmage > 55 && hail.scrimmage < 66, 'el pase sale desde unas 38 yardas');
});

test('línea de golpeo, marca de las 10 yardas y rótulos de los puestos', () => {
  for (const [j, l] of lineas) {
    if (typeof j.linea === 'number') { assert.equal(typeof l.scrimmage, 'number'); assert.equal(l.tSnap, l.tiempos[0]); } else { assert.equal(l.scrimmage, null); assert.equal(l.tSnap, null); }
    const conLetra = Object.values(j.jugadores).filter((x) => x[3]).length;
    assert.equal(l.rotulos.length, conLetra, j.id);
    for (const r of l.rotulos) { assert.ok(Object.values(PAPELES).includes(r.nombre)); assert.equal(r.numero, ''); }
  }
  const corta = lineas.find(([j]) => j.id === 'onside-kick')[1];
  assert.ok(Math.abs((corta.marca - corta.desde) - 10) < 0.6, `la marca está a 10 yardas del balón (${(corta.marca - corta.desde).toFixed(1)})`);
});

test('datos incompletos no rompen', () => {
  assert.equal(lineaDeClasica({ jugadores: {}, pasos: [] }), null);
  assert.equal(lineaDeClasica(null), null);
});
