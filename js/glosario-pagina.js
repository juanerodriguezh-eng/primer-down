// Página del glosario completo. Acepta un ancla (#touchdown) para abrir un término directo.
import { GLOSARIO, GRUPOS } from './glosario.js';
import { crear, vaciar, montarBotonTema } from './ui.js';

const lista = document.getElementById('lista');
const buscador = document.getElementById('buscador');
const cuenta = document.getElementById('cuenta');

function pintar(filtro = '') {
  vaciar(lista);
  const f = filtro.trim().toLowerCase();
  let total = 0;
  for (const grupo of GRUPOS) {
    const terminos = GLOSARIO.filter((t) => t.grupo === grupo.id && (!f || `${t.termino} ${t.definicion}`.toLowerCase().includes(f)));
    if (!terminos.length) continue;
    total += terminos.length;
    lista.append(crear('h2', {}, grupo.titulo), ...terminos.map((t) => crear('article', { class: 'termino termino-abierto', id: t.id },
      crear('h3', {}, t.termino),
      crear('p', {}, t.definicion),
      t.ejemplo ? crear('p', { class: 'ejemplo' }, crear('strong', {}, 'Ejemplo: '), t.ejemplo) : null)));
  }
  if (!total) lista.append(crear('p', { class: 'vacio' }, 'No encontramos ese término. Prueba con otra palabra.'));
  cuenta.textContent = f ? `${total} de ${GLOSARIO.length} términos` : `${GLOSARIO.length} términos del fútbol americano, explicados sin dar nada por sabido.`;
}

buscador.addEventListener('input', () => pintar(buscador.value));
montarBotonTema();
pintar();
if (location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
document.body.dataset.listo = '1';
