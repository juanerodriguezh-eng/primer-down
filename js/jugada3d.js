// Recreación de una jugada con 22 jugadores: formaciones, trayectorias y línea de tiempo.
// Parte PURA (sin DOM, sin Three.js): la consume el render 3D (js/vista3d.js) y se prueba con node --test.
//
// Qué es real y qué es ilustrado:
//   Real (viene de ESPN): dónde empieza y dónde termina la jugada, quién ataca, el tipo de jugada, los nombres
//   del texto (pasador, receptor, corredor, pateador), el lado del pase o de la carrera, si fue en escopeta,
//   las yardas de la patada y el resultado.
//   Ilustrado: la posición y el recorrido de cada jugador (ESPN no los entrega). Las formaciones son las típicas.
//
// Unidades: yardas y segundos. X = yardLine de los datos (0 = zona de anotación del local, 100 = la del visitante;
// las zonas llegan a -10 y 110). Z = ancho de la cancha (0 a 53,33). Y = altura.
// Por dentro se trabaja en coordenadas relativas a la jugada: a = yardas hacia adelante desde donde se pone el
// balón (negativo = detrás) y l = yardas hacia la derecha del ataque desde el centro de la cancha.
import { analizarTexto, nombreJugador } from './motor.js';
import { trazoDeJugada } from './pizarra.js';

export const ANCHO_CANCHA = 160 / 3;
const MEDIO = ANCHO_CANCHA / 2;
const T_SNAP = 0.9; // segundos de formación quieta antes del centro
export const AVISO_RECREACION = 'Recreación ilustrada: ESPN no entrega la posición de cada jugador.';

const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a0, l0, a1, l1) => Math.hypot(a1 - a0, l1 - l0);

// ---------------------------------------------------------------------------
// Formaciones: [rol, a, l, número típico del puesto]. Los números son de adorno salvo que haya dorsales reales.
// ---------------------------------------------------------------------------

export const FORMACIONES = {
  ataque: (escopeta) => [
    ['C', -0.5, 0, 61], ['LG', -0.7, -1.6, 66], ['RG', -0.7, 1.6, 71], ['LT', -0.95, -3.2, 77], ['RT', -0.95, 3.2, 74],
    ['TE', -0.9, 4.9, 87], ['WR', -0.6, -19, 11], ['WR', -1.5, 18, 81], ['WR', -1.5, -10.5, 17],
    ['QB', escopeta ? -5 : -1.7, 0, 9], ['RB', escopeta ? -5.2 : -6.6, escopeta ? 2.2 : 0, 26],
  ],
  defensa: () => [
    ['DE', 0.95, -4.6, 91], ['DT', 0.95, -1.5, 97], ['DT', 0.95, 1.5, 93], ['DE', 0.95, 5.6, 99],
    ['LB', 4.3, -4.8, 54], ['LB', 4.6, 0.2, 52], ['LB', 4.3, 5, 58],
    ['CB', 6.5, -18.4, 21], ['CB', 6.5, 17.4, 24], ['S', 8, -10, 31], ['S', 13.5, 3, 33],
  ],
  despeje: () => [
    ['C', -0.5, 0, 46], ['LG', -0.7, -1.6, 66], ['RG', -0.7, 1.6, 71], ['LT', -0.95, -3.2, 77], ['RT', -0.95, 3.2, 74],
    ['ALA', -1.8, -4.9, 44], ['ALA', -1.8, 4.9, 45], ['GUN', -0.6, -20, 18], ['GUN', -0.6, 20, 23],
    ['PRO', -6, 1.6, 36], ['P', -14, 0, 6],
  ],
  // El que recibe el despeje (índice 10) se coloca donde va a caer el balón.
  recibeDespeje: (cae) => [
    ['DE', 0.95, -4.4, 91], ['DT', 0.95, -1.5, 97], ['DT', 0.95, 1.5, 93], ['DE', 0.95, 4.4, 99], ['LB', 1.2, -6.8, 54], ['LB', 1.2, 6.8, 58],
    ['CB', 1.6, -19.4, 21], ['CB', 1.6, 19.4, 24], ['LB', 7, -3, 52], ['S', 12, 4, 31], ['RET', cae, 0, 13],
  ],
  golDeCampo: () => [
    ['C', -0.5, 0, 46], ['LG', -0.6, -1.5, 66], ['RG', -0.6, 1.5, 71], ['LT', -0.7, -3, 77], ['RT', -0.7, 3, 74],
    ['TE', -0.8, -4.5, 87], ['TE', -0.8, 4.5, 85], ['ALA', -1.6, -6, 44], ['ALA', -1.6, 6, 45],
    ['H', -7.6, 0.5, 6], ['K', -9.6, -2.2, 3],
  ],
  defiendeGolDeCampo: () => [
    ['DT', 0.9, -0.8, 97], ['DT', 0.9, 0.8, 93], ['DE', 0.9, -2.4, 91], ['DE', 0.9, 2.4, 99], ['LB', 0.9, -4, 54], ['LB', 0.9, 4, 58],
    ['LB', 1, -5.8, 52], ['S', 1, 5.8, 31], ['CB', 1.4, -8, 21], ['CB', 1.4, 8, 24], ['S', 14, 0, 33],
  ],
  // Patada de salida: 5 a cada lado del balón y el pateador atrás.
  patea: () => [
    ['K', -7, -2, 3],
    ...[-22, -17.5, -13, -8.5, -4, 4, 8.5, 13, 17.5, 22].map((l, i) => ['COB', -1, l, [38, 42, 47, 51, 55, 56, 50, 43, 35, 29][i]]),
  ],
  // Quien recibe la patada de salida: una línea adelante, otra en medio y dos al fondo (índices 9 y 10).
  recibePatada: (cae) => [
    ...[-20, -10, 0, 10, 20].map((l, i) => ['BLQ', 12, l, [80, 84, 45, 86, 82][i]]),
    ...[-14, 0, 14].map((l, i) => ['BLQ', Math.min(27, cae - 12), l, [40, 48, 41][i]]),
    ['BLQ', Math.min(42, cae - 6), 3, 34],
    ['RET', cae, -5, 13], ['RET', cae - 1, 6, 22],
  ],
};

const HUECOS = [[/left end/i, -9], [/left tackle/i, -4.2], [/left guard/i, -1.8], [/right end/i, 9], [/right tackle/i, 4.2], [/right guard/i, 1.8], [/middle/i, 0.4]];

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------

// Devuelve null si la jugada no se puede recrear (pausas, jugadas sin posición).
// ctx: { local: { id, nombre, color, colorAlterno }, visitante: { ... }, dorsales?: { [idEquipo]: { 'J.McCarthy': '9' } } }
export function lineaDeTiempo(jugada, ctx) {
  const trazo = trazoDeJugada(jugada, ctx);
  if (!trazo) return null;
  const e = jugada.explicacion || {};
  const h = analizarTexto(e.original || '') || {};
  const sentido = trazo.haciaDerecha ? 1 : -1;
  const origen = trazo.desde;
  const localId = String(ctx?.local?.id ?? '');
  const ataca = trazo.haciaDerecha ? 'local' : 'visitante';
  const defiende = trazo.haciaDerecha ? 'visitante' : 'local';
  const avance = sentido * (trazo.hasta - trazo.desde); // yardas hacia adelante hasta donde terminó el balón
  const alGol = trazo.haciaDerecha ? 100 - origen : origen; // yardas hasta la línea de gol que se ataca
  const aMin = -(100 - alGol) - 9; // fondo de la zona propia
  const aMax = alGol + 9; // fondo de la zona rival

  const jugadores = [];
  const tramos = []; // tramos del balón, en orden
  const eventos = [];
  const rotulos = [];

  const poner = (bando, lista) => lista.map(([rol, a, l, numero]) => {
    const j = { id: `${bando === 'ataque' ? 'a' : 'd'}${jugadores.length}`, bando, rol, numero: String(numero), nombre: '', papel: '', claves: [[0, limitar(a, aMin, aMax), l, '']], gestos: [] };
    jugadores.push(j);
    return j;
  });
  // Posición (relativa) de un jugador en el instante t.
  const donde = (j, t) => {
    const c = j.claves;
    if (t <= c[0][0]) return [c[0][1], c[0][2]];
    for (let i = 1; i < c.length; i++) {
      if (t <= c[i][0]) {
        const u = (t - c[i - 1][0]) / ((c[i][0] - c[i - 1][0]) || 1);
        return [c[i - 1][1] + (c[i][1] - c[i - 1][1]) * u, c[i - 1][2] + (c[i][2] - c[i - 1][2]) * u];
      }
    }
    return [c[c.length - 1][1], c[c.length - 1][2]];
  };
  // Agrega un punto al recorrido. Si ya había puntos después de t, los descarta (el jugador cambia de plan).
  const ir = (j, t, a, l, modo = '') => {
    const ultimo = j.claves[j.claves.length - 1];
    if (t <= ultimo[0] + 1e-6) {
      const [a0, l0] = donde(j, t);
      j.claves = j.claves.filter((c) => c[0] < t - 1e-6);
      if (!j.claves.length) j.claves.push([0, a0, l0, '']);
      if (t <= 1e-6) { j.claves[0] = [0, a, l, '']; return j; }
    }
    j.claves.push([t, limitar(a, aMin, aMax), limitar(l, -MEDIO - 1.5, MEDIO + 1.5), modo]);
    return j;
  };
  const quieto = (j, t) => { const [a, l] = donde(j, t); return ir(j, t, a, l); };
  // Corre hacia un punto sin pasar de su velocidad máxima; se detiene a `margen` yardas.
  const perseguir = (j, t0, t1, a, l, vmax = 7.5, margen = 0) => {
    if (t1 <= t0) return j;
    quieto(j, t0);
    const [a0, l0] = donde(j, t0);
    const d = dist(a0, l0, a, l);
    const alcance = Math.min(Math.max(0, d - margen), vmax * (t1 - t0));
    const f = d > 0.01 ? alcance / d : 0;
    return ir(j, t1, a0 + (a - a0) * f, l0 + (l - l0) * f);
  };
  const gesto = (j, t, tipo, dura = 0.6) => { j.gestos.push({ t, tipo, dura }); return j; };
  const llevar = (t0, t1, j) => tramos.push({ t0, t1, tipo: 'llevado', quien: j.id });
  const volar = (t0, t1, de, a, alto, giro = 'espiral') => tramos.push({ t0, t1, tipo: 'vuelo', de, a, alto, giro });
  const dejar = (t0, t1, en) => tramos.push({ t0, t1, tipo: 'quieto', en });
  const evento = (t, tipo, extra = {}) => eventos.push({ t, tipo, ...extra });
  const dorsal = (lado, nombre) => {
    const mapa = ctx?.dorsales?.[String(ctx?.[lado]?.id ?? '')];
    const clave = String(nombre ?? '').replace(/\s+/g, '').replace(/,?(Jr|Sr|II|III|IV|V)\.?$/i, ''); // igual que claveDorsal de modelo.js
    return (clave && mapa && mapa[clave] != null) ? String(mapa[clave]) : (nombre && mapa && mapa[nombre] != null ? String(mapa[nombre]) : null);
  };
  // Marca a un jugador como protagonista. Su número solo se muestra si es el real; si no se conoce, va sin número.
  const nombrar = (j, crudo, papel) => {
    if (!j || !crudo) return j;
    // Solo vale algo con forma de nombre de la liga ("J.Daniels", "Mi.Wilson", "M.Penix Jr."); si el texto vino
    // mal recortado (pasa en algunos balones sueltos), se queda con el nombre del principio o sin rótulo.
    const limpio = /^[A-Z][A-Za-z]{0,2}\.\s?(?:St\.\s?)?[A-Z][A-Za-z'’-]+(?: (?:Jr|Sr|II|III|IV)\.?)?/.exec(String(crudo).trim());
    if (!limpio) return j;
    crudo = limpio[0];
    j.nombre = nombreJugador(crudo) || crudo;
    j.papel = papel;
    j.numero = dorsal(j.bando === 'ataque' ? ataca : defiende, crudo) ?? '';
    rotulos.push({ jugador: j.id, papel, nombre: j.nombre, numero: j.numero });
    return j;
  };
  const elMasCercano = (lista, t, a, l) => lista.reduce((mejor, j) => {
    const [ja, jl] = donde(j, t);
    const d = dist(ja, jl, a, l);
    return !mejor || d < mejor.d ? { j, d } : mejor;
  }, null)?.j;

  let duracion = 4;
  let tSnap = T_SNAP;
  let lineaDeGolpeo = trazo.scrimmage !== null;
  const forma = trazo.forma;
  const anoto = !!e.anotacion || !!h.touchdown;

  // Todos los que no llevan el balón van hacia donde termina la jugada, cada uno a su ritmo, y frenan en círculo alrededor.
  const cerrar = (lista, t0, t1, a, l, excepto = []) => {
    let k = 0;
    for (const j of lista) {
      if (excepto.includes(j)) continue;
      k++;
      perseguir(j, Math.min(t0, t1 - 0.05), t1, a + Math.cos(k * 2.4) * 0.6, l + Math.sin(k * 2.4) * 0.6, j.bando === 'defensa' ? 7.4 : 5.6, 1.6 + (k % 4) * 0.9);
    }
  };
  // Elige quién hace el tacleo: el que llega más cómodo al punto donde termina la jugada. Nadie se teletransporta:
  // si ninguno llega a tiempo corriendo, el más cercano se lanza desde donde alcance a llegar.
  const derribar = (lista, tFin, a, l, tReaccion) => {
    const antes = Math.max(0.2, Math.min(tReaccion, tFin - 0.3));
    const temprano = Math.max(0.2, Math.min(antes, (tSnap ?? 0.4) + 0.5));
    let mejor = null;
    for (const tIni of [antes, temprano]) {
      for (const j of lista) {
        const [ja, jl] = donde(j, tIni);
        const v = dist(ja, jl, a + 0.5, l + 0.35) / Math.max(0.1, tFin - tIni);
        if (!mejor || v < mejor.v) mejor = { j, v, tIni };
      }
      if (mejor && mejor.v <= 8.8) break;
    }
    if (!mejor) return null;
    perseguir(mejor.j, mejor.tIni, tFin, a + 0.5, l + 0.35, 9.4);
    gesto(mejor.j, tFin - 0.25, 'taclear', 1.2);
    return mejor.j;
  };
  // El portador termina la jugada: tacleado, anotando o saliendo del campo.
  const terminar = (portador, defensores, tFin, a, l, tReaccion) => {
    if (anoto && a >= alGol - 0.6) {
      ir(portador, tFin + 0.7, Math.min(aMax - 1, a + 4.5), l);
      gesto(portador, tFin + 0.7, 'celebrar', 2);
      evento(tFin, 'touchdown');
      cerrar(defensores, tReaccion, tFin + 0.7, a - 1.5, l);
      return tFin + 2.6;
    }
    if (h.fueraDelCampo) {
      evento(tFin, 'fuera');
      cerrar(defensores, tReaccion, tFin, a, l);
      return tFin + 1.3;
    }
    const tacleador = derribar(defensores, tFin, a, l, tReaccion);
    gesto(portador, tFin, 'caer', 1.5);
    evento(tFin, 'tacleo');
    cerrar(defensores, tReaccion, tFin + 0.5, a, l, [tacleador]);
    return tFin + 1.6;
  };

  if (forma === 'patada' && e.accion !== 'despeje') {
    // ----- Patada de salida (o patada corta) -----
    lineaDeGolpeo = false;
    const p = h.patada || {};
    const corta = !!p.corta || e.accion === 'patada-corta';
    const fondo = alGol + 9;
    let cae = Number.isFinite(p.yardas) && p.yardas > 0 ? p.yardas : (corta ? 12 : Math.max(Math.abs(avance), Math.min(63, alGol - 2)));
    if (p.touchback) cae = Math.max(cae, alGol + 3);
    cae = limitar(cae, 8, fondo - 1);
    const cubren = poner('ataque', FORMACIONES.patea());
    const reciben = poner('defensa', FORMACIONES.recibePatada(corta ? 14 : cae));
    const pateador = nombrar(cubren[0], p.pateador, 'Pateador');
    const tPatada = 1.3;
    const vuelo = corta ? 1.1 : limitar(cae / 18, 1.6, 3.5);
    const tCae = tPatada + vuelo;
    ir(pateador, tPatada, -0.6, -0.3);
    gesto(pateador, tPatada - 0.15, 'patear', 0.7);
    dejar(0, tPatada, [0, 0, 0.15]);
    evento(tPatada, 'patada');
    const lCae = corta ? 9 : -3;
    for (const j of cubren.slice(1)) { quieto(j, tPatada - 0.2); ir(j, tCae, Math.min(cae - 4, 7.6 * (tCae - tPatada + 0.2)), donde(j, 0)[1] * 0.75); }
    const regresa = corta ? elMasCercano(reciben, 0, cae, lCae) : reciben[9];
    quieto(regresa, tPatada);
    ir(regresa, tCae, cae, lCae);
    volar(tPatada, tCae, [0, 0, 0.15], [cae, lCae, 1.1], corta ? 1.2 : 1.34 * vuelo * vuelo, 'tumbo');
    gesto(regresa, tCae - 0.2, 'atrapar', 0.5);
    evento(tCae, 'atrapada');
    const hayRegreso = !p.touchback && Math.abs(avance - cae) > 1.5;
    if (hayRegreso) nombrar(regresa, p.retorno?.jugador, 'Regresa la patada');
    const tFin = tCae + (hayRegreso ? Math.max(0.5, Math.abs(cae - avance) / 7.6) : 0.5);
    const lFin = hayRegreso ? lCae + 4 : lCae;
    for (const j of reciben) if (j !== regresa) { quieto(j, tPatada + 0.3); perseguir(j, tPatada + 0.3, tCae + 0.4, Math.max(avance + 4, donde(j, 0)[0] + 8), donde(j, 0)[1] * 0.7, 5.5); }
    if (hayRegreso) {
      ir(regresa, tFin, avance, lFin);
      llevar(tCae, tFin + 3, regresa);
      duracion = terminar(regresa, cubren, tFin, avance, lFin, tCae);
    } else {
      llevar(tCae, tFin + 3, regresa);
      if (p.touchback) { gesto(regresa, tCae + 0.2, 'arrodillar', 2); evento(tCae + 0.4, 'touchback'); }
      cerrar(cubren, tCae, tFin + 0.6, cae - 2, lCae);
      duracion = tFin + 1.5;
    }
  } else if (forma === 'patada') {
    // ----- Despeje -----
    const p = h.patada || {};
    let cae = Number.isFinite(p.yardas) && p.yardas > 0 ? p.yardas : Math.max(20, avance);
    if (p.touchback) cae = Math.max(cae, alGol + 2);
    cae = limitar(cae, 10, aMax - 1);
    const patean = poner('ataque', FORMACIONES.despeje());
    const reciben = poner('defensa', FORMACIONES.recibeDespeje(cae));
    const despejador = nombrar(patean[10], p.pateador, 'Despeja');
    const regresa = reciben[10];
    const tRecibe = tSnap + 0.75;
    const tPatada = tSnap + 2;
    const vuelo = limitar(cae / 12, 2.4, 4);
    const tCae = tPatada + vuelo;
    llevar(0, tSnap, patean[0]);
    volar(tSnap, tRecibe, [-0.5, 0, 0.5], [-14, 0, 1], 0.4, 'espiral');
    llevar(tRecibe, tPatada, despejador);
    quieto(despejador, tRecibe);
    ir(despejador, tPatada, -12, 0.3);
    gesto(despejador, tPatada - 0.2, 'patear', 0.8);
    evento(tSnap, 'snap');
    evento(tPatada, 'patada');
    volar(tPatada, tCae, [-12, 0.3, 0.6], [cae, 0, p.touchback || p.muerta || p.fuera ? 0.15 : 1.1], 1.34 * vuelo * vuelo, 'espiral');
    for (const j of patean.slice(0, 7)) { quieto(j, tSnap); ir(j, tSnap + 0.7, donde(j, 0)[0] - 0.8, donde(j, 0)[1], 'atras'); gesto(j, tSnap + 0.2, 'bloquear', 1.4); }
    for (const j of reciben.slice(0, 6)) { quieto(j, tSnap); ir(j, tPatada, -2.5, donde(j, 0)[1] * 0.7); }
    for (const j of [...patean.slice(0, 10)]) { quieto(j, tPatada); ir(j, tCae, Math.min(cae - 3, donde(j, tPatada)[0] + 7.6 * vuelo), donde(j, 0)[1] * 0.6); }
    for (const j of reciben.slice(6, 10)) { quieto(j, tSnap); perseguir(j, tSnap, tCae, cae - 8, donde(j, 0)[1] * 0.6, 6.5); }
    const hayRegreso = !!p.retorno && !p.touchback && Math.abs(avance - cae) > 1.5;
    if (p.touchback || p.muerta || p.fuera || p.recepcionLibre || !hayRegreso) {
      if (p.recepcionLibre || (!p.touchback && !p.muerta && !p.fuera)) {
        gesto(regresa, tCae - 0.2, 'atrapar', 0.5);
        llevar(tCae, tCae + 4, regresa);
        evento(tCae, p.recepcionLibre ? 'recepcion-libre' : 'atrapada');
      } else {
        ir(regresa, tCae, cae - 6, 5);
        dejar(tCae, tCae + 4, [cae, 0, 0.15]);
        evento(tCae, p.touchback ? 'touchback' : 'balon-muerto');
      }
      cerrar(patean.slice(0, 10), tCae, tCae + 0.8, cae, 0);
      duracion = tCae + 1.6;
    } else {
      nombrar(regresa, p.retorno?.jugador || p.receptor, 'Regresa el despeje');
      gesto(regresa, tCae - 0.2, 'atrapar', 0.5);
      evento(tCae, 'atrapada');
      const tFin = tCae + Math.max(0.5, Math.abs(cae - avance) / 7.4);
      ir(regresa, tFin, avance, 4);
      llevar(tCae, tFin + 3, regresa);
      duracion = terminar(regresa, patean.slice(0, 10), tFin, avance, 4, tCae);
    }
  } else if (forma === 'gol-de-campo') {
    // ----- Gol de campo -----
    const g = h.golDeCampo || {};
    const patean = poner('ataque', FORMACIONES.golDeCampo());
    const defienden = poner('defensa', FORMACIONES.defiendeGolDeCampo());
    const pateador = nombrar(patean[10], g.pateador, 'Pateador');
    const sujeta = patean[9];
    const tPone = tSnap + 0.55;
    const tPatada = tSnap + 1.35;
    const postes = alGol + 10; // los postes están al fondo de la zona de anotación
    const bueno = trazo.resultado === 'bueno';
    const bloqueado = !!g.bloqueadoPor || /block/i.test(g.detalle || '');
    const detalle = g.detalle || '';
    let destino = [postes, 0, 6];
    if (!bueno) {
      if (bloqueado) destino = [1.2, 0.8, 2.4];
      else if (/short/i.test(detalle)) destino = [postes - 4, 1, 0.3];
      else destino = [postes, /right/i.test(detalle) ? 5.2 : -5.2, 6];
    }
    const vuelo = bloqueado ? 0.35 : limitar(postes / 24, 1.1, 2.4);
    const tLlega = tPatada + vuelo;
    llevar(0, tSnap, patean[0]);
    volar(tSnap, tPone, [-0.5, 0, 0.5], [-7.6, 0.2, 0.5], 0.3, 'espiral');
    dejar(tPone, tPatada, [-7.6, 0, 0.15]);
    gesto(sujeta, tSnap + 0.1, 'arrodillar', 9);
    ir(pateador, tPatada, -8, -0.4);
    gesto(pateador, tPatada - 0.18, 'patear', 0.8);
    evento(tSnap, 'snap');
    evento(tPatada, 'patada');
    volar(tPatada, tLlega, [-7.6, 0, 0.15], destino, bloqueado ? 0.4 : limitar(postes * 0.2, 5, 11), 'tumbo');
    if (bloqueado) dejar(tLlega, tLlega + 3, [3, 1.5, 0.15]); else dejar(tLlega, tLlega + 3, [destino[0] + 3, destino[1], 0.15]);
    for (const j of patean.slice(0, 9)) { gesto(j, tSnap + 0.15, 'bloquear', 1.6); }
    for (const j of defienden.slice(0, 10)) { quieto(j, tSnap); ir(j, tPatada + 0.2, bloqueado && j === defienden[0] ? -1 : 0.1, donde(j, 0)[1] * 0.85); }
    evento(tLlega, bueno ? 'gol-de-campo-bueno' : 'gol-de-campo-fallado');
    if (bueno) for (const j of [pateador, sujeta]) gesto(j, tLlega + 0.1, 'celebrar', 1.6);
    duracion = tLlega + 1.7;
  } else {
    // ----- Jugadas desde la línea de golpeo: pase, carrera, captura, penal -----
    const escopeta = !!h.escopeta;
    const ataque = poner('ataque', FORMACIONES.ataque(escopeta));
    const defensa = poner('defensa', FORMACIONES.defensa());
    const [centro, , , , , ala, abiertoIzq, abiertoDer, ranura, mariscal, corredor] = ataque;
    const linea = ataque.slice(0, 5);
    const frente = defensa.slice(0, 4);
    const apoyadores = defensa.slice(4, 7);
    const [esquineroIzq, esquineroDer, profundoIzq, profundoMedio] = defensa.slice(7);
    const [qa, ql] = donde(mariscal, 0);
    const tRecibe = tSnap + (escopeta ? 0.35 : 0.15);

    if (forma === 'penal') {
      // Castigo sin jugada: nadie se mueve, cae la bandera y el balón se recoloca.
      llevar(0, 1.9, centro);
      dejar(1.9, 9, [avance, 0, 0.15]);
      evento(0.8, 'bandera', { a: 1.5, l: 7 });
      duracion = 3.4;
      tSnap = null;
    } else {
      llevar(0, tSnap, centro);
      volar(tSnap, tRecibe, [-0.5, 0, 0.5], [qa, ql, 1], 0.15, 'espiral');
      evento(tSnap, 'snap');

      const esPase = forma === 'pase' || forma === 'pase-incompleto';
      const captura = e.accion === 'captura';
      const rodilla = e.accion === 'arrodillarse';
      const lado = h.direccion === 'izquierda' ? -1 : h.direccion === 'derecha' ? 1 : 0;

      if (esPase) {
        // --- Pase ---
        const profundo = h.profundidad === 'profundo' || /\bdeep\b/i.test(e.original || '');
        const intercepcion = e.accion === 'intercepcion';
        const incompleto = forma === 'pase-incompleto';
        let aire;
        if (incompleto || intercepcion) aire = profundo ? 22 : 7;
        else if (avance <= 0) aire = Math.max(avance, -3);
        else aire = profundo ? Math.min(avance, Math.max(15, avance * 0.75)) : Math.min(avance, 3.5 + Math.min(5.5, avance * 0.35));
        aire = limitar(aire, -4, aMax - 2);
        const lAtrapa = lado === 0 ? 1.5 : lado * (profundo ? 15 : 11.5);
        // Receptor: el abierto de ese lado en pases profundos; el de la ranura o el ala cerrada en los cortos.
        let objetivo = lado < 0 ? (profundo ? abiertoIzq : ranura) : lado > 0 ? (profundo ? abiertoDer : ala) : (profundo ? ranura : ala);
        if (aire <= 0) objetivo = corredor;
        const [o0a, o0l] = donde(objetivo, 0);
        const desdeMano = [qa - (escopeta ? 2 : 5.3), ql, 1.9];
        const vuelo = limitar(dist(desdeMano[0], desdeMano[1], aire, lAtrapa) / 21, 0.45, 2.1);
        // Ruta del receptor: recto y quiebre hacia el punto de la atrapada. El pase sale cuando al receptor le da tiempo de llegar.
        const quiebre = [aire * 0.72, o0l + (lAtrapa - o0l) * 0.25];
        const tramo1 = aire > 3 ? dist(o0a, o0l, quiebre[0], quiebre[1]) : 0;
        const ruta = aire > 3 ? tramo1 + dist(quiebre[0], quiebre[1], aire, lAtrapa) : dist(o0a, o0l, aire, lAtrapa);
        const tLanza = Math.max(tRecibe + (profundo ? 1.9 : 1.25), tSnap + ruta / 8.3 - vuelo);
        const tAtrapa = tLanza + vuelo;

        nombrar(mariscal, h.pasador, 'Pasador');
        llevar(tRecibe, tLanza, mariscal);
        quieto(mariscal, tRecibe);
        ir(mariscal, tLanza - 0.25, desdeMano[0], ql, 'atras');
        gesto(mariscal, tLanza - 0.25, 'lanzar', 0.7);
        ir(mariscal, tAtrapa + 0.6, desdeMano[0] + 0.8, ql);
        evento(tLanza, 'lanzamiento');

        quieto(objetivo, tSnap);
        if (aire > 3) ir(objetivo, tSnap + (tAtrapa - tSnap) * (tramo1 / ruta), quiebre[0], quiebre[1]);
        ir(objetivo, tAtrapa, aire, lAtrapa);
        gesto(objetivo, tAtrapa - 0.3, 'atrapar', 0.5);

        // Los demás receptores corren sus rutas; la línea protege; el corredor se queda a bloquear.
        for (const r of [abiertoIzq, abiertoDer, ranura, ala]) {
          if (r === objetivo) continue;
          const [, rl] = donde(r, 0);
          quieto(r, tSnap);
          ir(r, tSnap + 1.4, Math.min(aMax - 3, 8), rl * 0.97);
          ir(r, tAtrapa, Math.min(aMax - 2, 8 + (tAtrapa - tSnap - 1.4) * 5), rl * 0.8 + (r === ala ? 4 : 0));
        }
        for (const b of linea) { const [ba, bl] = donde(b, 0); quieto(b, tSnap); ir(b, tSnap + 0.7, ba - 1.3, bl * 1.05, 'atras'); gesto(b, tSnap + 0.3, 'bloquear', tLanza - tSnap); }
        if (corredor !== objetivo) { quieto(corredor, tSnap); ir(corredor, tSnap + 0.8, desdeMano[0] + 2.2, 2.4); gesto(corredor, tSnap + 0.8, 'bloquear', tLanza - tSnap - 0.6); }
        // Defensa: los de adelante presionan, el resto retrocede a cubrir.
        for (const d of frente) { const [, dl] = donde(d, 0); quieto(d, tSnap); ir(d, tLanza, desdeMano[0] + 2.4, dl * 0.75); }
        for (const d of apoyadores) { const [da, dl] = donde(d, 0); quieto(d, tSnap); ir(d, tSnap + 1.3, da + 3, dl * 1.15, 'atras'); }
        const marca = (d, r) => { quieto(d, tSnap); const [ra, rl] = donde(r, tAtrapa - 0.01); ir(d, tAtrapa - 0.01, Math.max(ra + 1.6, 2), rl + (rl > 0 ? -1.3 : 1.3), 'atras'); };
        marca(esquineroIzq, abiertoIzq);
        marca(esquineroDer, abiertoDer);
        marca(profundoIzq, ranura);
        { const [pa, pl] = donde(profundoMedio, 0); quieto(profundoMedio, tSnap); ir(profundoMedio, tAtrapa - 0.01, Math.max(pa, aire + 5), pl + (lAtrapa - pl) * 0.45, 'atras'); }

        const destinoBalon = [aire, lAtrapa, incompleto ? 0.9 : 1.25];
        if (incompleto) {
          // Nadie lo atrapa: el balón cae y rueda un poco más allá del receptor.
          const pasa = [aire + 2.2, lAtrapa + lado * 1.2, 0.15];
          volar(tLanza, tAtrapa + 0.25, desdeMano, pasa, limitar(vuelo * vuelo * 1.34, 0.8, 9));
          dejar(tAtrapa + 0.25, tAtrapa + 4, pasa);
          evento(tAtrapa + 0.25, 'incompleto');
          if (h.receptor) nombrar(objetivo, h.receptor, 'Buscaban a');
          cerrar(defensa, tAtrapa, tAtrapa + 0.9, aire, lAtrapa, frente);
          duracion = tAtrapa + 1.6;
        } else if (intercepcion) {
          // Roba el balón el defensor que cubría al receptor buscado.
          const ladron = objetivo === abiertoIzq ? esquineroIzq : objetivo === abiertoDer ? esquineroDer : objetivo === ranura ? profundoIzq : objetivo === ala ? apoyadores[2] : apoyadores[1];
          if (h.receptor) nombrar(objetivo, h.receptor, 'Buscaban a');
          perseguir(ladron, tLanza, tAtrapa - 0.02, aire + 0.4, lAtrapa + 0.3, 9.4);
          ir(ladron, tAtrapa, aire + 0.4, lAtrapa + 0.3);
          gesto(ladron, tAtrapa - 0.3, 'atrapar', 0.5);
          volar(tLanza, tAtrapa, desdeMano, [aire + 0.4, lAtrapa + 0.3, 1.4], limitar(vuelo * vuelo * 1.34, 0.8, 9));
          evento(tAtrapa, 'intercepcion');
          const tFin = tAtrapa + Math.max(0.5, Math.abs(avance - aire) / 7.4);
          const lFin = lAtrapa * 0.7;
          ir(ladron, tFin, avance, lFin);
          llevar(tAtrapa, tFin + 4, ladron);
          // Ahora persiguen los del ataque.
          const tacleador = derribar(ataque, tFin, avance, lFin, tAtrapa);
          gesto(ladron, tFin, 'caer', 1.5);
          evento(tFin, 'tacleo');
          cerrar(ataque, tAtrapa, tFin + 0.5, avance, lFin, [tacleador]);
          duracion = tFin + 1.6;
        } else {
          nombrar(objetivo, h.receptor, 'Receptor');
          volar(tLanza, tAtrapa, desdeMano, destinoBalon, limitar(vuelo * vuelo * 1.34, 0.5, 9));
          evento(tAtrapa, 'atrapada');
          const resto = Math.abs(avance - aire);
          const lFin = h.fueraDelCampo ? (lAtrapa >= 0 ? MEDIO + 0.6 : -MEDIO - 0.6) : lAtrapa + (lAtrapa > 0 ? -1 : 1) * Math.min(4, resto * 0.25);
          const tFin = tAtrapa + Math.max(0.35, dist(aire, lAtrapa, avance, lFin) / 7.6);
          ir(objetivo, tFin, avance, lFin);
          llevar(tAtrapa, tFin + 4, objetivo);
          duracion = terminar(objetivo, defensa, tFin, avance, lFin, tAtrapa);
        }
      } else if (captura) {
        // --- Captura: el mariscal retrocede y lo derriban antes de lanzar ---
        nombrar(mariscal, h.pasador, 'Pasador');
        const aFin = Math.min(avance, -1);
        const tFin = tRecibe + 2.3 + Math.max(0, (-aFin - 8) * 0.13);
        llevar(tRecibe, tFin + 4, mariscal);
        quieto(mariscal, tRecibe);
        ir(mariscal, tRecibe + 1.2, Math.min(qa - 2, aFin - 1.5), ql, 'atras');
        ir(mariscal, tFin, aFin, ql + 1.2);
        for (const b of linea) { const [ba, bl] = donde(b, 0); quieto(b, tSnap); ir(b, tSnap + 0.7, ba - 1.3, bl * 1.05, 'atras'); gesto(b, tSnap + 0.3, 'bloquear', 2); }
        for (const r of [abiertoIzq, abiertoDer, ranura, ala]) { const [, rl] = donde(r, 0); quieto(r, tSnap); ir(r, tFin, 11, rl * 0.9); }
        quieto(corredor, tSnap); ir(corredor, tSnap + 0.8, qa - 1, 2.6); gesto(corredor, tSnap + 0.8, 'bloquear', 1.4);
        const captor = frente[3];
        for (const d of frente) { const [, dl] = donde(d, 0); quieto(d, tSnap); if (d !== captor) ir(d, tFin, aFin + 2, dl * 0.6); }
        ir(captor, tRecibe + 1.2, -2.5, 6.5);
        ir(captor, tFin, aFin + 0.5, ql + 1.5);
        gesto(captor, tFin - 0.25, 'taclear', 1.2);
        gesto(mariscal, tFin, 'caer', 1.5);
        for (const d of apoyadores) { const [da, dl] = donde(d, 0); quieto(d, tSnap); ir(d, tSnap + 1.3, da + 2.5, dl * 1.1, 'atras'); }
        for (const [d, r] of [[esquineroIzq, abiertoIzq], [esquineroDer, abiertoDer], [profundoIzq, ranura]]) { quieto(d, tSnap); const [ra, rl] = donde(r, tFin); ir(d, tFin, ra + 1.6, rl + (rl > 0 ? -1.3 : 1.3), 'atras'); }
        evento(tFin, 'tacleo');
        duracion = tFin + 1.6;
      } else if (rodilla) {
        // --- Rodilla al suelo: el mariscal recibe y se arrodilla para gastar el reloj ---
        nombrar(mariscal, h.corredor, 'Mariscal');
        llevar(tRecibe, 9, mariscal);
        quieto(mariscal, tRecibe);
        ir(mariscal, tRecibe + 0.5, Math.min(avance, qa), ql);
        gesto(mariscal, tRecibe + 0.4, 'arrodillar', 3);
        for (const b of linea) gesto(b, tSnap + 0.2, 'bloquear', 1);
        evento(tRecibe + 0.6, 'rodilla');
        duracion = tRecibe + 2;
      } else {
        // --- Carrera (o cualquier otro avance por tierra) ---
        const escapada = !!h.escapada;
        let lHueco = 0.4;
        for (const [re, l] of HUECOS) if (re.test(h.hueco || '')) { lHueco = l; break; }
        if (!h.hueco && lado) lHueco = lado * 5;
        const portador = escapada ? mariscal : corredor;
        nombrar(portador, h.corredor || (escapada ? h.pasador : ''), escapada ? 'Mariscal' : 'Corredor');
        let tSale;
        if (escapada) {
          // El mariscal retrocede para pasar, no encuentra a nadie y corre él mismo.
          llevar(tRecibe, 12, mariscal);
          quieto(mariscal, tRecibe);
          const aAtras = qa - (escopeta ? 1.5 : 4.5);
          const sale = [Math.min(-1, avance), lHueco];
          ir(mariscal, tRecibe + 1.3, aAtras, ql, 'atras');
          tSale = tRecibe + 1.3 + Math.max(0.5, dist(aAtras, ql, sale[0], sale[1]) / 6.5);
          ir(mariscal, tSale, sale[0], sale[1]);
          for (const r of [abiertoIzq, abiertoDer, ranura, ala]) { const [, rl] = donde(r, 0); quieto(r, tSnap); ir(r, tSale, 10, rl * 0.9); }
          quieto(corredor, tSnap); ir(corredor, tSnap + 0.8, qa - 1, -2.4); gesto(corredor, tSnap + 0.8, 'bloquear', 1.4);
        } else {
          // Entrega en mano: el mariscal gira y le da el balón al corredor.
          const tEntrega = tRecibe + 0.6;
          const [ca] = donde(corredor, 0);
          const aEntrega = Math.max(qa - 1.6, ca + 0.4, -4.6);
          llevar(tRecibe, tEntrega, mariscal);
          quieto(mariscal, tRecibe);
          ir(mariscal, tEntrega, aEntrega - 0.5, ql + (lHueco >= 0 ? 0.7 : -0.7), 'atras');
          ir(mariscal, tEntrega + 1.2, aEntrega - 2.5, ql - (lHueco >= 0 ? 2 : -2));
          quieto(corredor, tSnap);
          ir(corredor, tEntrega, aEntrega, ql + (lHueco >= 0 ? 1.2 : -1.2));
          llevar(tEntrega, 12, corredor);
          evento(tEntrega, 'entrega');
          tSale = tEntrega;
          for (const r of [abiertoIzq, abiertoDer, ranura]) { const [, rl] = donde(r, 0); quieto(r, tSnap); ir(r, tSnap + 1.5, 5, rl * 0.95); gesto(r, tSnap + 1.5, 'bloquear', 1.5); }
          { const [, al] = donde(ala, 0); quieto(ala, tSnap); ir(ala, tSnap + 0.8, 1, al + (lHueco > 4 ? 1.5 : 0)); gesto(ala, tSnap + 0.5, 'bloquear', 2); }
        }
        // La línea empuja hacia adelante y abre el hueco.
        for (const b of linea) { const [ba, bl] = donde(b, 0); quieto(b, tSnap); ir(b, tSnap + 1, ba + 1.6, bl + (bl >= lHueco ? 0.8 : -0.8)); gesto(b, tSnap + 0.2, 'bloquear', 2.4); }
        for (const d of frente) { const [da, dl] = donde(d, 0); quieto(d, tSnap); ir(d, tSnap + 1, da - 0.3, dl + (dl >= lHueco ? 0.9 : -0.9)); }
        // El portador busca el hueco y sigue hasta donde terminó la jugada.
        const [pa, pl] = donde(portador, tSale);
        const tBase = tSale;
        let tFin; let lFin;
        if (avance > 0.5) {
          const tHueco = tBase + Math.max(0.3, dist(pa, pl, 0, lHueco) / 6.8);
          ir(portador, tHueco, 0, lHueco);
          lFin = lHueco + (lHueco >= 0 ? 1 : -1) * Math.min(5, avance * 0.18);
          tFin = tHueco + Math.max(0.3, dist(0, lHueco, avance, lFin) / 7.6);
        } else {
          lFin = lHueco * 0.8;
          tFin = tBase + Math.max(0.5, dist(pa, pl, avance, lFin) / 6.2);
        }
        ir(portador, tFin, avance, lFin);
        const tReaccion = tSnap + 0.8;
        for (const d of [...apoyadores, esquineroIzq, esquineroDer, profundoIzq, profundoMedio]) quieto(d, tReaccion);
        duracion = terminar(portador, [...apoyadores, esquineroIzq, esquineroDer, profundoIzq, profundoMedio, ...frente], tFin, avance, lFin, Math.max(tReaccion, tSnap + 1));
      }
    }
  }

  if ((h.penales || []).some((p) => p.estado !== 'rechazado') && forma !== 'penal') evento(Math.max(0.5, duracion - 1.4), 'bandera', { a: Math.min(avance, 2), l: 6 });
  eventos.sort((x, y) => x.t - y.t);

  // --- De coordenadas relativas a coordenadas de cancha ---
  const X = (a) => limitar(origen + sentido * a, -9.6, 109.6);
  const Z = (l) => limitar(MEDIO + sentido * l, -1.5, ANCHO_CANCHA + 1.5);
  const punto = ([a, l, y]) => ({ x: X(a), y, z: Z(l) });
  const equipo = (lado) => {
    const t = ctx?.[lado] || {};
    return { id: String(t.id ?? ''), nombre: t.nombre || '', abrev: t.abrev || '', color: t.color || '', colorAlterno: t.colorAlterno || '', esLocal: String(t.id ?? '') === localId };
  };

  const linea = {
    forma,
    duracion: Math.round(duracion * 100) / 100,
    sentido,
    tSnap,
    desde: trazo.desde,
    hasta: trazo.hasta,
    scrimmage: lineaDeGolpeo ? trazo.scrimmage : null,
    marca: trazo.marca,
    resultado: trazo.resultado,
    anotacion: anoto,
    ataque: equipo(ataca),
    defensa: equipo(defiende),
    jugadores: jugadores.map((j) => ({
      id: j.id, bando: j.bando, rol: j.rol, numero: j.numero, nombre: j.nombre, papel: j.papel,
      claves: j.claves.map(([t, a, l, modo]) => ({ t, x: X(a), z: Z(l), atras: modo === 'atras' })),
      gestos: j.gestos.sort((x, y) => x.t - y.t),
    })),
    balon: tramos.sort((x, y) => x.t0 - y.t0).map((s) => (s.tipo === 'vuelo'
      ? { t0: s.t0, t1: s.t1, tipo: 'vuelo', de: punto(s.de), a: punto(s.a), alto: s.alto, giro: s.giro }
      : s.tipo === 'quieto' ? { t0: s.t0, t1: s.t1, tipo: 'quieto', en: punto(s.en) } : { t0: s.t0, t1: s.t1, tipo: 'llevado', quien: s.quien })),
    eventos: eventos.map((ev) => (ev.a !== undefined ? { t: ev.t, tipo: ev.tipo, x: X(ev.a), z: Z(ev.l) } : { t: ev.t, tipo: ev.tipo })),
    rotulos,
    descripcion: trazo.descripcion,
    aviso: AVISO_RECREACION,
  };

  // Garantía: el balón siempre termina donde dicen los datos. Si la recreación lo dejó en otro lugar
  // (un touchback, un balón suelto, un castigo después de la jugada), al final se coloca en su sitio real.
  if (forma !== 'pase-incompleto' && forma !== 'gol-de-campo') {
    const final = muestrear(linea, linea.duracion).balon;
    const real = X(avance);
    const tolerancia = anoto ? 6 : 1.5;
    if (Math.abs(final.x - real) > tolerancia) {
      const t0 = linea.duracion - 0.3;
      linea.balon.push({ t0, t1: t0 + 9, tipo: 'quieto', en: { x: real, y: 0.15, z: limitar(final.z, 18, ANCHO_CANCHA - 18) } });
      linea.eventos.push({ t: t0, tipo: 'balon-colocado' });
      linea.duracion = Math.round((linea.duracion + 1.2) * 100) / 100;
    }
  }
  return linea;
}

// ---------------------------------------------------------------------------
// Muestreo: dónde está cada cosa en el instante t (lo que el render dibuja en cada cuadro)
// ---------------------------------------------------------------------------

function posicionDe(j, t) {
  const c = j.claves;
  if (t <= c[0].t) return { x: c[0].x, z: c[0].z, vx: 0, vz: 0, atras: false };
  for (let i = 1; i < c.length; i++) {
    if (t <= c[i].t) {
      const dt = (c[i].t - c[i - 1].t) || 1;
      const u = (t - c[i - 1].t) / dt;
      // Arranque y frenada suaves dentro de cada tramo.
      const s = u * u * (3 - 2 * u);
      const k = 6 * u * (1 - u) / dt;
      return {
        x: c[i - 1].x + (c[i].x - c[i - 1].x) * s, z: c[i - 1].z + (c[i].z - c[i - 1].z) * s,
        vx: (c[i].x - c[i - 1].x) * k, vz: (c[i].z - c[i - 1].z) * k, atras: c[i].atras,
      };
    }
  }
  const f = c[c.length - 1];
  return { x: f.x, z: f.z, vx: 0, vz: 0, atras: false };
}

const GESTOS_QUE_QUEDAN = new Set(['caer']); // el jugador derribado se queda en el suelo

// Estado de todos los jugadores y del balón en el segundo t.
export function muestrear(linea, t) {
  const tiempo = limitar(t, 0, linea.duracion);
  const porId = new Map();
  const jugadores = linea.jugadores.map((j) => {
    const p = posicionDe(j, tiempo);
    const rapidez = Math.hypot(p.vx, p.vz);
    let gesto = '';
    let fase = 0;
    for (const g of j.gestos) {
      if (tiempo < g.t) break;
      if (tiempo <= g.t + g.dura || GESTOS_QUE_QUEDAN.has(g.tipo)) { gesto = g.tipo; fase = limitar((tiempo - g.t) / g.dura, 0, 1); }
    }
    // Hacia dónde mira: hacia donde corre; si retrocede o está quieto, hacia el frente de su equipo.
    const frente = (j.bando === 'ataque' ? linea.sentido : -linea.sentido) > 0 ? 0 : Math.PI;
    const rumbo = rapidez > 0.6 && !p.atras ? Math.atan2(p.vz, p.vx) : frente;
    const estado = { id: j.id, x: p.x, z: p.z, rumbo, rapidez, retrocede: p.atras && rapidez > 0.3, gesto, fase };
    porId.set(j.id, estado);
    return estado;
  });

  let balon = { x: linea.desde, y: 0.15, z: MEDIO, enAire: false, giro: '', portador: '', avanceVuelo: 0 };
  const tramos = linea.balon;
  let tramo = tramos[0];
  for (const s of tramos) if (tiempo >= s.t0) tramo = s;
  if (tramo) {
    if (tramo.tipo === 'llevado') {
      const p = porId.get(tramo.quien);
      const caido = p.gesto === 'caer' ? p.fase : 0;
      balon = { x: p.x + Math.cos(p.rumbo) * 0.3, y: 1.1 - caido * 0.8, z: p.z + Math.sin(p.rumbo) * 0.3, enAire: false, giro: '', portador: tramo.quien, avanceVuelo: 0 };
    } else if (tramo.tipo === 'vuelo') {
      const u = limitar((tiempo - tramo.t0) / ((tramo.t1 - tramo.t0) || 1), 0, 1);
      balon = {
        x: tramo.de.x + (tramo.a.x - tramo.de.x) * u,
        y: tramo.de.y + (tramo.a.y - tramo.de.y) * u + tramo.alto * 4 * u * (1 - u),
        z: tramo.de.z + (tramo.a.z - tramo.de.z) * u,
        enAire: u < 1, giro: tramo.giro, portador: '', avanceVuelo: u,
        rumbo: Math.atan2(tramo.a.z - tramo.de.z, tramo.a.x - tramo.de.x),
        inclinacion: Math.atan2((tramo.a.y - tramo.de.y) + tramo.alto * 4 * (1 - 2 * u), Math.hypot(tramo.a.x - tramo.de.x, tramo.a.z - tramo.de.z)),
      };
    } else {
      balon = { x: tramo.en.x, y: tramo.en.y, z: tramo.en.z, enAire: false, giro: '', portador: '', avanceVuelo: 0 };
    }
  }
  return { t: tiempo, jugadores, balon };
}
