// Jugadas clásicas de La Pizarra: datos y una función pura que calcula cada paso.
// Cancha esquemática de 100 x 70 (no está a escala). El ataque (O) va hacia ARRIBA; la defensa (X) lo espera arriba.
// Cada jugador: [x, y, bando, letra opcional]. Bando 'o' = ataque (círculos), 'x' = defensa (cruces).
// Cada paso: título, texto, a dónde se mueve cada jugador y quién o dónde queda el balón.
// `vuelo: true` = el balón viaja por el aire en ese paso (pase o patada).

const LINEA = 42; // línea de golpeo de las jugadas de ataque

// Formación base: 5 linieros, ala cerrada, 3 receptores, mariscal y corredor contra una defensa 4-3.
const ATAQUE_BASE = {
  T1: [40, 44, 'o'], G1: [45, 44, 'o'], CE: [50, 44, 'o'], G2: [55, 44, 'o'], T2: [60, 44, 'o'],
  AC: [65, 44, 'o', 'A'],
  R1: [10, 44, 'o', 'R'], R2: [90, 45, 'o', 'R'], R3: [78, 46, 'o', 'R'],
  MC: [50, 49, 'o', 'M'], CO: [50, 57, 'o', 'C'],
};
const DEFENSA_BASE = {
  D1: [38, 39, 'x'], D2: [46, 39, 'x'], D3: [54, 39, 'x'], D4: [63, 39, 'x'],
  L1: [40, 31, 'x'], L2: [50, 31, 'x'], L3: [61, 31, 'x'],
  E1: [10, 35, 'x'], E2: [90, 35, 'x'],
  P1: [35, 17, 'x'], P2: [66, 17, 'x'],
};

export const LETRAS = {
  M: 'Mariscal de campo (quarterback): el que lanza',
  C: 'Corredor (running back)',
  R: 'Receptor',
  A: 'Ala cerrada (tight end): bloquea y también atrapa pases',
  P: 'Pateador',
};

export const CLASICAS = [
  {
    id: 'play-action',
    nombre: 'Play action: el engaño de carrera',
    concepto: 'play-action',
    resumen: 'El ataque finge una carrera para que la defensa se acerque, y entonces lanza un pase a la espalda de los que mordieron el anzuelo.',
    cuando: 'Funciona mejor cuando el equipo ya corrió varias veces con éxito: la defensa está esperando otra carrera.',
    linea: LINEA,
    jugadores: { ...ATAQUE_BASE, ...DEFENSA_BASE },
    balon: 'CE',
    pasos: [
      { titulo: 'Antes de la jugada', texto: 'Formación normal. Nada delata lo que viene: desde aquí el ataque puede correr o pasar. El balón lo tiene el centro, en medio de la línea.' },
      { titulo: 'El mariscal finge la entrega', texto: 'El mariscal (M) recibe el balón, estira el brazo hacia el corredor (C) como si se lo diera… y se lo queda. El corredor se lanza contra la línea como si lo llevara.',
        balon: 'MC', mover: { MC: [50, 53], CO: [47, 47], T1: [40, 43], G1: [45, 43], CE: [50, 43], G2: [55, 43], T2: [60, 43], D1: [38, 40], D2: [46, 40], D3: [54, 40], D4: [63, 40] } },
      { titulo: 'La defensa muerde el anzuelo', texto: 'Los defensores del medio ven "carrera" y corren hacia adelante para frenarla. Al mismo tiempo, los receptores (R) y el ala cerrada (A) salen a toda velocidad hacia el espacio que esos defensores acaban de dejar.',
        mover: { L1: [42, 38], L2: [49, 38], L3: [58, 38], P2: [64, 26], R1: [13, 22], R2: [88, 24], R3: [72, 30], AC: [62, 18], MC: [50, 57] } },
      { titulo: 'Pase al hueco', texto: 'El mariscal lanza al ala cerrada, que quedó sola a la espalda de los defensores que subieron. Cuando sale bien, es una ganancia grande; por eso el engaño vale la pena.',
        balon: 'AC', vuelo: true, mover: { AC: [60, 13], P1: [44, 14], P2: [63, 20] } },
    ],
  },
  {
    id: 'screen',
    nombre: 'Screen: el pase pantalla',
    concepto: 'screen',
    resumen: 'El ataque deja pasar a propósito a los defensores que van por el mariscal y lanza un pase corto por encima de ellos a un corredor que tiene una "pantalla" de bloqueadores por delante.',
    cuando: 'Se usa contra defensas que presionan mucho al mariscal: su agresividad se vuelve en su contra.',
    linea: LINEA,
    jugadores: { ...ATAQUE_BASE, ...DEFENSA_BASE },
    balon: 'CE',
    pasos: [
      { titulo: 'Antes de la jugada', texto: 'Parece una jugada de pase cualquiera. Los cuatro defensores de la línea (las X de adelante) se preparan para ir por el mariscal.' },
      { titulo: 'Los dejan pasar', texto: 'El mariscal (M) retrocede con el balón. Los bloqueadores frenan un instante a los defensores y luego los sueltan a propósito. La defensa cree que va a capturar al mariscal.',
        balon: 'MC', mover: { MC: [50, 60], D1: [41, 50], D2: [47, 52], D3: [53, 52], D4: [60, 50], R1: [12, 30], R2: [88, 30], R3: [76, 32], AC: [68, 34], E1: [12, 24], E2: [88, 24] } },
      { titulo: 'Se arma la pantalla', texto: 'Tres bloqueadores se escapan hacia un costado y forman un muro. El corredor (C) se desliza detrás de ellos, sin que nadie lo siga.',
        mover: { T1: [20, 42], G1: [27, 40], CE: [34, 42], CO: [26, 50], MC: [51, 63], D1: [44, 57], D2: [48, 58], D3: [53, 58], D4: [57, 57] } },
      { titulo: 'Pase corto por encima', texto: 'Justo antes de que lo alcancen, el mariscal suelta un pase suave por encima de los defensores. El corredor lo atrapa con todo el campo por delante.',
        balon: 'CO', vuelo: true },
      { titulo: 'A correr detrás del muro', texto: 'Los que iban por el mariscal quedaron atrás, fuera de la jugada. El corredor avanza detrás de sus bloqueadores: un pase de 2 yardas se convierte en una ganancia de 15 o más.',
        mover: { CO: [22, 22], T1: [17, 30], G1: [25, 27], CE: [31, 30], L1: [36, 33], E1: [15, 26] } },
    ],
  },
  {
    id: 'blitz',
    nombre: 'Blitz: la carga',
    concepto: 'blitz',
    resumen: 'La defensa manda más jugadores de lo normal a perseguir al mariscal, para capturarlo o apurarlo antes de que pueda lanzar bien.',
    cuando: 'Es una apuesta: si llegan, es una captura o un mal pase; si no llegan, quedan menos defensores cubriendo a los receptores.',
    linea: LINEA,
    jugadores: { ...ATAQUE_BASE, ...DEFENSA_BASE },
    balon: 'CE',
    pasos: [
      { titulo: 'Antes de la jugada', texto: 'Lo normal es que cuatro defensores (las X de adelante) vayan por el mariscal y los otros siete cubran. Aquí la defensa prepara algo distinto.' },
      { titulo: 'Se acercan a la línea', texto: 'Dos defensores de la segunda fila se acercan a la línea antes de que empiece la jugada. A veces lo hacen para asustar y luego retroceden; esta vez van en serio.',
        mover: { L1: [42, 38], L3: [59, 38] } },
      { titulo: 'Cargan seis contra cinco', texto: 'Empieza la jugada y cargan seis defensores. El ataque solo tiene cinco bloqueadores en la línea: el corredor (C) frena a uno, pero otro queda libre y va directo al mariscal (M).',
        balon: 'MC', mover: { MC: [50, 57], D1: [39, 43], D2: [46, 43], D3: [54, 43], D4: [62, 43], L1: [43, 50], L3: [57.5, 49], CO: [57, 53], T1: [40, 46], G1: [45, 46], CE: [50, 46], G2: [55, 46], T2: [60, 46] } },
      { titulo: 'La respuesta: pase rápido', texto: 'El defensor que cargó dejó un hueco donde estaba parado. Si el mariscal lo ve a tiempo, lanza rápido a un receptor (R) que corre hacia ese hueco. Si tarda un segundo de más, lo capturan y pierde yardas.',
        balon: 'R3', vuelo: true, mover: { R3: [62, 33], L1: [47, 55], R1: [12, 30], R2: [88, 30], AC: [70, 36] } },
    ],
  },
  {
    id: 'hail-mary',
    nombre: 'Hail Mary: el Ave María',
    concepto: 'hail-mary',
    resumen: 'Un pase larguísimo y desesperado a la zona de anotación, con todos los receptores corriendo al mismo lugar, a ver si alguno lo atrapa entre la multitud.',
    cuando: 'Solo en la última jugada de una mitad o del partido, cuando el equipo va perdiendo y está demasiado lejos para otra cosa.',
    linea: 52,
    zonaDeAnotacion: 12,
    balon: 'CE',
    jugadores: {
      T1: [40, 54, 'o'], G1: [45, 54, 'o'], CE: [50, 54, 'o'], G2: [55, 54, 'o'], T2: [60, 54, 'o'],
      R1: [12, 54, 'o', 'R'], R2: [76, 54, 'o', 'R'], R3: [83, 55, 'o', 'R'], R4: [90, 54, 'o', 'R'],
      MC: [50, 61, 'o', 'M'], CO: [44, 61, 'o', 'C'],
      D1: [42, 49, 'x'], D2: [50, 49, 'x'], D3: [58, 49, 'x'],
      L1: [30, 36, 'x'], L2: [66, 36, 'x'],
      E1: [14, 34, 'x'], E2: [78, 34, 'x'], E3: [88, 34, 'x'],
      P1: [30, 16, 'x'], P2: [55, 14, 'x'], P3: [78, 16, 'x'],
    },
    pasos: [
      { titulo: 'Última jugada', texto: 'Quedan segundos y el ataque necesita un touchdown desde muy lejos. La defensa lo sabe: solo manda tres jugadores por el mariscal y pone a todos los demás bien atrás, cuidando la zona de anotación (la franja de arriba).' },
      { titulo: 'Todos corren al mismo lugar', texto: 'Los cuatro receptores (R) corren en línea recta hasta la zona de anotación y se juntan en el mismo punto. El mariscal (M) retrocede y se mueve para ganar tiempo: el pase necesita que ellos lleguen.',
        balon: 'MC', mover: { MC: [56, 65], R1: [58, 9], R2: [70, 8], R3: [76, 10], R4: [82, 7], CO: [52, 61], D1: [43, 58], D2: [50, 58], D3: [59, 58], L1: [48, 22], L2: [68, 22], E1: [60, 12], E2: [72, 11], E3: [80, 11], P1: [64, 6], P2: [72, 5], P3: [79, 5] } },
      { titulo: 'El pase más largo que puede lanzar', texto: 'El mariscal lanza el balón lo más alto y lejos que puede, hacia el grupo. Arriba se junta una multitud: receptores saltando para atraparlo y defensores saltando para tirarlo al suelo.',
        balon: [73, 8], vuelo: true },
      { titulo: 'Casi nunca sale… pero a veces sí', texto: 'Lo normal es que la defensa lo manotee y el partido termine ahí. Pero si un receptor lo atrapa, es touchdown en la última jugada. Por eso se llama "Ave María": se lanza y se reza.',
        balon: 'R2', mover: { R2: [74, 7.5] } },
    ],
  },
  {
    id: 'onside-kick',
    nombre: 'Onside kick: la patada corta',
    concepto: 'patada-corta',
    resumen: 'En vez de patear lejos para entregar el balón, el equipo patea corto a propósito e intenta recuperarlo él mismo.',
    cuando: 'La usa el equipo que va perdiendo y casi no tiene tiempo: acaba de anotar, pero necesita el balón otra vez.',
    linea: null,
    marca: 30,
    textoMarca: '10 yardas',
    balon: [50, 50],
    jugadores: {
      K1: [8, 52, 'o'], K2: [18, 52, 'o'], K3: [28, 52, 'o'], K4: [38, 52, 'o'],
      PA: [47, 56, 'o', 'P'],
      K5: [58, 52, 'o'], K6: [66, 52, 'o'], K7: [73, 52, 'o'], K8: [80, 52, 'o'], K9: [87, 52, 'o'], K10: [94, 52, 'o'],
      M1: [12, 28, 'x'], M2: [26, 28, 'x'], M3: [40, 28, 'x'], M4: [54, 28, 'x'], M5: [66, 28, 'x'], M6: [77, 28, 'x'], M7: [88, 28, 'x'],
      M8: [34, 18, 'x'], M9: [70, 18, 'x'], M10: [50, 8, 'x'], M11: [84, 20, 'x'],
    },
    pasos: [
      { titulo: 'Antes de la patada', texto: 'El equipo que patea (O) acaba de anotar y sigue perdiendo. Carga más jugadores hacia un lado. El rival (X) lo ve venir y pone adelante a sus jugadores con mejores manos. La línea amarilla marca 10 yardas desde el balón.' },
      { titulo: 'Patada corta y rastrera', texto: 'El pateador (P) golpea el balón por arriba para que salga botando de forma impredecible hacia el lado cargado. Sus compañeros corren detrás del balón.',
        balon: [80, 33], vuelo: true, mover: { PA: [50, 51], K5: [62, 40], K6: [70, 38], K7: [76, 37], K8: [82, 37], K9: [88, 38], K10: [93, 40], K1: [10, 44], K2: [20, 44], K3: [30, 44], K4: [40, 44] } },
      { titulo: 'La regla de las 10 yardas', texto: 'El equipo que pateó no puede tocar el balón hasta que cruce la línea amarilla (10 yardas), salvo que el rival lo toque primero. Por eso todos llegan al mismo tiempo que el balón, justo sobre esa línea.',
        balon: [80, 29], mover: { K6: [74, 32], K7: [78, 31], K8: [82, 31], K9: [86, 32], M5: [72, 29], M6: [79, 28], M7: [85, 29], M11: [82, 24] } },
      { titulo: 'El que lo agarre, se lo queda', texto: 'Si lo recupera el equipo que pateó, conserva el balón y sigue vivo. Pero casi siempre lo recupera el rival, que además queda muy cerca de anotar. Es una apuesta de último recurso.',
        balon: 'M6', mover: { M6: [80, 28] } },
    ],
  },
];

// Calcula, para cada paso, dónde está cada jugador y el balón. Función pura.
// Devuelve [{ titulo, texto, vuelo, posiciones: { id: [x, y] }, balon: [x, y], portador: id | null, movidos: [id] }]
export function estadosDe(jugada) {
  const posiciones = {};
  for (const [id, j] of Object.entries(jugada?.jugadores || {})) posiciones[id] = [j[0], j[1]];
  let balon = jugada?.balon ?? null;
  const estados = [];
  for (const paso of jugada?.pasos || []) {
    const movidos = [];
    for (const [id, destino] of Object.entries(paso.mover || {})) {
      if (!posiciones[id]) throw new Error(`${jugada.id}: el paso "${paso.titulo}" mueve a un jugador que no existe: ${id}`);
      posiciones[id] = [destino[0], destino[1]];
      movidos.push(id);
    }
    if (paso.balon !== undefined) balon = paso.balon;
    const portador = typeof balon === 'string' ? balon : null;
    if (portador && !posiciones[portador]) throw new Error(`${jugada.id}: el balón está en un jugador que no existe: ${portador}`);
    const dondeBalon = portador ? [...posiciones[portador]] : Array.isArray(balon) ? [balon[0], balon[1]] : null;
    estados.push({
      titulo: paso.titulo,
      texto: paso.texto,
      vuelo: !!paso.vuelo,
      posiciones: Object.fromEntries(Object.entries(posiciones).map(([id, p]) => [id, [...p]])),
      balon: dondeBalon,
      portador,
      movidos,
    });
  }
  return estados;
}
