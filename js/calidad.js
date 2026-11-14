// Calidad automática de la vista 3D: decide cuándo bajar los efectos para que la imagen nunca quede trabada.
// Pura (sin DOM ni Three.js): recibe cuánto tardó cada cuadro y dice si hay que bajar de nivel.
//   alta  = todo: bloom en los focos, grano de cámara, estela y sombras suaves.
//   media = sin bloom, sin grano y sin estela; sombras simples.
//   baja  = además sin sombras y con menos píxeles.
// Solo baja, nunca sube: así la imagen no anda cambiando de aspecto a media jugada.

export const NIVELES = ['baja', 'media', 'alta'];
export const nivelPorNombre = (nombre) => { const i = NIVELES.indexOf(String(nombre || '').toLowerCase()); return i < 0 ? null : i; };

// umbral: cuadros por segundo mínimos aceptables. ventana: cuadros que se promedian antes de decidir.
// calentamiento: cuadros que no cuentan al empezar y después de cada cambio (compilar sombreadores tarda).
export function crearMedidorDeCalidad({ nivel = 2, umbral = 40, ventana = 40, calentamiento = 12, fija = false } = {}) {
  let actual = Math.max(0, Math.min(2, Math.round(nivel)));
  let saltar = calentamiento;
  let suma = 0;
  let cuenta = 0;
  let ultimoFps = 0;
  const reiniciar = () => { suma = 0; cuenta = 0; };
  return {
    get nivel() { return actual; },
    get nombre() { return NIVELES[actual]; },
    get fps() { return ultimoFps; },
    // Después de una pausa (pestaña oculta, salto de jugada) lo medido antes ya no vale.
    pausa() { reiniciar(); saltar = Math.max(saltar, 3); },
    // dtMs: milisegundos reales desde el cuadro anterior. Devuelve el nivel nuevo si hay que bajar; si no, null.
    cuadro(dtMs) {
      if (fija || actual === 0) return null;
      if (!(dtMs > 0) || dtMs > 250) { reiniciar(); return null; } // un hueco así es una pausa, no lentitud
      if (saltar > 0) { saltar--; return null; }
      suma += dtMs; cuenta++;
      if (cuenta < ventana) return null;
      ultimoFps = 1000 / (suma / cuenta);
      reiniciar();
      if (ultimoFps >= umbral) return null;
      actual--;
      saltar = calentamiento;
      return actual;
    },
  };
}
