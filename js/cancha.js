// Mini cancha horizontal en SVG: dónde está el balón, la línea a conseguir y hacia dónde atacan.
// Convención de los datos: yardLine va de 0 (zona de anotación del local) a 100 (la del visitante).
// El local ataca hacia la derecha y el visitante hacia la izquierda.
const SVG = 'http://www.w3.org/2000/svg';

export function nodo(etiqueta, atributos = {}, texto) {
  const el = document.createElementNS(SVG, etiqueta);
  for (const [k, v] of Object.entries(atributos)) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Texto alternativo de la cancha (también sirve para las pruebas, no toca el DOM).
export function describirCancha(partido) {
  const punto = partido?.situacion?.punto;
  if (!punto || typeof punto.yardLine !== 'number') return 'Cancha sin jugada en curso.';
  const ataca = punto.equipoId === partido.local.id ? partido.local : partido.visitante;
  const haciaDerecha = punto.equipoId === partido.local.id;
  const yardasAlGol = haciaDerecha ? 100 - punto.yardLine : punto.yardLine;
  const hayMarca = punto.distancia > 0 && punto.distancia < yardasAlGol;
  return `Balón en ${partido.situacion.titulo.replace(/^.* en /, '')}. `
    + `Los ${ataca.nombre} atacan hacia la ${haciaDerecha ? 'derecha' : 'izquierda'}. `
    + (hayMarca ? `La línea a conseguir está ${punto.distancia} ${punto.distancia === 1 ? 'yarda' : 'yardas'} más adelante.` : 'La línea a conseguir es la zona de anotación.');
}

// Cancha vacía: pasto, zonas de anotación con el color de cada equipo y líneas cada 10 yardas.
// Devuelve el SVG y la función x(yardLine) para ubicar cosas encima. La usan la mini cancha y la pizarra.
// 120 unidades de ancho: 10 de cada zona de anotación + 100 yardas. 1 unidad = 1 yarda.
export function canchaBase(partido, descripcion, clase = 'cancha') {
  const svg = nodo('svg', { viewBox: '0 0 120 44', class: clase, role: 'img', 'aria-label': descripcion });
  svg.append(nodo('title', {}, descripcion));
  const x = (yardLine) => 10 + Math.max(0, Math.min(100, yardLine));

  svg.append(nodo('rect', { x: 0, y: 4, width: 120, height: 36, rx: 2, class: 'cancha-pasto' }));
  svg.append(nodo('rect', { x: 0, y: 4, width: 10, height: 36, class: 'cancha-zona', style: partido.local.color ? `fill:${partido.local.color}` : null }));
  svg.append(nodo('rect', { x: 110, y: 4, width: 10, height: 36, class: 'cancha-zona', style: partido.visitante.color ? `fill:${partido.visitante.color}` : null }));
  svg.append(nodo('text', { x: 5, y: 22, class: 'cancha-zona-texto', transform: 'rotate(-90 5 22)' }, partido.local.abrev));
  svg.append(nodo('text', { x: 115, y: 22, class: 'cancha-zona-texto', transform: 'rotate(90 115 22)' }, partido.visitante.abrev));

  for (let y = 10; y <= 90; y += 10) {
    svg.append(nodo('line', { x1: x(y), y1: 4, x2: x(y), y2: 40, class: y === 50 ? 'cancha-linea cancha-medio' : 'cancha-linea' }));
    svg.append(nodo('text', { x: x(y), y: 38.5, class: 'cancha-numero' }, String(y <= 50 ? y : 100 - y)));
  }
  return { svg, x };
}

export function dibujarCancha(partido) {
  const { svg, x } = canchaBase(partido, describirCancha(partido));

  const punto = partido?.situacion?.punto;
  if (punto && typeof punto.yardLine === 'number') {
    const haciaDerecha = punto.equipoId === partido.local.id;
    const balon = x(punto.yardLine);
    const yardasAlGol = haciaDerecha ? 100 - punto.yardLine : punto.yardLine;
    if (punto.distancia > 0 && punto.distancia < yardasAlGol) {
      const marca = x(punto.yardLine + (haciaDerecha ? punto.distancia : -punto.distancia));
      svg.append(nodo('rect', { x: Math.min(balon, marca), y: 4, width: Math.abs(marca - balon), height: 36, class: 'cancha-tramo' }));
      svg.append(nodo('line', { x1: marca, y1: 4, x2: marca, y2: 40, class: 'cancha-marca' }));
    }
    svg.append(nodo('line', { x1: balon, y1: 4, x2: balon, y2: 40, class: 'cancha-golpeo' }));
    // Flecha con la dirección del ataque.
    const punta = haciaDerecha ? balon + 7 : balon - 7;
    const base = haciaDerecha ? balon + 3.5 : balon - 3.5;
    svg.append(nodo('line', { x1: balon, y1: 13, x2: base, y2: 13, class: 'cancha-flecha' }));
    svg.append(nodo('polygon', { points: `${base},10.5 ${punta},13 ${base},15.5`, class: 'cancha-flecha-punta' }));
    svg.append(nodo('ellipse', { cx: balon, cy: 24, rx: 2.6, ry: 1.7, class: 'cancha-balon' }));
  }
  return svg;
}
