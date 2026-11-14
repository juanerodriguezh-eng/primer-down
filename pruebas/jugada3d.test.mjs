// Pruebas de la recreación con 22 jugadores (parte pura): formaciones, trayectorias y línea de tiempo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido } from '../js/modelo.js';
import { lineaDeTiempo, muestrear, FORMACIONES, ANCHO_CANCHA, AVISO_RECREACION } from '../js/jugada3d.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'datos', 'partidos');
const leer = (f) => JSON.parse(readFileSync(path.join(CARPETA, f), 'utf8'));
const jueves = construirPartido(leer('401873052.json'));
const todas = (p) => p.drives.flatMap((d) => d.jugadas);
const buscar = (p, re) => todas(p).find((j) => re.test(j.explicacion.original));
const jugador = (linea, papel) => linea.jugadores.find((j) => j.papel === papel);
const fin = (linea) => muestrear(linea, linea.duracion);

test('formaciones: 11 por bando y nadie encimado', () => {
  const juegos = {
    'ataque bajo el centro': FORMACIONES.ataque(false), 'ataque en escopeta': FORMACIONES.ataque(true), defensa: FORMACIONES.defensa(),
    despeje: FORMACIONES.despeje(), 'recibe despeje': FORMACIONES.recibeDespeje(40), 'gol de campo': FORMACIONES.golDeCampo(),
    'defiende gol de campo': FORMACIONES.defiendeGolDeCampo(), patea: FORMACIONES.patea(), 'recibe patada': FORMACIONES.recibePatada(62),
  };
  for (const [nombre, lista] of Object.entries(juegos)) {
    assert.equal(lista.length, 11, nombre);
    for (let i = 0; i < lista.length; i++) {
      assert.ok(Math.abs(lista[i][2]) < ANCHO_CANCHA / 2, `${nombre}: ${lista[i][0]} fuera de la cancha`);
      for (let k = i + 1; k < lista.length; k++) {
        assert.ok(Math.hypot(lista[i][1] - lista[k][1], lista[i][2] - lista[k][2]) >= 1.2, `${nombre}: ${lista[i][0]} y ${lista[k][0]} encimados`);
      }
    }
  }
  // El ataque está detrás del balón y la defensa delante.
  assert.ok(FORMACIONES.ataque(true).every(([, a]) => a < 0));
  assert.ok(FORMACIONES.defensa().every(([, a]) => a > 0));
});

test('pase completo: centro, lanzamiento, atrapada y tacleo donde terminó la jugada', () => {
  const j = buscar(jueves, /J\.McCarthy pass short left to C\.Skattebo to NYG 28 for 3 yards/);
  const linea = lineaDeTiempo(j, jueves.ctx);
  assert.equal(linea.forma, 'pase');
  assert.equal(linea.jugadores.filter((x) => x.bando === 'ataque').length, 11);
  assert.equal(linea.jugadores.filter((x) => x.bando === 'defensa').length, 11);
  assert.deepEqual(linea.eventos.map((e) => e.tipo), ['snap', 'lanzamiento', 'atrapada', 'tacleo']);
  assert.equal(jugador(linea, 'Pasador').nombre, 'J. McCarthy');
  assert.equal(jugador(linea, 'Receptor').nombre, 'C. Skattebo');
  assert.equal(linea.aviso, AVISO_RECREACION);
  // Antes del centro el balón está en la línea de golpeo; al final, donde dicen los datos.
  assert.ok(Math.abs(muestrear(linea, 0).balon.x - j.inicio.yardLine) < 1);
  assert.ok(Math.abs(fin(linea).balon.x - j.fin.yardLine) < 1, 'el balón no termina en end.yardLine');
  assert.equal(fin(linea).balon.portador, jugador(linea, 'Receptor').id);
  // En el aire el balón sube: es un arco, no una línea.
  const lanza = linea.eventos.find((e) => e.tipo === 'lanzamiento').t;
  const atrapa = linea.eventos.find((e) => e.tipo === 'atrapada').t;
  const enVuelo = muestrear(linea, (lanza + atrapa) / 2).balon;
  assert.equal(enVuelo.enAire, true);
  assert.equal(enVuelo.giro, 'espiral');
  assert.ok(enVuelo.y > 1.6);
  // Pase a la izquierda del ataque: los Giants son locales y atacan hacia la derecha, su izquierda es el lado lejano (z menor).
  assert.ok(muestrear(linea, atrapa).balon.z < ANCHO_CANCHA / 2);
});

test('carrera: entrega en mano, el corredor lleva el balón hasta el final y lo taclean', () => {
  const j = buscar(jueves, /C\.Skattebo right guard to NYG 37 for 9 yards/);
  const linea = lineaDeTiempo(j, jueves.ctx);
  assert.equal(linea.forma, 'carrera');
  assert.deepEqual(linea.eventos.map((e) => e.tipo), ['snap', 'entrega', 'tacleo']);
  const corredor = jugador(linea, 'Corredor');
  assert.equal(corredor.nombre, 'C. Skattebo');
  assert.equal(corredor.rol, 'RB');
  const final = fin(linea);
  assert.equal(final.balon.portador, corredor.id);
  assert.ok(Math.abs(final.balon.x - j.fin.yardLine) < 1);
  assert.equal(final.jugadores.find((x) => x.id === corredor.id).gesto, 'caer');
  assert.ok(linea.jugadores.some((x) => x.bando === 'defensa' && x.gestos.some((g) => g.tipo === 'taclear')));
});

test('el visitante ataca hacia la izquierda: la formación queda espejada', () => {
  const j = buscar(jueves, /A\.Ekeler left tackle to WAS 34 for 3 yards/);
  const linea = lineaDeTiempo(j, jueves.ctx);
  assert.equal(linea.sentido, -1);
  const inicio = muestrear(linea, 0);
  const mariscal = linea.jugadores.find((x) => x.rol === 'QB');
  assert.ok(inicio.jugadores.find((x) => x.id === mariscal.id).x > j.inicio.yardLine, 'el mariscal debe estar detrás del balón');
  assert.ok(linea.jugadores.filter((x) => x.bando === 'defensa').every((x) => x.claves[0].x < j.inicio.yardLine));
  assert.ok(fin(linea).balon.x < j.inicio.yardLine);
});

test('captura, pase incompleto, intercepción, despeje, patada de salida, gol de campo y penal', () => {
  const captura = lineaDeTiempo(buscar(jueves, /J\.McCarthy sacked at NYG 25 for -10 yards/), jueves.ctx);
  assert.equal(fin(captura).balon.portador, jugador(captura, 'Pasador').id);
  assert.ok(Math.abs(fin(captura).balon.x - 25) < 1.2);

  const incompleto = lineaDeTiempo(buscar(jueves, /J\.McCarthy pass incomplete short left \[C\.Omenihu\]/), jueves.ctx);
  assert.ok(incompleto.eventos.some((e) => e.tipo === 'incompleto'));
  assert.equal(fin(incompleto).balon.portador, '');
  assert.ok(fin(incompleto).balon.y < 0.5, 'el balón incompleto termina en el suelo');

  const robo = lineaDeTiempo(buscar(jueves, /INTERCEPTED by J\.Holland/), jueves.ctx);
  assert.ok(robo.eventos.some((e) => e.tipo === 'intercepcion'));
  const ladron = robo.jugadores.find((x) => x.id === fin(robo).balon.portador);
  assert.equal(ladron.bando, 'defensa');

  const despeje = lineaDeTiempo(buscar(jueves, /J\.Stout punts 34 yards to WAS 8/), jueves.ctx);
  assert.equal(jugador(despeje, 'Despeja').nombre, 'J. Stout');
  const patada = despeje.eventos.find((e) => e.tipo === 'patada').t;
  assert.ok(muestrear(despeje, patada + 1.2).balon.y > 6, 'el despeje sube alto');
  assert.ok(Math.abs(fin(despeje).balon.x - 92) < 1.5, 'cae en la yarda 8 de Washington');

  const salida = lineaDeTiempo(buscar(jueves, /D\.Stevens kicks 64 yards from WAS 35 to NYG 1/), jueves.ctx);
  assert.equal(salida.scrimmage, null);
  assert.equal(jugador(salida, 'Pateador').nombre, 'D. Stevens');
  assert.equal(jugador(salida, 'Regresa la patada').nombre, 'G. Desrosiers');
  const cae = salida.eventos.find((e) => e.tipo === 'atrapada').t;
  assert.ok(Math.abs(muestrear(salida, cae).balon.x - 1) < 1.5, 'la patada cae en la yarda 1 de los Giants');
  assert.ok(Math.abs(fin(salida).balon.x - 25) < 1.2, 'el regreso termina en la yarda 25');

  const fallado = lineaDeTiempo(buscar(jueves, /D\.Zvada 33 yard field goal is No Good, Wide Left/), jueves.ctx);
  assert.ok(fallado.eventos.some((e) => e.tipo === 'gol-de-campo-fallado'));
  const llega = fallado.eventos.find((e) => e.tipo === 'gol-de-campo-fallado').t;
  assert.ok(Math.abs(muestrear(fallado, llega).balon.z - ANCHO_CANCHA / 2) > 3.2, 'la patada fallada pasa por fuera de los postes');

  const penal = lineaDeTiempo(buscar(jueves, /PENALTY on NYG, Delay of Game, 5 yards, enforced at WAS 37 - No Play/), jueves.ctx);
  assert.equal(penal.forma, 'penal');
  assert.deepEqual(penal.eventos.map((e) => e.tipo), ['bandera']);
  assert.ok(penal.jugadores.every((x) => x.claves.length === 1), 'en un castigo sin jugada nadie se mueve');
});

test('dorsales: el número real se usa si se conoce; un jugador con nombre nunca lleva un número inventado', () => {
  const j = buscar(jueves, /C\.Skattebo right guard to NYG 37 for 9 yards/);
  const sin = lineaDeTiempo(j, jueves.ctx);
  assert.equal(jugador(sin, 'Corredor').numero, '');
  const con = lineaDeTiempo(j, { ...jueves.ctx, dorsales: { [jueves.local.id]: { 'C.Skattebo': '44' } } });
  assert.equal(jugador(con, 'Corredor').numero, '44');
  assert.deepEqual(con.rotulos, [{ jugador: jugador(con, 'Corredor').id, papel: 'Corredor', nombre: 'C. Skattebo', numero: '44' }]);
});

test('pausas y datos incompletos no se recrean y no rompen', () => {
  assert.equal(lineaDeTiempo(buscar(jueves, /^Two-Minute Warning$/), jueves.ctx), null);
  for (const basura of [null, undefined, {}, { explicacion: {} }, { inicio: { yardLine: 'x' } }]) assert.equal(lineaDeTiempo(basura, jueves.ctx), null);
});

test('barrido de los partidos guardados: 22 jugadores, todo dentro de la cancha, velocidades creíbles y el balón termina donde dicen los datos', () => {
  let recreadas = 0; let jugadas = 0; let nombradas = 0;
  const porForma = {};
  for (const f of readdirSync(CARPETA).filter((x) => /^\d+\.json$/.test(x))) {
    const p = construirPartido(leer(f));
    for (const j of todas(p)) {
      jugadas++;
      const linea = lineaDeTiempo(j, p.ctx);
      if (!linea) continue;
      recreadas++;
      porForma[linea.forma] = (porForma[linea.forma] || 0) + 1;
      const donde = `${f} ${j.id} (${linea.forma}): ${j.explicacion.original.slice(0, 90)}`;
      assert.equal(linea.jugadores.length, 22, donde);
      assert.equal(linea.jugadores.filter((x) => x.bando === 'ataque').length, 11, donde);
      assert.ok(linea.duracion >= 2 && linea.duracion <= 16, `duración ${linea.duracion}: ${donde}`);
      assert.ok(linea.balon.length >= 1, donde);
      if (linea.rotulos.length) nombradas++;
      for (const r of linea.rotulos) assert.ok(j.explicacion.original.includes(r.nombre.replace('. ', '.')), `rótulo "${r.nombre}" que no está en el texto: ${donde}`);
      for (const x of linea.jugadores) {
        for (let i = 0; i < x.claves.length; i++) {
          const c = x.claves[i];
          assert.ok(Number.isFinite(c.t) && Number.isFinite(c.x) && Number.isFinite(c.z), `${x.rol} con coordenadas inválidas: ${donde}`);
          assert.ok(c.x >= -10 && c.x <= 110 && c.z >= -2 && c.z <= ANCHO_CANCHA + 2, `${x.rol} fuera de la cancha (${c.x}, ${c.z}): ${donde}`);
          if (i) {
            assert.ok(c.t > x.claves[i - 1].t, `${x.rol} con tiempos desordenados: ${donde}`);
            const v = Math.hypot(c.x - x.claves[i - 1].x, c.z - x.claves[i - 1].z) / (c.t - x.claves[i - 1].t);
            assert.ok(v <= 11.5, `${x.rol} va a ${v.toFixed(1)} yardas por segundo: ${donde}`);
          }
        }
      }
      for (const t of [0, linea.duracion * 0.33, linea.duracion * 0.66, linea.duracion]) {
        const m = muestrear(linea, t);
        assert.ok([m.balon.x, m.balon.y, m.balon.z].every(Number.isFinite), `balón inválido en t=${t}: ${donde}`);
        assert.ok(m.balon.y >= 0 && m.balon.y < 40, `balón a ${m.balon.y} de altura: ${donde}`);
        assert.ok(m.jugadores.every((x) => Number.isFinite(x.x) && Number.isFinite(x.z) && Number.isFinite(x.rumbo)), donde);
      }
      // Al empezar nadie está encimado.
      const m0 = muestrear(linea, 0).jugadores;
      for (let i = 0; i < m0.length; i++) for (let k = i + 1; k < m0.length; k++) {
        assert.ok(Math.hypot(m0[i].x - m0[k].x, m0[i].z - m0[k].z) > 0.9, `jugadores encimados al empezar: ${donde}`);
      }
      // El balón termina en end.yardLine (salvo pases incompletos y goles de campo, donde ese dato no es el destino del balón).
      if (!['pase-incompleto', 'gol-de-campo'].includes(linea.forma)) {
        const final = muestrear(linea, linea.duracion).balon;
        const esperado = Math.max(-9.6, Math.min(109.6, linea.hasta));
        const tolerancia = linea.anotacion ? 6 : 1.6; // en una anotación el jugador sigue corriendo dentro de la zona
        assert.ok(Math.abs(final.x - esperado) <= tolerancia, `el balón termina en ${final.x.toFixed(1)} y debía terminar en ${esperado}: ${donde}`);
      }
    }
  }
  console.log(`    ${recreadas} de ${jugadas} jugadas recreadas con 22 jugadores (${nombradas} con protagonistas rotulados): ${JSON.stringify(porForma)}`);
  assert.ok(recreadas > 2300);
  assert.ok(nombradas / recreadas > 0.9);
});
