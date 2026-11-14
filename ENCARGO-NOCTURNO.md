# Encargo nocturno para Fable (viernes 13 nov, de madrugada)

Vas a trabajar **solo durante la noche**. Nadie va a responder preguntas ni aprobar nada hasta la mañana. Cuando dudes, decide con criterio según `primer-down/ESPECIFICACION.md` y deja anotada la decisión y su motivo en la bitácora. Lo que el sistema no te deje hacer, anótalo y sigue con lo siguiente.

## Antes de empezar
1. Lee completo `primer-down/ESPECIFICACION.md`. Es la fuente de verdad del proyecto.
2. Si ya existe `primer-down/BITACORA.md`, léela y continúa desde donde quedó. No rehagas lo que ya está hecho y verificado.

## Turnos cortos (aviso agregado el viernes 13 a las 7 a.m.)
El primer turno de la noche se cortó a los **23 minutos** por el límite de 5 horas, sin aviso previo. Ahora trabajas en **turnos de unos 20 minutos** varias veces al día. Por eso:
- **Al empezar:** revisa si hay archivos más nuevos que la última entrada de la bitácora. Por ejemplo, `js/motor.js` (87 KB) quedó escrito a la 1:13 a.m. **sin pruebas y sin anotar**. Verifícalo antes de agregarle cosas y anota en la bitácora en qué estado lo encontraste.
- **Anota en la bitácora cada 10 minutos de trabajo o después de cada avance verificable**, no solo al final de cada bloque. El corte llega sin aviso.
- Trabaja en pasos pequeños que queden terminados y verificados. Un paso a medias no sirve si te cortan.
- Borra `herramientas/_fix.mjs` si era temporal tuyo.

## Qué construir esta noche, en este orden de prioridad
Cada bloque debe quedar **funcionando y verificado** antes de pasar al siguiente. Más vale terminar 3 bloques sólidos que 5 a medias.

1. **Datos reales.** Descarga el JSON (scoreboard y summary) de al menos 5 partidos ya terminados de esta temporada a `primer-down/datos/`. Incluye Commanders contra Giants del jueves 12 nov si ya terminó. Genera `primer-down/datos/tipos-de-jugada.md` con todos los `type.text` distintos, cuántas veces aparece cada uno y un ejemplo real de cada uno. Anota también cualquier diferencia entre los datos reales y lo que dice la especificación.
2. **Estructura del sitio.** Decide la estructura de archivos según la sección 2 de la especificación y escríbela en la bitácora con una línea de por qué.
3. **Motor de explicaciones** (`motor.js`, funciones puras) con pruebas usando `node --test` y las jugadas reales guardadas, al menos una por tipo de jugada. Todas las pruebas deben pasar. Revisa tú mismo una muestra de 30 explicaciones generadas: que estén en buen español, que sean correctas para el fútbol americano y que no repitan frases de forma robótica.
4. **Sitio base que funcione localmente:** portada con los partidos de la semana, vista de partido con marcador y situación explicada, feed de jugadas por drive con las explicaciones del motor, y **modo repetición** con los partidos guardados. Verifícalo levantando un servidor estático local y comprobando que las páginas cargan sin errores.
5. **Si queda tiempo:** mini cancha, glosario de 40 términos o más, y luego La Pizarra (sección 4.6).

## Reglas de esta noche
- Trabaja solo dentro de `primer-down/`. No modifiques nada fuera de esa carpeta.
- No hagas commit ni push de git, no publiques nada y no crees cuentas.
- No uses claves de API ni servicios pagados. La única conexión de red permitida son los endpoints de ESPN de la especificación.
- No instales paquetes globales. Prefiere cero dependencias; si alguna es indispensable, anótala en la bitácora en vez de instalarla.
- No borres archivos que no hayas creado tú esta noche.

## Bitácora (obligatoria, para no perder trabajo si se corta)
Al terminar **cada bloque**, actualiza `primer-down/BITACORA.md` con:
- Qué quedó hecho y cómo lo verificaste (comando y resultado).
- Decisiones que tomaste sin poder consultar, y por qué.
- Lo que quedó pendiente o falló, con el error exacto.

Si se te acaba el tiempo o el cupo, lo último escrito en la bitácora es lo que se sabrá en la mañana. Por eso, actualízala seguido.

## Al terminar
Cierra la bitácora con:
1. Un resumen de 5 líneas para leer al despertar.
2. Cómo abrir el sitio localmente (un solo comando).
3. Los próximos 3 pasos recomendados.
4. Para `PROMPTS-FABLE.md`: qué salió bien a la primera, dónde tuviste que corregirte a ti mismo y por qué. El concurso pide contar el proceso con honestidad.
