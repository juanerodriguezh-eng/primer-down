// Glosario de Primer Down: términos explicados en español simple, cada uno con un ejemplo.
// El motor de explicaciones devuelve ids de esta lista en `conceptos`; una prueba comprueba que todos existan.

export const GRUPOS = [
  { id: 'basico', titulo: 'Lo básico' },
  { id: 'anotaciones', titulo: 'Cómo se anota' },
  { id: 'jugadas', titulo: 'Jugadas de ataque y defensa' },
  { id: 'patadas', titulo: 'Patadas' },
  { id: 'reglas', titulo: 'Reglas, banderas y reloj' },
  { id: 'posiciones', titulo: 'Quién es quién' },
  { id: 'clasicas', titulo: 'Jugadas con nombre propio' },
];

export const GLOSARIO = [
  // ---------- Lo básico ----------
  {
    id: 'down', grupo: 'basico', termino: 'Down (oportunidad)',
    definicion: 'Cada intento que tiene el ataque para avanzar. Recibe cuatro seguidos para ganar 10 yardas; si lo logra, le dan otros cuatro.',
    ejemplo: '“2.ª y 7” significa: segunda oportunidad y faltan 7 yardas para renovar.',
  },
  {
    id: 'primer-down', grupo: 'basico', termino: 'Primer down (primero y diez)',
    definicion: 'Lo que consigue el ataque al avanzar las yardas que le faltaban: la cuenta vuelve a empezar con cuatro oportunidades nuevas.',
    ejemplo: 'Era 3.ª y 4, el pase ganó 6 yardas: primer down, siguen atacando.',
  },
  {
    id: 'yarda', grupo: 'basico', termino: 'Yarda',
    definicion: 'La unidad con la que se mide el campo. Una yarda son 91 centímetros y el campo tiene 100 de una zona de anotación a la otra. Cada mitad se numera del 1 al 50.',
    ejemplo: '“La yarda 25 de los Giants” está en la mitad que defienden los Giants, a 25 yardas de su propia zona de anotación.',
  },
  {
    id: 'linea-de-golpeo', grupo: 'basico', termino: 'Línea de golpeo (line of scrimmage)',
    definicion: 'La línea imaginaria donde está el balón antes de cada jugada. Nadie puede cruzarla hasta que el balón se pone en juego.',
    ejemplo: 'Si derriban al corredor detrás de la línea de golpeo, la jugada pierde yardas.',
  },
  {
    id: 'drive', grupo: 'basico', termino: 'Serie ofensiva (drive)',
    definicion: 'Todas las jugadas seguidas de un equipo desde que recibe el balón hasta que anota, lo pierde o lo patea.',
    ejemplo: '“Avance de 8 jugadas y 65 yardas que terminó en touchdown”.',
  },
  {
    id: 'zona-de-anotacion', grupo: 'basico', termino: 'Zona de anotación (end zone)',
    definicion: 'Las 10 yardas pintadas en cada extremo del campo. Llegar con el balón a la del rival es touchdown.',
    ejemplo: 'El receptor atrapó el pase con los dos pies dentro de la zona de anotación: touchdown.',
  },
  {
    id: 'zona-roja', grupo: 'basico', termino: 'Zona roja (red zone)',
    definicion: 'Las últimas 20 yardas antes de la zona de anotación rival. Ahí lo esperado es anotar: como mínimo, un gol de campo.',
    ejemplo: 'Con el balón en la yarda 12 del rival, el ataque ya está en zona roja.',
  },
  {
    id: 'gol-o-nada', grupo: 'basico', termino: 'Primero y gol (goal to go)',
    definicion: 'Cuando el ataque está a menos de 10 yardas de la zona de anotación ya no puede ganar otro primer down: solo le sirve anotar.',
    ejemplo: '“1.ª y gol en la yarda 4”: tienen cuatro intentos para entrar.',
  },
  {
    id: 'tercera-oportunidad', grupo: 'basico', termino: 'Tercera oportunidad',
    definicion: 'El intento decisivo. Si el ataque no llega a la marca, en la cuarta casi siempre patea, así que la defensa se juega mucho en detenerlo.',
    ejemplo: 'En 3.ª y 9 se espera un pase: correr rara vez gana tantas yardas.',
  },
  {
    id: 'cuarta-oportunidad', grupo: 'basico', termino: 'Cuarta oportunidad',
    definicion: 'El último intento. El equipo elige entre despejar para alejar al rival, patear un gol de campo si está cerca, o jugársela sabiendo que, si falla, entrega el balón ahí mismo.',
    ejemplo: '4.ª y 1 en la yarda 40 del rival: muy lejos para gol de campo y muy cerca para despejar, así que muchos equipos se la juegan.',
  },
  {
    id: 'entrega-por-downs', grupo: 'basico', termino: 'Entrega por downs',
    definicion: 'Cuando el ataque se la juega en cuarta oportunidad y no llega a la marca, el rival toma el balón en ese mismo punto.',
    ejemplo: 'Faltaba 1 yarda en cuarta, la carrera fue detenida: balón para el otro equipo.',
  },
  {
    id: 'probabilidad-de-ganar', grupo: 'basico', termino: 'Probabilidad de ganar',
    definicion: 'Un cálculo que estima qué tan probable es que cada equipo gane según el marcador, el tiempo y la posición del balón. Las jugadas que más la mueven son las que marcamos como jugada clave.',
    ejemplo: 'Una intercepción al final del partido puede mover la probabilidad 40 puntos de golpe.',
  },

  // ---------- Cómo se anota ----------
  {
    id: 'touchdown', grupo: 'anotaciones', termino: 'Touchdown',
    definicion: 'La anotación más valiosa: 6 puntos por llegar con el balón a la zona de anotación rival, corriendo o atrapando un pase. Después viene un intento extra.',
    ejemplo: 'Pase de 12 yardas atrapado dentro de la zona de anotación: touchdown, 6 puntos.',
  },
  {
    id: 'punto-extra', grupo: 'anotaciones', termino: 'Punto extra',
    definicion: 'La patada que sigue a un touchdown. Si pasa entre los postes, suma 1 punto. Se patea desde 33 yardas y casi siempre entra.',
    ejemplo: 'Touchdown más punto extra: 7 puntos en total.',
  },
  {
    id: 'conversion-de-2', grupo: 'anotaciones', termino: 'Conversión de 2 puntos',
    definicion: 'En lugar de patear el punto extra, el equipo juega una sola jugada desde la yarda 2. Si entra a la zona de anotación, suma 2 puntos; si falla, nada.',
    ejemplo: 'Perdiendo por 8, un touchdown con conversión de 2 empata el partido.',
  },
  {
    id: 'gol-de-campo', grupo: 'anotaciones', termino: 'Gol de campo',
    definicion: 'Una patada que pasa entre los postes y vale 3 puntos. Su distancia es la yarda donde está el balón más unas 18: las 10 de la zona de anotación y las que retrocede el pateador.',
    ejemplo: 'Desde la yarda 28 del rival, el intento es de 46 yardas.',
  },
  {
    id: 'safety', grupo: 'anotaciones', termino: 'Safety',
    definicion: 'Dos puntos para la defensa cuando derriba al jugador que lleva el balón dentro de su propia zona de anotación. Además, el equipo castigado tiene que patearle el balón al rival.',
    ejemplo: 'Capturan al mariscal de campo dentro de su zona de anotación: 2 puntos y balón para el rival.',
  },
  {
    id: 'pick-six', grupo: 'anotaciones', termino: 'Intercepción para touchdown (pick six)',
    definicion: 'Cuando un defensor intercepta un pase y lo lleva hasta la zona de anotación contraria. Son 6 puntos para la defensa.',
    ejemplo: 'El esquinero adivinó el pase, lo atrapó y corrió 67 yardas sin que nadie lo alcanzara.',
  },

  // ---------- Jugadas ----------
  {
    id: 'pase-completo', grupo: 'jugadas', termino: 'Pase completo',
    definicion: 'El mariscal de campo lanza y un compañero atrapa el balón antes de que toque el suelo. La jugada sigue hasta que derriban al receptor o sale del campo.',
    ejemplo: 'Pase corto de 4 yardas y el receptor corre 9 más: ganancia de 13.',
  },
  {
    id: 'pase-incompleto', grupo: 'jugadas', termino: 'Pase incompleto',
    definicion: 'El balón toca el suelo sin que nadie lo atrape. No se ganan yardas, se gasta una oportunidad y el reloj se detiene.',
    ejemplo: 'El pase salió alto: incompleto, ahora es 3.ª y 10.',
  },
  {
    id: 'pase-profundo', grupo: 'jugadas', termino: 'Pase corto y pase profundo',
    definicion: 'La liga llama profundo al pase que viaja más de 15 yardas por el aire y corto al resto. El profundo gana mucho de golpe, pero se completa menos.',
    ejemplo: 'Un pase profundo de 45 yardas puede cambiar el partido en una jugada.',
  },
  {
    id: 'carrera', grupo: 'jugadas', termino: 'Carrera',
    definicion: 'Jugada en la que alguien avanza con el balón en las manos en lugar de lanzarlo. Gana menos yardas que un pase, pero es más segura y mantiene el reloj corriendo.',
    ejemplo: 'Carrera por el centro para 4 yardas.',
  },
  {
    id: 'sack', grupo: 'jugadas', termino: 'Captura (sack)',
    definicion: 'Cuando la defensa derriba al mariscal de campo detrás de la línea de golpeo antes de que pueda lanzar. El ataque pierde yardas y una oportunidad.',
    ejemplo: 'Captura de 8 yardas: de 2.ª y 5 pasan a 3.ª y 13.',
  },
  {
    id: 'intercepcion', grupo: 'jugadas', termino: 'Intercepción',
    definicion: 'Un defensor atrapa un pase que iba para un rival. Su equipo se queda con el balón en ese momento.',
    ejemplo: 'El pase iba hacia el centro, pero un apoyador se cruzó y lo atrapó.',
  },
  {
    id: 'fumble', grupo: 'jugadas', termino: 'Balón suelto (fumble)',
    definicion: 'El jugador que lleva el balón lo pierde antes de ser derribado. El balón queda libre y se lo queda el primero que lo recupere, sea del equipo que sea.',
    ejemplo: 'Le golpearon el brazo al corredor, soltó el balón y lo recuperó la defensa.',
  },
  {
    id: 'perdida-de-balon', grupo: 'jugadas', termino: 'Pérdida de balón',
    definicion: 'Cualquier jugada en la que el ataque entrega el balón sin querer: una intercepción o un balón suelto que recupera el rival. Suelen decidir partidos.',
    ejemplo: 'El equipo que pierde menos balones gana la mayoría de las veces.',
  },
  {
    id: 'scramble', grupo: 'jugadas', termino: 'Escapada del mariscal (scramble)',
    definicion: 'El mariscal de campo iba a lanzar, no encontró a nadie libre o sintió la presión, y decidió correr él mismo.',
    ejemplo: 'Nadie estaba libre: el mariscal salió por la derecha y ganó 11 yardas.',
  },
  {
    id: 'arrodillarse', grupo: 'jugadas', termino: 'Arrodillarse (formación de la victoria)',
    definicion: 'El mariscal de campo recibe el balón y pone una rodilla en el suelo de inmediato. Pierde una yarda a propósito para que el reloj siga corriendo sin arriesgar nada.',
    ejemplo: 'Con ventaja y un minuto por jugar, se arrodillan tres veces y se acaba el partido.',
  },
  {
    id: 'spike', grupo: 'jugadas', termino: 'Clavar el balón (spike)',
    definicion: 'El mariscal de campo tira el balón al suelo apenas lo recibe para detener el reloj. Le cuesta una oportunidad, pero ahorra segundos cuando ya no hay tiempos fuera.',
    ejemplo: 'Quedan 12 segundos: clavan el balón y preparan el gol de campo.',
  },
  {
    id: 'lateral', grupo: 'jugadas', termino: 'Pase lateral',
    definicion: 'Un pase hacia un costado o hacia atrás. A diferencia del pase adelantado, se pueden hacer todos los que se quiera, pero si cae al suelo es balón suelto.',
    ejemplo: 'El receptor atrapó el pase y, antes de caer, le dio un lateral a un compañero que siguió corriendo.',
  },
  {
    id: 'yardas-tras-la-recepcion', grupo: 'jugadas', termino: 'Yardas después de la recepción',
    definicion: 'Lo que avanza el receptor corriendo una vez que atrapó el pase. Un pase corto puede volverse una jugada grande gracias a ellas.',
    ejemplo: 'Pase de 3 yardas y 20 más corriendo: 23 en total.',
  },
  {
    id: 'fuera-del-campo', grupo: 'jugadas', termino: 'Salir del campo',
    definicion: 'Cuando el jugador con el balón pisa fuera de las líneas laterales, la jugada termina ahí. Al final de cada mitad, además, eso detiene el reloj.',
    ejemplo: 'Con poco tiempo, el receptor corrió hacia la banda y salió para parar el reloj.',
  },
  {
    id: 'jugada-grande', grupo: 'jugadas', termino: 'Jugada grande',
    definicion: 'Una jugada que gana 20 yardas o más de una sola vez. Son poco frecuentes y acercan mucho al ataque a anotar.',
    ejemplo: 'Pase profundo de 52 yardas hasta la zona roja.',
  },

  // ---------- Patadas ----------
  {
    id: 'patada-de-salida', grupo: 'patadas', termino: 'Patada de salida (kickoff)',
    definicion: 'La patada con la que empieza cada mitad y la que sigue a cada anotación. El equipo que anotó le patea el balón al rival, que intenta regresarlo lo más lejos posible.',
    ejemplo: 'Después del touchdown, patean de salida y el rival regresa el balón hasta su yarda 28.',
  },
  {
    id: 'punt', grupo: 'patadas', termino: 'Despeje (punt)',
    definicion: 'Una patada para alejar al rival de tu zona de anotación. Se usa en cuarta oportunidad cuando no conviene arriesgar: entregas el balón, pero lejos.',
    ejemplo: '4.ª y 8 en tu propia yarda 30: despeje de 45 yardas y el rival arranca en su yarda 25.',
  },
  {
    id: 'touchback', grupo: 'patadas', termino: 'Touchback',
    definicion: 'Cuando una patada llega a la zona de anotación y nadie la regresa, el equipo que recibe empieza en una yarda fija: la 35 en las patadas de salida y la 20 en los despejes.',
    ejemplo: 'La patada cayó en la zona de anotación: touchback, balón en la yarda 35.',
  },
  {
    id: 'recepcion-libre', grupo: 'patadas', termino: 'Recepción libre (fair catch)',
    definicion: 'El jugador que va a atrapar una patada levanta el brazo para pedir que no lo golpeen. A cambio, no puede avanzar: su equipo empieza donde la atrapó.',
    ejemplo: 'Venían cuatro rivales encima: pidió recepción libre en la yarda 14.',
  },
  {
    id: 'patada-corta', grupo: 'patadas', termino: 'Patada corta (onside kick)',
    definicion: 'Una patada de salida muy corta para intentar recuperar el balón uno mismo. Casi nunca funciona, así que solo se intenta cuando vas perdiendo y queda poco tiempo.',
    ejemplo: 'Perdiendo por 7 con un minuto por jugar, la patada corta es la única esperanza.',
  },
  {
    id: 'regreso', grupo: 'patadas', termino: 'Regreso de patada',
    definicion: 'Lo que corre con el balón el jugador que atrapa una patada de salida o un despeje. Un buen regreso le regala yardas a su ataque antes de empezar.',
    ejemplo: 'Regreso de 32 yardas: el ataque empieza en la yarda 35 en lugar de la 20.',
  },
  {
    id: 'muff', grupo: 'patadas', termino: 'Recepción fallida de patada (muff)',
    definicion: 'El jugador que iba a atrapar una patada la toca, pero se le escapa. El balón queda libre y cualquiera puede recuperarlo.',
    ejemplo: 'Se le cayó el despeje y lo recuperó el equipo que había pateado, ya en zona roja.',
  },
  {
    id: 'patada-bloqueada', grupo: 'patadas', termino: 'Patada bloqueada',
    definicion: 'Un defensor alcanza a tocar el balón justo cuando sale del pie del pateador. La patada no llega a su destino y el balón queda libre.',
    ejemplo: 'El gol de campo de 47 yardas fue bloqueado: cero puntos.',
  },

  // ---------- Reglas, banderas y reloj ----------
  {
    id: 'bandera', grupo: 'reglas', termino: 'Bandera amarilla (penal o castigo)',
    definicion: 'El pañuelo que lanzan los árbitros cuando ven una falta. El equipo infractor pierde yardas (5, 10 o 15) y a veces la jugada se repite.',
    ejemplo: 'Bandera en la jugada: 10 yardas hacia atrás por sujetar.',
  },
  {
    id: 'penal-rechazado', grupo: 'reglas', termino: 'Penal rechazado y penales compensados',
    definicion: 'El equipo afectado puede rechazar un penal si el resultado de la jugada le conviene más. Y si los dos equipos cometen falta en la misma jugada, se compensan y la jugada se repite.',
    ejemplo: 'La defensa interceptó el pase, así que rechaza el penal del ataque y se queda con el balón.',
  },
  {
    id: 'holding', grupo: 'reglas', termino: 'Sujetar (holding)',
    definicion: 'Agarrar a un rival que no lleva el balón. En el ataque cuesta 10 yardas; en la defensa, 5 yardas y primer down automático.',
    ejemplo: 'La carrera de 20 yardas no cuenta: hubo holding del ataque.',
  },
  {
    id: 'salida-en-falso', grupo: 'reglas', termino: 'Salida en falso',
    definicion: 'Un jugador del ataque se mueve antes de que el balón se ponga en juego. La jugada ni siquiera empieza y el ataque retrocede 5 yardas.',
    ejemplo: 'Con el estadio haciendo ruido, un liniero se adelantó: 5 yardas de castigo.',
  },
  {
    id: 'fuera-de-lugar', grupo: 'reglas', termino: 'Fuera de lugar (offside)',
    definicion: 'Un jugador está del lado equivocado de la línea de golpeo cuando arranca la jugada. Son 5 yardas. Incluye variantes como la invasión y la infracción en la zona neutral.',
    ejemplo: 'El defensor se adelantó: 5 yardas gratis para el ataque.',
  },
  {
    id: 'interferencia-de-pase', grupo: 'reglas', termino: 'Interferencia de pase',
    definicion: 'Estorbar con contacto a un rival que intenta atrapar un pase. Si la comete la defensa, el ataque avanza hasta el punto de la falta con primer down: puede ser el penal más caro del juego.',
    ejemplo: 'Pase profundo incompleto, pero hubo interferencia: 38 yardas de regalo.',
  },
  {
    id: 'falta-personal', grupo: 'reglas', termino: 'Falta personal',
    definicion: 'Las faltas que ponen en riesgo a un rival o son antideportivas: golpes tardíos, agarrar la máscara, rudeza contra el pasador. Cuestan 15 yardas.',
    ejemplo: 'Golpe al mariscal de campo cuando ya había lanzado: 15 yardas y primer down.',
  },
  {
    id: 'bloqueo', grupo: 'reglas', termino: 'Bloqueo',
    definicion: 'Estorbar con el cuerpo a un rival para abrirle paso a un compañero. Es legal de frente y con las manos por dentro; por la espalda o a las rodillas es falta.',
    ejemplo: 'El regreso de 40 yardas se anuló por un bloqueo por la espalda.',
  },
  {
    id: 'formacion', grupo: 'reglas', termino: 'Formación',
    definicion: 'Cómo se acomodan los 11 jugadores antes de la jugada. El ataque debe tener 7 sobre la línea y quedarse quieto un segundo antes de arrancar; solo uno puede ir en movimiento.',
    ejemplo: 'Solo había 6 jugadores en la línea: formación ilegal, 5 yardas.',
  },
  {
    id: 'reloj-de-jugada', grupo: 'reglas', termino: 'Reloj de jugada',
    definicion: 'El ataque tiene 40 segundos entre jugadas para poner el balón en juego. Si se le acaban, es retraso de juego y pierde 5 yardas.',
    ejemplo: 'No se pusieron de acuerdo a tiempo: retraso de juego.',
  },
  {
    id: 'tiempo-fuera', grupo: 'reglas', termino: 'Tiempo fuera',
    definicion: 'Una pausa que detiene el reloj. Cada equipo tiene 3 por mitad y no se guardan para la siguiente. Al final del partido valen oro.',
    ejemplo: 'La defensa pidió tiempo fuera para que el rival no siguiera gastando reloj.',
  },
  {
    id: 'aviso-de-dos-minutos', grupo: 'reglas', termino: 'Aviso de los dos minutos',
    definicion: 'Una pausa automática cuando quedan 2 minutos en cada mitad. Funciona como un tiempo fuera gratis para los dos equipos.',
    ejemplo: 'El ataque aprovechó el aviso de los dos minutos para planear la última serie.',
  },
  {
    id: 'manejo-del-reloj', grupo: 'reglas', termino: 'Manejo del reloj',
    definicion: 'El reloj sigue corriendo tras una carrera o un pase completo dentro del campo, y se detiene con un pase incompleto o al salir del campo. Por eso el que va ganando corre, y el que va perdiendo lanza y busca las bandas.',
    ejemplo: 'Ganando por 4 con tres minutos por jugar, tres carreras seguidas obligan al rival a gastar sus tiempos fuera.',
  },
  {
    id: 'revision', grupo: 'reglas', termino: 'Revisión y desafío (challenge)',
    definicion: 'Los árbitros pueden revisar una jugada en video. Un entrenador también puede pedirlo lanzando un pañuelo rojo: si no tenía razón, pierde un tiempo fuera.',
    ejemplo: 'Marcaron pase completo, el rival lo desafió y la repetición mostró que el balón tocó el suelo: incompleto.',
  },
  {
    id: 'medio-tiempo', grupo: 'reglas', termino: 'Cuartos y medio tiempo',
    definicion: 'El partido tiene cuatro cuartos de 15 minutos. Al final del primero y del tercero solo se cambia de lado; al medio tiempo todo se reinicia con una patada de salida.',
    ejemplo: 'Si quedan 20 segundos antes del medio tiempo, hay que anotar ya: la serie no continúa después.',
  },
  {
    id: 'tiempo-extra', grupo: 'reglas', termino: 'Tiempo extra',
    definicion: 'Si el partido termina empatado, se juegan 10 minutos más. Los dos equipos tienen derecho a una serie; si después de eso siguen empatados, gana el siguiente que anote.',
    ejemplo: 'Empate a 24 al final: se va a tiempo extra.',
  },
  {
    id: 'shotgun', grupo: 'reglas', termino: 'Formación escopeta (shotgun)',
    definicion: 'El mariscal de campo se coloca unos pasos detrás del centro en lugar de pegado a él. Le da más tiempo y mejor vista para lanzar.',
    ejemplo: 'En 3.ª y larga casi todos los equipos salen en escopeta.',
  },
  {
    id: 'sin-reunion', grupo: 'reglas', termino: 'Ataque sin reunión (no huddle)',
    definicion: 'El ataque se salta la reunión entre jugadas y arranca rápido. Sirve para ahorrar tiempo y para no dejar que la defensa cambie jugadores.',
    ejemplo: 'Perdiendo y con un minuto por jugar, el ataque juega sin reunión.',
  },

  // ---------- Quién es quién ----------
  {
    id: 'mariscal-de-campo', grupo: 'posiciones', termino: 'Mariscal de campo (quarterback)',
    definicion: 'El líder del ataque. Recibe el balón en cada jugada y decide: lo lanza, se lo entrega a un corredor o corre él mismo.',
    ejemplo: 'El mariscal de campo retrocedió, miró a su izquierda y lanzó a la derecha.',
  },
  {
    id: 'corredor', grupo: 'posiciones', termino: 'Corredor (running back)',
    definicion: 'El jugador que recibe el balón en la mano para avanzar corriendo. También atrapa pases cortos y ayuda a proteger al mariscal de campo.',
    ejemplo: 'El corredor encontró un hueco por la izquierda y ganó 9 yardas.',
  },
  {
    id: 'receptor', grupo: 'posiciones', termino: 'Receptor (wide receiver)',
    definicion: 'Los jugadores rápidos que se abren hacia las bandas y corren rutas para atrapar pases.',
    ejemplo: 'El receptor le ganó la espalda a su marcador y atrapó el pase profundo.',
  },
  {
    id: 'ala-cerrada', grupo: 'posiciones', termino: 'Ala cerrada (tight end)',
    definicion: 'Un jugador mitad bloqueador, mitad receptor. Se coloca junto a la línea ofensiva y puede bloquear o salir a atrapar pases.',
    ejemplo: 'En zona roja, el ala cerrada es un blanco grande y difícil de cubrir.',
  },
  {
    id: 'linea-ofensiva', grupo: 'posiciones', termino: 'Línea ofensiva',
    definicion: 'Los cinco jugadores grandes que protegen al mariscal de campo y abren huecos para la carrera. No pueden atrapar pases ni adelantarse antes de que salga el balón.',
    ejemplo: 'La línea ofensiva le dio cinco segundos al mariscal de campo para lanzar.',
  },
  {
    id: 'equipos-especiales', grupo: 'posiciones', termino: 'Equipos especiales',
    definicion: 'Los jugadores que entran solo en las jugadas de patada: salidas, despejes, goles de campo y puntos extra. Incluyen al pateador y al despejador.',
    ejemplo: 'Los equipos especiales bloquearon el despeje y anotaron.',
  },

  // ---------- Jugadas con nombre propio ----------
  {
    id: 'play-action', grupo: 'clasicas', termino: 'Engaño de carrera (play action)',
    definicion: 'El mariscal de campo finge entregarle el balón al corredor, la defensa se va con el engaño y entonces lanza a un receptor que quedó libre.',
    ejemplo: 'Después de varias carreras seguidas, el play action deja a un receptor solo.',
  },
  {
    id: 'screen', grupo: 'clasicas', termino: 'Pase pantalla (screen)',
    definicion: 'Los defensores entran con todo por el mariscal de campo y él lanza un pase muy corto a un compañero que tiene bloqueadores esperándolo por delante.',
    ejemplo: 'La defensa cargó con seis y el pase pantalla se fue 25 yardas.',
  },
  {
    id: 'blitz', grupo: 'clasicas', termino: 'Carga (blitz)',
    definicion: 'La defensa manda más jugadores de lo normal a presionar al mariscal de campo. Puede terminar en captura, pero deja menos gente cubriendo los pases.',
    ejemplo: 'Mandaron a un apoyador y a un profundo: el mariscal no tuvo tiempo de lanzar.',
  },
  {
    id: 'hail-mary', grupo: 'clasicas', termino: 'Ave María (Hail Mary)',
    definicion: 'Un pase larguísimo a la zona de anotación en la última jugada, con todos los receptores corriendo hacia el mismo lugar. Casi nunca funciona, pero es la única opción cuando no queda tiempo.',
    ejemplo: 'Quedan 2 segundos y están a 50 yardas: Ave María.',
  },
];

const POR_ID = new Map(GLOSARIO.map((t) => [t.id, t]));

export function buscarTermino(id) {
  return POR_ID.get(id) || null;
}

export function existeTermino(id) {
  return POR_ID.has(id);
}
