// Pruebas de los gráficos de transmisión de la vista 3D (js/graficatv.js) con los partidos guardados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { construirPartido } from '../js/modelo.js';
import { graficaDeTV, textoDeOportunidad } from '../js/graficatv.js';

const carpeta = new URL('../datos/partidos/', import.meta.url);
const leer = (id) => construirPartido(JSON.parse(readFileSync(new URL(`${id}.json`, carpeta), 'utf8')));
const jueves = leer('401873052'); // Commanders 24, Giants 21 (los Giants son locales)
const jugadas = (p) => p.drives.flatMap((d) => d.jugadas);
const buscar = (p, trozo) => jugadas(p).find((j) => (j.explicacion.original || '').includes(trozo));

test('oportunidad: "1.ª y 10", "3.ª y 7", "y gol" y jugadas sin oportunidad', () => {
  assert.equal(textoDeOportunidad({ down: 1, distance: 10, yardLine: 66, team: { id: '28' } }, '19'), '1.ª y 10');
  assert.equal(textoDeOportunidad({ down: 3, distance: 7, yardLine: 40, team: { id: '19' } }, '19'), '3.ª y 7');
  assert.equal(textoDeOportunidad({ down: 3, distance: 7, yardLine: 40, team: { id: '19' } }, '19', true), 'Tercera y 7');
  // El visitante ataca hacia la yarda 0: en la yarda 4 con 4 por avanzar, es "y gol".
  assert.equal(textoDeOportunidad({ down: 1, distance: 4, yardLine: 4, team: { id: '28' } }, '19'), '1.ª y gol');
  // El local ataca hacia la yarda 100.
  assert.equal(textoDeOportunidad({ down: 2, distance: 3, yardLine: 97, team: { id: '19' } }, '19'), '2.ª y gol');
  assert.equal(textoDeOportunidad({ down: 2, distance: 3, yardLine: 60, team: { id: '19' } }, '19'), '2.ª y 3');
  assert.equal(textoDeOportunidad({ down: 0, distance: 0, yardLine: 35 }, '19'), '');
  assert.equal(textoDeOportunidad({ down: -1, distance: 10 }, '19'), '');
  assert.equal(textoDeOportunidad(null, '19'), '');
  assert.equal(textoDeOportunidad({ down: 5, distance: 'x' }, '19'), '');
});

test('marcador de esquina de una jugada real: equipos, cuarto, reloj y oportunidad', () => {
  const j = buscar(jueves, 'J.Daniels pass short right to C.Okonkwo to WAS 40 for 6 yards');
  const g = graficaDeTV(j, jueves);
  assert.equal(g.visitante.abrev, 'WSH');
  assert.equal(g.local.abrev, 'NYG');
  assert.deepEqual([g.visitante.puntos, g.local.puntos], [0, 0]);
  assert.equal(g.visitante.ataca, true);
  assert.equal(g.local.ataca, false);
  assert.equal(g.periodo, '1.º');
  assert.equal(g.reloj, '3:09');
  assert.equal(g.oportunidad, '1.ª y 10');
  assert.equal(g.cambia, false);
  assert.equal(g.descripcion, 'Marcador: Commanders 0, Giants 0. Primer cuarto, 3:09. Primera y 10.');
});

test('en una anotación el marcador empieza con los puntos de antes y termina con los de después', () => {
  const todas = jugadas(jueves);
  const anotaciones = todas.filter((j, i) => i > 0 && (j.marcador.local + j.marcador.visitante) > (todas[i - 1].marcador.local + todas[i - 1].marcador.visitante));
  assert.ok(anotaciones.length >= 6);
  for (const j of anotaciones) {
    const g = graficaDeTV(j, jueves);
    const antes = todas[todas.indexOf(j) - 1].marcador;
    assert.deepEqual([g.local.puntos, g.visitante.puntos], [antes.local, antes.visitante]);
    assert.deepEqual([g.local.puntosDespues, g.visitante.puntosDespues], [j.marcador.local, j.marcador.visitante]);
    assert.equal(g.cambia, true);
  }
  // La última jugada del partido deja el marcador final.
  const ultima = graficaDeTV(todas[todas.length - 1], jueves);
  assert.deepEqual([ultima.visitante.puntosDespues, ultima.local.puntosDespues], [24, 21]);
});

test('datos incompletos no rompen nada', () => {
  assert.equal(graficaDeTV(null, jueves), null);
  assert.equal(graficaDeTV({}, null), null);
  const g = graficaDeTV({ id: 'x', marcador: { local: 7, visitante: 3 } }, { local: { id: '1', nombre: 'Locales' }, visitante: { id: '2', nombre: 'Visitantes' }, drives: [] });
  assert.equal(g.oportunidad, '');
  assert.equal(g.periodo, '');
  assert.equal(g.reloj, '');
  assert.deepEqual([g.local.puntos, g.visitante.puntos], [7, 3]);
  assert.equal(g.local.abrev, 'LOCA');
});

test('barrido de los partidos guardados: el marcador nunca baja y los textos caben en el gráfico', () => {
  let revisadas = 0;
  let conOportunidad = 0;
  for (const archivo of readdirSync(carpeta).filter((a) => /^\d+\.json$/.test(a))) {
    const p = leer(archivo.replace('.json', ''));
    for (const j of jugadas(p)) {
      const g = graficaDeTV(j, p);
      revisadas++;
      assert.ok(g, `sin gráfico en ${archivo} ${j.id}`);
      assert.ok(g.local.puntos <= g.local.puntosDespues && g.visitante.puntos <= g.visitante.puntosDespues, `el marcador baja en ${archivo} ${j.id}`);
      assert.ok(g.local.abrev.length >= 2 && g.local.abrev.length <= 4 && g.visitante.abrev.length >= 2);
      assert.ok(!/undefined|NaN|null/.test(`${g.descripcion} ${g.oportunidad} ${g.periodo} ${g.reloj}`), `texto roto en ${archivo} ${j.id}: ${g.descripcion}`);
      assert.ok(g.oportunidad.length <= 16, `oportunidad larga: ${g.oportunidad}`);
      assert.ok(g.oportunidad === '' || /^[1-4]\.ª y (gol|pulgadas|\d{1,2})$/.test(g.oportunidad), `oportunidad rara: ${g.oportunidad}`);
      if (g.oportunidad) conOportunidad++;
      assert.ok(!(g.local.ataca && g.visitante.ataca));
    }
  }
  assert.ok(revisadas > 2500);
  assert.ok(conOportunidad > 2000, `solo ${conOportunidad} jugadas con oportunidad`);
  console.log(`      ${revisadas} jugadas con gráfico de TV (${conOportunidad} con oportunidad)`);
});
