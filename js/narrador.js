// Narrador en español de la vista 3D.
// Dos partes, las dos sin DOM (se prueban con node --test):
//   1. relatoDeJugada(jugada, linea, partido): de 2 a 4 frases cortas con su momento, al estilo de un comentarista
//      de TV. Solo usa datos que trae la jugada (texto de ESPN, oportunidad, yardas, marcador); no inventa nada.
//   2. crearNarrador({ sintesis, Enunciado, memoria }): dice esas frases con la voz del navegador (Web Speech API),
//      sincronizadas con el reloj de la animación. La voz y el almacenamiento se reciben desde afuera.
import { analizarTexto } from './motor.js';
import { textoDeOportunidad } from './graficatv.js';

// ---------------------------------------------------------------------------
// 1. El relato
// ---------------------------------------------------------------------------

const MARCA = '\u0001';
const cerrarIncisos = (texto) => texto.replace(/\u0001(?=\s*[.!?…,;:]|$)/g, '').replace(/\u0001/g, ',');
const semilla = (texto) => { let h = 7; for (const c of String(texto)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const yardasTexto = (n) => `${n} ${n === 1 ? 'yarda' : 'yardas'}`;
// "B. Sinnott" → "Sinnott"; "A. St. Brown" → "St. Brown".
export const apellido = (nombre) => String(nombre || '').replace(/^[A-Z][A-Za-z]{0,2}\.\s*/, '').trim();

// Devuelve [{ t, momento, texto }] ordenado por t; [] si no hay nada que contar.
// momento: 'snap' | 'accion' | 'recepcion' | 'resultado' | 'marcador'.
export function relatoDeJugada(jugada, linea, partido) {
  if (!jugada || !linea) return [];
  const e = jugada.explicacion || {};
  const h = analizarTexto(e.original || '') || {};
  const base = semilla(jugada.id || e.original || '');
  let turno = 0;
  // Varía las frases sin azar: la misma jugada siempre se relata igual, jugadas distintas suenan distinto.
  const una = (...opciones) => opciones[(base + (turno++) * 7) % opciones.length];
  const tDe = (...tipos) => { for (const tipo of tipos) { const ev = linea.eventos.find((x) => x.tipo === tipo); if (ev) return ev.t; } return null; };
  const quien = (...papeles) => {
    const r = (linea.rotulos || []).find((x) => papeles.includes(x.papel));
    if (!r) return null;
    const a = apellido(r.nombre);
    return a ? { apellido: a, numero: r.numero || '' } : null;
  };
  // La primera vez que se nombra a alguien va con su número (si es el real): "Sinnott, el 82".
  // La marca se convierte al final en una coma si la frase sigue, o en nada si después viene un signo de puntuación.
  const conNumero = (q) => (q.numero ? `${q.apellido}, el ${q.numero}${MARCA}` : q.apellido);
  const equipoDe = (id) => (String(partido?.local?.id) === String(id) ? partido.local : String(partido?.visitante?.id) === String(id) ? partido.visitante : null);
  const ataca = linea.ataque?.nombre || equipoDe(jugada.inicio?.team?.id)?.nombre || '';
  const defiende = linea.defensa?.nombre || '';
  const frases = [];
  const decir = (t, momento, texto) => { if (texto && t !== null && Number.isFinite(t)) frases.push({ t: Math.max(0, t), momento, texto: cerrarIncisos(texto) }); };

  const oportunidad = textoDeOportunidad(jugada.inicio, partido?.local?.id, true); // "Tercera y 7", "Primera y gol"
  const yardas = Number.isFinite(h.yardas) ? h.yardas : null;
  const primerDown = (e.conceptos || []).includes('primer-down');
  const lado = { izquierda: 'a la izquierda', derecha: 'a la derecha', centro: 'por el centro' }[h.direccion] || '';
  const tInicio = linea.tSnap !== null && linea.tSnap !== undefined ? Math.max(0, linea.tSnap - 0.7) : 0;
  const tFinal = tDe('touchdown', 'tacleo', 'fuera', 'incompleto', 'gol-de-campo-bueno', 'gol-de-campo-fallado', 'touchback', 'balon-muerto', 'recepcion-libre', 'rodilla') ?? Math.max(0, linea.duracion - 1.5);
  const hayPenal = (h.penales || []).some((p) => p.estado !== 'rechazado');
  const anotaAtaque = linea.anotacion && e.anotacion && tDe('touchdown') !== null;

  const cierre = () => {
    // Lo que pasó después del final: touchdown con marcador, bandera o cambio de posesión.
    if (anotaAtaque) {
      const eq = equipoDe(e.anotacion.equipo);
      decir(tFinal, 'resultado', una(`¡Touchdown${eq ? ` de los ${eq.nombre}` : ''}!`, `¡Touchdown${eq ? `, touchdown de los ${eq.nombre}` : ''}!`, `¡Anotan${eq ? ` los ${eq.nombre}` : ''}! ¡Touchdown!`));
      const m = jugada.marcador;
      if (m && partido?.local && partido?.visitante) {
        const [a, b] = m.local >= m.visitante ? [partido.local, partido.visitante] : [partido.visitante, partido.local];
        const [pa, pb] = m.local >= m.visitante ? [m.local, m.visitante] : [m.visitante, m.local];
        decir(tFinal + 1.6, 'marcador', pa === pb ? `El partido queda empatado a ${pa}.` : `${a.nombre} ${pa}, ${b.nombre} ${pb}.`);
      }
      return true;
    }
    return false;
  };
  const coletilla = () => {
    if (h.sinJugada) return una('Pero hay pañuelo en el campo: la jugada no cuenta.', 'Atención, hay bandera: la jugada queda anulada.');
    if (h.balonSuelto) return una('¡Y hay balón suelto!', '¡Se le escapa el balón!');
    if (hayPenal) return una('Pero hay pañuelo en el campo.', 'Atención: hay bandera en la jugada.');
    return '';
  };

  if (linea.forma === 'penal') {
    decir(tDe('bandera') ?? 0.5, 'accion', una('Hay pañuelo en el campo antes de la jugada.', 'Bandera de los árbitros: no hay jugada.'));
    const primera = String(e.explicacion || '').split(/(?<=[.!?])\s+/)[0];
    if (primera && primera.length <= 150) decir(Math.max(1.6, linea.duracion - 1.4), 'resultado', primera);
  } else if (linea.forma === 'gol-de-campo') {
    const p = quien('Pateador');
    const distancia = Number.isFinite(h.golDeCampo?.yardas) ? h.golDeCampo.yardas : null;
    decir(tInicio, 'snap', `${ataca ? una(`Van por el gol de campo los ${ataca}`, `Intento de gol de campo de los ${ataca}`) : 'Intento de gol de campo'}${distancia ? `, de ${yardasTexto(distancia)}` : ''}.`);
    decir(tDe('patada'), 'accion', p ? una(`Patea ${conNumero(p)}.`, `Le pega ${conNumero(p)}.`) : 'Ahí va la patada.');
    if (tDe('gol-de-campo-bueno') !== null) decir(tFinal, 'resultado', una('¡Es bueno! Tres puntos.', '¡Entre los postes! Suman tres.', '¡Bueno el gol de campo!'));
    else decir(tFinal, 'resultado', h.golDeCampo?.bloqueadoPor ? '¡Bloqueado! No hay puntos.' : una('¡Lo falla! No hay puntos.', '¡Se va desviado! Sin puntos.'));
  } else if (linea.forma === 'patada') {
    const despeje = e.accion === 'despeje';
    const p = quien('Pateador', 'Despeja');
    const regresa = quien('Regresa la patada', 'Regresa el despeje');
    const pt = h.patada || {};
    if (despeje) decir(tInicio, 'snap', `${oportunidad ? `${oportunidad}. ` : ''}${ataca ? una(`Sale el equipo de despeje de los ${ataca}`, `Van a despejar los ${ataca}`) : 'Van a despejar'}.`);
    const largo = Number.isFinite(pt.yardas) && pt.yardas > 0 ? ` ${una('Patada de', 'Son')} ${yardasTexto(pt.yardas)}.` : '';
    decir(tDe('patada'), 'accion', `${p ? una(`${despeje ? 'Despeja' : 'Patea'} ${conNumero(p)}.`, `Ahí va la patada de ${conNumero(p)}.`) : (despeje ? 'Ahí va el despeje.' : 'Ahí va la patada de salida.')}${largo}`);
    if (!cierre()) {
      const yRegreso = Number.isFinite(pt.retorno?.yardas) ? pt.retorno.yardas : null;
      if (tDe('touchback') !== null) decir(tFinal, 'resultado', una('Touchback: no hay regreso.', 'Hasta la zona de anotación. Touchback.'));
      else if (tDe('recepcion-libre') !== null) decir(tFinal, 'resultado', 'Pide recepción libre: no hay regreso.');
      else if (tDe('balon-muerto') !== null) decir(tFinal, 'resultado', pt.fuera ? 'El balón sale del campo.' : 'El balón queda muerto ahí.');
      else if (regresa) {
        decir(tDe('atrapada'), 'recepcion', una(`La recibe ${conNumero(regresa)}.`, `Atrás espera ${conNumero(regresa)}.`));
        decir(tFinal, 'resultado', yRegreso !== null && yRegreso > 0 ? una(`Lo detienen después de ${yardasTexto(yRegreso)} de regreso.`, `Regreso de ${yardasTexto(yRegreso)}.`) : 'Lo detienen ahí mismo.');
      } else decir(tFinal, 'resultado', 'Ahí termina la jugada.');
    }
  } else if (tDe('rodilla') !== null) {
    const m = quien('Mariscal');
    decir(tInicio, 'snap', oportunidad ? `${oportunidad}.` : '');
    decir(tFinal, 'resultado', `${m ? m.apellido : 'El mariscal'} ${una('pone la rodilla en el suelo y deja correr el reloj.', 'se arrodilla: el reloj sigue corriendo.')}`);
  } else {
    // Jugadas desde la línea de golpeo: pase, carrera o captura.
    const pasador = quien('Pasador');
    const receptor = quien('Receptor');
    const buscado = quien('Buscaban a');
    const corredor = quien('Corredor', 'Mariscal');
    const tLanza = tDe('lanzamiento');
    decir(tInicio, 'snap', oportunidad ? una(`${oportunidad}${ataca ? ` para los ${ataca}` : ''}.`, `${oportunidad}.`, `${ataca ? `Atacan los ${ataca}. ` : ''}${oportunidad}.`) : '');
    if (tLanza !== null) {
      const hondo = h.profundidad === 'profundo';
      const sujeto = pasador ? conNumero(pasador) : 'El mariscal';
      decir(tLanza - 0.5, 'accion', una(
        `${sujeto} ${hondo ? 'lanza profundo' : 'lanza'}${lado ? ` ${lado}` : ''}...`,
        `${hondo ? 'Pase largo' : 'Pase'} ${pasador ? `de ${conNumero(pasador)}` : 'del mariscal'}${lado ? ` ${lado}` : ''}...`,
        `Retrocede ${pasador ? conNumero(pasador) : 'el mariscal'} y ${hondo ? 'la manda lejos' : 'suelta el pase'}${lado ? ` ${lado}` : ''}...`));
      if (tDe('intercepcion') !== null) {
        decir(tDe('intercepcion'), 'recepcion', una('¡Interceptado!', '¡Se la roban! ¡Intercepción!'));
        decir(tFinal + 0.9, 'resultado', defiende ? `El balón pasa a los ${defiende}.` : 'Cambio de posesión.');
      } else if (tDe('incompleto') !== null) {
        decir(tFinal, 'resultado', `${una('Incompleto.', 'No la puede atrapar. Incompleto.', 'El pase cae al pasto. Incompleto.')}${buscado ? ` ${una('Buscaba a', 'Iba para')} ${conNumero(buscado)}.` : ''}`);
      } else {
        decir(tDe('atrapada'), 'recepcion', receptor ? una(`¡La atrapa ${conNumero(receptor)}!`, `Completo con ${conNumero(receptor)}.`, `${conNumero(receptor)} se queda con el balón.`) : 'Pase completo.');
        if (!cierre()) {
          let fin;
          if (yardas === null) fin = 'Ahí lo detienen.';
          else if (yardas > 0) fin = h.fueraDelCampo ? `Sale del campo después de ${yardasTexto(yardas)}.` : una(`Lo derriban: ganancia de ${yardasTexto(yardas)}.`, `Avance de ${yardasTexto(yardas)}.`, `Son ${yardasTexto(yardas)} en la jugada.`);
          else fin = yardas === 0 ? 'Lo frenan sin ganancia.' : `Lo frenan atrás: pierden ${yardasTexto(-yardas)}.`;
          decir(tFinal, 'resultado', `${fin}${primerDown ? una(' ¡Primer down!', ' Alcanza para el primer down.') : ''}`);
        }
      }
    } else if (e.accion === 'captura') {
      decir(tFinal - 1.3, 'accion', `${pasador ? conNumero(pasador) : 'El mariscal'} ${una('retrocede para lanzar y se le viene la presión...', 'busca a quién lanzar y no encuentra a nadie...')}`);
      decir(tFinal, 'resultado', `${una('¡Lo capturan!', '¡Captura!')}${yardas !== null && yardas < 0 ? ` Pierden ${yardasTexto(-yardas)}.` : ''}`);
    } else {
      const escapada = !!h.escapada;
      const sujeto = corredor ? conNumero(corredor) : (escapada ? 'el mariscal' : 'el corredor');
      decir(tDe('entrega') ?? (tInicio + 1.6), 'accion', escapada
        ? una(`${sujeto.replace(/^e/, 'E')} no encuentra a nadie y sale corriendo...`, `Se escapa ${sujeto} con el balón...`)
        : una(`Se la entregan a ${sujeto}...`, `Balón para ${sujeto}${lado ? `, que va ${lado}` : ''}...`, `Carrera de ${sujeto}...`));
      if (!cierre()) {
        let fin;
        if (yardas === null) fin = 'Ahí lo detienen.';
        else if (yardas > 0) fin = h.fueraDelCampo ? `Sale del campo después de ${yardasTexto(yardas)}.` : una(`Lo detienen después de ${yardasTexto(yardas)}.`, `Gana ${yardasTexto(yardas)}.`, `Avance de ${yardasTexto(yardas)} por tierra.`);
        else fin = yardas === 0 ? una('No pasa: sin ganancia.', 'Lo frenan en la línea.') : `Lo frenan atrás: pierde ${yardasTexto(-yardas)}.`;
        decir(tFinal, 'resultado', `${fin}${primerDown ? una(' ¡Primer down!', ' Alcanza para el primer down.') : ''}`);
      }
    }
  }
  const extra = coletilla();
  if (extra && linea.forma !== 'penal') decir(tFinal + 1.2, 'resultado', extra);

  // Orden, sin duplicados y nunca más de 4: si sobran, se conserva el final (es lo que más importa).
  frases.sort((a, b) => a.t - b.t);
  const limpias = frases.filter((f, i) => i === 0 || f.texto !== frases[i - 1].texto);
  while (limpias.length > 4) limpias.shift();
  return limpias.map((f) => ({ t: Math.round(Math.min(f.t, linea.duracion) * 100) / 100, momento: f.momento, texto: f.texto }));
}

// ---------------------------------------------------------------------------
// 2. La voz
// ---------------------------------------------------------------------------

const PREFERIDAS = ['es-mx', 'es-us', 'es-419'];

// Elige la voz en español: primero es-MX, es-US o es-419; después cualquier es-*. null si no hay ninguna.
export function elegirVoz(voces) {
  const lista = Array.from(voces || []).filter((v) => /^es([-_]|$)/i.test(String(v?.lang || '')));
  if (!lista.length) return null;
  const idioma = (v) => String(v.lang).toLowerCase().replace('_', '-');
  for (const pref of PREFERIDAS) {
    const de = lista.filter((v) => idioma(v) === pref);
    if (de.length) return de.find((v) => v.localService) || de[0];
  }
  return lista.find((v) => v.localService) || lista[0];
}

const CLAVE = 'primerdown-narrador';

// sintesis: speechSynthesis (o algo con speak, cancel, getVoices). Enunciado: SpeechSynthesisUtterance.
// memoria: localStorage (o algo con getItem y setItem). Todo es opcional: si falta o falla, el narrador
// simplemente no está disponible y nada más se rompe.
export function crearNarrador({ sintesis = null, Enunciado = null, memoria = null, alHablar = null } = {}) {
  let voz = null;
  let encendido = false;
  let frases = [];
  let siguiente = 0; // índice de la próxima frase por decir
  let hablando = false;
  let pendiente = null; // como mucho una frase en espera: si llega otra, la reemplaza
  let guardia = 0;
  let pausado = false;
  const oyentes = new Set();
  const avisar = () => { for (const f of oyentes) { try { f(); } catch { /* un oyente roto no detiene al resto */ } } };

  try { encendido = memoria?.getItem(CLAVE) === '1'; } catch { encendido = false; }
  const buscarVoz = () => {
    try { voz = sintesis && Enunciado ? elegirVoz(sintesis.getVoices()) : null; } catch { voz = null; }
    avisar();
  };
  buscarVoz();
  // En varios navegadores las voces llegan después de cargar la página.
  try { sintesis?.addEventListener?.('voiceschanged', buscarVoz); } catch { /* sin evento, queda lo que haya */ }

  const soltar = () => { hablando = false; clearTimeout(guardia); };
  const pronunciar = (frase) => {
    if (!voz || !encendido || pausado) return;
    try {
      const u = new Enunciado(frase.texto);
      u.voice = voz;
      u.lang = voz.lang;
      u.rate = 1.12;
      u.pitch = 1.05;
      const alAcabar = () => {
        if (!hablando) return;
        soltar();
        const p = pendiente;
        pendiente = null;
        if (p) pronunciar(p);
      };
      u.onend = alAcabar;
      u.onerror = alAcabar;
      hablando = true;
      // Si el navegador nunca avisa del final, no se queda trabado.
      clearTimeout(guardia);
      guardia = setTimeout(alAcabar, 2500 + frase.texto.length * 90);
      sintesis.speak(u);
      alHablar?.(frase);
    } catch {
      soltar();
      pendiente = null;
    }
  };
  const callar = () => {
    pendiente = null;
    soltar();
    try { sintesis?.cancel(); } catch { /* nada que callar */ }
  };

  return {
    disponible: () => !!voz,
    encendido: () => encendido && !!voz,
    voz: () => (voz ? { nombre: voz.name || '', idioma: voz.lang } : null),
    alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
    encender(si) {
      encendido = !!si;
      try { memoria?.setItem(CLAVE, encendido ? '1' : '0'); } catch { /* sin almacenamiento, vale solo para esta visita */ }
      if (!encendido) callar();
      avisar();
    },
    // Empieza una jugada (o su repetición) desde el segundo `desde`: lo anterior se calla.
    cargar(lista, desde = 0) {
      callar();
      pausado = false;
      frases = Array.isArray(lista) ? lista : [];
      siguiente = frases.findIndex((f) => f.t >= desde - 0.05);
      if (siguiente < 0) siguiente = frases.length;
    },
    // El reloj de la animación llegó al segundo t: dice lo que toque.
    avanzar(t) {
      if (!voz || !encendido || pausado) return;
      while (siguiente < frases.length && frases[siguiente].t <= t) {
        const frase = frases[siguiente++];
        if (hablando) pendiente = frase; else pronunciar(frase);
      }
    },
    pausar() { pausado = true; callar(); },
    continuar() { pausado = false; },
    callar,
    ocupado: () => hablando || !!pendiente,
  };
}
