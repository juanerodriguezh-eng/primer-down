// Datos de equipos. Solo texto: sin logos ni marcas oficiales (restricción 3 de la especificación).
// Los nombres y colores de cada partido vienen del propio JSON de ESPN; aquí solo vive lo que el JSON no trae.

// El texto de las jugadas usa las abreviaturas de la liga, que no siempre coinciden con las de ESPN.
// Clave: abreviatura de la liga. Valor: abreviatura de ESPN.
export const ALIAS_ABREVIATURAS = {
  BLT: 'BAL',
  CLV: 'CLE',
  WAS: 'WSH',
  LA: 'LAR',
  ARZ: 'ARI',
  HST: 'HOU',
  JAC: 'JAX',
};

// Devuelve la abreviatura de ESPN para una abreviatura que aparece en el texto de una jugada.
export function abreviaturaEspn(abrev) {
  if (!abrev) return '';
  const a = String(abrev).toUpperCase();
  return ALIAS_ABREVIATURAS[a] || a;
}

// ¿Las dos abreviaturas nombran al mismo equipo?
export function mismaAbreviatura(a, b) {
  return !!a && !!b && abreviaturaEspn(a) === abreviaturaEspn(b);
}
