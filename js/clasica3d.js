// Jugadas clásicas de La Pizarra con jugadores 3D: convierte los pasos de js/clasicas.js (X y O en una pizarra
// esquemática) en una línea de tiempo como las de js/jugada3d.js, para que js/vista3d.js la dibuje igual que una jugada real.
// Módulo puro: sin DOM ni Three.js. Cada paso de la pizarra ocupa un tramo de tiempo (linea.tiempos).
import { estadosDe } from './clasicas.js';
import { ANCHO_CANCHA } from './jugada3d.js';

const MEDIO = ANCHO_CANCHA / 2;
const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

export const AVISO_CLASICA = 'Jugada de pizarra con posiciones de ejemplo: no es de un partido real.';
export const PAPELES = { M: 'Mariscal', C: 'Corredor', R: 'Receptor', A: 'Ala cerrada', P: 'Pateador' };

// Colores de ejemplo (no son de ningún equipo): el ataque de azul y la defensa de blanco con rojo.
const ATAQUE = { id: 'ataque', nombre: '', abrev: '', color: '#1f4fa3', colorAlterno: '#f2c230', esLocal: true };
const DEFENSA = { id: 'defensa', nombre: '', abrev: '', color: '#a3261f', colorAlterno: '#e8e8e8', esLocal: false };

const ROLES = { T1: 'LT', T2: 'RT', G1: 'LG', G2: 'RG', CE: 'C' };
const NUMEROS = {
  T1: 77, G1: 66, CE: 61, G2: 71, T2: 74, AC: 87, R1: 11, R2: 81, R3: 17, R4: 13, MC: 9, CO: 26, PA: 3,
  D1: 91, D2: 97, D3: 93, D4: 99, L1: 54, L2: 52, L3: 58, E1: 21, E2: 24, E3: 29, P1: 31, P2: 33, P3: 36,
};

const PASO_MINIMO = 2.2; // segundos que dura un paso con recorridos cortos
const RAPIDEZ_MEDIA = 7.2; // yardas por segundo: el paso se alarga hasta que nadie tenga que correr más rápido que esto
const ESPERA_INICIAL = 0.6;

// De la pizarra (100 x 70, sin escala, el ataque hacia arriba) a yardas respecto del punto de partida:
// a = hacia adelante, l = hacia la derecha del ataque. Cerca de la línea la pizarra está "inflada" para que se
// distingan las fichas; aquí se compacta para que los linieros queden hombro con hombro.
function conversor(jugada) {
  const conLinea = typeof jugada.linea === 'number';
  const referencia = conLinea ? jugada.linea : (Array.isArray(jugada.balon) ? jugada.balon[1] : 50);
  const CERCA = 6;
  const YARDAS_CERCA = 0.45;
  // Lejos de la línea: media yarda por unidad, salvo que haya zona de anotación; entonces la línea de gol queda a 38 yardas.
  const lejos = typeof jugada.zonaDeAnotacion === 'number' && conLinea
    ? (38 - CERCA * YARDAS_CERCA) / Math.max(1, (jugada.linea - jugada.zonaDeAnotacion) - CERCA)
    : 0.5;
  const fondo = (y) => {
    const d = referencia - y; // positivo = hacia adelante
    if (!conLinea) return d * 0.5;
    const m = Math.abs(d);
    return Math.sign(d) * (m <= CERCA ? m * YARDAS_CERCA : CERCA * YARDAS_CERCA + (m - CERCA) * lejos);
  };
  const lado = (x) => {
    const d = x - 50;
    const m = Math.abs(d);
    if (!conLinea) return d * 0.5;
    return Math.sign(d) * (m <= 16 ? m * 0.34 : 16 * 0.34 + (m - 16) * 0.58);
  };
  const yardasAlGol = typeof jugada.zonaDeAnotacion === 'number' ? fondo(jugada.zonaDeAnotacion) : null;
  const origen = yardasAlGol !== null ? 100 - yardasAlGol : (conLinea ? 40 : 35);
  return {
    conLinea, origen, yardasAlGol,
    punto: ([x, y]) => ({ x: limitar(origen + fondo(y), -9.6, 109.6), z: limitar(MEDIO + lado(x), -1.5, ANCHO_CANCHA + 1.5) }),
    fondoDe: (y) => origen + fondo(y),
  };
}

// Posición de un jugador en el segundo t según sus claves (mismo suavizado que muestrear en jugada3d.js).
function donde(claves, t) {
  if (t <= claves[0].t) return claves[0];
  for (let i = 1; i < claves.length; i++) {
    if (t <= claves[i].t) {
      const u = (t - claves[i - 1].t) / ((claves[i].t - claves[i - 1].t) || 1);
      const s = u * u * (3 - 2 * u);
      return { x: claves[i - 1].x + (claves[i].x - claves[i - 1].x) * s, z: claves[i - 1].z + (claves[i].z - claves[i - 1].z) * s };
    }
  }
  return claves[claves.length - 1];
}

// Devuelve la línea de tiempo de una jugada clásica, o null si la jugada no tiene pasos.
// linea.tiempos[i] = segundo en que termina el paso i (el paso 0 es la formación inicial).
export function lineaDeClasica(jugada) {
  const estados = estadosDe(jugada);
  if (!estados.length) return null;
  const c = conversor(jugada);
  const ids = Object.keys(jugada.jugadores);
  const bandoDe = (id) => (jugada.jugadores[id][2] === 'o' ? 'ataque' : 'defensa');
  const letraDe = (id) => jugada.jugadores[id][3] || '';

  const jugadores = new Map(ids.map((id, i) => {
    const p = c.punto(estados[0].posiciones[id]);
    return [id, {
      id, bando: bandoDe(id), rol: ROLES[id] || (/^D\d/.test(id) && c.conLinea ? 'DT' : ''),
      numero: String(NUMEROS[id] ?? 40 + i), nombre: '', papel: PAPELES[letraDe(id)] || '',
      claves: [{ t: 0, x: p.x, z: p.z, atras: false }], gestos: [],
    }];
  }));
  const gesto = (id, t, tipo, dura = 0.6) => { if (jugadores.has(id)) jugadores.get(id).gestos.push({ t: Math.max(0, t), tipo, dura }); };

  const balon = [];
  const eventos = [];
  const tiempos = [ESPERA_INICIAL];
  const alturaEnMano = 1.5;
  const suelo = 0.15;
  const puntoBalon = (estado, t) => {
    if (estado.portador) { const p = donde(jugadores.get(estado.portador).claves, t); return { x: p.x, y: alturaEnMano, z: p.z }; }
    const p = c.punto(estado.balon);
    return { x: p.x, y: suelo, z: p.z };
  };

  // Paso 0: la formación, quieta.
  if (estados[0].portador) balon.push({ t0: 0, t1: ESPERA_INICIAL, tipo: 'llevado', quien: estados[0].portador });
  else balon.push({ t0: 0, t1: ESPERA_INICIAL, tipo: 'quieto', en: puntoBalon(estados[0], 0) });

  for (let i = 1; i < estados.length; i++) {
    const antes = estados[i - 1];
    const ahora = estados[i];
    const t0 = tiempos[i - 1];
    // El paso dura lo que necesite el que más corre.
    let masLejos = 0;
    const destinos = new Map();
    for (const id of ahora.movidos) {
      const a = c.punto(antes.posiciones[id]);
      const b = c.punto(ahora.posiciones[id]);
      destinos.set(id, { a, b });
      masLejos = Math.max(masLejos, Math.hypot(b.x - a.x, b.z - a.z));
    }
    const dura = Math.round(Math.max(PASO_MINIMO, masLejos / RAPIDEZ_MEDIA) * 100) / 100;
    const t1 = Math.round((t0 + dura) * 100) / 100;
    tiempos.push(t1);

    for (const id of ids) {
      const j = jugadores.get(id);
      const ultima = j.claves[j.claves.length - 1];
      j.claves.push({ t: t0, x: ultima.x, z: ultima.z, atras: false });
      const d = destinos.get(id);
      if (!d) continue;
      // Retrocede de espaldas quien se mueve poco y hacia atrás de donde mira (el mariscal al caer, la cobertura).
      const frente = j.bando === 'ataque' ? 1 : -1;
      const haciaAtras = (d.b.x - d.a.x) * frente < -0.3 && Math.abs(d.b.z - d.a.z) < Math.abs(d.b.x - d.a.x) * 1.5;
      const corto = Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) < 8;
      j.claves.push({ t: t1, x: d.b.x, z: d.b.z, atras: haciaAtras && corto });
    }

    // --- Balón ---
    const mismoPortador = ahora.portador && ahora.portador === antes.portador;
    if (mismoPortador) {
      balon.push({ t0, t1, tipo: 'llevado', quien: ahora.portador });
    } else if (ahora.vuelo) {
      const patada = !antes.portador; // sale del suelo: lo patean
      // El pase llega un instante antes de que termine el paso, para que se vea la atrapada.
      const tAtrapa = Math.round((t1 - 0.3) * 100) / 100;
      const salidaEn = (t) => puntoBalon(antes, t);
      const distancia = Math.hypot(puntoBalon(ahora, tAtrapa).x - salidaEn(t0).x, puntoBalon(ahora, tAtrapa).z - salidaEn(t0).z);
      const enElAire = patada ? dura * 0.55 : limitar(distancia / 21, 0.6, dura - 0.8);
      const tSale = Math.round((patada ? t0 + dura * 0.35 : tAtrapa - enElAire) * 100) / 100;
      const tLlega = patada ? Math.round((tSale + enElAire) * 100) / 100 : tAtrapa;
      const llegada = puntoBalon(ahora, tLlega);
      const salida = salidaEn(tSale);
      if (antes.portador) balon.push({ t0, t1: tSale, tipo: 'llevado', quien: antes.portador });
      else balon.push({ t0, t1: tSale, tipo: 'quieto', en: salida });
      balon.push({
        t0: tSale, t1: tLlega, tipo: 'vuelo', de: { ...salida, y: antes.portador ? 2 : suelo }, a: llegada,
        alto: patada ? 0.5 : limitar(distancia * 0.16, 1, 9), giro: patada ? 'tumbo' : 'espiral',
      });
      if (ahora.portador) balon.push({ t0: tLlega, t1, tipo: 'llevado', quien: ahora.portador });
      else balon.push({ t0: tLlega, t1, tipo: 'quieto', en: llegada });
      if (patada) {
        // Patea el jugador marcado como pateador o, si no hay, el del ataque más cercano al balón.
        const pateador = ids.find((id) => letraDe(id) === 'P') || ids.filter((id) => bandoDe(id) === 'ataque')
          .sort((p, q) => Math.hypot(donde(jugadores.get(p).claves, t0).x - salida.x, donde(jugadores.get(p).claves, t0).z - salida.z)
            - Math.hypot(donde(jugadores.get(q).claves, t0).x - salida.x, donde(jugadores.get(q).claves, t0).z - salida.z))[0];
        gesto(pateador, tSale - 0.2, 'patear', 0.8);
        eventos.push({ t: tSale, tipo: 'patada' });
      } else {
        gesto(antes.portador, tSale - 0.25, 'lanzar', 0.7);
        eventos.push({ t: tSale, tipo: 'lanzamiento' });
        if (ahora.portador) { gesto(ahora.portador, tLlega - 0.3, 'atrapar', 0.5); eventos.push({ t: tLlega, tipo: 'atrapada' }); }
      }
    } else if (ahora.portador && antes.portador) {
      // Cambia de manos sin volar: el centro se lo da al mariscal o el mariscal lo entrega.
      const tRecibe = Math.round((t0 + 0.35) * 100) / 100;
      const de = puntoBalon(antes, t0);
      const a = puntoBalon(ahora, tRecibe);
      balon.push({ t0, t1: tRecibe, tipo: 'vuelo', de: { ...de, y: 0.6 }, a: { ...a, y: 1.1 }, alto: 0.15, giro: 'espiral' });
      balon.push({ t0: tRecibe, t1, tipo: 'llevado', quien: ahora.portador });
      eventos.push({ t: t0, tipo: i === 1 && c.conLinea ? 'snap' : 'entrega' });
    } else if (ahora.portador) {
      // Estaba en el suelo y alguien lo recupera al final del paso.
      balon.push({ t0, t1: t1 - 0.3, tipo: 'quieto', en: puntoBalon(antes, t0) });
      balon.push({ t0: t1 - 0.3, t1, tipo: 'llevado', quien: ahora.portador });
      gesto(ahora.portador, t1 - 0.5, 'atrapar', 0.5);
    } else {
      // Sigue suelto y rueda a otro lugar.
      const de = puntoBalon(antes, t0);
      const a = puntoBalon(ahora, t1);
      const tPara = Math.round((t0 + dura * 0.6) * 100) / 100;
      balon.push({ t0, t1: tPara, tipo: 'vuelo', de, a, alto: 0.3, giro: 'tumbo' });
      balon.push({ t0: tPara, t1, tipo: 'quieto', en: a });
    }
  }

  // La línea ofensiva bloquea desde que empieza la jugada.
  const fin = tiempos[tiempos.length - 1];
  if (c.conLinea && tiempos.length > 1) for (const id of Object.keys(ROLES)) gesto(id, ESPERA_INICIAL + 0.25, 'bloquear', fin - ESPERA_INICIAL);

  // Si la jugada termina con el balón en manos del ataque dentro de la zona de anotación, es touchdown.
  const ultimo = estados[estados.length - 1];
  const balonFinal = ultimo.portador ? donde(jugadores.get(ultimo.portador).claves, fin) : c.punto(ultimo.balon);
  const anotacion = c.yardasAlGol !== null && !!ultimo.portador && bandoDe(ultimo.portador) === 'ataque' && balonFinal.x >= 100;
  if (anotacion) { eventos.push({ t: fin, tipo: 'touchdown' }); gesto(ultimo.portador, fin + 0.3, 'celebrar', 2); }

  const lista = [...jugadores.values()];
  for (const j of lista) j.gestos.sort((a, b) => a.t - b.t);
  const inicio = puntoBalon(estados[0], 0);
  return {
    forma: 'clasica',
    id: jugada.id,
    duracion: Math.round((fin + (anotacion ? 3 : 0.8)) * 100) / 100,
    tiempos,
    sentido: 1,
    tSnap: c.conLinea && tiempos.length > 1 ? ESPERA_INICIAL : null,
    desde: inicio.x,
    hasta: balonFinal.x,
    scrimmage: c.conLinea ? c.origen : null,
    marca: typeof jugada.marca === 'number' ? limitar(c.fondoDe(jugada.marca), 0, 100) : null,
    resultado: '',
    anotacion,
    ataque: { ...ATAQUE },
    defensa: { ...DEFENSA },
    jugadores: lista,
    balon: balon.filter((s) => s.t1 > s.t0).sort((a, b) => a.t0 - b.t0),
    eventos: eventos.sort((a, b) => a.t - b.t),
    rotulos: lista.filter((j) => j.papel).map((j) => ({ jugador: j.id, papel: j.papel, nombre: j.papel, numero: '' })),
    descripcion: `${jugada.nombre}. ${jugada.resumen}`,
    aviso: AVISO_CLASICA,
  };
}
