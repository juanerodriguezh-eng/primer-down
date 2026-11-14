// Sondeo del modo en vivo: cuándo se vuelve a consultar el partido. Sin DOM y sin red:
// todo lo que toca el navegador (traer, pintar, reloj, pestaña oculta) llega por parámetro,
// así se prueba con node --test y un reloj falso.
export const CADA_EN_VIVO = 20000; // la especificación pide consultar cada 20 segundos
export const CADA_EN_ESPERA = 60000; // partido que todavía no empieza

// Mensaje cuando falla la red. Si ya había datos, se avisa que lo que se ve es lo último que llegó.
export function mensajeDeFallo(hayDatos) {
  return hayDatos
    ? 'No pudimos actualizar el partido. Te mostramos lo último que teníamos y volvemos a intentar en unos segundos.'
    : 'No pudimos cargar este partido desde la fuente de datos. Volvemos a intentar en unos segundos; mientras tanto puedes probar el modo repetición desde la portada.';
}

// traer(): promesa con los datos crudos.
// alRecibir(datos, { primeraVez }): pinta y devuelve el estado ('programado' | 'en-vivo' | 'final'). Si lanza, cuenta como fallo.
// alFallar({ hayDatos, error }): muestra el aviso; lo ya pintado no se toca.
// estaOculta(): true si la pestaña no se ve (no se consulta mientras tanto).
export function crearSondeo({
  traer, alRecibir, alFallar = () => {}, estaOculta = () => false,
  ahora = Date.now, poner = setTimeout, quitar = clearTimeout,
  cadaEnVivo = CADA_EN_VIVO, cadaEnEspera = CADA_EN_ESPERA,
}) {
  let estado = '';
  let hayDatos = false;
  let reloj = null;
  let ultimaConsulta = null;
  let enCurso = false;
  let detenido = false;
  let consultas = 0;
  let fallos = 0;

  // Deja lista la próxima consulta. Se llama después de cada consulta y cada vez que cambia la visibilidad.
  function programar() {
    if (reloj !== null) quitar(reloj);
    reloj = null;
    if (detenido || estado === 'final' || enCurso) return;
    if (estaOculta()) return; // al volver a la pestaña se consulta de inmediato si ya tocaba
    const cada = estado === 'en-vivo' || !hayDatos ? cadaEnVivo : cadaEnEspera;
    const falta = ultimaConsulta === null ? 0 : Math.max(0, cada - (ahora() - ultimaConsulta));
    reloj = poner(consultar, falta);
  }

  async function consultar() {
    if (enCurso || detenido) return; // nunca dos consultas a la vez
    if (reloj !== null) quitar(reloj);
    reloj = null;
    enCurso = true;
    ultimaConsulta = ahora();
    consultas++;
    try {
      const datos = await traer();
      const nuevo = alRecibir(datos, { primeraVez: !hayDatos });
      hayDatos = true;
      estado = nuevo || estado;
    } catch (error) {
      fallos++;
      try { alFallar({ hayDatos, error }); } catch { /* el aviso no puede tumbar el sondeo */ }
    }
    enCurso = false;
    programar();
  }

  function detener() {
    detenido = true;
    if (reloj !== null) quitar(reloj);
    reloj = null;
  }

  return {
    consultar,
    programar,
    detener,
    info: () => ({ estado, hayDatos, consultas, fallos, enEspera: reloj !== null, enCurso }),
  };
}
