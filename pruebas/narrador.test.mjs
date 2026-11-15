// Pruebas del narrador (parte pura): el relato de cada jugada, la elección de voz y la sincronización.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirPartido } from '../js/modelo.js';
import { lineaDeTiempo } from '../js/jugada3d.js';
import { relatoDeJugada, elegirVoz, crearNarrador, apellido } from '../js/narrador.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'datos', 'partidos');
const leer = (f) => construirPartido(JSON.parse(readFileSync(path.join(CARPETA, f), 'utf8')));
const jueves = leer('401873052.json');
const todas = (p) => p.drives.flatMap((d) => d.jugadas);
const ctxDe = (p) => ({ local: { ...p.ctx.local }, visitante: { ...p.ctx.visitante }, dorsales: p.dorsales });
const relato = (p, re) => {
  const j = todas(p).find((x) => re.test(x.explicacion.original));
  assert.ok(j, `no encontré la jugada ${re}`);
  const linea = lineaDeTiempo(j, ctxDe(p));
  return { j, linea, frases: relatoDeJugada(j, linea, p) };
};
const texto = (frases) => frases.map((f) => f.texto).join(' ');

test('pase de touchdown: lanzamiento, atrapada, touchdown y marcador, con apellido y número reales', () => {
  const { frases, linea } = relato(jueves, /J\.Daniels pass short middle to B\.Sinnott for 1 yard, TOUCHDOWN/);
  assert.equal(frases.length, 4);
  assert.deepEqual(frases.map((f) => f.momento), ['accion', 'recepcion', 'resultado', 'marcador']);
  assert.match(frases[0].texto, /Daniels, el 5/);
  assert.match(frases[1].texto, /Sinnott, el 82/);
  assert.match(frases[2].texto, /Touchdown/i);
  assert.equal(frases[3].texto, 'Commanders 10, Giants 7.');
  // Cada frase va en su momento: el lanzamiento antes de que salga el balón y el touchdown cuando ocurre.
  const t = (tipo) => linea.eventos.find((e) => e.tipo === tipo).t;
  assert.ok(frases[0].t < t('lanzamiento'));
  assert.ok(Math.abs(frases[1].t - t('atrapada')) < 0.01);
  assert.ok(Math.abs(frases[2].t - t('touchdown')) < 0.01);
});

test('carrera: oportunidad, quién corre, yardas reales y primer down', () => {
  const { frases } = relato(jueves, /C\.Skattebo right guard to NYG 37 for 9 yards/);
  assert.equal(frases.length, 3);
  assert.match(frases[0].texto, /Segunda y 7/);
  assert.match(frases[1].texto, /Skattebo, el 44/);
  assert.match(frases[2].texto, /9 yardas/);
  assert.match(frases[2].texto, /primer down/i);
});

test('pase incompleto, captura, intercepción, despeje y gol de campo dicen lo que pasó', () => {
  assert.match(texto(relato(jueves, /J\.McCarthy pass incomplete short right to M\.Nabers/).frases), /Incompleto\. (Iba para|Buscaba a) Nabers, el 1\./);
  assert.match(texto(relato(jueves, /INTERCEPTED by J\.Holland/).frases), /Intercep.*El balón pasa a los Giants\./);
  const despeje = relato(jueves, /T\.Way punts 40 yards/).frases;
  assert.match(despeje[0].texto, /^Cuarta y 8\./);
  assert.match(texto(despeje), /Way, el 10\. .*40 yardas/);
  assert.match(texto(relato(jueves, /J\.Daniels kneels/).frases), /Daniels (pone la rodilla|se arrodilla)/);
  const cowboys = leer('401873040.json');
  assert.match(texto(relato(cowboys, /S\.Shrader 47 yard field goal is GOOD/).frases), /gol de campo.*Colts, de 47 yardas\..*Shrader, el 3\..*(bueno|postes)/i);
  const chiefs = leer('401873045.json');
  assert.match(texto(relato(chiefs, /G\.Smith sacked at KC 26 for -6 yards/).frases), /(capturan|Captura).*Pierden 6 yardas\./);
  // Jugada anulada por penal: el relato no la da por buena.
  assert.match(texto(relato(cowboys, /D\.Prescott pass short right to R\.Flournoy.*No Play/).frases), /(no cuenta|anulada)/);
});

test('el relato varía: la misma clase de jugada no suena siempre igual, pero la misma jugada sí', () => {
  const pases = todas(jueves).filter((j) => j.explicacion.accion === 'pase-completo');
  const aperturas = new Set();
  for (const j of pases) {
    const linea = lineaDeTiempo(j, ctxDe(jueves));
    const frases = relatoDeJugada(j, linea, jueves);
    const accion = frases.find((f) => f.momento === 'accion');
    if (accion) aperturas.add(accion.texto.replace(/[A-Z][\w'’. -]*?, el \d+,?/g, 'X').replace(/(a la izquierda|a la derecha|por el centro)/, 'L'));
    assert.deepEqual(relatoDeJugada(j, linea, jueves), frases);
  }
  assert.ok(aperturas.size >= 3, `solo ${aperturas.size} formas de contar un pase`);
});

test('barrido de los 16 partidos: de 2 a 4 frases cortas, en orden, y sin nombres ni números inventados', () => {
  let jugadas = 0; let frasesTotales = 0;
  for (const f of readdirSync(CARPETA).filter((x) => /^\d+\.json$/.test(x))) {
    const p = leer(f);
    const ctx = ctxDe(p);
    for (const j of todas(p)) {
      const linea = lineaDeTiempo(j, ctx);
      if (!linea) { assert.deepEqual(relatoDeJugada(j, linea, p), []); continue; }
      const frases = relatoDeJugada(j, linea, p);
      const donde = `${f} · ${j.explicacion.original}`;
      jugadas++; frasesTotales += frases.length;
      assert.ok(frases.length >= 2 && frases.length <= 4, `${frases.length} frases en ${donde}`);
      const original = j.explicacion.original;
      const reales = new Set(linea.rotulos.map((r) => r.numero).filter(Boolean));
      for (let i = 0; i < frases.length; i++) {
        const fr = frases[i];
        assert.ok(fr.t >= 0 && fr.t <= linea.duracion, `tiempo fuera de la jugada en ${donde}`);
        assert.ok(i === 0 || fr.t >= frases[i - 1].t, `frases desordenadas en ${donde}`);
        assert.ok(fr.texto.length >= 8 && fr.texto.length <= 150, `frase de ${fr.texto.length} caracteres en ${donde}: ${fr.texto}`);
        assert.doesNotMatch(fr.texto, /undefined|null|NaN|\u0001| {2}| ,|,,|\.\.\.\./, `texto raro en ${donde}: ${fr.texto}`);
        // Todo dorsal dicho es uno real de la jugada, y todo apellido dicho con dorsal está en el texto de ESPN.
        for (const m of fr.texto.matchAll(/([A-Z][\w'’. -]*?), el (\d+)/g)) {
          assert.ok(reales.has(m[2]), `dorsal ${m[2]} inventado en ${donde}`);
          const ap = m[1].split(' ').pop();
          assert.ok(original.includes(ap), `apellido ${ap} no está en el texto: ${donde}`);
        }
      }
      // Si la jugada anotó touchdown para el ataque, el relato lo canta; si no hubo, no lo inventa.
      const dice = /touchdown/i.test(texto(frases));
      if (dice) assert.ok(/TOUCHDOWN/.test(original), `touchdown inventado en ${donde}`);
    }
  }
  assert.ok(jugadas > 2000, `solo ${jugadas} jugadas narradas`);
  console.log(`      ${jugadas} jugadas narradas, ${frasesTotales} frases (${(frasesTotales / jugadas).toFixed(1)} por jugada)`);
});

test('apellido: quita la inicial y respeta los compuestos', () => {
  assert.equal(apellido('B. Sinnott'), 'Sinnott');
  assert.equal(apellido('Mi. Wilson'), 'Wilson');
  assert.equal(apellido('A. St. Brown'), 'St. Brown');
  assert.equal(apellido(''), '');
});

test('elegir voz: prefiere es-MX, es-US o es-419; acepta cualquier español; sin español no hay voz', () => {
  const v = (lang, name = lang, localService = true) => ({ lang, name, localService });
  assert.equal(elegirVoz([v('en-US'), v('es-ES'), v('es-US'), v('es-MX')]).lang, 'es-MX');
  assert.equal(elegirVoz([v('en-US'), v('es-ES'), v('es-419'), v('es_US')]).lang, 'es_US');
  assert.equal(elegirVoz([v('es-ES'), v('es-419')]).lang, 'es-419');
  assert.equal(elegirVoz([v('pt-BR'), v('es-AR')]).lang, 'es-AR');
  assert.equal(elegirVoz([v('es-MX', 'remota', false), v('es-MX', 'local', true)]).name, 'local');
  assert.equal(elegirVoz([v('en-US'), v('est-EE'), v('eo')]), null);
  assert.equal(elegirVoz([]), null);
  assert.equal(elegirVoz(undefined), null);
});

// Voz falsa: anota lo que se dice y deja terminar cada frase a mano.
function vozFalsa(voces = [{ lang: 'es-MX', name: 'Paulina', localService: true }]) {
  const dichas = []; let actual = null; let cancelaciones = 0;
  const sintesis = {
    getVoices: () => voces,
    speak(u) { dichas.push(u.text); actual = u; },
    cancel() { cancelaciones++; actual = null; },
  };
  class Enunciado { constructor(text) { this.text = text; } }
  const guardado = new Map();
  const memoria = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, v) };
  return { sintesis, Enunciado, memoria, dichas, terminar: () => { const u = actual; actual = null; u?.onend?.(); }, cancelaciones: () => cancelaciones, guardado };
}
const FRASES = [{ t: 0.2, momento: 'snap', texto: 'Primera y 10.' }, { t: 2, momento: 'accion', texto: 'Lanza Daniels...' }, { t: 3.3, momento: 'recepcion', texto: '¡La atrapa Sinnott!' }, { t: 3.6, momento: 'resultado', texto: '¡Touchdown!' }];

test('narrador: apagado por defecto, recuerda la elección y solo existe si hay voz en español', () => {
  const f = vozFalsa();
  const n = crearNarrador(f);
  assert.equal(n.disponible(), true);
  assert.equal(n.encendido(), false);
  n.cargar(FRASES); n.avanzar(5);
  assert.deepEqual(f.dichas, []); // apagado: no dice nada
  n.encender(true);
  assert.equal(f.guardado.get('primerdown-narrador'), '1');
  assert.equal(crearNarrador(f).encendido(), true); // otra visita: sigue encendido
  n.encender(false);
  assert.equal(crearNarrador(f).encendido(), false);

  const sinVoz = crearNarrador(vozFalsa([{ lang: 'en-US', name: 'Sam' }]));
  assert.equal(sinVoz.disponible(), false);
  sinVoz.encender(true);
  assert.equal(sinVoz.encendido(), false);
});

test('narrador: dice cada frase cuando el reloj de la animación llega a su momento, sin encimarlas', () => {
  const f = vozFalsa();
  const n = crearNarrador(f);
  n.encender(true);
  n.cargar(FRASES);
  n.avanzar(0.1);
  assert.deepEqual(f.dichas, []);
  n.avanzar(0.25);
  assert.deepEqual(f.dichas, ['Primera y 10.']);
  n.avanzar(1.9); f.terminar();
  n.avanzar(2.05);
  assert.deepEqual(f.dichas, ['Primera y 10.', 'Lanza Daniels...']);
  // Dos frases llegan mientras todavía habla: espera a terminar y dice la más reciente (el resultado).
  n.avanzar(3.4); n.avanzar(3.7);
  assert.equal(f.dichas.length, 2);
  assert.equal(n.ocupado(), true);
  f.terminar();
  assert.deepEqual(f.dichas, ['Primera y 10.', 'Lanza Daniels...', '¡Touchdown!']);
  f.terminar();
  assert.equal(n.ocupado(), false);
  // En cámara lenta el reloj avanza más despacio y alcanza para decirlas todas.
  f.dichas.length = 0;
  n.cargar(FRASES);
  for (let t = 0; t <= 4.001; t += 0.05) { n.avanzar(t); f.terminar(); }
  assert.deepEqual(f.dichas, FRASES.map((x) => x.texto));
});

test('narrador: se calla al cambiar de jugada, al pausar y al apagarlo; al continuar no repite lo ya dicho', () => {
  const f = vozFalsa();
  const n = crearNarrador(f);
  n.encender(true);
  n.cargar(FRASES); n.avanzar(0.3);
  const antes = f.cancelaciones();
  n.cargar([{ t: 0, momento: 'snap', texto: 'Otra jugada.' }]); // cambia de jugada
  assert.ok(f.cancelaciones() > antes);
  assert.equal(n.ocupado(), false);
  n.avanzar(0.1);
  assert.equal(f.dichas.at(-1), 'Otra jugada.');

  f.dichas.length = 0;
  n.cargar(FRASES); n.avanzar(0.3);
  n.pausar();
  assert.equal(n.ocupado(), false);
  n.avanzar(2.5); // en pausa no habla
  assert.equal(f.dichas.filter((x) => x === 'Lanza Daniels...').length, 0);
  n.continuar(); n.avanzar(2.5);
  assert.equal(f.dichas.at(-1), 'Lanza Daniels...');
  assert.equal(f.dichas.filter((x) => x === 'Primera y 10.').length, 1);

  n.encender(false);
  assert.equal(n.ocupado(), false);
  n.avanzar(9);
  assert.equal(f.dichas.at(-1), 'Lanza Daniels...');
});

test('narrador: si la voz del navegador falla o no existe, nada se rompe', () => {
  const rota = vozFalsa();
  rota.sintesis.speak = () => { throw new Error('sin audio'); };
  rota.sintesis.cancel = () => { throw new Error('sin audio'); };
  const n = crearNarrador(rota);
  n.encender(true); n.cargar(FRASES);
  assert.doesNotThrow(() => { n.avanzar(5); n.callar(); n.pausar(); n.continuar(); n.cargar([]); });
  assert.equal(n.ocupado(), false);

  const nada = crearNarrador();
  assert.equal(nada.disponible(), false);
  assert.doesNotThrow(() => { nada.encender(true); nada.cargar(FRASES); nada.avanzar(3); nada.callar(); });
  const sinVoces = crearNarrador({ sintesis: { getVoices() { throw new Error('x'); } }, Enunciado: class {}, memoria: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } });
  assert.equal(sinVoces.disponible(), false);

  // Las voces pueden llegar después de cargar la página: el narrador avisa cuando aparece una en español.
  const tardia = vozFalsa([]);
  let alCambiar = null;
  tardia.sintesis.addEventListener = (tipo, f) => { if (tipo === 'voiceschanged') alCambiar = f; };
  const n2 = crearNarrador(tardia);
  let avisos = 0;
  n2.alCambiar(() => avisos++);
  assert.equal(n2.disponible(), false);
  tardia.sintesis.getVoices = () => [{ lang: 'es-US', name: 'Paulina' }];
  alCambiar();
  assert.equal(n2.disponible(), true);
  assert.ok(avisos >= 1);
});
