/* FASE 1 — modulo estratto dal precedente script.js. */

const CATEGORIE_COLORABILI = [
  { chiave:'sera', etichetta:'Sera', predefinito:'#F5A0C0', spiegazione:'Sera — rosa tramonto' },
  { chiave:'pomeriggio', etichetta:'Pomeriggio', predefinito:'#FFAB76', spiegazione:'Pomeriggio — arancio pieno giorno' },
  { chiave:'mattina', etichetta:'Mattina', predefinito:'#FFD97D', spiegazione:'Mattina — giallo alba' },
  { chiave:'notte', etichetta:'Notte', predefinito:'#B4A0E5', spiegazione:'Notte — viola notturno' },
  { chiave:'riposo', etichetta:'Riposo', predefinito:'#8DD3C7', spiegazione:'Riposo — verde acqua' },
  { chiave:'assenza', etichetta:'Assenze', predefinito:'#D8DAE0', spiegazione:'Assenze — grigio neutro' },
  { chiave:'ufficio', etichetta:'Ufficio', predefinito:'#A9C8E8', spiegazione:'Ufficio — azzurro' },
  { chiave:'aggiornamentoProfessionale', etichetta:'Aggiornamento professionale', predefinito:'#B7DDA8', spiegazione:'Aggiornamento professionale — verde chiaro' },
  { chiave:'addestramentoTiro', etichetta:'Addestramento tiro', predefinito:'#E5B896', spiegazione:'Addestramento tiro — cammello' }
];


// Spento di default: calendario bianco con sole sigle, finché non lo si accende esplicitamente
// dalle Impostazioni. Chi vuole i colori può riaccenderlo in qualsiasi momento.
function calendarioAColoriAttivo(){
  return TurniPSStorage.getItem(CHIAVE_CALENDARIO_A_COLORI) === '1';
}

// Stile del calendario: 'classico' (casella tutta colorata con la sigla, predefinito) oppure
// 'moderno' (sfondo chiaro, etichetta colorata con nome e ora di inizio, eventi scritti sotto).
function calendarioModernoAttivo(){
  return TurniPSStorage.getItem(CHIAVE_STILE_CALENDARIO) === 'moderno';
}

// Per l'etichetta dello stile moderno: una versione più scura del colore scelto per il turno
// (parte alta, col nome) e il colore del testo più leggibile sopra di essa.
function scurisciColore(hex, fattore){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if(!m) return hex;
  const n = parseInt(m[1], 16);
  let [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
  // In HSL: più scuro e più saturo (i colori pastello scuriti e basta diventano spenti).
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if(max !== min){
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  if(s > 0.2) s = Math.min(0.6, Math.max(0.35, s)); // i grigi restano grigi
  l = Math.max(0, l * (1 - fattore));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const canale = t => { t = (t + 1) % 1; return t < 1/6 ? p + (q - p) * 6 * t : t < 1/2 ? q : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; };
  const out = s === 0 ? [l, l, l] : [canale(h + 1/3), canale(h), canale(h - 1/3)];
  return '#' + out.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
function testoSuColore(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if(!m) return '#1E2129';
  const n = parseInt(m[1], 16);
  const luminanza = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminanza > 0.62 ? '#1E2129' : '#FFFFFF';
}

const SIGLA_SINGOLA_CATEGORIA = { mattina:'M', pomeriggio:'P', sera:'S', notte:'N', riposo:'R' };

function coloreCategoria(chiave){
  const c = CATEGORIE_COLORABILI.find(x => x.chiave === chiave);
  const v = (AppState.coloriTurni && AppState.coloriTurni[chiave]) || (c && c.predefinito) || '#E8ECF0';
  return (v && v !== 'transparent') ? v : ((c && c.predefinito) || '#E8ECF0');
}

function applicaColoriTurni(){
  if(typeof AppState === 'undefined' || !AppState.coloriTurni){
    AppState = window.AppState || AppState || {};
    AppState.coloriTurni = AppState.coloriTurni || {};
  }
  CATEGORIE_COLORABILI.forEach(c => {
    const col = coloreCategoria(c.chiave);
    document.documentElement.style.setProperty('--tipo-' + c.chiave, col);
    // Variabile dedicata al badge (stesso colore di sfondo cella)
    document.documentElement.style.setProperty('--badge-' + c.chiave, col);
  });
  renderLegendaColoriTurni();
}

function renderLegendaColoriTurni(){
  const box = el('legendaColoriTurni');
  if(!box) return;
  // Mini-legenda disattivata: i colori e le spiegazioni restano nel pannello "Colori turni".
  box.innerHTML = '';
}

function renderColoriTurni(){
  const box = el('corpoColoriTurni');
  if(!box) return;
  if(!AppState.coloriTurni) AppState.coloriTurni = {};
  box.innerHTML = CATEGORIE_COLORABILI.map(c => {
    const valoreInputColore = coloreCategoria(c.chiave);
    const spieg = c.spiegazione || c.etichetta;
    return `
    <div class="riga-colore-categoria" data-riga-categoria="${c.chiave}">
      <div class="riga-colore-info">
        <span class="etichetta-categoria">${spieg}</span>
        <span class="anteprima-colore" style="background:${valoreInputColore}" title="${valoreInputColore}"></span>
        <code class="codice-colore">${valoreInputColore}</code>
      </div>
      <div class="griglia-swatch">
        <label class="swatch-colore-libero" title="Cambia colore: ${spieg}">
          <input type="color" data-categoria-libero="${c.chiave}" value="${valoreInputColore}" aria-label="${spieg}">
        </label>
      </div>
    </div>`;
  }).join('');
  function applicaScelta(input){
    const chiave = input.getAttribute('data-categoria-libero') || input.dataset.categoriaLibero;
    if(!chiave) return;
    const val = input.value;
    AppState.coloriTurni[chiave] = val;
    salvaColoriTurniStorage();
    applicaColoriTurni();
    if(typeof renderCalendario === 'function') renderCalendario();
    const riga = input.closest('.riga-colore-categoria');
    if(riga){
      const ant = riga.querySelector('.anteprima-colore');
      const cod = riga.querySelector('.codice-colore');
      if(ant) ant.style.background = val;
      if(cod) cod.textContent = val;
    }
  }
  box.querySelectorAll('[data-categoria-libero]').forEach(input => {
    input.addEventListener('input', () => applicaScelta(input));
    input.addEventListener('change', () => applicaScelta(input));
  });
}

// Finestra "Modifica il giorno": Turno / Riposo / Assenza.
let modoGiornoEditor = 'turno';
function aggiornaVisibilitaCampiOrario(){
  const assenza = modoGiornoEditor === 'assenza' || !!el('campoAssenzaTipo').value;
  const riposo = !assenza && el('campoRiposo').checked;
  el('campiOrario').style.display = (assenza || riposo) ? 'none' : '';
  const blocco = el('bloccoAssenzaGiorno'); if(blocco) blocco.hidden = !assenza;
  const testoRiposo = el('testoRiposoGiorno'); if(testoRiposo) testoRiposo.hidden = !riposo;
  const voceSelezionata = AppState.assenze.find(a => a.id === el('campoAssenzaTipo').value);
  const eOraria = voceSelezionata && voceSelezionata.unita === 'h';
  el('campiRiposoCompensativo').style.display = eOraria ? '' : 'none';
}

// Indennità della griglia → casella (nascosta) che il salvataggio legge, come prima.
const CASELLE_INDENNITA_GIORNO = [
  ['reperibilita', 'campoReperibilita'], ['missione', 'campoMissione'], ['servizioEsterno', 'campoServizioEsterno'],
  ['ordinePubblico', 'campoOrdinePubblico'], ['controlloTerritorio', 'campoControlloTerritorio'], ['buonoPasto', 'campoBuonoPasto'],
  ['cambioTurno', 'campoCambioTurno'], ['compensazioneRiposo', 'campoCompensazioneRiposo'], ['recuperoFestivoLavorato', 'campoRecuperoFestivo']
];
// Il modello del turno: quello che ha esattamente questi orari (se era già quello, resta).
function modelloDaOrariGiorno(){
  const inizio = el('campoOraInizio').value, fine = el('campoOraFine').value;
  if(!inizio || !fine) return null;
  const adatti = (AppState.modelliTurno || []).filter(m => !m.riposo && m.oraInizio === inizio && m.oraFine === fine);
  const prima = (AppState.turni[giornoSelezionato] || {}).modelloId;
  return (adatti.find(m => m.id === prima) || adatti[0] || {}).id || null;
}
function aggiornaEditorGiornoV3(){
  if(!el('sceltaTipoGiorno')) return;
  const modo = el('campoAssenzaTipo').value ? 'assenza' : modoGiornoEditor === 'assenza' ? 'assenza' : el('campoRiposo').checked ? 'riposo' : 'turno';
  el('sceltaTipoGiorno').querySelectorAll('[data-tipo-giorno]').forEach(b => b.classList.toggle('attivo', b.dataset.tipoGiorno === modo));
  // Sottotitolo: cosa c'è in questo momento
  const inizio = el('campoOraInizio').value, fine = el('campoOraFine').value;
  const idModello = modelloDaOrariGiorno();
  const modello = (AppState.modelliTurno || []).find(m => m.id === idModello);
  const voce = AppState.assenze.find(a => a.id === el('campoAssenzaTipo').value);
  el('sottotitoloModaleTurno').textContent = modo === 'riposo' ? 'Riposo'
    : modo === 'assenza' ? (voce ? voce.nome : 'Assenza')
    : inizio && fine ? `${modello ? modello.nome + ' · ' : ''}${inizio} – ${fine}` : 'Turno da completare';
  // Modelli
  el('sceltaModelloGiorno').innerHTML = (AppState.modelliTurno || []).filter(m => !m.riposo && m.oraInizio && m.oraFine).map(m => {
    const colore = scurisciColore(coloreModelloV2(m), 0.35);
    const attivo = m.id === idModello;
    return `<button type="button" data-modello-giorno="${escapeHtml(m.id)}" class="${attivo ? 'attivo' : ''}" style="${attivo ? `background:${colore};color:${testoSuColore(colore)};` : `color:${colore};`}border-color:${colore}">${escapeHtml(typeof nomeBreveModelloSeq === 'function' ? nomeBreveModelloSeq(m) : m.nome)}</button>`;
  }).join('');
  // Indennità
  const attive = CASELLE_INDENNITA_GIORNO.filter(([, id]) => el(id).checked).length;
  el('grigliaIndennitaGiorno').innerHTML = CASELLE_INDENNITA_GIORNO.map(([chiave, id]) => {
    const voceInd = ELENCO_INDENNITA.find(x => x.chiave === chiave);
    const on = el(id).checked;
    return `<button type="button" data-indennita-giorno="${id}" class="${on ? 'attivo' : ''}" aria-pressed="${on}">${iconaIndennita(chiave)}<span>${voceInd ? voceInd.nome : chiave}</span></button>`;
  }).join('');
  el('contaIndennitaGiorno').textContent = attive ? `${attive} ${attive === 1 ? 'attiva' : 'attive'}` : '';
  el('notaControlloTerritorio').hidden = !el('campoControlloTerritorio').checked;
  // Prima / dopo il turno
  document.querySelectorAll('#pannelloTurno .scelta-prima-dopo').forEach(g => {
    const valore = el(g.dataset.per).value;
    g.querySelectorAll('[data-valore]').forEach(b => b.classList.toggle('attivo', b.dataset.valore === valore));
  });
}

// Calcola gli orari nascosti di straordinario (dalle/alle) a partire dai due campi visibili
// "quante ore" + "prima/dopo il turno", usando l'orario del turno corrente come riferimento.
// Chiamata prima di leggere il turno dal modulo, così i campi nascosti sono sempre aggiornati
// indipendentemente dall'ordine in cui l'utente ha compilato i campi.
function sincronizzaCampiStraordinarioDaOre(){
  const oraInizioTurno = el('campoOraInizio')?.value;
  const oraFineTurno = el('campoOraFine')?.value;
  const applica = (campoOre, campoPosizione, campoOrarioManualeInizio, campoOrarioManualeFine, campoInizioNascosto, campoFineNascosto) => {
    // Se l'utente ha compilato l'orario esatto facoltativo, ha sempre la precedenza sul calcolo
    // automatico da "ore + prima/dopo" — utile quando c'è un intervallo che il calcolo automatico
    // non indovinerebbe (es. lo straordinario non parte esattamente alla fine del turno).
    const orarioManualeInizio = el(campoOrarioManualeInizio)?.value;
    const orarioManualeFine = el(campoOrarioManualeFine)?.value;
    if(orarioManualeInizio && orarioManualeFine){
      if(el(campoInizioNascosto)) el(campoInizioNascosto).value = orarioManualeInizio;
      if(el(campoFineNascosto)) el(campoFineNascosto).value = orarioManualeFine;
      return;
    }
    const ore = el(campoOre)?.value;
    const posizione = el(campoPosizione)?.value || 'prima';
    const r = calcolaOrarioStraordinarioDaOre(oraInizioTurno, oraFineTurno, ore, posizione);
    if(el(campoInizioNascosto)) el(campoInizioNascosto).value = r.inizio;
    if(el(campoFineNascosto)) el(campoFineNascosto).value = r.fine;
  };
  applica('campoStrOre1', 'campoStrPosizione1', 'campoStrOrarioInizio1', 'campoStrOrarioFine1', 'campoStrPrimaInizio', 'campoStrPrimaFine');
  applica('campoStrOre2', 'campoStrPosizione2', 'campoStrOrarioInizio2', 'campoStrOrarioFine2', 'campoStrDopoInizio', 'campoStrDopoFine');
}

// Operazione inversa: quando riapri un turno che ha già uno straordinario salvato, ricostruisce
// "quante ore" + "prima/dopo" da mostrare nei campi visibili, a partire dall'orario nascosto.
function popolaCampiOreStraordinarioDaOrario(t){
  const popola = (inizioSalvato, fineSalvato, campoOre, campoPosizione) => {
    const r = scomponiOrarioStraordinarioInOre(inizioSalvato, fineSalvato, t.oraInizio, t.oraFine);
    if(el(campoOre)) el(campoOre).value = r.ore || '';
    if(el(campoPosizione)) el(campoPosizione).value = r.posizione;
  };
  popola(t.straordinarioPrimaInizio, t.straordinarioPrimaFine, 'campoStrOre1', 'campoStrPosizione1');
  popola(t.straordinarioDopoInizio, t.straordinarioDopoFine, 'campoStrOre2', 'campoStrPosizione2');
}

function leggiTurnoDalModale(){
  sincronizzaCampiStraordinarioDaOre();
  return {
    data: giornoSelezionato,
    riposo: el('campoRiposo').checked,
    assenzaTipo: el('campoAssenzaTipo').value || null,
    riposoCompensativoOraInizio: el('campoRCOraInizio').value,
    riposoCompensativoOraFine: el('campoRCOraFine').value,
    oraInizio: el('campoOraInizio').value,
    oraFine: el('campoOraFine').value,
    // "Servizio svolto" ora si modifica da Azioni rapide con salvataggio proprio indipendente
    // (come "Nota del giorno"): qui ne preserviamo il valore già salvato, senza leggerlo da un
    // campo del pannello che non esiste più, per non perderlo quando si salva il resto del turno.
    servizioSvolto: (AppState.turni[giornoSelezionato] || {}).servizioSvolto || '',
    straordinarioPrimaInizio: el('campoStrPrimaInizio').value,
    straordinarioPrimaFine: el('campoStrPrimaFine').value,
    straordinarioDopoInizio: el('campoStrDopoInizio').value,
    straordinarioDopoFine: el('campoStrDopoFine').value,
    compensaStraordinario: el('campoCompensaStraordinario').checked,
    permessoBreveAttivo: el('campoPermessoBreveAttivo').checked,
    permessoBreveOraInizio: el('campoPermessoBreveInizio').value,
    permessoBreveOraFine: el('campoPermessoBreveFine').value,
    recuperoPermessoBreveAttivo: el('campoRecuperoPermessoBreveAttivo').checked,
    recuperoPermessoBreveOraInizio: el('campoRecuperoPermessoBreveInizio').value,
    recuperoPermessoBreveOraFine: el('campoRecuperoPermessoBreveFine').value,
    secondoAttivo: el('campoSecondoAttivo').checked,
    secondoOraInizio: el('campoSecondoOraInizio').value,
    secondoOraFine: el('campoSecondoOraFine').value,
    reperibilita: el('campoReperibilita').checked,
    missione: el('campoMissione').checked,
    durataMissioneOre: Number(el('campoDurataMissione').value) || 0,
    servizioEsterno: el('campoServizioEsterno').checked,
    ordinePubblico: el('campoOrdinePubblico').checked,
    opSede: el('campoOPSede').value,
    opPernottamento: el('campoOPPernottamento').checked,
    controlloTerritorio: el('campoControlloTerritorio').checked,
    cambioTurno: el('campoCambioTurno').checked,
    compensazioneRiposo: el('campoCompensazioneRiposo').checked,
    recuperoFestivoLavorato: el('campoRecuperoFestivo').checked,
    buonoPasto: el('campoBuonoPasto').checked,
    modelloId: el('campoRiposo').checked || el('campoAssenzaTipo').value ? null : modelloDaOrariGiorno()
  };
}

function aggiornaAnteprima(){
  const t = leggiTurnoDalModale();
  const box = el('anteprimaClassificazione');
  const boxStr = el('anteprimaStraordinario');
  const boxRC = el('anteprimaRiposoCompensativo');
  if(boxRC){
    const voceSel = AppState.assenze.find(a => a.id === t.assenzaTipo);
    if(voceSel && voceSel.unita === 'h'){
      const f = finestraDaOrari(t.data || dataISO(new Date()), t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine);
      if(f.ore > 0){
        const eRC = voceSel.nome === 'Riposo compensativo';
        const totaleDisponibile = eRC ? calcolaOreCompensateAccumulate() : voceSel.valore;
        const oreStessoGiornoAltrove = (giornoSelezionato && AppState.turni[giornoSelezionato] && AppState.turni[giornoSelezionato].assenzaTipo === voceSel.id)
          ? finestraDaOrari(AppState.turni[giornoSelezionato].data, AppState.turni[giornoSelezionato].riposoCompensativoOraInizio, AppState.turni[giornoSelezionato].riposoCompensativoOraFine).ore : 0;
        const usateAltrove = calcolaOreAssenzaUsate(voceSel.id) - oreStessoGiornoAltrove;
        const rimanentiDopo = round2(totaleDisponibile - usateAltrove - f.ore);
        boxRC.textContent = `Consuma ${f.ore}h dal saldo di ${voceSel.nome}` + (rimanentiDopo < 0 ? ` — ⚠ saldo insufficiente, andresti a ${rimanentiDopo}h` : ` (resterebbero ${rimanentiDopo}h).`);
      } else {
        boxRC.textContent = 'Indica l\'orario del turno sostituito per calcolare le ore consumate.';
      }
    } else {
      boxRC.textContent = '';
    }
  }
  if(t.riposo){
    box.textContent = 'Giorno di riposo — nessuna ora da classificare.';
    if(boxStr) boxStr.textContent = '';
    return;
  }
  const c = classificaTurno(t);
  const boxPB = el('anteprimaPermessoBreve');
  const boxRPB = el('anteprimaRecuperoPermessoBreve');
  const vocePB = AppState.assenze.find(a => a.nome === 'Permesso breve');
  const oggiPermessoOre = (giornoSelezionato && AppState.turni[giornoSelezionato] && AppState.turni[giornoSelezionato].data && AppState.turni[giornoSelezionato].data.startsWith(String(annoCorrente)))
    ? classificaTurno(AppState.turni[giornoSelezionato]).orePermessoBreve : 0;
  const oggiRecuperoOre = (giornoSelezionato && AppState.turni[giornoSelezionato] && AppState.turni[giornoSelezionato].data && AppState.turni[giornoSelezionato].data.startsWith(String(annoCorrente)))
    ? classificaTurno(AppState.turni[giornoSelezionato]).oreRecuperoPermessoBreve : 0;
  const usateAnnoAltrove = vocePB ? round2(calcolaOrePermessoBreveUsateAnno(annoCorrente) - oggiPermessoOre) : 0;
  if(boxPB){
    if(t.permessoBreveAttivo && c.orePermessoBreve > 0 && vocePB){
      const rimanentiDopo = round2(vocePB.valore - usateAnnoAltrove - c.orePermessoBreve);
      boxPB.textContent = `Turno ridotto a ${round2(c.oreTotali)}h lavorate. Toglie ${c.orePermessoBreve}h dal saldo di Permesso breve (in modo permanente)` +
        (rimanentiDopo < 0 ? ` — ⚠ saldo insufficiente, andresti a ${rimanentiDopo}h.` : ` (resterebbero ${rimanentiDopo}h nel ${annoCorrente}).`) +
        ` Ricordati di recuperarle: ti restano da recuperare ${c.orePermessoBreve}h in più rispetto a prima.`;
    } else if(t.permessoBreveAttivo){
      boxPB.textContent = 'Indica l\'orario del permesso breve per calcolare le ore da togliere al turno.';
    } else {
      boxPB.textContent = 'Le ore di permesso breve si tolgono dalle ore lavorative del turno (es. turno 13:00–19:00 con permesso 18:00–19:00 = 5h lavorate, 1h di permesso) e scalano per sempre il saldo di Permesso breve in Assenze — recuperarle in seguito non fa tornare su il saldo, serve solo a non perdere la retribuzione di quell\'ora.';
    }
  }
  if(boxRPB){
    if(t.recuperoPermessoBreveAttivo && c.oreRecuperoPermessoBreve > 0){
      boxRPB.textContent = `${c.oreRecuperoPermessoBreve}h retribuite in più (non contano nel totale ore del turno). Scalano dalle ore ancora da recuperare, senza toccare il saldo di Permesso breve rimanente.`;
    } else if(t.recuperoPermessoBreveAttivo){
      boxRPB.textContent = 'Indica l\'orario del recupero per calcolare le ore da aggiungere al turno.';
    } else {
      boxRPB.textContent = 'Queste ore, a differenza del permesso breve, entrano nel calcolo della paga (ore retribuite in più), ma non si sommano al totale ore del turno né toccano il saldo rimanente di Permesso breve: scalano solo il debito di "ore da recuperare".';
    }
  }
  if(boxStr){
    const primaCalc = finestraDaOrari(t.data || dataISO(new Date()), t.straordinarioPrimaInizio, t.straordinarioPrimaFine);
    const dopoCalc = finestraDaOrari(t.data || dataISO(new Date()), t.straordinarioDopoInizio, t.straordinarioDopoFine);
    // Testo neutro: non indichiamo se un blocco è "prima" o "dopo" il turno, l'utente inserisce
    // solo l'orario reale e non deve pensare a questa distinzione.
    let testo = '';
    if(primaCalc.ore > 0 && dopoCalc.ore > 0){
      testo = `Ore di straordinario calcolate: ${primaCalc.ore}h + ${dopoCalc.ore}h = ${round2(primaCalc.ore + dopoCalc.ore)}h totali`;
    } else if(primaCalc.ore > 0 || dopoCalc.ore > 0){
      testo = `Ore di straordinario calcolate: ${primaCalc.ore || dopoCalc.ore}h`;
    }
    if(t.compensaStraordinario && c.oreCompensate > 0) testo += `${testo ? ' — ' : ''}${c.oreCompensate}h convertite in riposo compensativo, escluse dalla paga.`;
    boxStr.textContent = testo;
  }
  if(c.errore){ box.textContent = '⚠ ' + c.errore; return; }
  if(!t.oraInizio || !t.oraFine){ box.textContent = 'Inserisci ora inizio e ora fine per vedere la classificazione automatica.'; return; }
  box.textContent =
    `Ore totali: ${c.oreTotali}\n` +
    `Ordinarie: ${c.ordinarie} · Notturne: ${c.notturne} · Festive: ${c.festive} · Domenicali: ${c.domenicali} · Notturne festive: ${c.notturneFestive}\n` +
    `Straordinario — Diurno: ${c.strDiurno} · Notturno: ${c.strNotturno} · Festivo: ${c.strFestivo} · Notturno festivo: ${c.strNotturnoFestivo}`;
}

function apriModaleTurno(iso){
  giornoSelezionato = iso;
  const t = AppState.turni[iso] || {};
  el('pannelloTurno').dataset.iso = iso;
  el('titoloModaleTurno').textContent = 'Turno del ' + iso.split('-').reverse().join('/');
  el('campoRiposo').checked = !!t.riposo;
  modoGiornoEditor = t.assenzaTipo ? 'assenza' : t.riposo ? 'riposo' : 'turno';
  popolaSelectAssenze();
  el('campoAssenzaTipo').value = t.assenzaTipo || '';
  el('campoRCOraInizio').value = t.riposoCompensativoOraInizio || '';
  el('campoRCOraFine').value = t.riposoCompensativoOraFine || '';
  el('campoOraInizio').value = t.oraInizio || '';
  el('campoOraFine').value = t.oraFine || '';
  el('campoStrPrimaInizio').value = t.straordinarioPrimaInizio || '';
  el('campoStrPrimaFine').value = t.straordinarioPrimaFine || '';
  el('campoStrDopoInizio').value = t.straordinarioDopoInizio || '';
  el('campoStrDopoFine').value = t.straordinarioDopoFine || '';
  // Azzeriamo i campi "orario esatto" facoltativi prima di ripopolare: altrimenti un valore
  // inserito per un giorno precedente resterebbe visibile (e verrebbe riapplicato per sbaglio,
  // avendo la precedenza) quando si apre un giorno diverso nella stessa sessione.
  ['campoStrOrarioInizio1','campoStrOrarioFine1','campoStrOrarioInizio2','campoStrOrarioFine2'].forEach(id => { if(el(id)) el(id).value = ''; });
  popolaCampiOreStraordinarioDaOrario(t);
  // Il secondo blocco straordinario resta nascosto finché non serve: lo mostriamo di default
  // solo se il turno ha già dati salvati lì (riapertura di un turno con due finestre distinte).
  const secondoStrPresente = !!(t.straordinarioDopoInizio || t.straordinarioDopoFine);
  const blocchStrSecondo = el('blocchStrSecondo');
  if(blocchStrSecondo) blocchStrSecondo.hidden = !secondoStrPresente;
  const btnAggiungiStr = el('btnAggiungiSecondoStraordinario');
  // Se c'è solo il secondo straordinario (salvato "dopo"), il primo vuoto non si mostra.
  const primoStrPresente = !!(t.straordinarioPrimaInizio || t.straordinarioPrimaFine);
  const bloccoPrimo = el('bloccoStrPrimo');
  if(bloccoPrimo) bloccoPrimo.hidden = secondoStrPresente && !primoStrPresente;
  if(btnAggiungiStr) btnAggiungiStr.hidden = secondoStrPresente && primoStrPresente;
  el('campoCompensaStraordinario').checked = !!t.compensaStraordinario;
  el('campoPermessoBreveAttivo').checked = !!t.permessoBreveAttivo;
  el('campoPermessoBreveInizio').value = t.permessoBreveOraInizio || '';
  el('campoPermessoBreveFine').value = t.permessoBreveOraFine || '';
  el('campiPermessoBreve').style.display = t.permessoBreveAttivo ? '' : 'none';
  el('campoRecuperoPermessoBreveAttivo').checked = !!t.recuperoPermessoBreveAttivo;
  el('campoRecuperoPermessoBreveInizio').value = t.recuperoPermessoBreveOraInizio || '';
  el('campoRecuperoPermessoBreveFine').value = t.recuperoPermessoBreveOraFine || '';
  el('campiRecuperoPermessoBreve').style.display = t.recuperoPermessoBreveAttivo ? '' : 'none';
  el('campoSecondoAttivo').checked = !!t.secondoAttivo;
  el('campoSecondoOraInizio').value = t.secondoOraInizio || '';
  el('campoSecondoOraFine').value = t.secondoOraFine || '';
  el('campiSecondoSegmento').style.display = t.secondoAttivo ? '' : 'none';
  el('campoReperibilita').checked = !!t.reperibilita;
  el('campoMissione').checked = !!t.missione;
  el('campoDurataMissione').value = t.durataMissioneOre || 0;
  el('campoDurataMissioneBox').style.display = t.missione ? '' : 'none';
  el('campoServizioEsterno').checked = !!t.servizioEsterno;
  el('campoOrdinePubblico').checked = !!t.ordinePubblico;
  el('campoOPSede').value = t.opSede || 'in';
  el('campoOPPernottamento').checked = t.opPernottamento !== false;
  el('campoOrdinePubblicoBox').style.display = t.ordinePubblico ? '' : 'none';
  el('campoOPPernottamentoBox').style.display = (t.ordinePubblico && t.opSede === 'fuori') ? '' : 'none';
  el('campoControlloTerritorio').checked = !!t.controlloTerritorio;
  el('campoCambioTurno').checked = !!t.cambioTurno;
  el('campoCompensazioneRiposo').checked = !!t.compensazioneRiposo;
  el('campoRecuperoFestivo').checked = !!t.recuperoFestivoLavorato;
  el('campoBuonoPasto').checked = !!t.buonoPasto;
  aggiornaVisibilitaCampiOrario();
  aggiornaAnteprima();
  // Il pannello "+ Aggiungi indennità o straordinario" resta sempre aperto (richiesto esplicitamente):
  // niente più logica condizionale che lo apriva solo se c'erano già dati dentro.
  const pannelloIndennita = el('pannelloTurno').querySelector('.pannello-indennita-straordinario');
  if(pannelloIndennita) pannelloIndennita.open = true;
  const sezioniEditor = el('pannelloTurno').querySelectorAll('.editor-sezione');
  sezioniEditor.forEach((sezione, i) => { sezione.open = i < 2; });
  const dataTitolo = new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' });
  el('titoloModaleTurno').textContent = dataTitolo.charAt(0).toUpperCase() + dataTitolo.slice(1);
  aggiornaEditorGiornoV3();
  el('pannelloTurno').hidden = false;
  el('pannelloTurno').scrollTop = 0;
}


