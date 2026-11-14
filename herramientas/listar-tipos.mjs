// Genera datos/tipos-de-jugada.md a partir de todos los partidos guardados.
// Uso:  node herramientas/listar-tipos.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ, cargarCrudos, cargarTodos, recorrerJugadas } from './cargar-datos.mjs';

const crudos = cargarCrudos();
const todos = cargarTodos();
const idsCrudos = new Set(crudos.map((s) => s.header.id));

const tipos = new Map();
const penales = new Map();
const puntoExtra = new Map();
const resultadosDrive = new Map();
let total = 0;

for (const p of todos) {
  for (const d of p.drives) {
    const k = d.displayResult ?? '(sin resultado)';
    resultadosDrive.set(k, (resultadosDrive.get(k) || 0) + 1);
  }
}

for (const { partido, jugada: j } of recorrerJugadas(todos)) {
  total++;
  const clave = j.type?.text ?? '(sin tipo)';
  const t = tipos.get(clave) || { id: j.type?.id, abrev: j.type?.abbreviation || '', n: 0, enCrudos: 0, ejemplos: [] };
  t.n++;
  if (idsCrudos.has(partido.id)) t.enCrudos++;
  // Ejemplo: se prefiere uno de los partidos guardados completos y de largo "normal".
  const candidato = { texto: j.text, partido: partido.equipos.map((e) => e.abbreviation).join(' vs '), crudo: idsCrudos.has(partido.id), situacion: j.start?.downDistanceText || '' };
  if (t.ejemplos.length < 2 && !t.ejemplos.some((e) => e.texto === j.text)) t.ejemplos.push(candidato);
  else if (candidato.crudo && !t.ejemplos[0].crudo) t.ejemplos[0] = candidato;
  tipos.set(clave, t);

  if (j.penalty?.type?.text) {
    const k = j.penalty.type.text;
    const pe = penales.get(k) || { slug: j.penalty.type.slug, n: 0 };
    pe.n++;
    penales.set(k, pe);
  }
  if (j.pointAfterAttempt) {
    const k = `${j.pointAfterAttempt.text} (vale ${j.pointAfterAttempt.value})`;
    puntoExtra.set(k, (puntoExtra.get(k) || 0) + 1);
  }
}

const fila = (celdas) => `| ${celdas.join(' | ')} |`;
const limpiar = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const ordenados = [...tipos].sort((a, b) => b[1].n - a[1].n);

let md = `# Tipos de jugada en los datos reales de ESPN

Generado por \`herramientas/listar-tipos.mjs\`. No editar a mano la parte de las tablas: se regenera.

- **Partidos analizados:** ${todos.length} (temporada 2026, semanas 1 a 10). De ellos, ${crudos.length} están guardados completos en \`datos/crudos/\` y el resto en formato compacto (solo jugadas) en \`datos/corpus/\`.
- **Jugadas analizadas:** ${total.toLocaleString('es')}.
- **Tipos distintos (\`type.text\`):** ${tipos.size}.

## Resumen

${fila(['#', '`type.text`', 'id', 'abrev.', 'Veces', 'En los 16 completos'])}
${fila(['---', '---', '---', '---', '---:', '---:'])}
${ordenados.map(([k, t], i) => fila([i + 1, `**${k}**`, t.id ?? '', t.abrev || '(vacía)', t.n.toLocaleString('es'), t.enCrudos])).join('\n')}

## Un ejemplo real de cada tipo

`;

for (const [k, t] of ordenados) {
  md += `### ${k} (${t.n.toLocaleString('es')})\n`;
  for (const e of t.ejemplos) {
    md += `- \`${limpiar(e.texto)}\`  \n  _${e.partido}${e.situacion ? ', ' + limpiar(e.situacion) : ''}_\n`;
  }
  md += '\n';
}

md += `## Tipos de penal (campo \`penalty.type\`)

Aparece en ${[...penales.values()].reduce((a, b) => a + b.n, 0).toLocaleString('es')} jugadas. Solo se informa **un** penal por jugada aunque el texto mencione varios.

${fila(['Penal (`penalty.type.text`)', '`slug`', 'Veces'])}
${fila(['---', '---', '---:'])}
${[...penales].sort((a, b) => b[1].n - a[1].n).map(([k, p]) => fila([k, `\`${p.slug}\``, p.n])).join('\n')}

## Punto extra y conversión de 2 (campo \`pointAfterAttempt\`)

No son jugadas aparte: vienen dentro de la jugada del touchdown.

${fila(['`pointAfterAttempt.text` (valor)', 'Veces'])}
${fila(['---', '---:'])}
${[...puntoExtra].sort((a, b) => b[1] - a[1]).map(([k, n]) => fila([k, n])).join('\n')}

## Cómo terminan los drives (\`drive.displayResult\`)

${fila(['Resultado', 'Veces'])}
${fila(['---', '---:'])}
${[...resultadosDrive].sort((a, b) => b[1] - a[1]).map(([k, n]) => fila([k, n])).join('\n')}

`;

md += DIFERENCIAS();

writeFileSync(path.join(RAIZ, 'datos', 'tipos-de-jugada.md'), md);
console.log(`Escrito datos/tipos-de-jugada.md: ${tipos.size} tipos, ${total} jugadas, ${todos.length} partidos`);

function DIFERENCIAS() {
  return `## Diferencias entre los datos reales y la especificación

Comprobadas sobre los partidos guardados (13 nov 2026). Las que afectan al código están resueltas en \`js/motor.js\`.

1. **\`yardLine\` no es relativo a quien tiene el balón.** Es la distancia a la zona de anotación **del equipo local**, de 0 a 100 (comprobado en 2.715 de 2.715 jugadas contra \`possessionText\`). El local ataca hacia 100 y el visitante hacia 0. La especificación (4.6) habla de animar de \`start.yardLine\` a \`end.yardLine\`: sirve tal cual para dibujar, pero para explicar hay que convertirlo.
2. **\`yardsToEndzone\` no es fiable.** Vale 0 en tiempos fuera, avisos de dos minutos y finales de cuarto, y viene **invertido en la mitad de los punts** (cuando despeja el local). El motor lo calcula por su cuenta desde \`yardLine\`.
3. **\`type.text\` a veces está mal.** Vistos: un pase incompleto etiquetado "End Period", un "Safety" y un "Kickoff Return Touchdown" que en realidad fueron anulados por penal, y un "Timeout" cuyo texto es "Official Timeout". Por eso el motor decide con el texto **y** el tipo, no solo con el tipo.
4. **El punto extra y la conversión de 2 no son jugadas aparte.** Vienen dentro del texto del touchdown y en \`pointAfterAttempt\` (la especificación los lista como si fueran jugadas).
5. **El marcador de cada jugada (\`homeScore\`, \`awayScore\`) es el de después de la jugada**, con el punto extra ya sumado.
6. **Las abreviaturas del texto no son las de ESPN.** El texto usa las de la liga: BLT, CLV, WAS, LA, ARZ y HST donde ESPN usa BAL, CLE, WSH, LAR, ARI y HOU.
7. **Las jugadas revisadas traen las dos versiones en el mismo texto**: la original, la frase de la revisión ("...and the play was REVERSED.") y luego la corregida. Hay que leer la última.
8. **Hay campos útiles que la especificación no menciona:** \`penalty\` (\`type.slug\`, \`yards\`, \`status\`), \`review\`, \`scoringType\`, \`pointAfterAttempt\`, \`yardsAfterCatch\`, \`isTurnover\`, \`isPenalty\`, \`scoringPlay\`, \`period.number\` y \`clock.displayValue\`.
9. **\`downDistanceText\` falta** al inicio de las patadas de salida y al final de las jugadas de anotación (\`down: -1\`).
10. **En las patadas de salida, \`start.team\` es quien patea** y el drive pertenece a quien recibe. En tiempos fuera \`start.team\` no coincide con el drive la mitad de las veces: para esas filas se usa el equipo del drive.
11. **\`drives.current\` no aparece en ningún partido terminado.** Solo podrá comprobarse en vivo el domingo 15; el código lo trata como un drive más si existe.
12. **Unas pocas jugadas traen el texto corto de anotación de ESPN** en vez de la descripción de la liga (por ejemplo "Demetrius Knight Jr. Safety" o "Jalen Coker 26 Yd pass from Bryce Young"). Se explican con los campos estructurados.
13. **Tiempo extra:** \`period.number\` 5 con reloj desde 10:00, y existe el tipo "End of Regulation".
14. **El scoreboard acepta \`?dates=2026&seasontype=2&week=N\`** para pedir otra semana (mismo endpoint de la especificación; se usó para bajar semanas anteriores).
15. **El JSON trae enlaces a logos oficiales** (\`team.logos\`). No se usan en ninguna parte (restricción 3).
16. **Tipos conocidos de ESPN que no aparecieron en la muestra** (por ejemplo el regreso de un gol de campo fallado o el saque de moneda): quedan cubiertos por las reglas de texto y por el caso genérico, con pruebas sintéticas marcadas como tales.
`;
}
