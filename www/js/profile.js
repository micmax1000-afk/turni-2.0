/* FASE 1 — modulo estratto dal precedente script.js. */

// Il campo era in passato un testo libero (es. "SIULP"): qualunque valore salvato in precedenza
// diverso da "no" viene interpretato come iscrizione attiva, per non perdere il dato di chi
// l'aveva già compilato prima che diventasse un semplice Sì/No.
function normalizzaSindacato(valoreSalvato){
  if(!valoreSalvato) return 'no';
  return valoreSalvato === 'no' ? 'no' : 'si';
}

function puntiStella(cx, cy, rEst, rInt){
  let punti = [];
  for(let i = 0; i < 10; i++){
    const raggio = i % 2 === 0 ? rEst : rInt;
    const angolo = (Math.PI / 5) * i - Math.PI / 2;
    punti.push(`${(cx + raggio * Math.cos(angolo)).toFixed(1)},${(cy + raggio * Math.sin(angolo)).toFixed(1)}`);
  }
  return punti.join(' ');
}

function svgBadgeGrado(qualifica){
  const info = MAPPA_GRADI[qualifica] || { cat:'truppa', n:0 };
  const colore = info.cat === 'truppa' ? '#D65C5C' : '#D9B23C';
  const spacing = 5.5;
  const primo = 8 - ((info.n - 1) * spacing) / 2;
  let simboli = '';
  for(let i = 0; i < info.n; i++){
    const cx = info.n > 0 ? primo + i * spacing : 0;
    if(info.cat === 'truppa') simboli += `<rect x="${(cx-0.9).toFixed(1)}" y="4" width="1.8" height="10" fill="${colore}"/>`;
    else if(info.cat === 'sovr') simboli += `<polygon points="${cx},4 ${(cx+3).toFixed(1)},9 ${cx},14 ${(cx-3).toFixed(1)},9" fill="${colore}"/>`;
    else if(info.cat === 'isp') simboli += `<polygon points="${cx},4 ${(cx+2.7).toFixed(1)},6.9 ${(cx+1.6).toFixed(1)},11.4 ${(cx-1.6).toFixed(1)},11.4 ${(cx-2.7).toFixed(1)},6.9" fill="${colore}"/>`;
    else if(info.cat === 'funz') simboli += `<polygon points="${puntiStella(cx, 9, 3.1, 1.3)}" fill="${colore}"/>`;
  }
  const extra = info.extra
    ? `<polygon points="24,3 26,5 24,7 22,5" fill="none" stroke="${colore}" stroke-width="0.8"/>`
    : '';
  return `<svg width="32" height="18" viewBox="0 0 32 18" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle; flex-shrink:0;">
    <rect x="0.5" y="0.5" width="31" height="17" rx="2.5" fill="#16233F" stroke="#0D101C" stroke-width="1"/>
    ${simboli}${extra}
  </svg>`;
}

function aggiornaRiassuntoAnagrafica(){
  el('btnAnagrafica').innerHTML = AppState.anagrafica
    ? `${svgBadgeGrado(AppState.anagrafica.qualifica)} ${AppState.anagrafica.qualifica}`
    : '🪪 Anagrafica';
}

function popolaFormAnagrafica(){
  const stato = el('statoSalvataggioAnagrafica');
  if(stato) stato.textContent = 'Le modifiche si salvano da sole.';
  if(AppState.anagrafica){
    el('campoQualifica').value = AppState.anagrafica.qualifica || 'Agente';
    el('campoAnni').value = AppState.anagrafica.anni || '';
    el('campoSettimana').value = settimanaLavoro();
    el('campoRegione').value = AppState.anagrafica.regione || 'Lombardia';
    el('campoConiugeACarico').value = AppState.anagrafica.coniugeACarico || 'no';
    el('campoFigliOver21').value = AppState.anagrafica.figliOver21 ?? 0;
    el('campoSindacato').value = normalizzaSindacato(AppState.anagrafica.sindacato);
    el('campoAddComunale').value = numeroIt2(AppState.anagrafica.addComunale ?? 0.8);
    el('campoQuotaSindacale').value = numeroIt2(quotaSindacaleMensile(AppState.anagrafica));
    el('campoRedditoAnnoPrec').value = AppState.anagrafica.redditoAnnoPrecedente ? numeroIt2(AppState.anagrafica.redditoAnnoPrecedente) : '';
    el('campoAddRegionaleAnnoPrec').value = AppState.anagrafica.addRegionaleAnnoPrecedente ? numeroIt2(AppState.anagrafica.addRegionaleAnnoPrecedente) : '';
  }
  el('rigaQuotaSindacale').hidden = el('campoSindacato').value !== 'si';
  aggiornaAvvisiDatiMancanti();
  aggiornaVisualizzazioneParametro();
  aggiornaProfiloAnagrafica();
}

function aggiornaVisualizzazioneParametro(){
  const qualifica = el('campoQualifica').value;
  const parametro = PARAMETRO_STIPENDIALE[qualifica];
  el('visualizzaParametro').textContent = parametro !== undefined ? parametro.toFixed(2).replace('.', ',') : '—';
  // Testata della pagina Anagrafica: distintivo, qualifica, parametro, regione, se è completa.
  const grado = el('visualizzaGrado');
  if(grado) grado.innerHTML = svgBadgeGrado(qualifica);
  const q = el('testataQualifica'); if(q) q.textContent = qualifica;
  const r = el('testataRegione'); if(r) r.textContent = el('campoRegione').value;
  const c = el('testataCompleta');
  if(c) aggiornaAvvisiDatiMancanti();
}


function aggiornaProfiloAnagrafica(){
  const a = AppState.anagrafica || {};
  const qualifica = a.qualifica || el('campoQualifica')?.value || 'Agente';
  const anni = Number(a.anni ?? el('campoAnni')?.value) || 0;
  const regione = a.regione || el('campoRegione')?.value || '—';
  const coniuge = (a.coniugeACarico || el('campoConiugeACarico')?.value) === 'si';
  const over = Number(a.figliOver21 ?? el('campoFigliOver21')?.value) || 0;
  const sindacato = normalizzaSindacato(a.sindacato ?? el('campoSindacato')?.value) === 'si';
  const required = [qualifica, anni > 0 ? anni : '', regione];
  const complete = Math.round((required.filter(Boolean).length / required.length) * 100);
  const initials = qualifica.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'AG';
  const avatar = el('profiloAvatar'); if(avatar) avatar.textContent = initials;
  const title = el('profiloNomeTitolo'); if(title) title.textContent = qualifica;
  const subtitle = el('profiloSedeTitolo'); if(subtitle) subtitle.textContent = regione;
  const badge = el('profiloComplete'); if(badge) badge.textContent = `${complete}%`;
  const alert = el('profiloAlert'); if(alert) alert.hidden = complete >= 80;
  const host = el('profiloSummary');
  if(host) host.innerHTML = `
    <div class="profilo-summary-card"><span>👮 Qualifica</span><strong>${qualifica}</strong><small>Parametro ${PARAMETRO_STIPENDIALE[qualifica] !== undefined ? PARAMETRO_STIPENDIALE[qualifica].toFixed(2).replace('.',',') : '—'}</small></div>
    <div class="profilo-summary-card"><span>⌛ Servizio</span><strong>${anni ? anni + ' anni' : 'Da impostare'}</strong><small>${anni >= 17 ? 'Assegno funzione: attivo' : 'Assegno funzione: non ancora'}</small></div>
    <div class="profilo-summary-card"><span>📍 Regione</span><strong>${regione}</strong><small>Addizionale regionale automatica</small></div>
    <div class="profilo-summary-card"><span>👨‍👩‍👧 Famiglia</span><strong>${coniuge ? 'Coniuge + ' : ''}${over} figli over 21</strong><small>${sindacato ? 'Sindacato: presente' : 'Dati facoltativi'}</small></div>`;
}

function cancellaAnagrafica(){
  AppState.anagrafica = null;
  TurniPSStorage.removeItem(CHIAVE_ANAGRAFICA);
  el('campoQualifica').value = 'Agente';
  el('campoAnni').value = '';
  el('campoRegione').value = 'Lombardia';
  el('campoConiugeACarico').value = 'no';
  el('campoFigliOver21').value = 0;
  el('campoSindacato').value = 'no';
  el('campoAddComunale').value = '0,8';
  el('campoRedditoAnnoPrec').value = '';
  el('campoAddRegionaleAnnoPrec').value = '';
  el('campoQuotaSindacale').value = '';
  el('rigaQuotaSindacale').hidden = true;
  aggiornaVisualizzazioneParametro();
  aggiornaRiassuntoAnagrafica();
  aggiornaProfiloAnagrafica();
  if(typeof aggiornaRiassuntoAnagraficaAltro === 'function') aggiornaRiassuntoAnagraficaAltro();
}

function salvaAnagraficaDaModale(){
  AppState.anagrafica = {
    qualifica: el('campoQualifica').value,
    anni: el('campoAnni').value,
    settimana: el('campoSettimana').value,
    regione: el('campoRegione').value,
    // v2.99: l'addizionale comunale si inserisce qui. Finché non la scrivi resta 0,8% (stima)
    // e risulta "da inserire".
    ...addComunaleDaCampo(),
    coniugeACarico: el('campoConiugeACarico').value,
    figliOver21: Number(el('campoFigliOver21').value) || 0,
    sindacato: el('campoSindacato').value,
    quotaSindacale: el('campoQuotaSindacale').value === '' ? quotaSindacaleMensile(AppState.anagrafica) : Math.max(0, leggiNumeroItaliano(el('campoQuotaSindacale').value)),
    redditoAnnoPrecedente: Math.max(0, leggiNumeroItaliano(el('campoRedditoAnnoPrec').value)),
    // A quale anno si riferisce il reddito: se lo cambi è quello dell'anno scorso, altrimenti resta com'era.
    redditoAnnoPrecedenteAnno: leggiNumeroItaliano(el('campoRedditoAnnoPrec').value) !== (Number(AppState.anagrafica?.redditoAnnoPrecedente) || 0)
      ? new Date().getFullYear() - 1 : (AppState.anagrafica?.redditoAnnoPrecedenteAnno || new Date().getFullYear() - 1),
    addRegionaleAnnoPrecedente: Math.max(0, leggiNumeroItaliano(el('campoAddRegionaleAnnoPrec').value))
  };
  el('rigaQuotaSindacale').hidden = el('campoSindacato').value !== 'si';
  if(el('campoSindacato').value === 'si' && el('campoQuotaSindacale').value === '') el('campoQuotaSindacale').value = numeroIt2(AppState.anagrafica.quotaSindacale);
  // Dopo il salvataggio i numeri si riscrivono in formato italiano (35200 → 35.200, 0.5 → 0,5).
  const a = AppState.anagrafica, rifai = (id, v) => { const c = el(id); if(c && document.activeElement !== c && c.value !== '') c.value = numeroIt2(v); };
  rifai('campoAddComunale', a.addComunale); rifai('campoQuotaSindacale', a.quotaSindacale);
  if(a.redditoAnnoPrecedente) rifai('campoRedditoAnnoPrec', a.redditoAnnoPrecedente);
  if(a.addRegionaleAnnoPrecedente) rifai('campoAddRegionaleAnnoPrec', a.addRegionaleAnnoPrecedente);
  salvaAnagraficaStorage();
  aggiornaRiassuntoAnagrafica();
  aggiornaProfiloAnagrafica();
  aggiornaVisualizzazioneParametro();
  if(typeof aggiornaRiassuntoAnagraficaAltro === 'function') aggiornaRiassuntoAnagraficaAltro();
  const stato = el('statoSalvataggioAnagrafica');
  if(stato) stato.innerHTML = '<span class="stato-attivo">✓ Salvato</span> · le modifiche si salvano da sole';
  aggiornaAvvisiDatiMancanti();
  // v3.8.9: il congedo ordinario segue anni di servizio e orario.
  if(typeof aggiornaCongedoAutomatico === 'function') aggiornaCongedoAutomatico();
}

function addComunaleDaCampo(){
  const prima = AppState.anagrafica || {};
  const v = el('campoAddComunale').value;
  if(v === '') return { addComunale: prima.addComunale ?? 0.8 };
  return { addComunale: Math.max(0, leggiNumeroItaliano(v)) };
}
// Numero in formato italiano, fino a 2 decimali (0,8 · 9,77 · 35.200).
function numeroIt2(v){
  const n = Number(v);
  return isFinite(n) ? n.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '';
}

// Quota sindacale al mese: quella scritta in Anagrafica, altrimenti il valore delle Tabelle.
function quotaSindacaleMensile(a){
  const q = a && a.quotaSindacale;
  if(q !== undefined && q !== null && q !== '' && !isNaN(Number(q))) return Number(q);
  return Number(AppState.tabelle && AppState.tabelle.sindacatoMensile) || 0;
}

// v2.99: dati dell'anagrafica che servono al netto e che mancano ancora.
function datiAnagraficaMancanti(){
  const a = AppState.anagrafica;
  if(!a) return ['i tuoi dati (qualifica, anni, regione…)'];
  const m = [];
  if(!(Number(a.anni) > 0)) m.push('anni di servizio');
  // v3.4: il reddito è facoltativo (privacy): se manca l'app lo stima; se c'è ed è vecchio, chiede la CU nuova.
  if(Number(a.redditoAnnoPrecedente) > 0 && redditoDaAggiornare(a)) m.push(`reddito ${new Date().getFullYear() - 1} (nuova CU)`);
  return m;
}
// La CU con i redditi dell'anno scorso arriva in primavera: da giugno, se il reddito è ancora di due anni fa, va aggiornato.
function redditoDaAggiornare(a){
  const oggi = new Date();
  const anno = Number(a && a.redditoAnnoPrecedenteAnno) || 0;
  return !!anno && anno < oggi.getFullYear() - 1 && oggi.getMonth() >= 5;
}
function testoDatiMancanti(m){
  return m.length === 1 ? m[0] : m.slice(0, -1).join(', ') + ' e ' + m[m.length - 1];
}
function aggiornaAvvisiDatiMancanti(){
  const m = datiAnagraficaMancanti();
  const testo = testoDatiMancanti(m);
  const maiusc = testo.charAt(0).toUpperCase() + testo.slice(1);
  const rep = el('avvisoReportMancanti');
  if(rep){
    rep.hidden = !m.length;
    if(m.length) rep.innerHTML = `<span aria-hidden="true">⚠️</span><i><b>Completa i tuoi dati</b><small>Da inserire: ${escapeHtml(testo)}. Senza, netto e tasse potrebbero non tornare.</small></i><button type="button" class="btn-nuovo-turni-v4" data-completa-anagrafica>Completa</button>`;
  }
  const ana = el('avvisoAnagraficaMancanti');
  if(ana){
    ana.hidden = !m.length;
    if(m.length) ana.innerHTML = `<span aria-hidden="true">⚠️</span><i><b>${m.length === 1 ? 'Manca 1 dato' : `Mancano ${m.length} dati`}</b><small>${escapeHtml(maiusc)}: senza, il netto non è giusto.</small></i>`;
  }
  // "da inserire" sotto le righe che mancano
  const segna = (id, manca) => {
    const riga = el(id) && el(id).closest('.riga-anagrafica');
    if(!riga) return;
    let s = riga.querySelector('.da-inserire-v5');
    if(manca && !s){ s = document.createElement('small'); s.className = 'da-inserire-v5'; s.textContent = 'da inserire'; riga.querySelector('span').appendChild(s); }
    if(!manca && s) s.remove();
  };
  segna('campoAnni', m.includes('anni di servizio'));
  segna('campoRedditoAnnoPrec', m.some(x => x.startsWith('reddito')));
  const notaReddito = el('notaRedditoAnnoPrec');
  if(notaReddito){
    const a = AppState.anagrafica || {}, anno = Number(a.redditoAnnoPrecedenteAnno) || (new Date().getFullYear() - 1);
    notaReddito.textContent = Number(a.redditoAnnoPrecedente) > 0 ? `Redditi ${anno}, dalla CU ${anno + 1} · resta solo sul telefono` : 'Facoltativo, dalla CU: detrazioni e addizionali più precise. Resta solo sul telefono';
  }
  const c = el('testataCompleta');
  if(c){ c.textContent = m.length ? (m.length === 1 ? 'Manca 1 dato' : `Mancano ${m.length} dati`) : 'Completa'; c.classList.toggle('da-completare', !!m.length); }
}

const PARAMETRO_STIPENDIALE = {
  'Agente': 105.25, 'Agente Scelto': 108.50, 'Assistente': 112.00,
  'Assistente Capo': 116.50, 'Assistente Capo Coordinatore': 121.50,
  'Vice Sovrintendente': 116.75, 'Sovrintendente': 121.50, 'Sovrintendente Capo': 124.25,
  'Sovrintendente Capo Coordinatore': 131.00,
  'Vice Ispettore': 124.75, 'Ispettore': 131.00, 'Ispettore Capo': 133.50, 'Ispettore Superiore': 137.50,
  'Sostituto Commissario': 143.50, 'Sostituto Commissario Coordinatore': 148.00,
  'Vice Commissario': 136.75, 'Commissario': 148.00, 'Commissario Capo': 150.50
};

const MAPPA_GRADI = {
  'Agente': { cat:'truppa', n:0 },
  'Agente Scelto': { cat:'truppa', n:1 },
  'Assistente': { cat:'truppa', n:2 },
  'Assistente Capo': { cat:'truppa', n:3 },
  'Assistente Capo Coordinatore': { cat:'truppa', n:3, extra:true },
  'Vice Sovrintendente': { cat:'sovr', n:1 },
  'Sovrintendente': { cat:'sovr', n:2 },
  'Sovrintendente Capo': { cat:'sovr', n:3 },
  'Sovrintendente Capo Coordinatore': { cat:'sovr', n:3, extra:true },
  'Vice Ispettore': { cat:'isp', n:1 },
  'Ispettore': { cat:'isp', n:2 },
  'Ispettore Capo': { cat:'isp', n:3 },
  'Ispettore Superiore': { cat:'isp', n:4 },
  'Sostituto Commissario': { cat:'funz', n:1 },
  'Sostituto Commissario Coordinatore': { cat:'funz', n:1, extra:true },
  'Vice Commissario': { cat:'funz', n:2 },
  'Commissario': { cat:'funz', n:3 },
  'Commissario Capo': { cat:'funz', n:3, extra:true }
};
