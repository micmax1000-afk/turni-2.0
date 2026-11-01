// ── v3.8.14: icone a linea in tutta l'app ──
// Le emoji usate come icona (da sole, o all'inizio di un'etichetta: "📅 Evento", "🗑️ Cancella")
// diventano icone disegnate a linea, nello stile delle indennità: uguali su tutti i telefoni,
// in tinta con il colore dell'app e leggibili anche col tema scuro.
// Le emoji dentro le frasi (consigli, messaggi) restano come sono.

const DISEGNI_LINEA = {
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  giro: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  orologio: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2.5h4"/>',
  sveglia: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.2 1.8M5 3.5 2.5 6M19 3.5 21.5 6"/>',
  clessidra: '<path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9"/>',
  cestino: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
  ingranaggio: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  puntina: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  luna: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  tramonto: '<path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 5v3M4.6 9.6l1.8 1.4M19.4 9.6 17.6 11M8 21h8"/>',
  grafico: '<path d="M4 20V4M4 20h16M8 16l3.5-4 3 2.5L20 8"/>',
  barre: '<path d="M4 20h16M7 20v-7M12 20V5M17 20v-10"/>',
  riposo: '<path d="M4 6h6l-6 7h6M13 12h5l-5 6h5"/>',
  vacanza: '<path d="M12 3a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8zM12 11v10M7 21h10"/>',
  tavolozza: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.6-1.3-.6-2.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.3" r="1.2" fill="currentColor"/><circle cx="15" cy="7.8" r="1.2" fill="currentColor"/>',
  lista: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM8.5 11h7M8.5 15h5"/>',
  posate: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2 0-3.5 3-3.5 8H17"/>',
  scudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  euro: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4.5 4.5 0 1 0 0 7M7 10.5h6M7 13.5h6"/>',
  matita: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/>',
  pennello: '<path d="M18.5 3.5l2 2-8.5 8.5-2-2zM9.5 13.5c-2 0-3.5 1.5-3.5 3.5 0 1.3-1 2.5-2.5 2.5 1.5 1.5 6.5 1.5 8-1.5.8-1.6.2-3.2-2-4.5z"/>',
  auto: '<path d="M3 17v-4l2.5-6h13L21 13v4z"/><path d="M3 13h18"/><circle cx="7.5" cy="17" r="1.8" fill="currentColor"/><circle cx="16.5" cy="17" r="1.8" fill="currentColor"/>',
  ricevuta: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
  salva: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  scarica: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19h16"/>',
  carica: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 19h16"/>',
  tessera: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.3"/><path d="M5.8 16c.6-1.7 1.8-2.5 3.2-2.5s2.6.8 3.2 2.5M14.5 10h4M14.5 13.5h3"/>',
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  nuvola: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z"/>',
  batteria: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M6.5 10v4M10 10v4"/>',
  telefono: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  cornetta: '<path d="M5 3.5h3.5l1.5 4.5-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4.5 1.5V19a1.5 1.5 0 0 1-1.6 1.5A17 17 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z"/>',
  stampante: '<path d="M7 9V3.5h10V9M7 17H4.5v-6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v6H17"/><rect x="7" y="14" width="10" height="7"/>',
  festa: '<path d="M4 20l4.5-12L16 15.5z"/><path d="M14 4v2M18.5 5.5 17 7M20 10h-2M12.5 8.5c1-1.5 1.5-3 1-4.5"/>',
  persona: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
  persone: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M15.5 5.5a3 3 0 0 1 0 5.5M17.5 14.6c1.6.6 2.7 2.2 3 4.9"/>',
  goccia: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  edificio: '<path d="M3 21h18M4.5 10h15M12 3l8 5H4zM6.5 10v8M10 10v8M14 10v8M17.5 10v8"/>',
  avanti: '<path d="M5 5l7 7-7 7M13 5l7 7-7 7"/>',
  fulmine: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
  torcia: '<path d="M8 3h8l-1 6H9zM9 9h6v10a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM12 13v2"/>',
  indietro: '<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  salute: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  contrasto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
  libro: '<path d="M4 4.5h6a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H4zM20 4.5h-6a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H20z"/>',
  fumetto: '<path d="M4 5h16v11H9l-5 4z"/>',
  mano: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7c-2.5 0-4-1.2-5.5-3.5L3 15a1.5 1.5 0 0 1 2.5-1.5L8 16"/>',
  tocco: '<path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V11l4.6.9a2 2 0 0 1 1.6 2.3l-.9 4.8a2 2 0 0 1-2 1.6H11a2 2 0 0 1-1.6-.8L6 15.5a1.5 1.5 0 0 1 2.3-1.9L9 14.5"/>',
  insetto: '<rect x="7.5" y="7" width="9" height="13" rx="4.5"/><path d="M12 7v13M9 4.5l1.5 2.5M15 4.5 13.5 7M4 12h3.5M16.5 12H20M4.5 7.5 7.8 9.3M19.5 7.5l-3.3 1.8M4.5 17.5l3.3-1.8M19.5 17.5l-3.3-1.8"/>',
  lampadina: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  domanda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.6v.4"/>',
  busta: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  casa: '<path d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5"/>',
  pausa: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  chiave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5 16 10"/>',
  lucchetto: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  cappello: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3v-4.5M21.5 9.5v5"/>',
  razzo: '<path d="M12 15c-1.5-1.5-2.5-3.5-2-6.5C10.5 6 13 3.5 19.5 3c-.5 6.5-3 9-5.5 9.5M9 12l-4 1 3-4M12 15l-1 4 4-3M7 17c-1.5.5-2.5 2-2.5 3.5C6 20.5 7.5 19.5 8 18"/>',
  cartella: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  distintivo: '<path d="M12 3l2.4 2 3.1-.3.6 3 2.6 1.8-1.4 2.8 1.4 2.8-2.6 1.8-.6 3-3.1-.3L12 21l-2.4-2-3.1.3-.6-3-2.6-1.8 1.4-2.8L3.3 9.5 5.9 7.7l.6-3 3.1.3z"/><circle cx="12" cy="12" r="3"/>',
  globo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z"/>',
  medaglia: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11 6 3h4l2 5 2-5h4l-2.5 8"/>',
  calcolatrice: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 12h.5M12 12h.5M15.5 12h.5M8.5 16h.5M12 16h.5M15.5 16h.5"/>',
  mappa: '<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  regalo: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8c-1-3-5-4-5-1.5S12 8 12 8zM12 8c1-3 5-4 5-1.5S12 8 12 8z"/>',
  pezzo: '<path d="M10 4.5a2 2 0 0 1 4 0V6h4v4h-1.5a2 2 0 0 0 0 4H18v4h-4v-1.5a2 2 0 0 0-4 0V18H6v-4h1.5a2 2 0 0 0 0-4H6V6h4z"/>',
  stella: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  occhio: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  condividi: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>',
  avviso: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.3"/>'
};
// Emoji → icona (senza il "selettore di variante" ️)
const EMOJI_LINEA = {
  '📅': 'calendario', '📆': 'calendario', '🗓': 'calendario', '🔄': 'giro', '🔁': 'giro', '♻': 'giro', '🔃': 'giro',
  '⏱': 'orologio', '🕐': 'orologio', '🕒': 'orologio', '🕰': 'orologio', '⌚': 'orologio', '⏰': 'sveglia', '⏳': 'clessidra', '⌛': 'clessidra',
  '🗑': 'cestino', '⚙': 'ingranaggio', '🔧': 'ingranaggio', '📌': 'puntina', '📍': 'puntina', '🌙': 'luna', '☀': 'sole', '🌤': 'sole', '🌅': 'tramonto', '🌇': 'tramonto',
  '📈': 'grafico', '📊': 'barre', '💤': 'riposo', '🌴': 'vacanza', '🏖': 'vacanza', '🎨': 'tavolozza', '📋': 'lista', '🗂': 'cartella', '📁': 'cartella',
  '🍽': 'posate', '🍴': 'posate', '🛡': 'scudo', '💰': 'euro', '💶': 'euro', '💸': 'euro', '✏': 'matita', '📝': 'matita', '🖌': 'pennello', '🖊': 'matita',
  '🚓': 'auto', '🚗': 'auto', '🚔': 'auto', '🧾': 'ricevuta', '💾': 'salva', '📥': 'scarica', '📤': 'carica', '🪪': 'tessera', '🔔': 'campana', '☁': 'nuvola',
  '🔋': 'batteria', '📱': 'telefono', '📲': 'telefono', '📞': 'cornetta', '🖨': 'stampante', '🎉': 'festa', '🎊': 'festa', '👶': 'persona', '🧸': 'persona',
  '♿': 'persona', '👮': 'distintivo', '👨': 'persona', '👩': 'persona', '👧': 'persona', '🤝': 'persone', '👥': 'persone', '🩸': 'goccia', '🏛': 'edificio',
  '⏭': 'avanti', '⚡': 'fulmine', '🔦': 'torcia', '↩': 'indietro', '🩺': 'salute', '🌓': 'contrasto', '📖': 'libro', '📚': 'libro', '💬': 'fumetto',
  '👋': 'mano', '👆': 'tocco', '🐞': 'insetto', '💡': 'lampadina', '❓': 'domanda', '✉': 'busta', '📧': 'busta', '🏠': 'casa', '⏸': 'pausa', '🔑': 'chiave',
  '🔒': 'lucchetto', '🎓': 'cappello', '🚀': 'razzo', '🌐': 'globo', '🎖': 'medaglia', '🏅': 'medaglia', '🧮': 'calcolatrice', '🗺': 'mappa', '🎁': 'regalo',
  '🧩': 'pezzo', '⭐': 'stella', '👁': 'occhio', '🔗': 'condividi', '⚠': 'avviso'
};
function svgLinea(nome, classe){
  const d = DISEGNI_LINEA[nome];
  return d ? `<svg class="icona-linea${classe ? ' ' + classe : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icona="${nome}">${d}</svg>` : '';
}
const RE_EMOJI_SOLA = /^\s*((?:\p{Extended_Pictographic}|[↩⌚⌛⏭⏸])️?(?:‍\p{Extended_Pictographic}️?)*)\s*$/u;
const RE_EMOJI_INIZIO = /^\s*((?:\p{Extended_Pictographic}|[↩⌚⌛⏭⏸])️?)\s+(\S[\s\S]*)$/u;
const TAG_ESCLUSI = new Set(['OPTION', 'SELECT', 'TEXTAREA', 'INPUT', 'SCRIPT', 'STYLE', 'TITLE', 'svg', 'SVG', 'CANVAS']);
// Dove le emoji restano (frasi, messaggi, testo libero dell'utente)
const ZONE_ESCLUSE = '.toast, .nota-servizio-dett, .vs-ev, .agenda-evento, .voce-frase, .voce-live, [contenteditable], .no-icone-linea';
function nomeIconaDa(emoji){ return EMOJI_LINEA[emoji.replace(/️/g, '')] || null; }
function convertiElementoIcona(elem){
  if(!elem || elem.nodeType !== 1 || TAG_ESCLUSI.has(elem.tagName)) return;
  if(elem.childElementCount){
    // "🍽️ Buoni pasto <small>…</small>": l'emoji all'inizio del primo pezzo di testo
    const primo = elem.firstChild;
    if(primo && primo.nodeType === 3 && !elem.closest(ZONE_ESCLUSE)){
      const m = primo.nodeValue.match(RE_EMOJI_INIZIO) || primo.nodeValue.match(/^\s*((?:\p{Extended_Pictographic})\uFE0F?)\s*$/u);
      const nome = m && nomeIconaDa(m[1]);
      if(nome){
        const t = document.createElement('template');
        t.innerHTML = svgLinea(nome, m[2] ? 'icona-linea-testo' : '');
        elem.insertBefore(t.content.firstChild, primo);
        if(m[2]) primo.nodeValue = m[2]; else primo.remove();
      }
    }
    return;
  }
  const testo = elem.textContent;
  if(!testo || testo.length > 160) return;
  if(elem.closest(ZONE_ESCLUSE)) return;
  let m = testo.match(RE_EMOJI_SOLA);
  if(m){
    const nome = nomeIconaDa(m[1]);
    if(nome){ elem.innerHTML = svgLinea(nome); elem.classList.add('con-icona-linea'); }
    return;
  }
  m = testo.match(RE_EMOJI_INIZIO);
  if(m){
    const nome = nomeIconaDa(m[1]);
    if(nome){ elem.innerHTML = svgLinea(nome, 'icona-linea-testo') + escapeHtml(m[2]); }
  }
}
function convertiIconeLinea(radice){
  const r = radice || document.body;
  if(!r || !r.querySelectorAll) return;
  convertiElementoIcona(r);
  r.querySelectorAll('*').forEach(convertiElementoIcona);
}
let attesaIconeLinea = null, radiciIconeLinea = new Set();
function avviaIconeLinea(){
  convertiIconeLinea(document.body);
  const oss = new MutationObserver(lista => {
    lista.forEach(x => { const n = x.type === 'characterData' ? x.target.parentElement : x.target; if(n) radiciIconeLinea.add(n); });
    if(attesaIconeLinea) return;
    attesaIconeLinea = requestAnimationFrame(() => {
      attesaIconeLinea = null;
      const radici = [...radiciIconeLinea]; radiciIconeLinea = new Set();
      radici.forEach(n => { if(n.isConnected) convertiIconeLinea(n); });
    });
  });
  oss.observe(document.body, { childList: true, subtree: true, characterData: true });
}
