# Encargo 3 para Fable (sábado 14 y domingo 15 nov): realismo y cierre

Igual que antes: trabajas solo, en turnos que se cortan sin aviso. Lee `BITACORA.md` (cierre del encargo 2) y anota en una sección nueva "Encargo 3" cada 10 minutos o después de cada avance verificable. Si la sección ya existe, continúa desde ahí.

**Contexto:** el encargo 2 se publicó el sábado a las 7 a.m. (push hecho; el sitio en línea ya tiene el 3D). Al dueño le gustó la vista 3D y pide **que se vea todavía más real**. **El proyecto debe quedar terminado el domingo 15 en la noche**: el lunes no hay tiempo para revisar. Así que cada avance debe quedar terminado, probado y confirmado en git. Nada a medias al final de un turno.

## Qué hacer, en este orden (lo primero es lo que más realismo da por menos trabajo)
1. **Gráficos de transmisión de TV** en la vista 3D:
   - marcador de esquina con equipos (texto y colores), puntos, cuarto y reloj;
   - "3.ª y 7" o "3rd & 7" sobre la cancha al inicio de la jugada;
   - la **línea amarilla de primer down y la azul de scrimmage pintadas sobre el pasto y debajo de los jugadores**, como en la tele;
   - cortina de "REPETICIÓN" al cambiar al ángulo de repetición.
2. **Luz y materiales de estadio:** iluminación de entorno (por ejemplo `RoomEnvironment` + PMREM), reflejos en cascos, tonemapping ACES, sombras suaves y, si el rendimiento lo permite, un bloom leve en los focos y grano fino de cámara. Los addons de Three.js que hagan falta se descargan una sola vez desde `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/...` a `js/vendor/`, y se importan como módulos sin build.
3. **Cuerpos de atleta:** proporciones más musculosas (hombros, muslos, pantorrillas), uniformes con pliegues o sombreado, y movimientos más naturales al correr, lanzar, atrapar y taclear (inclinación del torso, brazos opuestos a las piernas, aceleración).
4. **Cámara:** temblor leve de cámara en mano en las repeticiones y desenfoque de movimiento o estela en los pases largos.
5. **Detalle de texto:** las jugadas con fumble que dicen "forzado por X y lo recupera X" cuando es el mismo jugador. Que suene natural.
6. **`PROMPTS-FABLE.md` al día para el concurso:** los encargos 1, 2, 3 y el nocturno (`ENCARGO-NOCTURNO.md`, `ENCARGO-2.md`, `ENCARGO-3.md`), cada uno con su resultado y sus correcciones honestas, tomados de la bitácora. Con números: turnos, pruebas, jugadas y partidos.

## Calidad obligatoria
- **Rendimiento en celular:** agrega un modo de calidad automático. Si los fps bajan de unos 40, apaga el bloom, el grano y las sombras suaves. La vista nunca debe quedar trabada.
- `prefers-reduced-motion` desactiva el temblor y el desenfoque.
- El respaldo 2D sin WebGL sigue funcionando.
- Pruebas en verde (`npm test`) y `node herramientas/verificar-sitio.mjs` sin fallas. Saca capturas antes y después para comparar y deja 2 en `docs/` para el README.

## Reglas
- Solo dentro de `primer-down/`.
- `git add` y `git commit` después de cada avance verificado. **No hagas push.**
- **Red:** ESPN, el sitio publicado y jsdelivr, solo para los addons de Three.js 0.170.0.
- Sin claves, sin servicios pagados y sin paquetes globales.
- **Cierre:** cuando termines todo, escribe un cierre corto en la bitácora: qué cambió, cómo se verificó y qué falta.
