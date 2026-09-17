/* FASE 1 — modulo estratto dal precedente script.js. */

const CATEGORIE_COLORABILI = [
  { chiave:'sera', etichetta:'Sera', predefinito:'#F5A0C0', spiegazione:'Sera — rosa tramonto' },
  { chiave:'pomeriggio', etichetta:'Pomeriggio', predefinito:'#FFAB76', spiegazione:'Pomeriggio — arancio pieno giorno' },
  { chiave:'mattina', etichetta:'Mattina', predefinito:'#FFD97D', spiegazione:'Mattina — giallo alba' },
  { chiave:'notte', etichetta:'Notte', predefinito:'#B4A0E5', spiegazione:'Notte — viola notturno' },
  { chiave:'riposo', etichetta:'Riposo', predefinito:'#8DD3C7', spiegazione:'Riposo — verde acqua' },
  { chiave:'assenza', etichetta:'Assenze', predefinito:'#D8DAE0', spiegazione:'Assenze — grigio neutro' }
];


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

function aggiornaVisibilitaCampiOrario(){
  const assente = el('campoRiposo').checked || !!el('campoAssenzaTipo').value;
  el('campiOrario').style.display = assente ? 'none' : '';
  const voceSelezionata = AppState.assenze.find(a => a.id === el('campoAssenzaTipo').value);
  const eOraria = voceSelezionata && voceSelezionata.unita === 'h';
  el('campiRiposoCompensativo').style.display = eOraria ? '' : 'none';
}

function leggiTurnoDalModale(){
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
    aggiornamentoProfessionale: el('campoAggiornamentoProfessionale').checked,
    addestramentoTiro: el('campoAddestramentoTiro').checked
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
  el('campoModelloTurno').value = '';
  el('campoRiposo').checked = !!t.riposo;
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
  // Il secondo blocco straordinario resta nascosto finché non serve: lo mostriamo di default
  // solo se il turno ha già dati salvati lì (riapertura di un turno con due finestre distinte).
  const secondoStrPresente = !!(t.straordinarioDopoInizio || t.straordinarioDopoFine);
  const blocchStrSecondo = el('blocchStrSecondo');
  if(blocchStrSecondo) blocchStrSecondo.hidden = !secondoStrPresente;
  const btnAggiungiStr = el('btnAggiungiSecondoStraordinario');
  if(btnAggiungiStr) btnAggiungiStr.hidden = secondoStrPresente;
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
  el('campoAggiornamentoProfessionale').checked = !!t.aggiornamentoProfessionale;
  el('campoAddestramentoTiro').checked = !!t.addestramentoTiro;
  aggiornaVisibilitaCampiOrario();
  aggiornaAnteprima();
  const sezioniEditor = el('pannelloTurno').querySelectorAll('.editor-sezione');
  sezioniEditor.forEach((sezione, i) => { sezione.open = i < 2; });
  el('pannelloTurno').hidden = false;
  el('pannelloTurno').scrollIntoView({ behavior:'smooth', block:'start' });
}


