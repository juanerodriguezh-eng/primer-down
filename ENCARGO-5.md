# Encargo 5 para Fable (domingo 15 en la mañana): gráfica de probabilidad de ganar

Igual que antes: trabajas solo, en turnos que se cortan sin aviso. Lee `BITACORA.md` (cierre del encargo 4) y anota en una sección nueva "Encargo 5" después de cada avance verificable. Si la sección ya existe, continúa desde ahí.

**Contexto:** el encargo 4 está publicado. Esta tarde se prueba con partidos en vivo, así que nada puede quedar roto. Cada avance termina probado y confirmado en git, o no se empieza. El dueño pidió **algo interactivo que muestre cómo fue cambiando la probabilidad de ganar de cada equipo a medida que avanzaba el partido**. `modelo.js` ya lee `summary.winprobability`; reutilízalo.

## Qué hacer
1. **Parte pura con pruebas:**
   - A partir de `winprobability` y de las jugadas, arma la serie: probabilidad del local y del visitante por jugada, cuarto, reloj y marcador.
   - Marca los momentos importantes: las jugadas clave de `clave.js`, las anotaciones y las pérdidas de balón.
   - Si ESPN no trae `winprobability`, el resultado es vacío y la sección no aparece. No calcules una probabilidad propia.
   - Pruébalo con partidos guardados y con el simulador del modo en vivo.
2. **Gráfica "Probabilidad de ganar" en la página del partido:**
   - **SVG dibujado con código**, sin librerías.
   - Una línea que se mueve entre los dos equipos con sus colores: arriba un equipo y abajo el otro. Línea guía en el 50 %. Divisiones por cuarto.
   - Puntos en los momentos importantes.
   - **Interactiva:**
     - al pasar el dedo o el mouse, muestra cuarto, reloj, marcador, el porcentaje de cada equipo y el texto corto de la jugada;
     - al tocar un punto, abre esa jugada en la vista 3D;
     - funciona con teclado (flechas), con foco visible y con una descripción para lectores de pantalla.
   - Una frase arriba, al estilo de TV, por ejemplo "Los Commanders llegaron a tener solo un 12 % y lo ganaron". Usa solo datos reales.
   - **En vivo**, la gráfica crece con cada sondeo, sin parpadeo y sin duplicar puntos.
   - Se ve bien a 360 px, en modo claro y en modo oscuro.
   - Si está activo `prefers-reduced-motion`, se muestra sin animación.
3. **Opcional, solo si sobra tiempo y no arriesga nada:** en el modo de jugadas clave, en la tarjeta de título, una mini gráfica con el punto de esa jugada.
4. **Cierre:**
   - `npm test` en verde y `node herramientas/verificar-sitio.mjs` sin fallas.
   - Captura en `docs/probabilidad.png`.
   - 1 línea en el README.
   - El encargo 5 en `PROMPTS-FABLE.md`, con su resultado y sus correcciones honestas.
   - Cierre corto en la bitácora.

## Reglas
- Solo dentro de `primer-down/`.
- `git add` y `git commit` después de cada avance verificado. **No hagas push.**
- **Red:** solo ESPN y el sitio publicado.
- Sin claves, sin servicios pagados, sin paquetes y sin librerías nuevas.
- No rompas nada de lo que ya funciona: modo en vivo, 3D, narrador, jugadas clave y respaldo 2D.
