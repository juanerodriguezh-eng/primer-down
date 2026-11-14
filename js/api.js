// Única puerta a la red: la API pública de ESPN y los partidos guardados en datos/partidos.
// Nada de claves: ESPN responde con Access-Control-Allow-Origin: * y el navegador la lee directo.
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

async function traerJSON(url, espera = 15000) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), espera);
  try {
    const respuesta = await fetch(url, { signal: control.signal, cache: 'no-store' });
    if (!respuesta.ok) throw new Error(`La fuente respondió ${respuesta.status}`);
    return await respuesta.json();
  } finally {
    clearTimeout(reloj);
  }
}

const soloDigitos = (id) => {
  const limpio = String(id ?? '').trim();
  if (!/^\d{1,15}$/.test(limpio)) throw new Error('Identificador de partido no válido');
  return limpio;
};

// Partidos de la semana actual.
export const traerCartelera = () => traerJSON(`${ESPN}/scoreboard`);

// Detalle de un partido, con todas sus jugadas.
export const traerPartido = (id) => traerJSON(`${ESPN}/summary?event=${soloDigitos(id)}`);

// Partidos guardados para el modo repetición (rutas relativas: funcionan igual en GitHub Pages).
export const traerIndiceGuardados = () => traerJSON('datos/partidos/indice.json');
export const traerPartidoGuardado = (id) => traerJSON(`datos/partidos/${soloDigitos(id)}.json`);
