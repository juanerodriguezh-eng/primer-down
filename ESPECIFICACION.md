# Primer Down: la NFL explicada en español mientras la ves

Especificación para construir con Claude Fable 5.2. Entrada al concurso [FABLE] de la comunidad Imperio (cierre: jueves 19 nov 2026, 23:59 hora de Chile).

## 1. Qué es y para quién

Una web app que acompaña un partido de la NFL **en vivo** y explica cada jugada en español simple, para quien está empezando a ver fútbol americano: “¿por qué patearon en cuarta?”, “¿qué fue esa bandera amarilla?”, “¿por qué dejan correr el reloj?”.

- **Usuario principal:** hispanohablantes que están empezando con la NFL (México y EE.UU. latino son sus mayores audiencias fuera del público tradicional), o que ven el partido con alguien que sí sabe y no quieren preguntar todo.
- **Uso típico:** el celular en la mano mientras el partido está en la tele. Por eso el diseño es **mobile-first**.
- **Qué cambia:** pasas de ver jugadas sin entender a seguir el partido sabiendo qué está en juego en cada down.

El jurado evalúa **impacto, claridad y prueba** (que esté terminado y funcionando). Prioriza siempre que funcione de punta a punta antes que agregar funciones.

## 2. Restricciones (no negociables)

1. **Costo cero para operar.** Sitio 100 % estático, alojado en GitHub Pages. Nada de servidores pagados ni claves de API en el navegador.
2. **Las explicaciones de cada jugada no usan IA en tiempo real.** Las genera un **motor de reglas** en JavaScript a partir de los datos estructurados de cada jugada. Así es instantáneo, gratis y funciona para cualquier persona sin cuenta. (La IA en vivo es solo el módulo opcional de la sección 6.)
3. **Sin logos ni marcas oficiales** de la NFL ni de los equipos. Los equipos se nombran en texto; los colores de equipo están bien como acento.
4. **Todo en español** neutro latinoamericano, cercano y sin jerga innecesaria. Cuando se use un término en inglés (touchdown, punt, sack), se explica la primera vez y queda enlazado al glosario.
5. Sin frameworks pesados ni paso de build obligatorio: HTML, CSS y JavaScript plano (módulos ES). Debe abrirse localmente con un servidor estático simple.

## 3. Fuente de datos

API pública **no oficial** de ESPN. Responde con `Access-Control-Allow-Origin: *`, así que el navegador la puede leer directo. Ya probada el 12 nov 2026.

- Partidos de la semana: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
  - `week.number`, `events[]` con `id`, `name`, `date` (UTC), `status.type.description` / `status.type.completed`, competidores y marcador.
- Detalle de un partido: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={id}`
  - Claves: `boxscore`, `drives`, `header`, `winprobability`, `leaders`, `gameInfo`, entre otras.
  - `drives.previous[]` → cada drive trae `plays[]`; también puede existir `drives.current`.
  - Cada jugada trae, por ejemplo:
    ```json
    {"text": "(Shotgun) J.McCarthy pass short left to C.Skattebo to NYG 28 for 3 yards (A.Robertson).",
     "type": {"id": "24", "text": "Pass Reception", "abbreviation": "REC"},
     "start": {"down": 1, "distance": 10, "yardLine": 25, "yardsToEndzone": 75, "downDistanceText": "1st & 10 at NYG 25", "team": {"id": "19"}},
     "end":   {"down": 2, "distance": 7,  "yardLine": 28, "yardsToEndzone": 72, "downDistanceText": "2nd & 7 at NYG 28", "team": {"id": "19"}},
     "statYardage": 3}
    ```
  - `winprobability[]` sirve para encontrar las jugadas que más cambiaron el partido.

Reglas para usar la fuente:
- Durante un partido en vivo, consultar el detalle **cada 20 segundos** y solo mientras la pestaña está visible.
- Si la API falla o cambia, mostrar un mensaje claro y seguir mostrando lo último que se tenía.
- **Respaldo para la demo:** guardar en `datos/` el JSON completo de al menos 2 partidos ya terminados y ofrecer un “modo repetición” que reproduce un partido jugada por jugada, como si fuera en vivo. Esto garantiza que el jurado pueda probarlo cualquier día.
- Antes de escribir el motor de reglas, descargar varios partidos reales y **listar todos los `type.text` distintos** que aparecen, para que el motor los cubra todos.

## 4. Funciones obligatorias (versión 1)

### 4.1 Portada: partidos de la semana
- Lista de partidos con estado: **En vivo**, **Programado** (con hora local del visitante) o **Final**, con marcador.
- Los partidos en vivo arriba. Botón de “modo repetición” para los partidos guardados.

### 4.2 Vista de partido
- **Marcador** y reloj del cuarto.
- **Situación actual explicada**, no solo “2nd & 7”: por ejemplo, “Segunda oportunidad: les faltan 7 yardas para renovar. Les quedan 3 intentos”.
- **Mini cancha** horizontal con la posición del balón, la línea a conseguir y hacia qué lado atacan.

### 4.3 Jugada por jugada
- Feed con la jugada más reciente arriba, agrupado por drive (“Avance de Giants: 8 jugadas, 65 yardas, terminó en touchdown”).
- Cada jugada muestra:
  - **La explicación en español** (1 o 2 frases) del motor de reglas.
  - Un ícono o etiqueta de tipo (pase, carrera, patada, penal, pérdida de balón, anotación).
  - Etiquetas de conceptos que abren el glosario.
  - El texto original en inglés, plegado.
- Las jugadas que más movieron la probabilidad de ganar (`winprobability`) se marcan como **jugada clave**.

### 4.4 Motor de explicaciones (el corazón del proyecto)
Funciones puras en su propio módulo (`motor.js`), con pruebas. Debe explicar el **qué** y, cuando el contexto lo permite, el **por qué**:
- Pases (completo, incompleto, interceptado), carreras, sacks, fumbles.
- Cuarta oportunidad: si patean (punt), intentan gol de campo o se la juegan, explicar por qué esa decisión tiene sentido según la yarda y la distancia.
- Touchdown, punto extra, conversión de 2, safety, gol de campo (con su distancia).
- Penales: leer el tipo desde el texto (“PENALTY on X, Holding, 10 yards”) y explicar ese penal en una frase.
- Patadas de salida, regresos, touchbacks.
- Tiempos fuera, aviso de dos minutos, fin de cuarto, revisiones o challenges.
- Contexto de reloj y marcador en momentos clave (por ejemplo, por qué un equipo que va ganando corre el balón al final).
- Un caso genérico de respaldo para tipos desconocidos, que nunca rompa la app.

### 4.5 Glosario
- 40 términos o más, cada uno con explicación simple y un ejemplo.
- Accesible desde las etiquetas y desde un botón fijo.

### 4.6 La Pizarra (módulo visual)
- Botón **“Ver en la pizarra”** en cada jugada: anima en una cancha dibujada (Canvas o SVG) el movimiento real del balón, de `start.yardLine` a `end.yardLine`, con un arco para los pases y una línea para las carreras, más la línea de scrimmage y la de primer down.
- Sección **“Jugadas clásicas”** con 4 a 5 jugadas didácticas animadas con X y O (play action, screen, blitz, Hail Mary, onside kick), cada una con su explicación paso a paso.

### 4.7 Resumen al final del partido
- Las 3 a 5 jugadas clave, generadas con reglas a partir de `winprobability` y las anotaciones.
- Un texto corto: “Así se ganó el partido”.
- Botón para copiar el resumen y compartirlo.

## 5. Calidad mínima
- Funciona bien en un celular de 360 px de ancho, con modo oscuro (se ve de noche).
- Carga rápido y sin pasos de build.
- Accesible: contraste, foco visible y textos alternativos en la cancha.
- Pruebas de `motor.js` con jugadas reales guardadas, al menos una por tipo de jugada.

## 6. Módulo opcional (solo si sobra tiempo y cupo): “¿Por qué?” con IA
- Botón “¿Por qué?” en cada jugada, que pide a Claude una explicación más profunda.
- Sin claves en el navegador: el sitio llama a un **webhook de n8n** (ya existe una instancia) que llama a la API de Anthropic con `claude-haiku-5-5` o `claude-sonnet-5-5`, con un límite diario de llamadas. Se paga con créditos de API ya disponibles, nunca con tarjeta.
- Si el webhook no responde, el botón se oculta y la app sigue funcionando igual.

## 7. Terminado significa
- [ ] Publicado en GitHub Pages con un link público.
- [ ] Se puede seguir un partido en vivo y el feed se actualiza solo.
- [ ] El modo repetición funciona con al menos 2 partidos guardados.
- [ ] Todos los tipos de jugada vistos en los datos reales tienen explicación.
- [ ] La Pizarra anima jugadas reales y tiene al menos 4 jugadas clásicas.
- [ ] Resumen al final del partido.
- [ ] Probado en vivo con los partidos del domingo 15 de noviembre.
- [ ] `PROMPTS-FABLE.md` al día con los encargos clave y las correcciones.

## 8. Calendario
| Día | Trabajo |
|---|---|
| Jue 12 (noche) | Descargar partidos reales, listar tipos de jugada, estructura del sitio, motor de reglas con pruebas |
| Vie 13 | Vista de partido, feed en vivo, mini cancha, glosario |
| Sáb 14 | La Pizarra, resumen, modo repetición, diseño final, publicación en GitHub Pages |
| Dom 15 | Prueba en vivo con los partidos del día y correcciones |
| Lun 16 | Ajustes finales con Fable (la promoción de Fable termina el 17 nov a las 2:59 a.m. GMT-5) |
| Mar 17 a jue 19 | Video de 60 a 90 s, post en Skool con [FABLE] y en X con #FableImperial (sin Fable) |

## 9. Registro del proceso
El concurso pide contar cómo se hizo. Cada encargo importante a Fable se copia en `PROMPTS-FABLE.md`, junto con lo que salió bien a la primera, dónde hubo que corregir y cómo.
