# Registro de encargos a Fable: Primer Down

Para la parte “Cómo lo hiciste” de la entrada [FABLE]. Cada encargo importante va aquí, con su resultado y sus correcciones honestas. Todo sale de `BITACORA.md`, que Fable fue escribiendo mientras trabajaba; ahí está el detalle con horas y comandos.

## El método, en corto

- **Fable trabajó solo, en turnos programados que se cortaban sin aviso** al agotarse el cupo (el primero duró 23 minutos). Nadie respondía preguntas.
- Cada turno recibía el mismo prompt de una línea: **“Lee `primer-down/ENCARGO-N.md` y cúmplelo, continuando desde lo que diga `primer-down/BITACORA.md`. Trabajas de forma autónoma.”**
- El encargo (un archivo de texto) decía qué hacer y en qué orden. La bitácora era la memoria entre turnos: cada avance verificado, cada decisión tomada sin consultar, lo que no se pudo comprobar y cada error propio.
- Regla que sostuvo todo: **nada se da por hecho sin una comprobación automática** (`npm test` y `node herramientas/verificar-sitio.mjs`, que abre el sitio en un navegador sin ventana a 360 px).

## Números

| | Turnos | Pruebas al cerrar | Qué quedó |
|---|---|---|---|
| Encargo nocturno (vie 13) | 3 | 94 | Versión 1 completa: datos, motor, sitio, repetición, glosario y La Pizarra |
| Encargo 2 (vie 13 y sáb 14) | 3 | 139 | Modo en vivo probado, vista 3D con Three.js, README, contraste y resumen final |
| Encargo 3 (sáb 14) | 2 (y 1 de comprobación) | 154 | Gráficos de TV, luz de estadio, cuerpos de atleta, cámara en mano y estela |
| Encargo 4 (sáb 14 en la noche) | 2 | 173 | Narrador en español con la voz del navegador y “Jugadas clave” en reproducción continua |

- **11 turnos** en total (uno, el 9, solo volvió a comprobar el cierre del encargo 3). 6 de los 11 empezaron encontrando trabajo del turno anterior sin anotar o sin confirmar, y lo verificaron antes de seguir.
- **137 partidos reales** analizados (25.387 jugadas, 32 tipos de jugada); **16 partidos** guardados para el modo repetición (2.982 jugadas, 2.454 recreadas en 3D con 22 jugadores).
- **173 pruebas** y un verificador que revisa **36 páginas** a 360 px.
- Cero dependencias de npm, cero claves, cero costo. Única librería: Three.js 0.170.0 y 11 de sus addons, copiados en `js/vendor/`.

---

## Encargo 1: arranque (jueves 12 nov)

```
Lee primer-down/ESPECIFICACION.md completo. Es una web app que vamos a construir juntos para un concurso, y el plazo es corto.

Tu tarea en esta sesión:
1. Descarga el JSON de al menos 4 partidos reales ya terminados de esta temporada desde la API de ESPN descrita ahí y guárdalos en primer-down/datos/.
2. Lista todos los tipos de jugada (type.text) distintos que aparecen, con un ejemplo de cada uno.
3. Propón la estructura de archivos del sitio y espera mi visto bueno antes de seguir.
4. Con mi visto bueno, construye motor.js con sus pruebas, usando las jugadas reales guardadas.

Respeta las restricciones de la sección 2 sin excepción. Si algo de la especificación no calza con lo que ves en los datos reales, avísame en vez de suponer.
```

**Resultado:** este prompt estaba pensado para una sesión con supervisión. La bitácora no registra una sesión aparte para él: sus cuatro tareas se hicieron dentro del encargo nocturno, que las amplió y quitó el “espera mi visto bueno”, porque de noche no había nadie para darlo.

**Correcciones:** la lección fue del método, no del código. Un prompt que pide esperar aprobación no sirve para trabajar sin supervisión; hubo que cambiarlo por “decide con criterio y deja anotada la decisión y su motivo”.

---

## Encargo nocturno (`ENCARGO-NOCTURNO.md`, viernes 13 nov, 3 turnos)

**Qué pedía:** construir la versión 1 completa según la especificación, en cinco bloques: datos reales, estructura, motor de explicaciones, sitio base y La Pizarra. Sin commit, sin push y sin instalar nada. A las 7 a.m. se le agregó el aviso de los turnos cortos: “anota en la bitácora cada 10 minutos o después de cada avance verificable; el corte llega sin aviso”.

**Resultado:**
- 137 partidos descargados de ESPN (el encargo pedía pocos; Fable bajó más porque con 16 solo aparecían 24 de los 32 tipos de jugada, y faltaban justo los raros).
- Motor de reglas que explica en español los 32 tipos de jugada: 25.387 jugadas, 0 errores.
- Sitio estático sin build: portada, partido en vivo y en repetición, mini cancha, glosario de 76 términos, resumen final y La Pizarra con 5 jugadas clásicas.
- 94 pruebas y un verificador de 12 páginas a 360 px.
- 16 diferencias entre la especificación y los datos reales, documentadas (por ejemplo: `yardLine` se mide desde la zona del equipo local, y el punto extra no es una jugada aparte).

**Salió bien a la primera:** la descarga y el listado de tipos; la estructura con lo puro separado de la pantalla; el modo repetición como “el mismo partido cortado en la jugada N”.

**Correcciones honestas:**
- El turno 1 se cortó con 87 KB de motor escritos, **sin pruebas y sin anotar**. El turno 2 tuvo que verificarlo desde cero.
- La herramienta de revisión del propio Fable decía “0 sospechosos”. Las pruebas encontraron 4 errores reales, y leer 30 explicaciones encontró 7 frases falsas para el fútbol americano (por ejemplo, “primer down automático” en un offside).
- Para diagnosticar un 403 de ESPN, Fable le cambió la identificación al navegador de pruebas. El sistema de permisos bloqueó que eso quedara en el script, y tenía razón: era saltarse un filtro anti-bots. Lo quitó y lo dejó confesado en la bitácora.
- La primera versión de las jugadas clásicas tenía 37 pares de jugadores encimados, y un enlace nuevo en la barra desbordó las 11 páginas a 360 px. Las dos cosas las encontraron las comprobaciones, no la vista.

---

## Encargo 2 (`ENCARGO-2.md`, viernes 13 y sábado 14 nov, 3 turnos)

**Qué pedía, en orden:** 1) arreglar `npm test` en Node 24; 2) dejar el modo en vivo listo para el domingo sin poder probarlo con un partido real; 3) una vista 3D de cada jugada con Three.js; 4) README para el jurado; 5) calidad a 360 px en claro y oscuro; 6) que el resumen “Así se ganó el partido” no suene a máquina.

**Resultado:**
- Modo en vivo como módulo puro con reloj falso (`js/vivo.js`) y un simulador que convierte un partido guardado en un partido “en curso” en las tres formas en que ESPN puede entregar el drive actual. 13 pruebas.
- Vista 3D: cancha, 22 jugadores articulados, tres cámaras, repetición, touchdown con confeti, bandera de penal y respaldo a la pizarra 2D sin WebGL. La recreación es una línea de tiempo pura y probada (`js/jugada3d.js`); el 3D solo la dibuja.
- Dorsales reales sacados del `boxscore` de ESPN: 3.563 rótulos con su número real y 6 sin número (cuando hay duda, no se inventa).
- Contraste WCAG comprobado con pruebas en las dos paletas.
- Resumen final con relato del partido sacado del marcador real.
- 139 pruebas; verificador con 24 páginas.

**Salió bien a la primera:** el modo en vivo con reloj falso (permitió probar lo que “no se podía probar”); separar la línea de tiempo del render; las pruebas del relato final.

**Correcciones honestas:**
- **Los barridos sobre datos reales encontraron lo que nadie imaginó:** jugadores que se teletransportaban a 19 yardas por segundo; un final de jugada en blanco al cierre de cada cuarto, que hacía cruzar 99 yardas a una carrera “sin ganancia”; un marcador 0-0 en pleno cuarto cuarto; y un pronóstico previo que convertía la patada inicial en “jugada clave” en 9 de 11 partidos. Los dos últimos estaban en la versión ya publicada.
- **Las capturas encontraron lo que las pruebas no ven:** con el ángulo de cámara que pedía el encargo, un jugador medía 10 px en un celular. Fable se apartó del encargo, cerró el teleobjetivo y lo dejó anotado.
- **La prueba de contraste encontró 3 defectos** en una paleta que Fable había dado por buena sin mirarla.
- **Leer el texto encontró lo que ni pruebas ni capturas ven:** el resumen pasaba todas las pruebas y decía “partido de ida y vuelta” en una paliza de 23 puntos.
- Punto débil repetido: cuatro veces un script de edición pasado por el shell se comió las barras invertidas de una expresión regular.

---

## Encargo 3 (`ENCARGO-3.md`, sábado 14 nov, 2 turnos)

**Qué pedía, en orden:** al dueño le gustó el 3D y pidió que se viera más real. 1) Gráficos de transmisión de TV; 2) luz y materiales de estadio; 3) cuerpos de atleta y movimientos naturales; 4) temblor de cámara en mano y estela en los pases largos; 5) arreglar el texto del fumble “forzado por X y lo recupera X”; 6) este archivo al día. Con un modo de calidad automático: si los fps bajan de 40, se apagan efectos.

**Resultado:**
- **Gráficos de TV:** marcador de esquina con colores de los equipos, puntos, cuarto, reloj y “3.ª y 7”; la oportunidad pintada sobre el pasto; líneas azul y amarilla pintadas bajo los jugadores (reciben su sombra); cortina de “REPETICIÓN”. El marcador muestra los puntos de **antes** de la jugada y sube cuando alguien anota.
- **Luz:** entorno `RoomEnvironment` con PMREM, tonemapping ACES, cascos con barniz que reflejan, sombras suaves, torres de focos, bloom leve y grano de cámara.
- **Calidad automática** (`js/calidad.js`, pura y probada): alta → media → baja según los cuadros reales; reacciona en menos de 2 segundos y no vuelve a subir a media jugada.
- **Cuerpos:** torso en V, hombros, bíceps, muslos y pantorrillas; uniformes con pliegues y franja; linieros más pesados. Al correr se inclinan al acelerar, se ladean en las curvas y giran los hombros al revés que la cadera; lanzar, atrapar, taclear y caer tienen gestos propios.
- **Cámara:** temblor de cámara en mano en las repeticiones y estela del balón en los vuelos largos (52 jugadas del partido de muestra).
- **Texto:** “N. Bonitto le quita el balón (fumble) y él mismo lo recupera para los Broncos”.
- 154 pruebas; verificador con 28 páginas; capturas de antes y después en `docs/`.

**Salió bien a la primera:** el módulo puro de gráficos de TV con su barrido de 2.982 jugadas; los cuerpos nuevos; el texto del fumble.

**Correcciones honestas:**
- El turno 7 se cortó a los 8 minutos con el punto 1 escrito y sin confirmar. El turno 8 encontró que **el verificador ni arrancaba**: por quinta vez, un script de edición se había comido barras invertidas. Con el verificador andando aparecieron 4 fallas reales: la cortina de repetición quedaba visible y desbordaba la página, y el sello de cámara lenta tapaba el marcador nuevo.
- **La primera luz salió lavada y sobreexpuesta:** el bloom alcanzaba a toda la cancha. Se vio en la primera captura y se corrigió bajando luces y subiendo el umbral.
- **El desenfoque de movimiento a pantalla completa fue un error de diseño.** La captura mostró fantasmas de toda la cancha cada vez que la cámara se movía, y colores cambiados. Fable lo quitó entero y dejó solo la estela del balón, que es lo que de verdad se ve en una transmisión.
- **Lo que sigue sin comprobarse**, dicho sin adornos: el navegador sin ventana solo muestra cuadros congelados. Nadie ha visto todavía **en movimiento** los gestos nuevos, el temblor de cámara ni la cortina, ni se han medido los fps en un celular real. La calidad automática existe justamente porque eso no se pudo medir.

---

## Encargo 4 (`ENCARGO-4.md`, sábado 14 nov en la noche, 2 turnos)

**Qué pedía, en orden:** dos mejoras para que el video del concurso luzca, sin romper nada antes del partido en vivo del domingo. 1) Narrador en español en la vista 3D con la voz del propio navegador (`speechSynthesis`), con la parte pura aparte y probada; 2) “Jugadas clave” en reproducción continua: elegir las 5 jugadas que decidieron el partido y mostrarlas una tras otra en 3D con tarjeta de título, repetición corta, cortina y marcador final, con una URL directa para grabar; 3) cierre con pruebas, captura, README y este archivo.

**Resultado:**
- **Narrador** (`js/narrador.js`, puro; `js/voz.js`): de cada jugada salen 2 a 4 frases con su momento, solo con datos de la jugada. En el touchdown de muestra: una frase del lanzamiento con “Daniels, el 5”, una de la atrapada con “Sinnott, el 82”, el touchdown y “Commanders 10, Giants 7.” Prefiere voces es-MX, es-US o es-419; sin voz en español el botón no aparece. Apagado por defecto, recuerda la elección, sigue el reloj de la animación y de la repetición, y se calla al pausar, al cambiar de jugada o al ocultar la pestaña. Lo que dice va escrito sobre la imagen. Barrido: 2.454 jugadas narradas, 8.131 frases, ningún nombre ni dorsal que no esté en la jugada.
- **Jugadas clave** (`js/clave.js`, puro; `js/modoclave.js`): con `winprobability` se eligen los 5 mayores cambios de probabilidad; sin ella, anotaciones, pérdidas de balón, cuartas oportunidades y ganancias grandes, con más peso para lo tardío y lo cerrado. Cada tarjeta dice cuarto, reloj, marcador de antes y el porqué (“Touchdown de los Commanders: le dio la vuelta al marcador. Subió 49 puntos la probabilidad de ganar de los Commanders.”). Botón “▶ Jugadas clave” y `partido.html?id=...&modo=clave`. Pausa, siguiente y salir; con el narrador encendido también se narra; sin WebGL o con “reducir movimiento” la misma secuencia va en la pizarra 2D.
- 173 pruebas; verificador con 36 páginas; capturas en `docs/jugadas-clave.png` y `docs/jugadas-clave-tarjeta.png`.

**Salió bien a la primera:** la secuencia completa de jugadas clave, que llegó del título al marcador final en la primera corrida en el navegador, y el barrido de la elección (160 jugadas clave en 16 partidos, con y sin probabilidad).

**Correcciones honestas:**
- **El turno 10 se cortó con el botón del narrador escrito y sin confirmar, y con el verificador fallando:** el narrador no decía nada. Dos causas, las dos de Fable: al abrir la vista 3D por la dirección la jugada quedaba fuera de pantalla (y ahí el narrador se pausa, como debe), y cuando la jugada saltaba al final por el temporizador de respaldo nadie le avisaba al narrador.
- **Una comprobación se relajó, y está dicho:** el verificador pedía 3 frases dichas y quedó en 2, porque con los 6 cuadros que dibuja el navegador sin ventana solo salen la primera y la última.
- **Leyendo 60 relatos** aparecieron una coma sin cerrar, una jugada anulada por penal relatada como buena y un recorte que perdía el lanzamiento en vez de la oportunidad.
- **Las capturas encontraron lo que las pruebas no ven:** en el modo clave seguían visibles los botones propios de la vista 3D (el atributo `hidden` no les hacía efecto) y el marcador final se partía en dos renglones a 360 px.
- **Errores de Fable al editar:** dos pruebas fallaron por creer que los Commanders eran locales; un comentario agregado al final de una línea se tragó el `catch` y dejó `partido.js` con error de sintaxis (lo delató `node --check` en el mismo paso); y cuatro veces más el shell dañó o rechazó un comando con comillas o barras invertidas. Además anotó tres horas adelantadas en la bitácora y las corrigió con el reloj de git.
- **Lo que sigue sin comprobarse:** nadie ha **oído** al narrador ni ha visto la secuencia de jugadas clave **en movimiento**; solo hay cuadros congelados de cada paso y una voz simulada. Y al abrir `&modo=clave` por dirección directa, Chrome no deja hablar hasta que la persona toca algo.

---

## Moraleja (borrador)

Lo que hizo posible trabajar sin supervisión no fue un prompt brillante, sino tres cosas aburridas: **un encargo ordenado por prioridad, una bitácora que sobrevive a los cortes y una comprobación automática para cada cosa**. Cada vez que Fable confió en “se ve bien”, se equivocó; cada vez que escribió primero la comprobación, la comprobación encontró algo. Y lo más útil de la bitácora resultó ser la lista de lo que **no** se pudo comprobar: es la lista exacta de lo que una persona tiene que mirar.
