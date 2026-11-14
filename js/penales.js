// Diccionario de penales: del nombre que usa la liga a una explicación en español simple.
// Clave: el `slug` que entrega ESPN en `penalty.type.slug` (o el nombre del texto convertido a slug).
//   nombre:   cómo se le dice en español (con el término en inglés cuando ayuda a reconocerlo en la transmisión)
//   explica:  qué pasó, en una frase, empezando en minúscula y sin punto final
//   extra:    consecuencia especial, si la tiene (primer down automático, pérdida de down, etc.)
//   concepto: id del término del glosario que mejor lo explica

export const PENALES = {
  'offensive-holding': {
    nombre: 'sujetar en ataque (holding)',
    explica: 'un bloqueador agarró a un defensor para que no llegara al balón',
    concepto: 'holding',
  },
  'false-start': {
    nombre: 'salida en falso',
    explica: 'un jugador del ataque se movió antes de que el balón se pusiera en juego',
    concepto: 'salida-en-falso',
  },
  'defensive-pass-interference': {
    nombre: 'interferencia de pase defensiva',
    explica: 'el defensor estorbó con contacto al receptor antes de que llegara el balón',
    extra: 'El ataque avanza hasta donde fue la falta y recibe primer down automático',
    concepto: 'interferencia-de-pase',
  },
  'offensive-pass-interference': {
    nombre: 'interferencia de pase ofensiva',
    explica: 'el receptor empujó o estorbó a su marcador para quedar libre',
    concepto: 'interferencia-de-pase',
  },
  'delay-of-game': {
    nombre: 'retraso de juego',
    explica: 'el ataque no puso el balón en juego antes de que se agotaran los 40 segundos que tiene entre jugadas',
    concepto: 'reloj-de-jugada',
  },
  'defensive-delay-of-game': {
    nombre: 'retraso de juego de la defensa',
    explica: 'un defensor impidió a propósito que el ataque pudiera arrancar la siguiente jugada',
    concepto: 'reloj-de-jugada',
  },
  'defensive-holding': {
    nombre: 'sujetar en defensa (holding)',
    explica: 'un defensor agarró a un receptor o a un bloqueador',
    extra: 'Además de las yardas, el ataque recibe primer down automático',
    concepto: 'holding',
  },
  'unnecessary-roughness': {
    nombre: 'rudeza innecesaria',
    explica: 'hubo un golpe peligroso o tardío, más allá de lo que permite el reglamento',
    concepto: 'falta-personal',
  },
  'defensive-offside': {
    nombre: 'fuera de lugar de la defensa (offside)',
    explica: 'un defensor estaba del lado equivocado de la línea cuando arrancó la jugada',
    concepto: 'fuera-de-lugar',
  },
  'offensive-offside': {
    nombre: 'fuera de lugar del ataque (offside)',
    explica: 'un jugador del ataque estaba adelantado respecto al balón cuando arrancó la jugada',
    concepto: 'fuera-de-lugar',
  },
  'neutral-zone-infraction': {
    nombre: 'infracción en la zona neutral',
    explica: 'un defensor se metió antes de tiempo en el espacio que separa a las dos líneas y provocó que el ataque se moviera',
    concepto: 'fuera-de-lugar',
  },
  encroachment: {
    nombre: 'invasión (encroachment)',
    explica: 'un defensor cruzó la línea y tocó a un rival antes de que arrancara la jugada',
    concepto: 'fuera-de-lugar',
  },
  'roughing-the-passer': {
    nombre: 'rudeza contra el pasador',
    explica: 'golpearon al mariscal de campo tarde o de una forma prohibida cuando ya había soltado el balón',
    extra: 'Son yardas y primer down automático para el ataque',
    concepto: 'falta-personal',
  },
  'roughing-the-kicker': {
    nombre: 'rudeza contra el pateador',
    explica: 'derribaron al pateador sin haber tocado antes el balón',
    extra: 'Son yardas y primer down automático: el equipo que iba a patear conserva el balón',
    concepto: 'falta-personal',
  },
  'running-into-the-kicker': {
    nombre: 'contacto con el pateador',
    explica: 'un defensor chocó levemente con el pateador después de la patada',
    concepto: 'falta-personal',
  },
  'face-mask': {
    nombre: 'agarrar la máscara (face mask)',
    explica: 'jalaron a un rival de la rejilla del casco, algo prohibido porque puede lastimar el cuello',
    concepto: 'falta-personal',
  },
  'horse-collar-tackle': {
    nombre: 'tacleada de collar (horse collar)',
    explica: 'derribaron al rival jalándolo desde atrás por el cuello del uniforme',
    concepto: 'falta-personal',
  },
  'lowering-the-head-to-make-forcible-contact': {
    nombre: 'golpear con la corona del casco',
    explica: 'un jugador bajó la cabeza para embestir con el casco por delante',
    concepto: 'falta-personal',
  },
  'illegal-formation': {
    nombre: 'formación ilegal',
    explica: 'el equipo se acomodó mal antes de la jugada (el ataque, por ejemplo, debe tener al menos 7 jugadores sobre la línea)',
    concepto: 'formacion',
  },
  'illegal-shift': {
    nombre: 'cambio ilegal (illegal shift)',
    explica: 'varios jugadores del ataque se reacomodaron y no se quedaron quietos un segundo completo antes de arrancar',
    concepto: 'formacion',
  },
  'illegal-motion': {
    nombre: 'movimiento ilegal',
    explica: 'un jugador del ataque iba avanzando hacia la línea en el momento en que se puso el balón en juego',
    concepto: 'formacion',
  },
  'illegal-block-above-the-waist': {
    nombre: 'bloqueo ilegal por la espalda',
    explica: 'bloquearon a un rival desde atrás, algo frecuente en los regresos de patada',
    concepto: 'bloqueo',
  },
  'illegal-blindside-block': {
    nombre: 'bloqueo ilegal por el lado ciego',
    explica: 'un jugador bloqueó con fuerza a un rival que no lo veía venir',
    concepto: 'bloqueo',
  },
  'chop-block': {
    nombre: 'bloqueo doble a las piernas (chop block)',
    explica: 'dos bloqueadores atacaron al mismo defensor, uno arriba y otro a las piernas',
    concepto: 'bloqueo',
  },
  'low-block': {
    nombre: 'bloqueo bajo ilegal',
    explica: 'bloquearon a un rival por debajo de la cintura en una situación en la que no está permitido',
    concepto: 'bloqueo',
  },
  'illegal-double-team-block': {
    nombre: 'bloqueo doble ilegal',
    explica: 'dos jugadores bloquearon juntos al mismo rival en una patada de salida, algo que ya no se permite',
    concepto: 'bloqueo',
  },
  'illegal-crackback': {
    nombre: 'bloqueo de regreso ilegal (crackback)',
    explica: 'un jugador abierto volvió hacia el centro y bloqueó bajo a un defensor',
    concepto: 'bloqueo',
  },
  clipping: {
    nombre: 'bloqueo por detrás a las piernas (clipping)',
    explica: 'bloquearon a un rival desde atrás y por debajo de la cintura',
    concepto: 'bloqueo',
  },
  tripping: {
    nombre: 'zancadilla',
    explica: 'un jugador usó la pierna para hacer caer a un rival',
    concepto: 'falta-personal',
  },
  'illegal-use-of-hands': {
    nombre: 'uso ilegal de las manos',
    explica: 'un jugador puso las manos en la cara o en el cuello de un rival',
    concepto: 'bloqueo',
  },
  'illegal-contact': {
    nombre: 'contacto ilegal',
    explica: 'un defensor empujó a un receptor a más de 5 yardas de la línea, antes de que saliera el pase',
    extra: 'Son 5 yardas y primer down automático',
    concepto: 'interferencia-de-pase',
  },
  'ineligible-downfield-pass': {
    nombre: 'jugador inelegible campo abajo',
    explica: 'un liniero ofensivo, que no puede recibir pases, avanzó demasiado antes de que se lanzara el balón',
    concepto: 'linea-ofensiva',
  },
  'ineligible-downfield-kick': {
    nombre: 'jugador adelantado en una patada',
    explica: 'un jugador del equipo que pateaba salió corriendo campo abajo antes de la patada',
    concepto: 'punt',
  },
  'illegal-touch-pass': {
    nombre: 'toque ilegal de un pase',
    explica: 'el primero en tocar el pase fue un jugador que no tenía permitido recibirlo',
    concepto: 'linea-ofensiva',
  },
  'illegal-touch-kick': {
    nombre: 'toque ilegal de una patada',
    explica: 'el equipo que pateó tocó el balón antes de que pudiera hacerlo',
    concepto: 'punt',
  },
  'illegal-forward-pass': {
    nombre: 'pase adelantado ilegal',
    explica: 'lanzaron hacia adelante cuando ya habían cruzado la línea de golpeo, o fue un segundo pase adelantado',
    concepto: 'linea-de-golpeo',
  },
  'illegal-forward-handoff': {
    nombre: 'entrega adelantada ilegal',
    explica: 'entregaron el balón en la mano hacia adelante a un jugador que no podía recibirlo así',
    concepto: 'linea-de-golpeo',
  },
  'intentional-grounding': {
    nombre: 'lanzamiento intencional al suelo (intentional grounding)',
    explica: 'el mariscal de campo tiró el balón adonde no había ningún compañero solo para evitar que lo capturaran',
    extra: 'Pierden yardas y también el down',
    concepto: 'sack',
  },
  'unsportsmanlike-conduct': {
    nombre: 'conducta antideportiva',
    explica: 'hubo un comportamiento fuera de lugar, como reclamar de más o provocar al rival',
    concepto: 'falta-personal',
  },
  taunting: {
    nombre: 'burla al rival (taunting)',
    explica: 'un jugador se burló de un rival después de la jugada',
    concepto: 'falta-personal',
  },
  disqualification: {
    nombre: 'expulsión',
    explica: 'los árbitros sacaron del partido a un jugador por una falta grave',
    concepto: 'falta-personal',
  },
  'defensive-too-many-men-on-field': {
    nombre: 'demasiados jugadores en el campo (defensa)',
    explica: 'la defensa tenía 12 jugadores en lugar de 11 cuando arrancó la jugada',
    concepto: 'formacion',
  },
  'offensive-too-many-men-on-field': {
    nombre: 'demasiados jugadores en el campo (ataque)',
    explica: 'el ataque tenía 12 jugadores en lugar de 11',
    concepto: 'formacion',
  },
  'illegal-substitution': {
    nombre: 'sustitución ilegal',
    explica: 'un equipo hizo mal un cambio de jugadores, por ejemplo entrando con uno de más a la reunión',
    concepto: 'formacion',
  },
  'kickoff-short-of-landing-zone': {
    nombre: 'patada de salida demasiado corta',
    explica: 'la patada cayó antes de la zona de aterrizaje, que va de la yarda 20 a la zona de anotación',
    extra: 'El rival empieza a atacar desde su yarda 40',
    concepto: 'patada-de-salida',
  },
  'kickoff-out-of-bounds': {
    nombre: 'patada de salida fuera del campo',
    explica: 'la patada salió por un costado sin que nadie la tocara',
    extra: 'El rival empieza a atacar desde su yarda 40',
    concepto: 'patada-de-salida',
  },
  'player-out-of-bounds-on-kick': {
    nombre: 'jugador fuera del campo en una patada',
    explica: 'un jugador del equipo que pateaba salió del campo por su cuenta mientras iba a cubrir la patada',
    concepto: 'punt',
  },
  'fair-catch-interference': {
    nombre: 'interferencia con la recepción libre',
    explica: 'no dejaron espacio al jugador que había pedido atrapar la patada sin ser tocado',
    concepto: 'recepcion-libre',
  },
  'invalid-fair-catch-signal': {
    nombre: 'señal inválida de recepción libre',
    explica: 'el jugador que iba a recibir la patada hizo mal la señal con el brazo',
    concepto: 'recepcion-libre',
  },
  leverage: {
    nombre: 'apoyo ilegal para bloquear una patada (leverage)',
    explica: 'un defensor se apoyó en otro jugador para saltar más alto e intentar tapar la patada',
    concepto: 'gol-de-campo',
  },
};

// Convierte un nombre de penal del texto ("Offensive Holding") al slug de ESPN ("offensive-holding").
export function slugDePenal(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Busca un penal por slug o por nombre en inglés. Devuelve null si no lo conoce.
export function buscarPenal(slugONombre) {
  const slug = slugDePenal(slugONombre);
  return PENALES[slug] || null;
}
