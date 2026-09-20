/* FASE 1 — modulo estratto dal precedente script.js. */

// Stampa/esporta in PDF una sola sezione fra quelle stampabili (cedolino, riepilogo annuale),
// nascondendo temporaneamente le altre eventualmente aperte per evitare che si sovrappongano
// nell'output di stampa. Il CSS @media print mostra comunque solo elementi non-[hidden].
const SEZIONI_STAMPABILI = ['contenitoreCedolino', 'contenitoreRiepilogoAnnuale'];
function stampaSezione(idDaMostrare){
  const nascostiTemporaneamente = SEZIONI_STAMPABILI
    .filter(id => id !== idDaMostrare)
    .map(id => el(id))
    .filter(elemento => elemento && !elemento.hidden);
  nascostiTemporaneamente.forEach(elemento => { elemento.hidden = true; });
  // Se la sezione da stampare vive dentro un <details> richiudibile (es. Riepilogo Annuale,
  // reso richiudibile per semplificare il Cedolino), un <details> chiuso non stampa il proprio
  // contenuto: "visibility:visible" da CSS non basta a superare il display:none che il browser
  // applica al contenuto nascosto. Lo apriamo qui, e lo richiudiamo dopo la stampa se non lo era già.
  const dettagliDaRichiudere = [];
  const elementoDaMostrare = el(idDaMostrare);
  let antenato = elementoDaMostrare ? elementoDaMostrare.closest('details') : null;
  while(antenato){
    if(!antenato.open){ antenato.open = true; dettagliDaRichiudere.push(antenato); }
    antenato = antenato.parentElement ? antenato.parentElement.closest('details') : null;
  }
  const ripristina = () => {
    nascostiTemporaneamente.forEach(elemento => { elemento.hidden = false; });
    dettagliDaRichiudere.forEach(d => { d.open = false; });
    window.removeEventListener('afterprint', ripristina);
  };
  window.addEventListener('afterprint', ripristina);
  window.print();
}

function inizializzaInfoRichiudibili(){
  // Toggle generico per i blocchi informativi richiudibili (es. nota Assegno Unico in Anagrafica).
  document.querySelectorAll('.info-richiudibile-toggle').forEach(toggle => {
    if(toggle.dataset.inizializzato) return;
    toggle.dataset.inizializzato = '1';
    toggle.addEventListener('click', () => {
      const corpo = toggle.nextElementSibling;
      if(!corpo) return;
      const aperto = !corpo.hidden;
      corpo.hidden = aperto;
      toggle.setAttribute('aria-expanded', aperto ? 'false' : 'true');
    });
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizializzaInfoRichiudibili);
else inizializzaInfoRichiudibili();

function mostraAvviso(messaggio, titolo){
  el('titoloAvviso').textContent = titolo || 'Avviso';
  el('testoAvviso').textContent = messaggio;
  el('btnAnnullaAvviso').hidden = true;
  el('btnConfermaAvviso').textContent = 'OK';
  el('btnConfermaAvviso').onclick = () => { el('overlayAvviso').hidden = true; };
  el('overlayAvviso').hidden = false;
}

function mostraConferma(messaggio, alConfermare, titolo){
  el('titoloAvviso').textContent = titolo || 'Conferma';
  el('testoAvviso').textContent = messaggio;
  el('btnAnnullaAvviso').hidden = false;
  el('btnConfermaAvviso').textContent = 'Continua';
  el('btnAnnullaAvviso').onclick = () => { el('overlayAvviso').hidden = true; };
  el('btnConfermaAvviso').onclick = () => { el('overlayAvviso').hidden = true; alConfermare(); };
  el('overlayAvviso').hidden = false;
}

function mostraScheda(nome){
  // Chiusura di sicurezza: qualsiasi popup/overlay rimasto aperto per errore (dal selettore
  // Modelli, dallo straordinario rapido, da un avviso di conferma non chiuso correttamente...)
  // non deve mai poter bloccare la navigazione principale — lo chiudiamo sempre, ad ogni cambio
  // di scheda, anche se probabilmente era già chiuso (innocuo in quel caso).
  ['overlaySelettoreModelli','overlayStraordinarioRapido','overlayModificaModello','overlayEvento','overlayAvviso','popupRapidoGiorno'].forEach(id => { const o = el(id); if(o) o.hidden = true; });
  // V60 — Ristrutturazione a 4 schede (Calendario/Report/Turni/Altro). Le vecchie viste interne
  // (vistaCedolino, vistaStatistiche, vistaAssenze, ecc.) restano fisicamente invariate — cambia
  // solo QUALI vengono mostrate insieme sotto ciascuna delle 4 nuove schede della barra in basso.
  const gruppi = {
    calendario: ['vistaTurni'],
    report: ['vistaStatistiche', 'vistaCedolino'],
    turni: ['vistaAssenze'],
    altro: ['vistaImpostazioni'],
    anagrafica: ['vistaAnagrafica'],
    tabelle: ['vistaTabelle']
  };
  // Anagrafica e Tabelle sono "sotto-pagine" raggiunte da Altro: il tasto evidenziato in barra
  // resta "Altro" anche quando si sta guardando una di queste due, non essendoci un tasto proprio.
  // Gli altri alias mappano i vecchi nomi di scheda (ancora richiamati altrove nel codice) ai
  // nuovi 4 gruppi, senza dover cambiare ogni singola chiamata a mostraScheda(...).
  const tabAttivoPerNome = { anagrafica: 'altro', tabelle: 'altro', sequenza: 'turni', cedolino: 'report', statistiche: 'report', impostazioni: 'altro', assenze: 'turni' };
  const tabAttivo = tabAttivoPerNome[nome] || nome;
  const vistaDaMostrare = gruppi[nome] ? nome : tabAttivo;
  const tuttiIDiv = ['vistaTurni', 'vistaStatistiche', 'vistaCedolino', 'vistaAssenze', 'vistaImpostazioni', 'vistaAnagrafica', 'vistaTabelle'];
  const daMostrare = gruppi[vistaDaMostrare] || [];
  tuttiIDiv.forEach(id => { const n = el(id); if(n) n.hidden = !daMostrare.includes(id); });
  const tabId = { calendario: 'tabCalendario', report: 'tabReport', turni: 'tabTurni', altro: 'tabAltro' };
  Object.keys(tabId).forEach(k => { const n = el(tabId[k]); if(n) n.classList.toggle('attiva', k === tabAttivo); });
  if(nome === 'assenze' || nome === 'turni') renderAssenze();
  if(nome === 'tabelle') renderTabelle();
  if(nome === 'anagrafica') popolaFormAnagrafica();
  if(nome === 'sequenza'){
    const host = el('sezioneSequenzaHost');
    const seq = el('sezioneSequenza');
    if(host && seq && seq.parentElement !== host) host.appendChild(seq);
    if(seq) seq.hidden = false;
    renderSequenza();
  } else {
    const seq = el('sezioneSequenza');
    if(seq) seq.hidden = true;
  }
  if(nome === 'statistiche' || nome === 'report'){ const a=el('campoAnnoStatistiche'); if(a && !a.value) a.value=new Date().getFullYear(); renderStatistiche(); if(typeof aggiornaRiepilogoMensile === 'function') aggiornaRiepilogoMensile(); if(typeof applicaVisibilitaReportBlocchi === 'function') applicaVisibilitaReportBlocchi(); }
  if(nome === 'impostazioni' || nome === 'altro') inizializzaImpostazioni();
  window.scrollTo({ top:0, behavior:'instant' });
}


/* V20 — Notifiche non invasive */
let _toastTimer = null;
function mostraToast(messaggio, tipo='successo', durata=3200){
  const box = el('toastContainer');
  if(!box) return;
  const icone = {successo:'✓', errore:'!', avviso:'⚠', info:'i'};
  const toast = document.createElement('div');
  toast.className = `toast-v20 toast-${tipo}`;
  toast.setAttribute('role','status');
  toast.innerHTML = `<span class="toast-icon">${icone[tipo] || 'i'}</span><span class="toast-text"></span><button type="button" class="toast-close" aria-label="Chiudi">×</button>`;
  toast.querySelector('.toast-text').textContent = messaggio;
  toast.querySelector('.toast-close').onclick = () => toast.remove();
  box.appendChild(toast);
  requestAnimationFrame(()=>toast.classList.add('visibile'));
  window.setTimeout(()=>{ toast.classList.remove('visibile'); window.setTimeout(()=>toast.remove(),220); }, durata);
}

function aggiornaAvvisiApp(){
  const out = [];
  const oggi = new Date();
  const isoOggi = dataISO(oggi);
  const chiaveMese = `${oggi.getFullYear()}-${String(oggi.getMonth()+1).padStart(2,'0')}`;
  const turniMese = Object.keys(AppState.turni || {}).filter(k=>k.startsWith(chiaveMese));
  if(turniMese.length === 0){
    // Primo avvio vero e proprio (nessun turno mai inserito, in nessun mese): invito diretto con
    // pulsante d'azione, invece del semplice avviso informativo mostrato agli utenti già attivi.
    const nessunTurnoMai = Object.keys(AppState.turni || {}).length === 0;
    if(nessunTurnoMai && AppState.anagrafica){
      out.push({ tipo:'info', testo:'Benvenuto! Genera la tua turnazione per iniziare a usare l\u2019app.', azione:{ label:'🚀 Genera turni', onClick: () => el('settingsSequenza')?.click() } });
    } else {
      out.push({tipo:'info', testo:'Nessun turno registrato nel mese corrente. Se hai già la turnazione, puoi generarla o inserirla dal calendario.'});
    }
  }
  const ultimo = TurniPSStorage.getItem(CHIAVE_ULTIMO_BACKUP);
  if(Object.keys(AppState.turni || {}).length && !ultimo) out.push({tipo:'avviso', testo:'Backup non ancora effettuato: esporta una copia dei tuoi dati.'});
  else if(ultimo){ const giorni=Math.floor((oggi-new Date(ultimo))/86400000); if(giorni>=30) out.push({tipo:'avviso', testo:`Backup vecchio di ${giorni} giorni. È consigliato crearne uno nuovo.`}); }

  // La turnazione automatica sta per finire (o è già finita): proponiamo di continuarla con un
  // tocco solo, invece di dover andare in Turni → Genera automaticamente → Continua manualmente.
  // Soglia di 10 giorni: abbastanza in anticipo da poter continuare con calma, non così tanto da
  // risultare un avviso permanente e inutile.
  const ultimoGiornoSequenzaStr = TurniPSStorage.getItem(CHIAVE_SEQUENZA_ULTIMO_GIORNO);
  if(ultimoGiornoSequenzaStr){
    const ultimoGiornoSequenza = new Date(ultimoGiornoSequenzaStr + 'T00:00:00');
    const giorniRimasti = Math.round((ultimoGiornoSequenza - oggi) / 86400000);
    if(giorniRimasti <= 10){
      const dataLeggibile = `${String(ultimoGiornoSequenza.getDate()).padStart(2,'0')}/${String(ultimoGiornoSequenza.getMonth()+1).padStart(2,'0')}`;
      const testoAvviso = giorniRimasti < 0
        ? `La tua turnazione automatica è terminata il ${dataLeggibile}.`
        : `La tua turnazione automatica finisce il ${dataLeggibile}.`;
      out.push({ tipo:'info', testo: testoAvviso, azione:{ label:'🔁 Continua per un altro mese', onClick: () => {
        // continuaSequenzaTurni() imposta già da sola "1 mese" internamente: non serve più
        // toccare qui il campo dei giorni (che oggi si chiama campoPatternGiorni, non più
        // campoSequenzaGiorni, dal passaggio al sistema unico dei Pattern).
        if(typeof continuaSequenzaTurni === 'function') continuaSequenzaTurni();
        if(typeof renderCalendario === 'function') renderCalendario();
        if(typeof mostraToast === 'function') mostraToast('Turnazione continuata: la rotazione prosegue per un altro mese, senza sfasare i turni già inseriti.', 'successo');
        if(typeof renderAvvisiApp === 'function') renderAvvisiApp();
      } } });
    }
  }
  const ass = AppState.assenze || {};
  Object.entries(ass).forEach(([nome,v])=>{
    const spettanti=Number(v?.spettanti ?? v?.totale ?? 0), usati=Number(v?.usati ?? v?.utilizzati ?? 0);
    if(spettanti>0 && usati/spettanti>=.8) out.push({tipo:'avviso', testo:`Saldo assenza quasi esaurito: ${nome}.`});
  });
  return out.slice(0,5);
}

function renderAvvisiApp(){
  const host=el('appAlerts'); if(!host) return;
  const avvisi=aggiornaAvvisiApp();
  host.innerHTML='';
  if(!avvisi.length){ host.hidden=true; return; }
  host.hidden=false;
  avvisi.forEach(a=>{
    const d=document.createElement('div'); d.className=`app-alert-v20 alert-${a.tipo}`;
    d.innerHTML=`<span>${a.tipo==='avviso'?'⚠':a.tipo==='errore'?'!':'i'}</span><div class="app-alert-v20-corpo"><p></p>${a.azione ? `<button type="button" class="app-alert-v20-azione">${escapeHtml(a.azione.label)}</button>` : ''}</div><button type="button" class="app-alert-v20-chiudi" aria-label="Chiudi">×</button>`;
    d.querySelector('p').textContent=a.testo;
    if(a.azione) d.querySelector('.app-alert-v20-azione').onclick = a.azione.onClick;
    d.querySelector('.app-alert-v20-chiudi').onclick=()=>d.remove();
    host.appendChild(d);
  });
}
