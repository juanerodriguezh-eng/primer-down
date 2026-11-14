// Utilidad compartida por las herramientas y las pruebas: carga todos los partidos
// disponibles en disco (crudos de datos/crudos y compactos de datos/corpus) con una forma común:
//   { id, date, equipos: [{id, homeAway, abbreviation, name, location, score}], drives: [{team, plays, ...}] }
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compactarPartido } from './ampliar-corpus.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function cargarCrudos() {
  const dir = path.join(RAIZ, 'datos', 'crudos');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('summary-') && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
}

export function cargarCorpus() {
  const dir = path.join(RAIZ, 'datos', 'corpus');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('semana-') && f.endsWith('.json'))
    .sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7)))
    .flatMap((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')).partidos);
}

// Todos los partidos en forma compacta, sin repetir.
export function cargarTodos() {
  const vistos = new Set();
  const todos = [];
  for (const p of [...cargarCrudos().map(compactarPartido), ...cargarCorpus()]) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    todos.push(p);
  }
  return todos;
}

// Recorre todas las jugadas con su contexto mínimo.
export function* recorrerJugadas(partidos) {
  for (const partido of partidos) {
    for (const drive of partido.drives) {
      for (let i = 0; i < drive.plays.length; i++) {
        yield { partido, drive, jugada: drive.plays[i], indice: i };
      }
    }
  }
}
