// ── v3.8.17: Utilità (Altro → Utilità) ──
// Scadenze personali, Note di servizio, Cambi con i colleghi, Gestione veicolo.
// Tutto resta sul telefono (e nel backup). Niente fotocamera: i km si scrivono o si dettano.

const CHIAVE_UTILITA = 'simCedolino_utilita_v1';
const CARBURANTE = ['Riserva', '¼', '½', '¾', 'Pieno'];
const TIPI_SCADENZA = [
  { id: 'visita', nome: 'Visita medica', icona: 'salute', ripeti: '2' },
  { id: 'tiro', nome: 'Tiro', icona: 'medaglia', ripeti: '1' },
  { id: 'tesserino', nome: 'Tesserino', icona: 'tessera', ripeti: '' },
  { id: 'patente', nome: 'Patente di servizio', icona: 'auto', ripeti: '' },
  { id: 'corso', nome: 'Corso', icona: 'cappello', ripeti: '1' },
  { id: 'altro', nome: 'Altro', icona: 'calendario', ripeti: '' }
];
let U = { scadenze: [], note: [], scambi: [], mezzi: [], uscite: [], link: [] };
let utStato = { pagina: null, cerca: '', meseVeicolo: null, editor: null };

function caricaUtilita(){
  try{ const v = JSON.parse(TurniPSStorage.getItem(CHIAVE_UTILITA) || 'null'); if(v && typeof v === 'object') U = Object.assign({ scadenze: [], note: [], scambi: [], mezzi: [], uscite: [], link: [] }, v); }catch(e){}
}
function salvaUtilita(){ try{ TurniPSStorage.setItem(CHIAVE_UTILITA, JSON.stringify(U)); }catch(e){} aggiornaRigheUtilita(); aggiornaBannerScadenze(); try{ renderUtilitaRiquadroGiorno(); if(typeof applicaVistaCalendario === 'function' && typeof vistaCalendario === 'function' && vistaCalendario() !== 'mese'){ if(vistaCalendario() === 'agenda') renderAgenda(); else applicaVistaCalendario(); } }catch(e){} }
function datiUtilitaPerBackup(){ return JSON.parse(JSON.stringify(U)); }
function ripristinaUtilitaDaBackup(d){
  if(!d || typeof d !== 'object') return;
  (U.scadenze || []).forEach(s => annullaAvvisiScadenza(s));
  U = Object.assign({ scadenze: [], note: [], scambi: [], mezzi: [], uscite: [], link: [] }, d);
  salvaUtilita();
  U.scadenze.forEach(s => programmaAvvisiScadenza(s, true));
}
const idUt = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ic = (n, c) => typeof svgLinea === 'function' ? svgLinea(n, c || '') : '';
const oggiUt = () => dataISO(new Date());
function dataBreveUt(iso){ const d = dataDaIso(iso); return `${GIORNI_SETTIMANA_BREVI[d.getDay()]} ${d.getDate()} ${NOMI_MESI[d.getMonth()].slice(0, 3).toLowerCase()}`; }
function dataLungaUt(iso){ const d = dataDaIso(iso); return `${d.getDate()} ${NOMI_MESI[d.getMonth()].toLowerCase()} ${d.getFullYear()}`; }
function giorniDa(iso){ return Math.round((dataDaIso(iso) - dataDaIso(oggiUt())) / 86400000); }
function nomeTurnoDelGiorno(iso){ const t = AppState.turni[iso]; return t ? (nomeGiornoVista(t) || 'Turno') : ''; }

// ── Pagine (a tutto schermo) ──
function paginaUt(livello){
  const id = livello === 2 ? 'editorUt' : 'paginaUt';
  let p = el(id);
  if(!p){
    p = document.createElement('div'); p.id = id; p.className = 'ut-pagina' + (livello === 2 ? ' ut-editor' : '');
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
    document.body.appendChild(p);
    p.addEventListener('click', clicUt); p.addEventListener('input', inputUt); p.addEventListener('change', inputUt);
    p.addEventListener('submit', e => { if(e.target.id === 'utFormLeggi'){ e.preventDefault(); cercaNelleLeggi(1, true); } });
  }
  return p;
}
function testaUt(titolo, sotto, azione){
  return `<div class="ut-testa"><button type="button" class="ut-x" data-ut="chiudi" aria-label="Chiudi">✕</button><b>${titolo}${sotto ? `<small>${sotto}</small>` : ''}</b>${azione || ''}</div>`;
}
function apriUtilita(pagina){
  utStato.pagina = pagina; utStato.cerca = ''; utStato.leggi = null;
  if(pagina === 'veicolo' && !utStato.meseVeicolo) utStato.meseVeicolo = oggiUt().slice(0, 7);
  renderPaginaUt();
}
function chiudiPaginaUt(livello, _forzato){
  const p = el(livello === 2 ? 'editorUt' : 'paginaUt');
  if(p){ p.hidden = true; p.innerHTML = ''; }
  if(livello === 2) utStato.editor = null; else utStato.pagina = null;
}
function renderPaginaUt(){
  if(!utStato.pagina) return;
  const p = paginaUt(1); p.hidden = false;
  const f = { scadenze: htmlScadenze, note: htmlNote, scambi: htmlScambi, veicolo: htmlVeicolo, link: htmlLink }[utStato.pagina];
  const cercaFocus = document.activeElement && document.activeElement.id === 'utCercaNote';
  p.innerHTML = f ? f() : '';
  if(cercaFocus){ const c = el('utCercaNote'); if(c){ c.focus(); c.setSelectionRange(c.value.length, c.value.length); } }
}

// ── Scadenze ──
function quantoManca(iso){
  const g = giorniDa(iso);
  if(g < 0) return { testo: g === -1 ? 'ieri' : `${-g} giorni fa`, classe: 'ut-rosso' };
  if(g === 0) return { testo: 'oggi', classe: 'ut-rosso' };
  if(g === 1) return { testo: 'domani', classe: 'ut-arancio' };
  if(g <= 30) return { testo: `tra ${g} giorni`, classe: 'ut-arancio' };
  if(g <= 90) return { testo: `tra ${g} giorni`, classe: 'ut-verde' };
  const mesi = Math.round(g / 30.4);
  if(mesi < 24) return { testo: `tra ${mesi} mesi`, classe: 'ut-grigio' };
  return { testo: `tra ${Math.round(g / 365)} anni`, classe: 'ut-grigio' };
}
function testoRipeti(r){ return r === '1' ? 'ogni anno' : r ? `ogni ${r} anni` : ''; }
function iconaScadenza(s){ return (TIPI_SCADENZA.find(t => t.id === s.tipo) || TIPI_SCADENZA[5]).icona; }
function rigaScadenza(s){
  const q = quantoManca(s.data);
  return `<button type="button" class="ut-riga" data-ut="apri-scadenza" data-id="${s.id}"><span class="ut-ic">${ic(iconaScadenza(s))}</span>`
    + `<span class="ut-t"><b>${escapeHtml(s.nome)}</b><small>${dataLungaUt(s.data)}${s.ripeti ? ' · ' + testoRipeti(s.ripeti) : ''}</small></span><span class="ut-cd ${q.classe}">${q.testo}</span></button>`;
}
function htmlScadenze(){
  const ord = [...U.scadenze].sort((a, b) => a.data.localeCompare(b.data));
  const prossime = ord.filter(s => giorniDa(s.data) >= 0), scadute = ord.filter(s => giorniDa(s.data) < 0).reverse();
  return testaUt('Scadenze', 'Ti avviso in tempo', `<button type="button" class="ut-pri" data-ut="nuova-scadenza">＋ Nuova</button>`)
    + `<div class="ut-corpo">`
    + (!ord.length ? `<p class="ut-vuoto">Nessuna scadenza. Aggiungi la visita medica, il tiro, il tesserino…</p>` : '')
    + (prossime.length ? `<p class="ut-tit">Prossime</p><div class="ut-lista">${prossime.map(rigaScadenza).join('')}</div>` : '')
    + (scadute.length ? `<p class="ut-tit">Scadute</p><div class="ut-lista">${scadute.map(rigaScadenza).join('')}</div>` : '')
    + `<p class="ut-nota">Gli avvisi arrivano come i promemoria degli eventi, alle 9:00 del giorno scelto.</p></div>`;
}
function apriEditorScadenza(id){
  const s = id ? U.scadenze.find(x => x.id === id) : { id: null, tipo: 'visita', nome: 'Visita medica periodica', data: giornoPiu(oggiUt(), 30), ripeti: '2', avvisi: [30, 7, 0], note: '' };
  if(!s) return;
  utStato.editor = { tipo: 'scadenza', bozza: JSON.parse(JSON.stringify(s)), originale: JSON.stringify(s) };
  renderEditorScadenza();
}
function renderEditorScadenza(){
  const s = utStato.editor.bozza, p = paginaUt(2); p.hidden = false;
  const avv = [[30, '1 mese prima'], [7, '1 settimana prima'], [1, 'il giorno prima'], [0, 'il giorno stesso']];
  p.innerHTML = testaUt(s.id ? 'Scadenza' : 'Nuova scadenza', '', `<button type="button" class="ut-pri" data-ut="salva-scadenza">Salva</button>`)
    + `<div class="ut-corpo"><div class="ut-chips">${TIPI_SCADENZA.map(t => `<button type="button" class="ut-chip${s.tipo === t.id ? ' on' : ''}" data-ut="tipo-scadenza" data-id="${t.id}">${t.nome}</button>`).join('')}</div>`
    + `<div class="ut-box"><label class="ut-campo">Nome<input data-campo="nome" value="${escapeHtml(s.nome)}" maxlength="60"></label>`
    + `<label class="ut-campo">Scade il<input type="date" data-campo="data" value="${s.data}"></label>`
    + `<label class="ut-campo">Si ripete<select data-campo="ripeti">${[['', 'No'], ['1', 'Ogni anno'], ['2', 'Ogni 2 anni'], ['3', 'Ogni 3 anni'], ['5', 'Ogni 5 anni'], ['10', 'Ogni 10 anni']].map(([v, t]) => `<option value="${v}"${s.ripeti === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>`
    + `<p class="ut-tit">Avvisami</p><div class="ut-chips">${avv.map(([g, t]) => `<button type="button" class="ut-chip${s.avvisi.includes(g) ? ' on' : ''}" data-ut="avviso-scadenza" data-id="${g}">${t}</button>`).join('')}</div>`
    + `<div class="ut-box"><label class="ut-campo ut-campo-col">Note<textarea data-campo="note" rows="2" placeholder="facoltative">${escapeHtml(s.note || '')}</textarea></label></div>`
    + (s.id && s.ripeti ? `<button type="button" class="ut-sec ut-largo" data-ut="rinnova-scadenza">${ic('giro')} Fatta: sposta alla prossima (${testoRipeti(s.ripeti)})</button>` : '')
    + (s.id ? `<button type="button" class="ut-elimina" data-ut="elimina-scadenza">${ic('cestino')} Elimina scadenza</button>` : '') + `</div>`;
}
function eventoDaScadenza(s){
  return { id: 'scadenza_' + s.id, titolo: `Scadenza: ${s.nome}`, tuttoIlGiorno: true, oraPromemoria: '09:00', luogo: '', ripeti: '',
    promemoria: (s.avvisi || []).map(g => ({ min: g * 1440 })), ricordami: true, avvisoSecondi: 0 };
}
function programmaAvvisiScadenza(s, silenzioso){
  if(typeof schedulaPromemoriaEvento !== 'function' || !(s.avvisi || []).length) return;
  try{ schedulaPromemoriaEvento(s.data, eventoDaScadenza(s), silenzioso ? { silenzioso: true, soloAggiungi: true } : {}); }catch(e){}
}
function annullaAvvisiScadenza(s){ try{ if(typeof annullaPromemoriaEvento === 'function') annullaPromemoriaEvento('scadenza_' + s.id); }catch(e){} }
function aggiungiAnni(iso, n){ const d = dataDaIso(iso); return dataISO(new Date(d.getFullYear() + n, d.getMonth(), d.getDate(), 12)); }
function aggiornaBannerScadenze(){
  const sez = document.querySelector('.scheda-calendario-v2');
  if(!sez) return;
  let b = el('bannerScadenze');
  // Prima la prossima entro 30 giorni; se non c'è, una appena scaduta (per una settimana).
  const ord = [...U.scadenze].sort((a, b) => a.data.localeCompare(b.data));
  const vicina = ord.find(s => giorniDa(s.data) >= 0 && giorniDa(s.data) <= 30) || ord.reverse().find(s => giorniDa(s.data) < 0 && giorniDa(s.data) >= -7);
  if(!vicina){ if(b) b.remove(); return; }
  if(!b){ b = document.createElement('button'); b.type = 'button'; b.id = 'bannerScadenze'; b.className = 'ut-banner'; b.addEventListener('click', () => apriUtilita('scadenze')); sez.insertBefore(b, sez.firstChild); }
  const g = giorniDa(vicina.data);
  b.classList.toggle('ut-banner-rosso', g <= 0);
  b.innerHTML = `${ic('sveglia')}<span>${escapeHtml(vicina.nome)} ${g < 0 ? `<b>scaduta da ${-g} ${-g === 1 ? 'giorno' : 'giorni'}</b>` : g === 0 ? '<b>scade oggi</b>' : `tra <b>${g} ${g === 1 ? 'giorno' : 'giorni'}</b> (${dataBreveUt(vicina.data)})`}</span><i aria-hidden="true">›</i>`;
}

// ── Note di servizio ──
function htmlNote(){
  const q = (typeof normalizzaVoce === 'function' ? normalizzaVoce(utStato.cerca) : utStato.cerca.toLowerCase()).trim();
  const norm = t => typeof normalizzaVoce === 'function' ? normalizzaVoce(t) : String(t).toLowerCase();
  const note = U.note.filter(n => !q || q.split(' ').every(w => norm(`${n.titolo} ${n.testo}`).includes(w))).sort((a, b) => b.modificata - a.modificata);
  const card = n => `<button type="button" class="ut-card" data-ut="apri-nota" data-id="${n.id}"><b>${escapeHtml(n.titolo || 'Senza titolo')}</b>${n.testo ? `<p>${escapeHtml(n.testo)}</p>` : ''}`
    + `<span class="ut-meta">${n.fissata ? `<span class="ut-fissata">${ic('puntina')} Fissata</span>` : ''}${n.giorno ? `<span class="ut-giorno">${dataBreveUt(n.giorno)}${nomeTurnoDelGiorno(n.giorno) ? ' · ' + escapeHtml(nomeTurnoDelGiorno(n.giorno)) : ''}</span>` : ''}<span>${new Date(n.modificata).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span></span></button>`;
  const fissate = note.filter(n => n.fissata), altre = note.filter(n => !n.fissata);
  const gruppi = {};
  altre.forEach(n => { const d = new Date(n.modificata); const k = `${NOMI_MESI[d.getMonth()]} ${d.getFullYear()}`; (gruppi[k] = gruppi[k] || []).push(n); });
  return testaUt('Note di servizio', 'Appunti veloci, solo sul telefono', `<button type="button" class="ut-pri" data-ut="nuova-nota">＋ Nuova</button>`)
    + `<div class="ut-corpo"><label class="ut-cerca">${ic('cerca')}<input type="search" id="utCercaNote" placeholder="Cerca nelle note" value="${escapeHtml(utStato.cerca)}"></label>`
    + (!U.note.length ? `<p class="ut-vuoto">Nessuna nota. Tocca «＋ Nuova» per scrivere il primo appunto.</p>` : !note.length ? `<p class="ut-vuoto">Nessuna nota con «${escapeHtml(utStato.cerca)}».</p>` : '')
    + (fissate.length ? `<p class="ut-tit">Fissate</p>${fissate.map(card).join('')}` : '')
    + Object.keys(gruppi).map(k => `<p class="ut-tit">${k}</p>${gruppi[k].map(card).join('')}`).join('')
    + `<p class="ut-nota">${ic('lucchetto')} Le note restano solo sul telefono e nel tuo backup. Non inserire dati personali di cittadini.</p></div>`;
}
function apriEditorNota(id, giorno){
  const n = id ? U.note.find(x => x.id === id) : { id: null, titolo: '', testo: '', giorno: giorno || '', fissata: false };
  if(!n) return;
  utStato.editor = { tipo: 'nota', bozza: JSON.parse(JSON.stringify(n)), originale: JSON.stringify(n) };
  renderEditorNota();
}
function renderEditorNota(){
  const n = utStato.editor.bozza, p = paginaUt(2); p.hidden = false;
  p.innerHTML = testaUt('Nota', '', `<button type="button" class="ut-pri" data-ut="salva-nota">Salva</button>`)
    + `<div class="ut-corpo"><input class="ut-nota-tit" data-campo="titolo" placeholder="Titolo" value="${escapeHtml(n.titolo)}" maxlength="80">`
    + `<div class="ut-chips ut-barra"><label class="ut-chip${n.giorno ? ' on' : ''}">${ic('calendario')}<input type="date" data-campo="giorno" value="${n.giorno || ''}" aria-label="Giorno"></label>`
    + `<button type="button" class="ut-chip${n.fissata ? ' on' : ''}" data-ut="fissa-nota">${ic('puntina')} ${n.fissata ? 'Fissata' : 'Fissa in alto'}</button>`
    + `<button type="button" class="ut-chip" data-ut="detta" data-campo-detta="testo">${typeof ICONA_MICROFONO !== 'undefined' ? ICONA_MICROFONO : ''} Detta</button></div>`
    + `<textarea class="ut-nota-testo" data-campo="testo" placeholder="Scrivi qui…">${escapeHtml(n.testo)}</textarea>`
    + `<p class="ut-nota">${ic('lucchetto')} Solo sul telefono e nel tuo backup. Non inserire dati personali di cittadini.</p>`
    + (n.id ? `<button type="button" class="ut-elimina" data-ut="elimina-nota">${ic('cestino')} Elimina nota</button>` : '') + `</div>`;
}

// ── Cambi con i colleghi ──
function nomiColleghi(){ return [...new Set([...U.scambi.map(s => s.collega), ...U.uscite.map(u => u.collega)].filter(Boolean))].sort(); }
function saldoScambi(){ const aperti = U.scambi.filter(s => !s.restituito); return { devo: aperti.filter(s => s.verso === 'devo').length, mideve: aperti.filter(s => s.verso === 'mideve').length }; }
function htmlScambi(){
  const aperti = U.scambi.filter(s => !s.restituito).sort((a, b) => a.giorno.localeCompare(b.giorno));
  const chiusi = U.scambi.filter(s => s.restituito).sort((a, b) => b.restituito.localeCompare(a.restituito)).slice(0, 30);
  const sal = saldoScambi();
  const riga = s => `<div class="ut-riga"><span class="ut-ic">${ic('giro')}</span><span class="ut-t" data-ut="apri-scambio" data-id="${s.id}"><b>${s.verso === 'devo' ? `Devi un turno a ${escapeHtml(s.collega)}` : `${escapeHtml(s.collega)} ti deve un turno`}</b>`
    + `<small>${s.verso === 'devo' ? 'Ha fatto' : 'Hai fatto'} ${s.verso === 'devo' ? 'il tuo' : 'il suo'} ${escapeHtml(s.turno || 'turno')} di ${dataBreveUt(s.giorno)}</small></span>`
    + `<button type="button" class="ut-btn-r" data-ut="restituito" data-id="${s.id}">Restituito</button></div>`;
  const rigaChiusa = s => `<button type="button" class="ut-riga ut-chiusa" data-ut="apri-scambio" data-id="${s.id}"><span class="ut-ic">${ic('giro')}</span><span class="ut-t"><b>${escapeHtml(s.collega)} · pari</b><small>${escapeHtml(s.turno || 'Turno')} ${dataBreveUt(s.giorno)} ↔ ${dataBreveUt(s.restituito)}</small></span><span class="ut-cd ut-verde">✓</span></button>`;
  return testaUt('Cambi con i colleghi', 'Chi deve un turno a chi', `<button type="button" class="ut-pri" data-ut="nuovo-scambio">＋ Nuovo</button>`)
    + `<div class="ut-corpo"><div class="ut-saldo"><div class="ut-saldo-devo">Devi<b>${sal.devo}</b>${sal.devo === 1 ? 'turno' : 'turni'} da restituire</div><div class="ut-saldo-mideve">Ti devono<b>${sal.mideve}</b>${sal.mideve === 1 ? 'turno' : 'turni'}</div></div>`
    + (!U.scambi.length ? `<p class="ut-vuoto">Nessun cambio. Si segnano anche da Modifica il giorno → «Scambio con un collega».</p>` : '')
    + (aperti.length ? `<p class="ut-tit">Da sistemare</p><div class="ut-lista">${aperti.map(riga).join('')}</div>` : '')
    + (chiusi.length ? `<p class="ut-tit">Sistemati</p><div class="ut-lista">${chiusi.map(rigaChiusa).join('')}</div>` : '')
    + `<p class="ut-nota">È solo un promemoria tra colleghi: non cambia la paga (il «Cambio turno» pagato è tra le indennità).</p></div>`;
}
function apriEditorScambio(id, giorno){
  const s = id ? U.scambi.find(x => x.id === id) : { id: null, giorno: giorno || giornoSelezionato || oggiUt(), collega: '', verso: 'devo', turno: '', restituito: null };
  if(!s) return;
  utStato.editor = { tipo: 'scambio', bozza: JSON.parse(JSON.stringify(s)), originale: JSON.stringify(s) };
  renderEditorScambio();
}
function renderEditorScambio(){
  const s = utStato.editor.bozza, p = paginaUt(2); p.hidden = false;
  p.innerHTML = testaUt(s.id ? 'Cambio con un collega' : 'Nuovo cambio', '', `<button type="button" class="ut-pri" data-ut="salva-scambio">Salva</button>`)
    + `<div class="ut-corpo"><div class="ut-seg"><button type="button" class="${s.verso === 'devo' ? 'on' : ''}" data-ut="verso" data-id="devo">Mi ha sostituito</button><button type="button" class="${s.verso === 'mideve' ? 'on' : ''}" data-ut="verso" data-id="mideve">L'ho sostituito io</button></div>`
    + `<div class="ut-box"><label class="ut-campo">Collega<input data-campo="collega" list="utColleghi" value="${escapeHtml(s.collega)}" placeholder="es. Rossi" maxlength="40"></label>`
    + `<label class="ut-campo">Giorno<input type="date" data-campo="giorno" value="${s.giorno}"></label>`
    + `<label class="ut-campo">Restituito il<input type="date" data-campo="restituito" value="${s.restituito || ''}"></label></div>`
    + `<datalist id="utColleghi">${nomiColleghi().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>`
    + `<p class="ut-nota">${s.verso === 'devo' ? 'Il collega ha fatto il tuo turno: gli devi un turno.' : 'Hai fatto il turno del collega: ti deve un turno.'}</p>`
    + (s.id ? `<button type="button" class="ut-elimina" data-ut="elimina-scambio">${ic('cestino')} Elimina</button>` : '') + `</div>`;
}

// ── Gestione veicolo ──
function mezzoDi(id){ return U.mezzi.find(m => m.id === id) || null; }
function targaHtml(t){ return t ? `<span class="ut-targa"><i>I</i><span>${escapeHtml(t)}</span></span>` : ''; }
function kmPercorsi(u){ const a = Number(u.kmInizio), b = Number(u.kmFine); return a > 0 && b >= a ? b - a : null; }
function numeroIt0(n){ return Number(n).toLocaleString('it-IT'); }
function tacche(n){ return n === null || n === undefined || n === '' ? '' : `<span class="ut-tacche">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`; }
function htmlVeicolo(){
  const mese = utStato.meseVeicolo, [a, m] = mese.split('-').map(Number);
  const uscite = U.uscite.filter(u => u.giorno.slice(0, 7) === mese).sort((x, y) => y.giorno.localeCompare(x.giorno));
  const km = uscite.reduce((s, u) => s + (kmPercorsi(u) || 0), 0), litri = uscite.reduce((s, u) => s + (Number(u.litri) || 0), 0);
  const ultimiKm = id => { const u = [...U.uscite].filter(x => x.mezzoId === id && (x.kmFine || x.kmInizio)).sort((x, y) => y.giorno.localeCompare(x.giorno))[0]; return u ? `Ultimi km: ${numeroIt0(u.kmFine || u.kmInizio)} · ${dataBreveUt(u.giorno)}` : 'Nessuna uscita'; };
  return testaUt('Gestione veicolo', 'Mezzi, km, carburante e anomalie', `<button type="button" class="ut-pri" data-ut="nuova-uscita">＋ Uscita</button>`)
    + `<div class="ut-corpo"><p class="ut-tit ut-tit-azione">I tuoi mezzi <button type="button" data-ut="nuovo-mezzo">＋ Mezzo</button></p>`
    + (U.mezzi.length ? U.mezzi.map(mz => `<button type="button" class="ut-mezzo" data-ut="apri-mezzo" data-id="${mz.id}"><span class="ut-ic">${ic('auto')}</span><span class="ut-t"><b>${escapeHtml(mz.sigla || 'Mezzo')}</b>${targaHtml(mz.targa)}<small>${ultimiKm(mz.id)}</small></span><i aria-hidden="true">›</i></button>`).join('') : `<p class="ut-vuoto">Nessun mezzo. Si aggiunge anche dalla prima uscita.</p>`)
    + `<div class="ut-mese-nav"><button type="button" data-ut="mese-veicolo" data-id="-1" aria-label="Mese prima">‹</button><b>${NOMI_MESI[m - 1]} ${a}</b><button type="button" data-ut="mese-veicolo" data-id="1" aria-label="Mese dopo">›</button></div>`
    + `<div class="ut-mese"><div><b>${numeroIt0(km)}</b>km</div><div><b>${uscite.length}</b>${uscite.length === 1 ? 'uscita' : 'uscite'}</div><div><b>${litri ? numeroIt0(litri) + ' L' : '—'}</b>riforniti</div></div>`
    + (uscite.length ? uscite.map(u => { const mz = mezzoDi(u.mezzoId), d = dataDaIso(u.giorno), k = kmPercorsi(u);
        return `<button type="button" class="ut-uscita" data-ut="apri-uscita" data-id="${u.id}"><span class="d"><small>${GIORNI_SETTIMANA_BREVI[d.getDay()]}</small><b>${d.getDate()}</b></span>`
          + `<span class="c"><b>${escapeHtml(mz ? mz.sigla : 'Mezzo')}${nomeTurnoDelGiorno(u.giorno) ? ' · ' + escapeHtml(nomeTurnoDelGiorno(u.giorno)) : ''}</b><small>${[u.presa && u.riconsegna ? `${u.presa}–${u.riconsegna}` : '', u.carbInizio !== '' && u.carbInizio !== undefined && u.carbFine !== '' && u.carbFine !== undefined ? `${CARBURANTE[u.carbInizio]} → ${CARBURANTE[u.carbFine]}` : '', u.litri ? `rifornimento ${u.litri} L` : ''].filter(Boolean).join(' · ')} ${tacche(u.carbFine)}</small></span>`
          + `<span class="k">${k !== null ? numeroIt0(k) + ' km' : '—'}${u.anomalie ? '<small>1 anomalia</small>' : ''}</span></button>`; }).join('') : `<p class="ut-vuoto">Nessuna uscita in questo mese.</p>`)
    + `<p class="ut-nota">${ic('lucchetto')} Solo sul telefono e nel tuo backup. Niente dati di cittadini.</p></div>`;
}
function apriEditorUscita(id, giorno){
  let u = id ? U.uscite.find(x => x.id === id) : null;
  if(!u){
    const g = giorno || giornoSelezionato || oggiUt(), t = AppState.turni[g] || {};
    const ultima = [...U.uscite].sort((x, y) => y.giorno.localeCompare(x.giorno))[0];
    const mezzoId = ultima ? ultima.mezzoId : (U.mezzi[0] ? U.mezzi[0].id : '');
    const ultimaStesso = [...U.uscite].filter(x => x.mezzoId === mezzoId).sort((x, y) => y.giorno.localeCompare(x.giorno))[0];
    u = { id: null, giorno: g, mezzoId, presa: t.oraInizio || '', riconsegna: t.oraFine || '', kmInizio: ultimaStesso && ultimaStesso.kmFine ? ultimaStesso.kmFine : '', kmFine: '', carbInizio: '', carbFine: '', litri: '', collega: '', anomalie: '', appunti: '' };
  }
  utStato.editor = { tipo: 'uscita', bozza: JSON.parse(JSON.stringify(u)), originale: JSON.stringify(u), nuovoMezzo: !U.mezzi.length ? { sigla: '', targa: '' } : null };
  renderEditorUscita();
}
function campoKm(nome, valore){
  return `<div class="ut-km"><input data-campo="${nome}" inputmode="numeric" pattern="[0-9]*" value="${valore === '' || valore === undefined ? '' : valore}" placeholder="—"><button type="button" class="ut-mic" data-ut="detta" data-campo-detta="${nome}" data-numero="1" aria-label="Detta i km">${typeof ICONA_MICROFONO !== 'undefined' ? ICONA_MICROFONO : ''}</button></div>`;
}
function scelteCarburante(nome, v){ return `<div class="ut-fuel">${CARBURANTE.map((c, i) => `<button type="button" class="${v === i ? 'on' : ''}" data-ut="carburante" data-campo-carb="${nome}" data-id="${i}">${c}</button>`).join('')}</div>`; }
function renderEditorUscita(){
  const ed = utStato.editor, u = ed.bozza, p = paginaUt(2); p.hidden = false;
  const k = kmPercorsi(u);
  const scrollPrima = p.scrollTop;
  p.innerHTML = testaUt('Uscita del veicolo', `${dataBreveUt(u.giorno)}${nomeTurnoDelGiorno(u.giorno) ? ' · ' + escapeHtml(nomeTurnoDelGiorno(u.giorno)) : ''}`, `<button type="button" class="ut-pri" data-ut="salva-uscita">Salva</button>`)
    + `<div class="ut-corpo"><p class="ut-tit">Veicolo</p><div class="ut-box">`
    + `<div class="ut-chips">${U.mezzi.map(mz => `<button type="button" class="ut-chip${!ed.nuovoMezzo && u.mezzoId === mz.id ? ' on' : ''}" data-ut="scegli-mezzo" data-id="${mz.id}">${escapeHtml(mz.sigla)}</button>`).join('')}<button type="button" class="ut-chip${ed.nuovoMezzo ? ' on' : ''}" data-ut="mezzo-nuovo">＋ Nuovo mezzo</button></div>`
    + (ed.nuovoMezzo ? `<label class="ut-campo">Sigla<input data-campo-mezzo="sigla" value="${escapeHtml(ed.nuovoMezzo.sigla)}" placeholder="es. Volante 12" maxlength="30"></label><label class="ut-campo">Targa<input data-campo-mezzo="targa" value="${escapeHtml(ed.nuovoMezzo.targa)}" placeholder="es. POLIZIA M1234" maxlength="20" autocapitalize="characters"></label>`
      : (mezzoDi(u.mezzoId) ? `<div class="ut-campo">Targa ${targaHtml(mezzoDi(u.mezzoId).targa) || '<span class="ut-tenue">—</span>'}</div>` : ''))
    + `<label class="ut-campo">Giorno<input type="date" data-campo="giorno" value="${u.giorno}"></label>`
    + `<label class="ut-campo">Presa<input type="time" data-campo="presa" value="${u.presa || ''}"></label>`
    + `<label class="ut-campo">Riconsegna<input type="time" data-campo="riconsegna" value="${u.riconsegna || ''}"></label></div>`
    + `<p class="ut-tit">Chilometri</p><div class="ut-box"><div class="ut-campo">Km alla presa${campoKm('kmInizio', u.kmInizio)}</div><div class="ut-campo">Km alla riconsegna${campoKm('kmFine', u.kmFine)}</div>`
    + `<div class="ut-calc${k === null && u.kmInizio && u.kmFine ? ' ut-calc-errore' : ''}"><span>Km percorsi</span><b id="utKmPercorsi">${k !== null ? numeroIt0(k) + ' km' : u.kmInizio && u.kmFine ? 'controlla i km' : '—'}</b></div></div>`
    + `<p class="ut-tit">Carburante</p><div class="ut-box"><div class="ut-campo ut-campo-col">Alla presa${scelteCarburante('carbInizio', u.carbInizio)}</div><div class="ut-campo ut-campo-col">Alla riconsegna${scelteCarburante('carbFine', u.carbFine)}</div>`
    + `<label class="ut-campo">Rifornimento<span class="ut-km"><input data-campo="litri" inputmode="decimal" value="${u.litri || ''}" placeholder="litri"></span></label></div>`
    + `<p class="ut-tit">Pattuglia</p><div class="ut-box"><label class="ut-campo">Collega<input data-campo="collega" list="utColleghi" value="${escapeHtml(u.collega || '')}" placeholder="facoltativo" maxlength="40"></label></div>`
    + `<datalist id="utColleghi">${nomiColleghi().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>`
    + `<p class="ut-tit">Danni o anomalie</p><div class="ut-box"><div class="ut-campo ut-campo-col"><div class="ut-riga-mic"><input data-campo="anomalie" value="${escapeHtml(u.anomalie || '')}" placeholder="es. spia pressione gomme"><button type="button" class="ut-mic" data-ut="detta" data-campo-detta="anomalie" aria-label="Detta">${typeof ICONA_MICROFONO !== 'undefined' ? ICONA_MICROFONO : ''}</button></div></div></div>`
    + `<p class="ut-tit">Appunti</p><div class="ut-box"><div class="ut-campo ut-campo-col"><textarea data-campo="appunti" rows="3" placeholder="facoltativi">${escapeHtml(u.appunti || '')}</textarea><button type="button" class="ut-chip ut-chip-mic" data-ut="detta" data-campo-detta="appunti">${typeof ICONA_MICROFONO !== 'undefined' ? ICONA_MICROFONO : ''} Detta</button></div></div>`
    + `<p class="ut-nota">${ic('lucchetto')} Solo sul telefono e nel tuo backup. Non inserire dati personali di cittadini.</p>`
    + (u.id ? `<button type="button" class="ut-elimina" data-ut="elimina-uscita">${ic('cestino')} Elimina uscita</button>` : '') + `</div>`;
  p.scrollTop = scrollPrima;
}
function apriEditorMezzo(id){
  const m = id ? mezzoDi(id) : { id: null, sigla: '', targa: '' };
  if(!m) return;
  utStato.editor = { tipo: 'mezzo', bozza: JSON.parse(JSON.stringify(m)), originale: JSON.stringify(m) };
  const p = paginaUt(2); p.hidden = false;
  p.innerHTML = testaUt(m.id ? 'Mezzo' : 'Nuovo mezzo', '', `<button type="button" class="ut-pri" data-ut="salva-mezzo">Salva</button>`)
    + `<div class="ut-corpo"><div class="ut-box"><label class="ut-campo">Sigla<input data-campo="sigla" value="${escapeHtml(m.sigla)}" placeholder="es. Volante 12" maxlength="30"></label>`
    + `<label class="ut-campo">Targa<input data-campo="targa" value="${escapeHtml(m.targa)}" placeholder="es. POLIZIA M1234" maxlength="20" autocapitalize="characters"></label></div>`
    + (m.id ? `<button type="button" class="ut-elimina" data-ut="elimina-mezzo">${ic('cestino')} Elimina mezzo</button>` : '') + `</div>`;
}

// ── Dettatura in un campo (stessa voce di "Detta a voce": prima senza internet) ──
async function dettaInCampo(nome, soloNumero, bottone){
  const campo = el('editorUt') && el('editorUt').querySelector(`[data-campo="${nome}"]`);
  if(!campo) return;
  const metti = testo => {
    let t = String(testo || '').trim();
    if(soloNumero){
      const prep = typeof preparaFraseVoce === 'function' ? preparaFraseVoce(t) : t;
      const n = (prep.replace(/[.\s](?=\d{3}\b)/g, '').match(/\d+/g) || []).join('');
      if(!n){ mostraToast('Non ho capito il numero: riprova o scrivilo.', 'avviso'); return; }
      t = n;
    }
    campo.value = soloNumero || !campo.value ? t : `${campo.value.replace(/\s+$/, '')}\n${t}`;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  };
  if(bottone) bottone.classList.add('in-ascolto');
  try{
    const p = typeof pluginVoce === 'function' ? pluginVoce() : null;
    if(p){
      const perm = await p.permesso();
      if(!perm || !perm.concesso){ mostraToast('Per dettare serve il permesso del microfono.', 'avviso'); return; }
      mostraToast('Parla pure…', 'info', 2500);
      try{ const r = await p.ascolta({ offline: true, lingua: 'it-IT' }); metti(r && r.testo); }
      catch(err){
        const c = (err && (err.code || err.message)) || '';
        if(/offline/.test(c)) mostraToast("Per dettare senza internet scarica l'italiano: lo trovi in «Detta a voce».", 'avviso', 6000);
        else if(!/niente|annullato/.test(c)) mostraToast('Non ho sentito: riprova.', 'avviso');
      }
      return;
    }
    const R = typeof riconoscitoreWeb === 'function' ? riconoscitoreWeb() : null;
    if(!R){ mostraToast('Su questo dispositivo la dettatura non è disponibile.', 'avviso'); return; }
    await new Promise(fine => { const rec = new R(); rec.lang = 'it-IT'; rec.interimResults = false; rec.onresult = e => metti(e.results[0][0].transcript); rec.onend = fine; rec.onerror = fine; try{ rec.start(); mostraToast('Parla pure…', 'info', 2500); }catch(e){ fine(); } });
  } finally { if(bottone) bottone.classList.remove('in-ascolto'); }
}

// ── Clic e modifiche nelle pagine ──
function clicUt(e){
  const b = e.target.closest('[data-ut]');
  if(!b) return;
  if(clicLinkUt(b)) return;
  const a = b.dataset.ut, id = b.dataset.id, ed = utStato.editor;
  const livello = b.closest('#editorUt') ? 2 : 1;
  switch(a){
    case 'chiudi': if(livello === 2) chiudiEditorConControllo(); else { chiudiPaginaUt(1); aggiornaUtilitaGiorno(); } return;
    case 'nuova-scadenza': apriEditorScadenza(null); return;
    case 'apri-scadenza': apriEditorScadenza(id); return;
    case 'tipo-scadenza': { const t = TIPI_SCADENZA.find(x => x.id === id); const s = ed.bozza; const eraPredefinito = !s.nome || TIPI_SCADENZA.some(x => s.nome.startsWith(x.nome)); s.tipo = id; if(eraPredefinito) s.nome = id === 'visita' ? 'Visita medica periodica' : id === 'tiro' ? 'Tiro annuale' : id === 'tesserino' ? 'Rinnovo tesserino' : id === 'altro' ? '' : t.nome; s.ripeti = t.ripeti; renderEditorScadenza(); return; }
    case 'avviso-scadenza': { const g = Number(id), s = ed.bozza; s.avvisi = s.avvisi.includes(g) ? s.avvisi.filter(x => x !== g) : [...s.avvisi, g].sort((x, y) => y - x); renderEditorScadenza(); return; }
    case 'salva-scadenza': { const s = ed.bozza; if(!s.nome.trim()){ mostraToast('Dai un nome alla scadenza.', 'avviso'); return; } if(!/^\d{4}-\d{2}-\d{2}$/.test(s.data)){ mostraToast('Scegli la data.', 'avviso'); return; }
      const vecchia = s.id ? U.scadenze.find(x => x.id === s.id) : null; if(vecchia) annullaAvvisiScadenza(vecchia);
      if(!s.id){ s.id = idUt('sc'); U.scadenze.push(s); } else Object.assign(vecchia, s);
      salvaUtilita(); programmaAvvisiScadenza(s); chiudiPaginaUt(2); renderPaginaUt(); mostraToast('Scadenza salvata', 'successo'); return; }
    case 'rinnova-scadenza': { const s = U.scadenze.find(x => x.id === ed.bozza.id); if(!s) return; annullaAvvisiScadenza(s); let d = s.data; do{ d = aggiungiAnni(d, Number(s.ripeti)); }while(giorniDa(d) < 0); s.data = d; salvaUtilita(); programmaAvvisiScadenza(s); chiudiPaginaUt(2); renderPaginaUt(); mostraToast(`Prossima: ${dataLungaUt(d)}`, 'successo'); return; }
    case 'elimina-scadenza': mostraConferma('Eliminare questa scadenza e i suoi avvisi?', () => { const s = U.scadenze.find(x => x.id === ed.bozza.id); if(s) annullaAvvisiScadenza(s); U.scadenze = U.scadenze.filter(x => x.id !== ed.bozza.id); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); }); return;
    case 'nuova-nota': apriEditorNota(null); return;
    case 'apri-nota': apriEditorNota(id); return;
    case 'fissa-nota': ed.bozza.fissata = !ed.bozza.fissata; b.classList.toggle('on', ed.bozza.fissata); b.innerHTML = `${ic('puntina')} ${ed.bozza.fissata ? 'Fissata' : 'Fissa in alto'}`; return;
    case 'salva-nota': { const n = ed.bozza; if(!n.titolo.trim() && !n.testo.trim()){ chiudiPaginaUt(2); return; } n.modificata = Date.now(); if(!n.id){ n.id = idUt('nt'); U.note.push(n); } else Object.assign(U.note.find(x => x.id === n.id), n); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); aggiornaUtilitaGiorno(); mostraToast('Nota salvata', 'successo'); return; }
    case 'elimina-nota': mostraConferma('Eliminare questa nota?', () => { U.note = U.note.filter(x => x.id !== ed.bozza.id); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); aggiornaUtilitaGiorno(); }); return;
    case 'nuovo-scambio': apriEditorScambio(null); return;
    case 'apri-scambio': apriEditorScambio(id); return;
    case 'verso': ed.bozza.verso = id; renderEditorScambio(); return;
    case 'restituito': { const s = U.scambi.find(x => x.id === id); if(!s) return; s.restituito = oggiUt(); salvaUtilita(); renderPaginaUt(); aggiornaUtilitaGiorno(); renderCalendario(); mostraToast(`${s.collega}: pari. Puoi cambiare la data toccando la voce.`, 'successo', 5000); return; }
    case 'salva-scambio': { const s = ed.bozza; if(!s.collega.trim()){ mostraToast('Scrivi il nome del collega.', 'avviso'); return; } s.collega = s.collega.trim(); s.turno = nomeTurnoDelGiorno(s.giorno) || s.turno || 'turno'; if(!s.restituito) s.restituito = null; if(!s.id){ s.id = idUt('cb'); U.scambi.push(s); } else Object.assign(U.scambi.find(x => x.id === s.id), s); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); aggiornaUtilitaGiorno(); renderCalendario(); mostraToast('Cambio salvato', 'successo'); return; }
    case 'elimina-scambio': mostraConferma('Eliminare questo cambio?', () => { U.scambi = U.scambi.filter(x => x.id !== ed.bozza.id); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); aggiornaUtilitaGiorno(); renderCalendario(); }); return;
    case 'mese-veicolo': { const [y, m] = utStato.meseVeicolo.split('-').map(Number); const d = new Date(y, m - 1 + Number(id), 1, 12); utStato.meseVeicolo = dataISO(d).slice(0, 7); renderPaginaUt(); return; }
    case 'nuovo-mezzo': apriEditorMezzo(null); return;
    case 'apri-mezzo': apriEditorMezzo(id); return;
    case 'salva-mezzo': { const m = ed.bozza; if(!m.sigla.trim()){ mostraToast('Scrivi la sigla del mezzo.', 'avviso'); return; } m.sigla = m.sigla.trim(); m.targa = (m.targa || '').trim().toUpperCase(); if(!m.id){ m.id = idUt('mz'); U.mezzi.push(m); } else Object.assign(mezzoDi(m.id), m); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); return; }
    case 'elimina-mezzo': mostraConferma('Eliminare il mezzo? Le uscite già registrate restano.', () => { U.mezzi = U.mezzi.filter(x => x.id !== ed.bozza.id); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); }); return;
    case 'nuova-uscita': apriEditorUscita(null); return;
    case 'apri-uscita': apriEditorUscita(id); return;
    case 'scegli-mezzo': ed.nuovoMezzo = null; ed.bozza.mezzoId = id; if(!ed.bozza.id && !ed.bozza.kmInizio){ const ult = [...U.uscite].filter(x => x.mezzoId === id && x.kmFine).sort((x, y) => y.giorno.localeCompare(x.giorno))[0]; if(ult) ed.bozza.kmInizio = ult.kmFine; } renderEditorUscita(); return;
    case 'mezzo-nuovo': ed.nuovoMezzo = ed.nuovoMezzo || { sigla: '', targa: '' }; renderEditorUscita(); return;
    case 'carburante': { const v = Number(id), c = b.dataset.campoCarb; ed.bozza[c] = ed.bozza[c] === v ? '' : v; renderEditorUscita(); return; }
    case 'detta': dettaInCampo(b.dataset.campoDetta, !!b.dataset.numero, b); return;
    case 'salva-uscita': { const u = ed.bozza;
      if(ed.nuovoMezzo){ if(!ed.nuovoMezzo.sigla.trim()){ mostraToast('Scrivi la sigla del mezzo.', 'avviso'); return; } const mz = { id: idUt('mz'), sigla: ed.nuovoMezzo.sigla.trim(), targa: (ed.nuovoMezzo.targa || '').trim().toUpperCase() }; U.mezzi.push(mz); u.mezzoId = mz.id; }
      if(!u.mezzoId){ mostraToast('Scegli il mezzo.', 'avviso'); return; }
      if(u.kmInizio && u.kmFine && Number(u.kmFine) < Number(u.kmInizio)){ mostraToast('I km alla riconsegna sono meno di quelli alla presa: controllali.', 'avviso'); return; }
      if(!u.id){ u.id = idUt('us'); U.uscite.push(u); } else Object.assign(U.uscite.find(x => x.id === u.id), u);
      salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); aggiornaUtilitaGiorno(); mostraToast(kmPercorsi(u) !== null ? `Uscita salvata · ${numeroIt0(kmPercorsi(u))} km` : 'Uscita salvata', 'successo'); return; }
    case 'elimina-uscita': mostraConferma("Eliminare quest'uscita?", () => { U.uscite = U.uscite.filter(x => x.id !== ed.bozza.id); salvaUtilita(); chiudiPaginaUt(2); renderPaginaUt(); aggiornaUtilitaGiorno(); }); return;
  }
}
function inputUt(e){
  const t = e.target;
  if(t.id === 'utCercaNote'){ utStato.cerca = t.value; renderPaginaUt(); return; }
  const ed = utStato.editor; if(!ed) return;
  if(t.dataset.campoMezzo){ ed.nuovoMezzo[t.dataset.campoMezzo] = t.value; return; }
  const c = t.dataset.campo; if(!c) return;
  if(ed.tipo === 'uscita' && (c === 'kmInizio' || c === 'kmFine')){
    t.value = t.value.replace(/\D/g, '');
    ed.bozza[c] = t.value;
    const k = kmPercorsi(ed.bozza), out = el('utKmPercorsi');
    if(out) out.textContent = k !== null ? numeroIt0(k) + ' km' : ed.bozza.kmInizio && ed.bozza.kmFine ? 'controlla i km' : '—';
    return;
  }
  ed.bozza[c] = t.value;
  if(ed.tipo === 'uscita' && c === 'giorno' && e.type === 'change') renderEditorUscita();
  if(ed.tipo === 'nota' && c === 'giorno'){ const ch = t.closest('.ut-chip'); if(ch) ch.classList.toggle('on', !!t.value); }
}

// ── Altro → Utilità: le righe con il riassunto ──
function aggiornaRigheUtilita(){
  const s = el('sottoUtilScadenze'), n = el('sottoUtilNote'), c = el('sottoUtilScambi'), v = el('sottoUtilVeicolo');
  if(s){ const ord = [...U.scadenze].sort((a, b) => a.data.localeCompare(b.data));
    const vic = ord.find(x => giorniDa(x.data) >= 0) || null, scad = ord.filter(x => giorniDa(x.data) < 0).length;
    s.textContent = vic ? `${vic.nome} ${quantoManca(vic.data).testo}${scad ? ` · ${scad} scadut${scad === 1 ? 'a' : 'e'}` : ''}` : scad ? `${scad} scadut${scad === 1 ? 'a' : 'e'}` : 'Visita medica, tiro, tesserino…';
    s.classList.toggle('ut-sotto-arancio', (!!vic && giorniDa(vic.data) <= 30) || (!vic && scad > 0)); }
  if(n){ const ult = [...U.note].sort((a, b) => b.modificata - a.modificata)[0]; n.textContent = U.note.length ? `${U.note.length} ${U.note.length === 1 ? 'nota' : 'note'} · ultima ${new Date(ult.modificata).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : 'Appunti veloci'; }
  if(c){ const sal = saldoScambi(); c.textContent = sal.devo || sal.mideve ? `Devi ${sal.devo} ${sal.devo === 1 ? 'turno' : 'turni'} · te ne devono ${sal.mideve}` : 'Chi deve un turno a chi'; }
  if(v){ const mese = oggiUt().slice(0, 7), us = U.uscite.filter(u => u.giorno.slice(0, 7) === mese), km = us.reduce((a, u) => a + (kmPercorsi(u) || 0), 0); const ult = [...U.uscite].sort((x, y) => y.giorno.localeCompare(x.giorno))[0];
    v.textContent = us.length ? `${mezzoDi(ult.mezzoId) ? mezzoDi(ult.mezzoId).sigla + ' · ' : ''}${numeroIt0(km)} km a ${NOMI_MESI[new Date().getMonth()].toLowerCase()}` : U.mezzi.length ? `${U.mezzi.length} ${U.mezzi.length === 1 ? 'mezzo' : 'mezzi'}` : 'Km, carburante e anomalie'; }
}

// ── Nel giorno (Modifica il giorno): veicolo, scambio, note ──
function aggiornaUtilitaGiorno(){
  const box = el('utilitaGiorno'); if(!box) return;
  const iso = typeof giornoPerPopupV2 !== 'undefined' && giornoPerPopupV2 ? giornoPerPopupV2 : giornoSelezionato;
  if(!iso){ box.innerHTML = ''; return; }
  const usc = U.uscite.filter(u => u.giorno === iso);
  const sc = U.scambi.find(s => s.giorno === iso);
  const note = U.note.filter(n => n.giorno === iso);
  box.innerHTML = `<p class="titolo-sezione-giorno">Veicolo</p>`
    + (usc.length ? usc.map(u => { const mz = mezzoDi(u.mezzoId), k = kmPercorsi(u);
        return `<button type="button" class="riquadro-giorno ut-giorno-riga" data-ut-giorno="uscita" data-id="${u.id}"><span class="ut-ic">${ic('auto')}</span><span class="ut-t"><b>${escapeHtml(mz ? mz.sigla : 'Mezzo')}${mz && mz.targa ? ' · ' + escapeHtml(mz.targa) : ''}</b><small>${[k !== null ? numeroIt0(k) + ' km' : '', u.carbInizio !== '' && u.carbFine !== '' && u.carbInizio !== undefined ? `carburante ${CARBURANTE[u.carbInizio]} → ${CARBURANTE[u.carbFine]}` : '', u.anomalie ? '1 anomalia' : ''].filter(Boolean).join(' · ') || 'Tocca per completare'}</small></span><i aria-hidden="true">›</i></button>`; }).join('')
      : `<button type="button" class="ut-aggiungi-giorno" data-ut-giorno="nuova-uscita">＋ Registra l'uscita del veicolo</button>`)
    + `<p class="titolo-sezione-giorno">Scambio con un collega</p>`
    + (sc ? `<button type="button" class="riquadro-giorno ut-giorno-riga" data-ut-giorno="scambio" data-id="${sc.id}"><span class="ut-ic">${ic('giro')}</span><span class="ut-t"><b>${sc.verso === 'devo' ? `${escapeHtml(sc.collega)} ti ha sostituito` : `Hai sostituito ${escapeHtml(sc.collega)}`}</b><small>${sc.restituito ? `Pari: restituito ${dataBreveUt(sc.restituito)}` : sc.verso === 'devo' ? 'Gli devi un turno' : 'Ti deve un turno'}</small></span><i aria-hidden="true">›</i></button>`
      : `<button type="button" class="ut-aggiungi-giorno" data-ut-giorno="nuovo-scambio">＋ Segna uno scambio con un collega</button>`)
    + `<p class="titolo-sezione-giorno">Note di servizio</p>`
    + note.map(n => `<button type="button" class="riquadro-giorno ut-giorno-riga" data-ut-giorno="nota" data-id="${n.id}"><span class="ut-ic">${ic('lista')}</span><span class="ut-t"><b>${escapeHtml(n.titolo || 'Nota')}</b><small>${escapeHtml((n.testo || '').slice(0, 80))}</small></span><i aria-hidden="true">›</i></button>`).join('')
    + `<button type="button" class="ut-aggiungi-giorno" data-ut-giorno="nuova-nota">＋ Nota per questo giorno</button>`;
}
function clicUtilitaGiorno(e){
  const b = e.target.closest('[data-ut-giorno]'); if(!b) return;
  const iso = typeof giornoPerPopupV2 !== 'undefined' && giornoPerPopupV2 ? giornoPerPopupV2 : giornoSelezionato;
  const a = b.dataset.utGiorno, id = b.dataset.id;
  if(a === 'uscita') apriEditorUscita(id); else if(a === 'nuova-uscita') apriEditorUscita(null, iso);
  else if(a === 'scambio') apriEditorScambio(id); else if(a === 'nuovo-scambio') apriEditorScambio(null, iso);
  else if(a === 'nota') apriEditorNota(id); else if(a === 'nuova-nota') apriEditorNota(null, iso);
}
// Segno ⇄ sui giorni con uno scambio da sistemare
function segnaScambiNelCalendario(){
  document.querySelectorAll('.ut-segno-scambio').forEach(x => x.remove());
  U.scambi.filter(s => !s.restituito).forEach(s => {
    const c = document.querySelector(`#calendarioGriglia .giorno-cella[data-data="${s.giorno}"]`);
    if(c) c.insertAdjacentHTML('beforeend', `<span class="ut-segno-scambio" title="Scambio con ${escapeHtml(s.collega)}">⇄</span>`);
  });
}

function inizializzaUtilita(){
  caricaUtilita();
  ['Scadenze', 'Note', 'Scambi', 'Veicolo', 'Link'].forEach(k => on('util' + k, 'click', () => apriUtilita({ Scadenze: 'scadenze', Note: 'note', Scambi: 'scambi', Veicolo: 'veicolo', Link: 'link' }[k])));
  inizializzaIndietro();
  aggiornaRigheUtilita();
  aggiornaBannerScadenze();
  // Nel giorno: la sezione sta in "Modifica il giorno", sotto "Altro per questo giorno"
  const corpo = document.querySelector('#pannelloTurno .altro-giorno-v2');
  if(corpo && !el('utilitaGiorno')){ const d = document.createElement('div'); d.id = 'utilitaGiorno'; d.className = 'utilita-giorno'; corpo.after(d); d.addEventListener('click', clicUtilitaGiorno); }
  if(typeof window.apriModaleTurno === 'function' && !window.apriModaleTurno.__ut){
    const orig = window.apriModaleTurno;
    window.apriModaleTurno = function(){ const r = orig.apply(this, arguments); try{ aggiornaUtilitaGiorno(); }catch(e){} return r; };
    window.apriModaleTurno.__ut = true;
  }
  if(typeof window.renderListaEventiGiornoV2 === 'function' && !window.renderListaEventiGiornoV2.__ut){
    const origE = window.renderListaEventiGiornoV2;
    window.renderListaEventiGiornoV2 = function(){ const r = origE.apply(this, arguments); try{ renderUtilitaRiquadroGiorno(); }catch(e){} return r; };
    window.renderListaEventiGiornoV2.__ut = true;
  }
  if(typeof window.renderCalendario === 'function' && !window.renderCalendario.__ut){
    const origR = window.renderCalendario;
    window.renderCalendario = function(){ const r = origR.apply(this, arguments); try{ segnaScambiNelCalendario(); aggiornaBannerScadenze(); }catch(e){} return r; };
    window.renderCalendario.__ut = true;
  }
  segnaScambiNelCalendario();
  // All'apertura gli avvisi delle scadenze future si rimettono in coda (in silenzio)
  setTimeout(() => U.scadenze.filter(s => giorniDa(s.data) >= 0).forEach(s => programmaAvvisiScadenza(s, true)), 4000);
}

// ── v3.8.18: le Utilità del giorno dove le guardi già (riquadro del giorno, Settimana, Agenda, Cerca) ──
function righeUtilitaGiorno(iso){
  if(!iso) return '';
  const out = [];
  U.uscite.filter(u => u.giorno === iso).forEach(u => {
    const mz = mezzoDi(u.mezzoId), k = kmPercorsi(u);
    out.push(`<span class="ut-mini" role="button" tabindex="0" data-ut-apri="uscita" data-id="${u.id}">${ic('auto')}<span>${escapeHtml(mz ? mz.sigla : 'Mezzo')}${k !== null ? ` · ${numeroIt0(k)} km` : ''}${u.anomalie ? ` · <em>${escapeHtml(u.anomalie)}</em>` : ''}</span></span>`);
  });
  U.note.filter(n => n.giorno === iso).forEach(n => out.push(`<span class="ut-mini" role="button" tabindex="0" data-ut-apri="nota" data-id="${n.id}">${ic('lista')}<span>${escapeHtml(n.titolo || (n.testo || 'Nota').slice(0, 40))}</span></span>`));
  U.scambi.filter(s => s.giorno === iso).forEach(s => out.push(`<span class="ut-mini" role="button" tabindex="0" data-ut-apri="scambio" data-id="${s.id}">${ic('giro')}<span>${s.verso === 'devo' ? `${escapeHtml(s.collega)} ti ha sostituito` : `Hai sostituito ${escapeHtml(s.collega)}`}${s.restituito ? ' · pari' : ''}</span></span>`));
  return out.length ? `<span class="ut-mini-lista">${out.join('')}</span>` : '';
}
function renderUtilitaRiquadroGiorno(){
  const lista = el('listaEventiGiornoV2'); if(!lista) return;
  let box = el('utilitaRiquadroGiorno');
  if(!box){ box = document.createElement('div'); box.id = 'utilitaRiquadroGiorno'; lista.after(box); }
  box.innerHTML = righeUtilitaGiorno(giornoSelezionato);
}
// Ricerca dell'Agenda: anche note di servizio e uscite del veicolo
function risultatiUtilitaPerCerca(va){
  const r = [];
  U.note.forEach(n => { if(va(`${n.titolo} ${n.testo}`)) r.push({ iso: n.giorno || dataISO(new Date(n.modificata)), html: `<button type="button" class="agenda-evento" data-ut-apri="nota" data-id="${n.id}">${ic('lista')}<em>Nota</em><span class="agenda-ev-testo"><b>${escapeHtml(n.titolo || 'Nota')}</b>${n.testo ? `<small>${escapeHtml(n.testo.slice(0, 70))}</small>` : ''}</span></button>` }); });
  U.uscite.forEach(u => { const mz = mezzoDi(u.mezzoId); if(va(`${mz ? mz.sigla + ' ' + mz.targa : ''} ${u.anomalie || ''} ${u.appunti || ''} ${u.collega || ''}`)) r.push({ iso: u.giorno, html: `<button type="button" class="agenda-evento" data-ut-apri="uscita" data-id="${u.id}">${ic('auto')}<em>${escapeHtml(mz ? mz.sigla : 'Mezzo')}</em><span class="agenda-ev-testo"><b>${kmPercorsi(u) !== null ? numeroIt0(kmPercorsi(u)) + ' km' : 'Uscita'}${u.anomalie ? ' · ' + escapeHtml(u.anomalie) : ''}</b>${u.appunti ? `<small>${escapeHtml(u.appunti.slice(0, 70))}</small>` : ''}</span></button>` }); });
  return r;
}
document.addEventListener('click', e => {
  const x = e.target.closest && e.target.closest('[data-ut-apri]');
  if(!x || x.closest('#paginaUt, #editorUt')) return;
  e.stopPropagation(); e.preventDefault();
  const id = x.dataset.id, t = x.dataset.utApri;
  if(t === 'uscita') apriEditorUscita(id); else if(t === 'nota') apriEditorNota(id); else if(t === 'scambio') apriEditorScambio(id);
}, true);

// ── v3.8.19: Link utili (Altro → Link utili): pagine ufficiali, con la fonte sotto ──
const GRUPPI_LINK = [
  { titolo: 'Controlli', link: [
    { titolo: 'Crimnet – banche dati', testo: 'Veicoli rubati (targa o telaio), documenti rubati o smarriti', fonte: 'Ministero dell\u2019Interno', url: 'https://crimnet.dcpc.interno.gov.it/crimnet/', icona: 'occhio' },
    { titolo: 'PRADO – documenti originali', testo: 'Modelli dei documenti d\'identità e di viaggio europei, per riconoscere i falsi', fonte: 'Consiglio dell\'Unione europea', url: 'https://www.consilium.europa.eu/prado/it/prado-start-page.html', icona: 'tessera' }
  ] },
  { titolo: 'Stipendio e contratto', link: [
    { titolo: 'Addizionali regionali e comunali IRPEF', testo: 'Aliquote di ogni Regione e di ogni Comune', fonte: 'MEF – Dipartimento delle Finanze', url: 'https://www.finanze.gov.it/it/fiscalita/fiscalita-regionale-e-locale/', icona: 'euro' },
    { titolo: 'Contratto di lavoro – SIULP', testo: 'Testi del contratto e della contrattazione', fonte: 'SIULP', url: 'https://siulp.it/category/contrattazione/contratto/', icona: 'lista' },
    { titolo: 'Contratto di lavoro – SAP', testo: 'I contratti', fonte: 'SAP – Sindacato Autonomo di Polizia', url: 'https://sap-nazionale.org/2023/i-contratti/', icona: 'lista' }
  ] },
  { titolo: 'Viaggi', link: [
    { titolo: 'Viaggiare Sicuri', testo: 'Avvisi e documenti richiesti per ogni Paese', fonte: 'Ministero degli Affari Esteri', url: 'https://www.viaggiaresicuri.it/', icona: 'mappa' }
  ] }
];
function urlSicuro(u){ const t = String(u || '').trim(); if(!t) return ''; const c = /^https?:\/\//i.test(t) ? t : 'https://' + t; try{ const x = new URL(c); return /^https?:$/.test(x.protocol) ? x.href : ''; }catch(e){ return ''; } }
function rigaLink(l, personale){
  return `<a class="ut-riga ut-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"><span class="ut-ic">${ic(l.icona || 'globo')}</span><span class="ut-t"><b>${escapeHtml(l.titolo)}</b>${l.testo ? `<small>${escapeHtml(l.testo)}</small>` : ''}<small class="ut-fonte">${personale ? escapeHtml(new URL(l.url).hostname) : 'Fonte: ' + escapeHtml(l.fonte)}</small></span>${personale ? `<button type="button" class="ut-link-mod" data-ut="apri-link" data-id="${l.id}" aria-label="Modifica">${ic('matita')}</button>` : `<i aria-hidden="true">↗</i>`}</a>`;
}
function htmlLink(){
  const miei = U.link || [];
  return testaUt('Link utili', 'Pagine ufficiali: si aprono nel browser', '')
    + `<div class="ut-corpo">`
    + GRUPPI_LINK.map((g, gi) => (gi === 1 ? htmlNormativa() : '') + `<p class="ut-tit">${g.titolo}</p>`
      + `<div class="ut-lista">${g.link.map(l => rigaLink(l)).join('')}</div>`).join('')
    + `<p class="ut-tit ut-tit-azione">I tuoi link <button type="button" data-ut="nuovo-link">＋ Link</button></p>`
    + (miei.length ? `<div class="ut-lista">${miei.map(l => rigaLink(l, true)).join('')}</div>` : `<p class="ut-vuoto">Aggiungi i siti che usi di più: il tuo sindacato, l'ufficio, la mensa…</p>`)
    + `<p class="ut-nota">Si aprono i siti ufficiali, con i loro dati aggiornati. I risultati di Crimnet non hanno valore legale e possono arrivare con qualche giorno di ritardo rispetto alla denuncia.</p></div>`;
}
function apriEditorLink(id){
  const l = id ? (U.link || []).find(x => x.id === id) : { id: null, titolo: '', url: '' };
  if(!l) return;
  utStato.editor = { tipo: 'link', bozza: JSON.parse(JSON.stringify(l)), originale: JSON.stringify(l) };
  const p = paginaUt(2); p.hidden = false;
  p.innerHTML = testaUt(l.id ? 'Link' : 'Nuovo link', '', `<button type="button" class="ut-pri" data-ut="salva-link">Salva</button>`)
    + `<div class="ut-corpo"><div class="ut-box"><label class="ut-campo">Nome<input data-campo="titolo" value="${escapeHtml(l.titolo)}" placeholder="es. Sindacato" maxlength="40"></label>`
    + `<label class="ut-campo">Indirizzo<input data-campo="url" value="${escapeHtml(l.url)}" placeholder="es. www.sito.it" inputmode="url" autocapitalize="off"></label></div>`
    + (l.id ? `<button type="button" class="ut-elimina" data-ut="elimina-link">${ic('cestino')} Elimina link</button>` : '') + `</div>`;
}
function clicLinkUt(b){
  const a = b.dataset.ut, ed = utStato.editor;
  if(a === 'nuovo-link'){ apriEditorLink(null); return true; }
  if(a === 'leggi-altri'){ cercaNelleLeggi((utStato.leggi.pagina || 1) + 1); return true; }
  if(a === 'leggi-ordine' || a === 'leggi-tipo'){ const st = statoLeggi(); if(a === 'leggi-ordine') st.ordine = b.dataset.v; else st.tipo = b.dataset.v; cercaNelleLeggi(1); return true; }
  if(a === 'leggi-chiudi'){ utStato.leggi = null; const i = el('utCercaLeggi'); if(i) i.value = ''; disegnaLeggi(); return true; }
  if(a === 'stella-norma'){ const id = b.dataset.id; const p = new Set(U.preferitiNorme || []); if(p.has(id)) p.delete(id); else p.add(id); U.preferitiNorme = [...p]; salvaUtilita(); const l = el('utListaNorme'); if(l) l.innerHTML = righeNorme(); return true; }
  if(a === 'apri-link'){ apriEditorLink(b.dataset.id); return true; }
  if(a === 'salva-link'){
    const l = ed.bozza, url = urlSicuro(l.url);
    if(!l.titolo.trim()){ mostraToast('Dai un nome al link.', 'avviso'); return true; }
    if(!url){ mostraToast('Indirizzo non valido.', 'avviso'); return true; }
    l.url = url; l.titolo = l.titolo.trim();
    U.link = U.link || [];
    if(!l.id){ l.id = idUt('lk'); U.link.push(l); } else Object.assign(U.link.find(x => x.id === l.id), l);
    salvaUtilita(); chiudiPaginaUt(2, true); renderPaginaUt(); return true;
  }
  if(a === 'elimina-link'){ mostraConferma('Eliminare questo link?', () => { U.link = (U.link || []).filter(x => x.id !== ed.bozza.id); salvaUtilita(); chiudiPaginaUt(2, true); renderPaginaUt(); }); return true; }
  return false;
}

// ── v3.8.19: chiudere un editor: le note si salvano da sole, il resto chiede se ci sono modifiche ──
function editorModificato(){
  const ed = utStato.editor; if(!ed) return false;
  if(ed.tipo === 'uscita' && ed.nuovoMezzo && (ed.nuovoMezzo.sigla || ed.nuovoMezzo.targa)) return true;
  return ed.originale !== undefined && ed.originale !== JSON.stringify(ed.bozza);
}
function chiudiEditorConControllo(){
  const ed = utStato.editor;
  if(!ed){ chiudiPaginaUt(2, true); return; }
  if(ed.tipo === 'nota'){
    const n = ed.bozza;
    if(editorModificato() && (n.titolo.trim() || n.testo.trim())){
      n.modificata = Date.now();
      if(!n.id){ n.id = idUt('nt'); U.note.push(n); } else Object.assign(U.note.find(x => x.id === n.id), n);
      salvaUtilita(); mostraToast('Nota salvata', 'successo');
    }
    chiudiPaginaUt(2, true); renderPaginaUt(); aggiornaUtilitaGiorno(); return;
  }
  if(editorModificato()){ mostraConferma('Hai fatto delle modifiche. Uscire senza salvare?', () => chiudiPaginaUt(2, true), 'Uscire senza salvare?'); return; }
  chiudiPaginaUt(2, true);
}

// ── v3.8.19: tasto «indietro» di Android: chiude quello che è aperto in cima, non l'app ──
let indietroPronto = false;
function chiudiInCima(){
  const vis = id => el(id) && !el(id).hidden;
  if(vis('overlayAvviso')){ const a = el('btnAnnullaAvviso'); if(a && !a.hidden) a.click(); else el('overlayAvviso').hidden = true; return true; }
  if(vis('editorUt')){ chiudiEditorConControllo(); return true; }
  if(vis('paginaUt')){ chiudiPaginaUt(1); aggiornaUtilitaGiorno(); return true; }
  if(vis('schedaVoce') && typeof chiudiVoce === 'function'){ chiudiVoce(); return true; }
  if(vis('guidaNovita') && typeof chiudiNovita === 'function'){ chiudiNovita(); return true; }
  if(vis('overlayEvento')){ el('overlayEvento').hidden = true; return true; }
  if(vis('pannelloColoriTurni')){ const c = el('btnChiudiColoriTurni'); if(c) c.click(); return true; }
  if(vis('overlaySelettoreModelli')){ el('overlaySelettoreModelli').hidden = true; return true; }
  const altri = [...document.querySelectorAll('.overlay')].filter(o => !o.hidden && o.id !== 'overlayBenvenuto');
  if(altri.length){ const o = altri[altri.length - 1]; const x = o.querySelector('.btn-icona, [id^="btnChiudi"]'); if(x) x.click(); else o.hidden = true; return true; }
  if(vis('pannelloTurno')){ const c = el('btnChiudiTurno'); if(c) c.click(); else el('pannelloTurno').hidden = true; return true; }
  if(vis('menuFabGiorno') && typeof chiudiFabGiorno === 'function'){ chiudiFabGiorno(); return true; }
  if(vis('barraPennello') && typeof chiudiPennello === 'function'){ chiudiPennello(); return true; }
  const schedaAperta = document.querySelector('.scheda-nav.attiva, .scheda-nav[aria-current="page"]');
  if(schedaAperta && schedaAperta.id !== 'tabCalendario' && typeof mostraScheda === 'function'){ mostraScheda('calendario'); window.scrollTo(0, 0); return true; }
  return false;
}
function inizializzaIndietro(){
  if(indietroPronto || !window.history || !history.pushState) return;
  indietroPronto = true;
  try{ history.replaceState({ turni: 'base' }, ''); history.pushState({ turni: 'app' }, ''); }catch(e){ return; }
  window.addEventListener('popstate', () => {
    if(chiudiInCima()){ try{ history.pushState({ turni: 'app' }, ''); }catch(e){} }
    else { mostraToast('Premi ancora «indietro» per uscire', 'info', 2000); } // niente di aperto: al prossimo «indietro» Android chiude l'app
  });
}

// ── v3.8.20: Normativa in Link utili: collegamenti diretti ai testi ufficiali, ricerca e preferiti ──
// Nessun testo copiato: ogni voce apre il testo (vigente su Normattiva, o il PDF indicato).
const NORME = [
  { id: 'cp', titolo: 'Codice penale', testo: 'R.D. 19 ottobre 1930, n. 1398 – testo vigente', fonte: 'Normattiva', url: 'https://www.normattiva.it/eli/id/1930/10/26/030U1398/CONSOLIDATED', parole: 'reati pene' },
  { id: 'cpp', titolo: 'Codice di procedura penale', testo: 'D.P.R. 22 settembre 1988, n. 447 – testo vigente', fonte: 'Normattiva', url: 'https://www.normattiva.it/eli/id/1988/10/24/088G0492/CONSOLIDATED', parole: 'arresto fermo perquisizione' },
  { id: 'tulps', titolo: 'TULPS', testo: 'Testo unico delle leggi di pubblica sicurezza – R.D. 18 giugno 1931, n. 773', fonte: 'Normattiva', url: 'https://www.normattiva.it/eli/id/1931/06/26/031U0773/CONSOLIDATED', parole: 'pubblica sicurezza licenze armi' },
  { id: 'regtulps', titolo: 'Regolamento del TULPS', testo: 'R.D. 6 maggio 1940, n. 635 – testo vigente', fonte: 'Normattiva', url: 'https://www.normattiva.it/eli/id/1940/06/26/040U0635/CONSOLIDATED', parole: 'regolamento esecuzione pubblica sicurezza' },
  { id: 'cds', titolo: 'Codice della strada', testo: 'D.Lgs. 30 aprile 1992, n. 285 – testo vigente', fonte: 'Normattiva', url: 'https://www.normattiva.it/eli/id/1992/05/18/092G0306/CONSOLIDATED', parole: 'circolazione sanzioni veicoli patente' },
  { id: 'l121', titolo: 'Legge 121/1981', testo: 'Nuovo ordinamento dell\u2019Amministrazione della pubblica sicurezza – testo vigente', fonte: 'Normattiva', url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1981-04-01;121', parole: 'ordinamento polizia di stato riforma' },
  { id: 'dpr782', titolo: 'Regolamento di servizio – D.P.R. 782/1985', testo: 'Regolamento di servizio dell\u2019Amministrazione della pubblica sicurezza – testo vigente', fonte: 'Normattiva', url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1985;782', parole: 'regolamento servizio doveri' },
  { id: 'normattiva', titolo: 'Normattiva – tutte le leggi', testo: 'Cerca qualsiasi legge in vigore', fonte: 'Istituto Poligrafico e Zecca dello Stato', url: 'https://www.normattiva.it/', parole: 'leggi decreti' }
];
function righeNorme(){
  const pref = new Set(U.preferitiNorme || []);
  const lista = NORME.slice().sort((a, b) => (pref.has(b.id) ? 1 : 0) - (pref.has(a.id) ? 1 : 0));
  return lista.map(n => `<div class="ut-riga ut-norma${pref.has(n.id) ? ' preferita' : ''}"><a class="ut-norma-link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer"><span class="ut-ic">${ic('libro')}</span><span class="ut-t"><b>${escapeHtml(n.titolo)}</b><small>${escapeHtml(n.testo)}</small><small class="ut-fonte">Fonte: ${escapeHtml(n.fonte)}</small></span></a>`
    + `<button type="button" class="ut-stella" data-ut="stella-norma" data-id="${n.id}" aria-pressed="${pref.has(n.id)}" aria-label="${pref.has(n.id) ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${pref.has(n.id) ? '★' : '☆'}</button></div>`).join('');
}
function htmlNormativa(){
  return `<p class="ut-tit">Normativa</p><div class="ut-lista" id="utListaNorme">${righeNorme()}</div>${htmlCercaLeggi()}`;
}

// ── «Cerca nelle leggi»: ricerca per parola con le API open data di Normattiva (IPZS, licenza CC BY-NC 4.0) ──
// Solo l'elenco degli atti trovati; il testo si apre sempre sul sito ufficiale. Nulla viene salvato.
const API_NORMATTIVA = 'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/semplice';
const LEGGI_PER_PAGINA = 10;
function statoLeggi(){ return utStato.leggi || (utStato.leggi = { testo: '', pagina: 0, atti: [], totale: 0, stato: '', richiesta: 0, ordine: 'recente', tipo: '', tipi: [], tutti: 0 }); }
function maiuscolaIniziale(t){ t = String(t || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }
function attoDaApi(a){
  const titolo = String(a.titoloAtto || '').replace(/^\[|\]$/g, '').replace(/\s*\(\w{8,}\)\s*\]?\s*$/, '').replace(/\s+/g, ' ').trim();
  const nome = maiuscolaIniziale(String(a.descrizioneAtto || '').replace(/\s+/g, ' ').trim()) || 'Atto';
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(a.dataGU || '') && /^[\w]+$/.test(a.codiceRedazionale || '');
  const url = ok ? `https://www.normattiva.it/atto/caricaDettaglioAtto?atto.dataPubblicazioneGazzetta=${a.dataGU}&atto.codiceRedazionale=${a.codiceRedazionale}` : 'https://www.normattiva.it/';
  return { url, titolo: nome, testo: titolo, icona: 'libro', fonte: 'Normattiva' };
}
// Nomi brevi dei tipi di atto che Normattiva restituisce nei filtri
const TIPI_LEGGI = { PLE: 'Leggi', PLL: 'D.Lgs.', PDL: 'D.L.', PPR: 'D.P.R.', PRD: 'R.D.', PRL: 'R.D.L.', PLC: 'Leggi cost.', COS: 'Costituzione' };
async function cercaNelleLeggi(pagina, nuova){
  const st = statoLeggi(), inp = el('utCercaLeggi');
  const testo = nuova ? (inp ? inp.value : '').trim() : st.testo;
  if(testo.length < 3){ Object.assign(st, { stato: 'corto', atti: [], totale: 0, tipi: [] }); disegnaLeggi(); return; }
  if(inp) inp.blur();
  const id = ++st.richiesta;
  if(nuova) Object.assign(st, { tipo: '', tipi: [], tutti: 0 });
  Object.assign(st, { testo, stato: 'carica' }); if(pagina === 1){ st.atti = []; st.totale = 0; }
  disegnaLeggi();
  try{
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), 20000);
    const corpo = { testoRicerca: testo, orderType: st.ordine, paginazione: { paginaCorrente: pagina, numeroElementiPerPagina: LEGGI_PER_PAGINA } };
    if(st.tipo) corpo.filtriMap = { codice_tipo_provvedimento: st.tipo };
    const r = await fetch(API_NORMATTIVA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl ? ctrl.signal : undefined, body: JSON.stringify(corpo) });
    clearTimeout(t);
    if(id !== st.richiesta) return;
    if(r.status === 204){ Object.assign(st, { stato: 'ok', totale: 0, pagina: 1 }); disegnaLeggi(); return; }
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if(id !== st.richiesta) return;
    st.atti = st.atti.concat((d.listaAtti || []).map(attoDaApi));
    Object.assign(st, { stato: 'ok', totale: d.numeroAttiTrovati || st.atti.length, pagina });
    if(!st.tipo && pagina === 1){ // i filtri per tipo si prendono dalla ricerca senza filtro, così restano tutti visibili
      st.tutti = st.totale;
      st.tipi = ((d.facetMap && d.facetMap.codice_tipo_provvedimento) || []).filter(f => f && f.codice && f.valore > 0)
        .map(f => ({ codice: String(f.codice), nome: TIPI_LEGGI[f.codice] || maiuscolaIniziale(f.descrizione), n: f.valore }));
    }
  }catch(e){ if(id === st.richiesta) st.stato = navigator.onLine === false ? 'offline' : 'errore'; }
  disegnaLeggi();
}
function righeLeggi(){
  const st = statoLeggi();
  if(st.stato === 'corto') return `<p class="ut-vuoto">Scrivi almeno 3 lettere.</p>`;
  if(st.stato === 'offline') return `<p class="ut-vuoto">Serve internet per cercare su Normattiva.</p>`;
  if(st.stato === 'errore') return `<p class="ut-vuoto">Normattiva non risponde in questo momento. Riprova più tardi.</p>`;
  if(!st.stato) return '';
  const chip = (azione, v, testo, attivo) => `<button type="button" class="ut-chip${attivo ? ' attivo' : ''}" data-ut="${azione}" data-v="${escapeHtml(v)}" aria-pressed="${attivo}">${testo}</button>`;
  let h = `<div class="ut-leggi-testa"><span>${st.stato === 'carica' && !st.atti.length ? 'Cerco su Normattiva…' : `${numeroIt0(st.totale)} ${st.totale === 1 ? 'atto trovato' : 'atti trovati'}`}</span><button type="button" class="ut-leggi-chiudi" data-ut="leggi-chiudi">✕ Chiudi</button></div>`;
  h += `<div class="ut-leggi-filtri">${chip('leggi-ordine', 'recente', 'Più recenti', st.ordine === 'recente')}${chip('leggi-ordine', 'vecchio', 'Più vecchie', st.ordine === 'vecchio')}</div>`;
  if(st.tipi.length > 1) h += `<div class="ut-leggi-filtri">${chip('leggi-tipo', '', `Tutti <b>${numeroIt0(st.tutti)}</b>`, !st.tipo)}${st.tipi.map(t => chip('leggi-tipo', t.codice, `${escapeHtml(t.nome)} <b>${numeroIt0(t.n)}</b>`, st.tipo === t.codice)).join('')}</div>`;
  if(st.stato === 'ok' && !st.atti.length) return h + `<p class="ut-vuoto">Nessuna legge trovata con «${escapeHtml(st.testo)}».</p>`;
  if(st.atti.length) h += `<div class="ut-lista">${st.atti.map(a => rigaLink(a)).join('')}</div>`;
  if(st.stato === 'carica' && st.atti.length) h += `<p class="ut-vuoto">Cerco su Normattiva…</p>`;
  else if(st.atti.length < st.totale) h += `<button type="button" class="ut-chip ut-leggi-altri" data-ut="leggi-altri">Mostra altri ${Math.min(LEGGI_PER_PAGINA, st.totale - st.atti.length)}</button>`;
  if(st.atti.length > 3) h += `<button type="button" class="ut-leggi-chiudi ut-leggi-chiudi-fondo" data-ut="leggi-chiudi">✕ Chiudi i risultati</button>`;
  return h;
}
function disegnaLeggi(){ const b = el('utRisultatiLeggi'); if(b) b.innerHTML = righeLeggi(); }
function htmlCercaLeggi(){
  const st = statoLeggi();
  return `<p class="ut-tit">Cerca nelle leggi</p><form id="utFormLeggi" class="ut-cerca ut-cerca-leggi" role="search">${ic('cerca')}<input type="search" id="utCercaLeggi" enterkeyhint="search" autocomplete="off" placeholder="Una parola, es. perquisizione" value="${escapeHtml(st.testo)}" maxlength="80"><button type="submit" class="ut-chip">Cerca</button></form>`
    + `<div id="utRisultatiLeggi">${righeLeggi()}</div><p class="ut-nota">Le norme si aprono sul sito ufficiale: tocca ☆ per mettere in cima quelle che usi di più. «Cerca nelle leggi» cerca in tutte le leggi pubblicate su Normattiva (serve internet). La parola viene inviata a Normattiva: non scrivere dati personali. Dati: Normattiva – Istituto Poligrafico e Zecca dello Stato, licenza CC BY-NC 4.0.</p>`;
}
