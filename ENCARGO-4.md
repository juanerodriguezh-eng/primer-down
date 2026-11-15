# Encargo 4 para Fable (sábado 14 en la noche y madrugada del domingo 15): narrador y jugadas clave

Igual que antes: trabajas solo, en turnos que se cortan sin aviso. El primer turno es muy corto, de unos 10 minutos. Lee `BITACORA.md` (cierre del encargo 3) y anota en una sección nueva "Encargo 4" después de cada avance verificable. Si la sección ya existe, continúa desde ahí.

**Contexto:** el encargo 3 está publicado (push hecho el sábado en la noche). El proyecto se entra a un concurso y **el jurado verá un video corto y el link**. Estas dos mejoras son para que eso luzca. El domingo en la tarde se prueba con un partido en vivo, así que nada puede quedar roto: cada avance termina probado y confirmado en git, o no se empieza.

## Qué hacer, en este orden
1. **Narrador en español** en la vista 3D (primero, porque es lo más corto):
   - Usa la voz del propio navegador (`speechSynthesis` de la Web Speech API): sin servicios externos, sin claves y sin descargas. Elige una voz `es-*` y prefiere `es-MX`, `es-US` o `es-419`. Si no hay ninguna voz en español, el botón no aparece.
   - **La parte pura va aparte y con pruebas:** a partir de la jugada y de su línea de tiempo, genera 2 a 4 frases cortas de relato con su momento (snap, lanzamiento, atrapada o tacleo, resultado), al estilo de un comentarista de TV en español. Usa solo los datos que trae la jugada; no inventes nada. Evita que suene robótico: varía las frases y menciona el número y el apellido cuando vengan en el texto.
   - Botón "🔊 Narrador", apagado por defecto y que recuerda la elección. Se sincroniza con la animación y con la repetición en cámara lenta, y se calla al cambiar de jugada, al pausar o al ocultar la pestaña.
   - Si falla `speechSynthesis`, la vista 3D sigue igual.
2. **"Jugadas clave" en reproducción continua:**
   - **Parte pura con pruebas:** elige las 5 jugadas que decidieron el partido. Si el summary de ESPN trae `winprobability`, usa los mayores cambios de probabilidad. Si no, usa anotaciones, pérdidas de balón, cuartas oportunidades convertidas o falladas y ganancias grandes. Ordénalas cronológicamente. Pruébalo con los partidos guardados.
   - Botón "▶ Jugadas clave" en la página del partido y la URL directa `partido.html?id=...&modo=clave`, para grabar el video.
   - Las reproduce una tras otra en 3D:
     - tarjeta de título entre jugadas (cuarto, reloj, marcador y una línea de por qué fue clave);
     - la jugada con cámara de transmisión;
     - una repetición corta;
     - una cortina para pasar a la siguiente.
     - Al final, el marcador final.
   - Con el narrador encendido, también se narra.
   - Controles de pausa, siguiente y salir. Respeta `prefers-reduced-motion`; sin WebGL, usa la misma secuencia con la pizarra 2D.
3. **Cierre:** `npm test` en verde y `node herramientas/verificar-sitio.mjs` sin fallas. Saca una captura de las jugadas clave y guárdala en `docs/`. Agrega 2 líneas al README y suma el encargo 4 a `PROMPTS-FABLE.md`, con su resultado y sus correcciones honestas. Termina con un cierre corto en la bitácora: qué cambió, cómo se verificó y qué falta.

## Reglas
- Solo dentro de `primer-down/`.
- `git add` y `git commit` después de cada avance verificado. **No hagas push.**
- **Red:** solo ESPN y el sitio publicado.
- Sin claves, sin servicios pagados, sin paquetes y sin librerías nuevas.
- No rompas nada de lo que ya funciona: modo en vivo, respaldo 2D y calidad automática.
