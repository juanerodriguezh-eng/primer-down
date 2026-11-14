# Encargo 2 para Fable (sábado 14 nov, turnos automáticos)

Trabajas solo, en turnos cortos (unos 20 minutos) que se cortan sin aviso cuando se acaba el cupo. Nadie responde preguntas. Lee primero `ESPECIFICACION.md` y `BITACORA.md`: la versión 1 está terminada y verificada en local. Anota en `BITACORA.md`, en una sección nueva "Encargo 2", cada 10 minutos o después de cada avance verificable. Al empezar, mira si la sección "Encargo 2" ya existe y continúa desde ahí.

## Novedades desde tu último turno
- **El sitio ya está publicado:** https://juanerodriguezh-eng.github.io/primer-down/ (GitHub Pages, rama `main`, repositorio `juanerodriguezh-eng/primer-down`). `primer-down/` ahora es su propio repositorio de git. `.gitignore` deja fuera `datos/crudos/`, `datos/corpus/`, `herramientas/capturas/`, los logs y `correr-noche.ps1`.
- **ESPN sí responde fuera del navegador sin ventana:** desde PowerShell, con el encabezado `Origin` de github.io, el scoreboard y el summary dieron 200 con `Access-Control-Allow-Origin: *`. El 403 que viste era del navegador sin ventana, no del sitio publicado.
- **`npm test` falla con Node 24.19:** `node --test pruebas/` toma la carpeta como si fuera un archivo. Pasar los archivos uno por uno da 94 de 94.

## Qué hacer, en este orden
1. **Arreglar `npm test`** para que pase en Node 24 en Windows, sin dependencias. Verifícalo corriendo `npm test`.
2. **Dejar el modo en vivo listo para el domingo 15.** Esto no se ha podido probar con un partido real.
   - Crea en `pruebas/` un partido "en curso" simulado a partir de un crudo: córtalo a mitad, ponle el estado en progreso y prueba **las dos formas posibles**, con `drives.current` y sin él.
   - Comprueba con pruebas: el sondeo cada 20 s se detiene con la pestaña oculta, las jugadas nuevas no se duplican al refrescar, un fallo de red muestra un mensaje claro y deja lo último que había, y el paso de "en vivo" a "final" muestra el resumen.
   - Si en algo dudas de cómo vendrán los datos en vivo, haz que el código tolere las dos formas, anota la duda en la bitácora y sigue.
3. **Más animado y con jugadores más reales** (lo pidió el dueño del proyecto después de ver la v1 publicada). Restricciones de siempre: sin librerías pesadas ni build, sin fotos de jugadores, sin logos ni marcas; los colores de equipo sí. Hazlo en pasos que queden terminados y probados, en este orden:
   **ACTUALIZACIÓN del dueño (viernes 21 h): quiere el estilo y la cámara lo MÁS REALISTAS posible.** Esto reemplaza el enfoque 2D del boceto:
   - **Usa Three.js en 3D** (licencia MIT). Descárgalo **una sola vez** desde `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js` a `js/vendor/three.module.min.js`, junto con su LICENSE. Esa descarga es la única excepción a la regla de red. Sin build y sin npm install: impórtalo como módulo ES. **Cárgalo de forma diferida, solo al abrir la vista 3D**, para que la portada y el feed sigan livianos.
   - **Cámara de transmisión:** elevada en la tribuna lateral (unos 25 a 35 m de alto y 60 a 80 m de distancia), con teleobjetivo (FOV de 18 a 25°). Sigue al balón con amortiguación, un pequeño retraso y un encuadre que anticipa la jugada, como un camarógrafo. Zoom suave en la atrapada o en el tacleo. Agrega un botón **"Repetición"** con un segundo ángulo, desde detrás de la zona de anotación y en cámara lenta.
   - **Realismo:** jugadores articulados hechos con geometría propia (cápsulas o lathe, sin modelos de terceros con licencias dudosas), con proporciones de atleta. Casco con material brillante y máscara, hombreras, número en pecho y espalda (CanvasTexture), colores del equipo, guantes y calcetas. Ciclos de animación procedurales para correr, retroceder, lanzar, atrapar, bloquear y taclear. Luz de estadio direccional con sombras suaves (shadow map de 1024 a 2048) y luz ambiental o de hemisferio. Pasto con textura procedural y franjas de corte. Líneas, hash marks, números y zonas de anotación pintados con CanvasTexture. Balón en espiral con su sombra.
   - **Rendimiento en celular:** `devicePixelRatio` limitado a 2, pocos polígonos y 30 a 60 fps en un celular común. Pausa el render cuando no está visible.
   - **Respaldo obligatorio:** sin WebGL, con error al cargar o con `prefers-reduced-motion`, se muestra la pizarra 2D actual. La app nunca se rompe.
   - Mantén separada la parte pura (formaciones, trayectorias y línea de tiempo de la jugada a partir de los datos de ESPN) en un módulo con pruebas en `node --test`. El render 3D solo consume esa línea de tiempo.
   - Saca capturas con el navegador sin ventana para verificar cómo se ve; si WebGL no anda sin ventana, prueba con `--use-angle=swiftshader` o `--enable-unsafe-swiftshader`.
   - Prioridad dentro de este punto: 1) cancha y cámara 3D con el balón moviéndose en jugadas reales; 2) jugadores 3D con colores y números; 3) animaciones de cuerpo; 4) repetición con segundo ángulo; 5) momentos (touchdown, bandera de penal).

   **Guía visual previa (2D, solo como referencia de encuadre y ritmo):** `referencias/boceto-jugadores.html`, un boceto hecho con Opus (está fuera de git). Úsalo como referencia del estilo: jugadores de pie sobre una cancha en perspectiva de transmisión, cámara que sigue al balón, sombra y espiral del balón, piernas en movimiento y un cartel al final. **No lo copies tal cual**: escribe tu propia versión, integrada a `js/pizarra.js` y a los módulos puros con pruebas, y mejórala donde puedas (por ejemplo, el encuadre a 360 px, el tacleo y la atrapada). En la bitácora, deja dicho qué tomaste del boceto y qué hiciste distinto.
   a. **Jugadores ilustrados** (SVG o Canvas dibujado con código) en vez de X y O: casco, hombreras, número de camiseta y colores del equipo. Que se vean bien a 360 px.
   b. **Cancha con perspectiva tipo transmisión de TV** (por ejemplo, CSS 3D o proyección propia): pasto a franjas, números de yarda y zonas de anotación con el color de cada equipo.
   c. **Jugadas reales recreadas con 22 jugadores:** formación según el tipo de jugada; el snap; la caída del mariscal; el balón en arco con giro en los pases; corredor con piernas en movimiento; de `start.yardLine` a `end.yardLine` como hasta ahora. Rotula al pasador, al receptor o al corredor con el número y el nombre que vienen en el texto. Muestra siempre el aviso "Recreación ilustrada: ESPN no entrega la posición de cada jugador". No inventes datos.
   d. **Momentos:** "¡TOUCHDOWN!" con confeti del color del equipo, bandera amarilla cayendo en los penales y un pequeño efecto en el marcador cuando cambia. Respeta `prefers-reduced-motion`.
   e. **Jugadas clásicas de La Pizarra** también con jugadores ilustrados, con un botón para volver a la vista de X y O.
   Mantén las pruebas en verde y agrega pruebas a la parte pura (formaciones y trayectorias). Revisa el rendimiento en celular: animación fluida y sin bloquear la página.
4. **README.md** en español para el jurado, corto: qué es, el link, capturas (puedes regenerar una o dos en `docs/` si las necesitas publicadas), cómo se construyó con Fable en turnos sin supervisión, cómo abrirlo localmente y cómo correr las pruebas.
5. **Revisión de calidad a 360 px y en modo claro y oscuro:** contraste, foco visible y textos alternativos de la cancha y de la pizarra. Arregla lo que encuentres y deja una prueba o una comprobación en `herramientas/verificar-sitio.mjs` cuando se pueda.
6. **Si sobra tiempo:** mejora el texto "Así se ganó el partido" del resumen final con 3 partidos guardados distintos y revisa que no suene robótico.

## Reglas
- Trabaja solo dentro de `primer-down/`.
- **Git:** puedes hacer `git add` y `git commit` dentro de `primer-down/` al terminar cada avance verificado, con mensajes claros en español. **No hagas push**: lo publica una persona después de revisar.
- **Red:** solo los endpoints de ESPN de la especificación y leer el sitio publicado en `juanerodriguezh-eng.github.io`.
- Sin claves de API, servicios pagados ni paquetes globales. Cero dependencias.
- No borres archivos que no creaste tú.
- **Al cerrar cada turno** deja en la bitácora qué falta. Si terminas todo, escribe un cierre como el de la versión 1, con lo que salió bien a la primera y dónde te corregiste.
