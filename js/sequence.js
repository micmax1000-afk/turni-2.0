/* FASE 1 — modulo estratto dal precedente script.js. */

const OPZIONI_SEQUENZA_SEMPLICE = {
  riposo: '💤 Riposo',
  mattina: '☀️ Mattina — 07:00–13:00',
  pomeriggio: '🌤️ Pomeriggio — 13:00–19:00',
  sera24: '🌇 Sera — 19:00–24:00',
  sera01: '🌇 Sera — 19:00–01:00',
  notte00: '🌙 Notte — 00:00–07:00',
  notte01: '🌙 Notte — 01:00–07:00',
  mattutino: '☀️ Turno — 08:00–14:00',
  pomeridiano: '🌤️ Turno — 14:00–20:00',
  personalizzato: '🕐 Orario personalizzato…'
};

function descrizionePassoSemplice(passo){
  if(!passo || passo.tipo === 'riposo') return '💤 Riposo';
  if(passo.tipo === 'personalizzato'){
    const a=passo.oraInizio||'--:--', b=passo.oraFine||'--:--';
    return `🕐 Personalizzato — ${a}–${b}`;
  }
  const etichetta = OPZIONI_SEQUENZA_SEMPLICE[passo.tipo] || OPZIONI_SEQUENZA[passo.tipo] || passo.tipo;
  // Mostriamo l'icona illustrata al posto della semplice emoji per i 4 momenti della giornata
  // (qui il contesto è innerHTML, quindi può ospitare SVG — a differenza dei <select><option>
  // dei menu a tendina, che per limite del browser possono contenere solo testo semplice).
  const mappaMomento = {
    mattina:'mattina', mattutino:'mattina',
    pomeriggio:'pomeriggio', pomeridiano:'pomeriggio',
    sera24:'sera', sera01:'sera',
    notte00:'notte', notte01:'notte'
  };
  const momento = mappaMomento[passo.tipo];
  if(momento && typeof svgIconaMomento === 'function'){
    const testoSenzaEmoji = etichetta.replace(/^\S+\s*/, '');
    return `<span style="display:inline-flex;align-items:center;gap:7px;">${svgIconaMomento(momento)}<span>${testoSenzaEmoji}</span></span>`;
  }
  return etichetta;
}

function aggiornaAnteprimaSequenzaSemplice(){
  const box=el('anteprimaSequenzaSemplice');
  if(!box) return;
  if(!AppState.sequenzaTurni.length){
    box.innerHTML='<span class="anteprima-vuota">Nessun passaggio. Apri le opzioni avanzate per aggiungerne uno.</span>';
    return;
  }
  box.innerHTML=AppState.sequenzaTurni.slice(0,7).map((p,i)=>
    `<div class="anteprima-passaggio"><span>${i+1}</span><strong>${descrizionePassoSemplice(p)}</strong></div>`
  ).join('') + (AppState.sequenzaTurni.length>7 ? `<div class="anteprima-altro">＋ altri ${AppState.sequenzaTurni.length-7} passaggi</div>` : '');
}

function renderSequenza(){
  const data=el('campoSequenzaDataInizio');
  // La data di inizio della generazione è indipendente dal giorno selezionato
  // nel calendario. Durante il render dei modelli non deve essere sovrascritta.
  if(data && !data.value) data.value = dataISO(new Date());
  const lista = el('listaSequenza');
  if(!lista) return;
  lista.innerHTML = AppState.sequenzaTurni.map((passo, i) => {
    if(!passo.extra) passo.extra = {};
    const numeroAttivi = CAMPI_EXTRA_SEQUENZA.filter(c => passo.extra[c.chiave]).length;
    return `
    <div class="riga-sequenza riga-sequenza-semplice" data-indice="${i}">
      <div class="riga-sequenza-header">
        <span class="numero-passo">${i + 1}</span>
        ${passo.tipo !== 'riposo' ? `<button class="btn-extra-sequenza" type="button" data-indice-extra="${i}" title="Opzioni avanzate per questo passaggio">⚙️${numeroAttivi > 0 ? ` ${numeroAttivi}` : ''}</button>` : ''}
        <button class="riga-rimuovi" type="button" title="Rimuovi passaggio" aria-label="Rimuovi passaggio ${i+1}">✕</button>
      </div>
      <select data-indice="${i}" data-campo="tipo" aria-label="Turno del giorno ${i+1}">
        ${Object.entries(OPZIONI_SEQUENZA_SEMPLICE).map(([val, etichetta]) =>
          `<option value="${val}" ${val === passo.tipo ? 'selected' : ''}>${etichetta}</option>`).join('')}
      </select>
    </div>
    ${passo.tipo === 'personalizzato' ? `
    <div class="riga-sequenza-orari riga-sequenza-orari-semplice">
      <label class="campo-modale">Dalle<input type="time" data-indice="${i}" data-campo="oraInizio" value="${passo.oraInizio || ''}"></label>
      <label class="campo-modale">Alle<input type="time" data-indice="${i}" data-campo="oraFine" value="${passo.oraFine || ''}"></label>
    </div>` : ''}
    ${passo.tipo !== 'riposo' && passo.apertoExtra ? `
      <div class="pannello-extra-sequenza" data-pannello-extra="${i}">
        <label class="campo-modale">Servizio svolto<input type="text" data-indice="${i}" data-campo-extra="servizioSvolto" value="${passo.extra.servizioSvolto || ''}" placeholder="es. Pattugliamento"></label>
        <div class="griglia-check">
          ${CAMPI_EXTRA_SEQUENZA.map(c => `
            <label class="campo-modale campo-riga">
              <input type="checkbox" data-indice="${i}" data-campo-extra="${c.chiave}" ${passo.extra[c.chiave] ? 'checked' : ''}> ${c.etichetta}
            </label>`).join('')}
        </div>
        <label class="campo-modale campo-riga" style="margin-top:4px;">
          <input type="checkbox" data-indice="${i}" data-campo-extra="secondoAttivo" ${passo.extra.secondoAttivo ? 'checked' : ''}> Rientro pomeridiano (turno spezzato)
        </label>
        ${passo.extra.secondoAttivo ? `
          <div class="griglia-check">
            <label class="campo-modale">Rientro dalle<input type="time" data-indice="${i}" data-campo-extra="secondoOraInizio" value="${passo.extra.secondoOraInizio || ''}"></label>
            <label class="campo-modale">alle<input type="time" data-indice="${i}" data-campo-extra="secondoOraFine" value="${passo.extra.secondoOraFine || ''}"></label>
          </div>` : ''}
        <label class="campo-modale campo-riga" style="margin-top:4px;">
          <input type="checkbox" data-indice="${i}" data-campo-extra="straordinarioProgrammato" ${passo.extra.straordinarioProgrammato ? 'checked' : ''}> <strong>Straordinario programmato</strong>
        </label>
        ${passo.extra.straordinarioProgrammato ? `
          <div class="griglia-check">
            <label class="campo-modale">Prima — dalle<input type="time" data-indice="${i}" data-campo-extra="strPrimaInizio" value="${passo.extra.strPrimaInizio || ''}"></label>
            <label class="campo-modale">alle<input type="time" data-indice="${i}" data-campo-extra="strPrimaFine" value="${passo.extra.strPrimaFine || ''}"></label>
            <label class="campo-modale">Dopo — dalle<input type="time" data-indice="${i}" data-campo-extra="strDopoInizio" value="${passo.extra.strDopoInizio || ''}"></label>
            <label class="campo-modale">alle<input type="time" data-indice="${i}" data-campo-extra="strDopoFine" value="${passo.extra.strDopoFine || ''}"></label>
          </div>
          <p class="sotto-titolo" style="margin:2px 0 0;">Lascia vuote le coppie che non ti servono.</p>` : ''}
      </div>` : ''}`;
  }).join('');

  lista.querySelectorAll('select, input[data-campo]').forEach(campo => {
    campo.addEventListener('input', () => {
      const i = Number(campo.dataset.indice);
      AppState.sequenzaTurni[i][campo.dataset.campo] = campo.value;
      if(campo.dataset.campo === 'tipo') renderSequenza();
      aggiornaAnteprimaSequenzaSemplice();
    });
  });
  lista.querySelectorAll('[data-campo-extra]').forEach(campo => {
    campo.addEventListener('input', () => {
      const i = Number(campo.dataset.indice);
      const chiave = campo.dataset.campoExtra;
      AppState.sequenzaTurni[i].extra[chiave] = campo.type === 'checkbox' ? campo.checked : campo.value;
      if(chiave === 'secondoAttivo' || chiave === 'straordinarioProgrammato'){ renderSequenza(); return; }
      const numeroAttivi = CAMPI_EXTRA_SEQUENZA.filter(c => AppState.sequenzaTurni[i].extra[c.chiave]).length;
      const btnExtra = lista.querySelector(`.riga-sequenza[data-indice="${i}"] .btn-extra-sequenza`);
      if(btnExtra) btnExtra.textContent = `⚙️${numeroAttivi > 0 ? ` ${numeroAttivi}` : ''}`;
    });
  });
  lista.querySelectorAll('.btn-extra-sequenza').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.indiceExtra);
      AppState.sequenzaTurni[i].apertoExtra = !AppState.sequenzaTurni[i].apertoExtra;
      renderSequenza();
    });
  });
  lista.querySelectorAll('.riga-rimuovi').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if(AppState.sequenzaTurni.length <= 1) return;
      AppState.sequenzaTurni.splice(i, 1);
      salvaSequenzaStorage();
      renderSequenza();
    });
  });
  aggiornaAnteprimaSequenzaSemplice();
}

function copiaTurnoCorrente(){
  if(!giornoSelezionato || !AppState.turni[giornoSelezionato]) return;
  turnoCopiato = JSON.parse(JSON.stringify(AppState.turni[giornoSelezionato]));
  aggiornaDettaglioGiorno();
}

function incollaTurnoCorrente(){
  if(!giornoSelezionato || !turnoCopiato) return;
  const esegui = () => {
    AppState.turni[giornoSelezionato] = { ...turnoCopiato, data: giornoSelezionato, generatoAutomaticamente: true };
    salvaTurniStorage();
    renderCalendario();
  };
  if(AppState.turni[giornoSelezionato]){
    mostraConferma('Il giorno selezionato ha già un turno: verrà sovrascritto. Continuare?', esegui);
  } else {
    esegui();
  }
}

function cancellaTurniMese(){
  const giorniNelMese = new Date(annoCorrente, meseCorrente + 1, 0).getDate();
  const isoDelMese = [];
  for(let g = 1; g <= giorniNelMese; g++){
    const iso = dataISO(new Date(annoCorrente, meseCorrente, g));
    if(AppState.turni[iso]) isoDelMese.push(iso);
  }
  if(isoDelMese.length === 0){
    mostraAvviso(`Nessun turno inserito in ${NOMI_MESI[meseCorrente]} ${annoCorrente} da cancellare.`);
    return;
  }
  mostraConferma(
    `Stai per cancellare ${isoDelMese.length} turno/i di ${NOMI_MESI[meseCorrente]} ${annoCorrente}.\n` +
    `L'operazione non è reversibile. Continuare?`,
    () => {
      isoDelMese.forEach(iso => delete AppState.turni[iso]);
      salvaTurniStorage();
      renderCalendario();
    }
  );
}

function orariSemplici(){
  const v = el('selettoreOrarioSemplice')?.value || '0814';
  if(v === '0713') return {inizio:'07:00', fine:'13:00'};
  if(v === '0814') return {inizio:'08:00', fine:'14:00'};
  return null;
}

function passoPersonalizzatoConOrario(extra={}, orari=null){
  const o = orari || orariSemplici() || {inizio:'08:00', fine:'14:00'};
  return {tipo:'personalizzato', oraInizio:o.inizio, oraFine:o.fine, extra:{...extra}};
}

function applicaModelloTurnoInQuinta(){
  AppState.sequenzaTurni = [{tipo:'sera01'}, {tipo:'pomeriggio'}, {tipo:'mattina'}, {tipo:'notte01'}, {tipo:'riposo'}];
  salvaSequenzaStorage();
  renderSequenza();
}

function applicaModelloTurnoInQuinta10(){
  AppState.sequenzaTurni = [
    {tipo:'sera01'}, {tipo:'pomeriggio'}, {tipo:'mattina'}, {tipo:'notte01'}, {tipo:'riposo'},
    {tipo:'sera01'}, {tipo:'pomeriggio'}, {tipo:'mattina'}, {tipo:'mattina'}, {tipo:'riposo'}
  ];
  salvaSequenzaStorage();
  renderSequenza();
}

function applicaModelloSettimanaCorta(){
  const orari = orariSemplici();
  if(!orari){
    mostraAvviso('Per la settimana corta scegli 07:00–13:00 o 08:00–14:00. Per un orario diverso usa le Opzioni avanzate.');
    return;
  }
  const base = (extra={}) => passoPersonalizzatoConOrario(extra, orari);
  const riposo = () => ({tipo:'riposo'});
  const rientro = {secondoAttivo:true, secondoOraInizio:'15:00', secondoOraFine:'18:00'};
  AppState.sequenzaTurni = [base(), base(rientro), base(), base(rientro), base(), riposo(), riposo()];
  salvaSequenzaStorage();
  renderSequenza();
}

function applicaModelloSettimanaLunga(){
  const orari = orariSemplici();
  if(!orari){
    mostraAvviso('Per la settimana lunga scegli 07:00–13:00 o 08:00–14:00. Per un orario diverso usa le Opzioni avanzate.');
    return;
  }
  const base = () => passoPersonalizzatoConOrario({}, orari);
  const riposo = () => ({tipo:'riposo'});
  AppState.sequenzaTurni = [base(),base(),base(),base(),base(),base(),riposo()];
  salvaSequenzaStorage();
  renderSequenza();
}

function generaSequenzaTurni(indiceInizialeForzato){
  const dataInizioStr = el('campoSequenzaDataInizio').value;
  const numeroGiorni = Math.max(1, Math.min(366, Number(el('campoSequenzaGiorni').value) || 1));
  if(!dataInizioStr || AppState.sequenzaTurni.length === 0) return;

  const dataInizio = new Date(dataInizioStr + 'T00:00:00');
  const indiceIniziale = indiceInizialeForzato !== undefined
    ? ((indiceInizialeForzato % AppState.sequenzaTurni.length) + AppState.sequenzaTurni.length) % AppState.sequenzaTurni.length
    : 0;

  // Conto quanti giorni nell'intervallo hanno già un turno inserito, per chiedere conferma
  let giorniEsistenti = 0;
  for(let i = 0; i < numeroGiorni; i++){
    const d = new Date(dataInizio); d.setDate(d.getDate() + i);
    if(AppState.turni[dataISO(d)]) giorniEsistenti++;
  }
  const eseguiGenerazione = () => {
    for(let i = 0; i < numeroGiorni; i++){
      const d = new Date(dataInizio); d.setDate(d.getDate() + i);
      const iso = dataISO(d);
      const passo = AppState.sequenzaTurni[(indiceIniziale + i) % AppState.sequenzaTurni.length];
      if(passo.tipo === 'riposo'){
        AppState.turni[iso] = { data: iso, riposo: true, generatoAutomaticamente: true };
      } else {
        const oraInizio = passo.tipo === 'personalizzato' ? (passo.oraInizio || '') : MODELLI_TURNO[passo.tipo].oraInizio;
        const oraFine = passo.tipo === 'personalizzato' ? (passo.oraFine || '') : MODELLI_TURNO[passo.tipo].oraFine;
        if(!oraInizio || !oraFine) continue; // passo personalizzato incompleto: salta il giorno
        const extra = passo.extra || {};
        AppState.turni[iso] = {
          data: iso, riposo: false, assenzaTipo: null,
          oraInizio, oraFine, generatoAutomaticamente: true,
          servizioSvolto: extra.servizioSvolto || '',
          straordinarioPrimaInizio: extra.straordinarioProgrammato ? (extra.strPrimaInizio || '') : '',
          straordinarioPrimaFine: extra.straordinarioProgrammato ? (extra.strPrimaFine || '') : '',
          straordinarioDopoInizio: extra.straordinarioProgrammato ? (extra.strDopoInizio || '') : '',
          straordinarioDopoFine: extra.straordinarioProgrammato ? (extra.strDopoFine || '') : '',
          secondoAttivo: !!extra.secondoAttivo, secondoOraInizio: extra.secondoOraInizio || '', secondoOraFine: extra.secondoOraFine || '',
          reperibilita: !!extra.reperibilita, missione: !!extra.missione, servizioEsterno: !!extra.servizioEsterno,
          ordinePubblico: !!extra.ordinePubblico, controlloTerritorio: !!extra.controlloTerritorio, cambioTurno: false,
          buonoPasto: !!extra.buonoPasto
        };
      }
    }
    // L'ancora di rotazione si registra solo quando si genera "da zero" (indice 0),
    // così "Continua turnazione" può sempre calcolare la fase corretta rispetto a questo punto.
    if(indiceIniziale === 0){
      TurniPSStorage.setItem(CHIAVE_SEQUENZA_ANCORA, dataInizioStr);
    }
    // Registro sempre l'ultimo giorno effettivamente scritto: "Continua turnazione" riparte da qui + 1,
    // senza bisogno di calcolarlo o digitarlo a mano, e senza toccare i giorni già inseriti.
    const ultimoGiornoScritto = new Date(dataInizio); ultimoGiornoScritto.setDate(ultimoGiornoScritto.getDate() + numeroGiorni - 1);
    TurniPSStorage.setItem(CHIAVE_SEQUENZA_ULTIMO_GIORNO, dataISO(ultimoGiornoScritto));
    salvaTurniStorage();
    salvaSequenzaStorage();

    // Porta il calendario direttamente sul periodo appena generato.
    // Prima della correzione, se l'utente generava una sequenza in un mese diverso
    // da quello visualizzato, il calendario restava sul mese precedente e sembrava vuoto.
    annoCorrente = dataInizio.getFullYear();
    meseCorrente = dataInizio.getMonth();
    giornoSelezionato = dataInizioStr;
    mostraScheda('turni');
    renderCalendario();
  };

  if(giorniEsistenti > 0){
    mostraConferma(
      `Attenzione: ${giorniEsistenti} giorno/i nell'intervallo scelto ${giorniEsistenti === 1 ? 'ha' : 'hanno'} già un turno inserito.\n` +
      `Generando la sequenza, ${giorniEsistenti === 1 ? 'verrà sovrascritto' : 'verranno sovrascritti'} e persi.\n\nContinuare comunque?`,
      eseguiGenerazione
    );
  } else {
    eseguiGenerazione();
  }
}

function continuaSequenzaTurni(){
  if(AppState.sequenzaTurni.length === 0) return;
  const ancoraStr = TurniPSStorage.getItem(CHIAVE_SEQUENZA_ANCORA);
  const ultimoGiornoStr = TurniPSStorage.getItem(CHIAVE_SEQUENZA_ULTIMO_GIORNO);
  if(!ancoraStr || !ultimoGiornoStr){
    mostraAvviso('Non c\'è ancora una turnazione generata da cui continuare: usa prima "Genera" per crearne una, poi potrai continuarla per altri giorni o mesi senza sfasare la rotazione.');
    return;
  }
  // Riparte automaticamente dal giorno subito dopo l'ultimo generato, senza toccare i giorni già inseriti
  const ultimoGiorno = new Date(ultimoGiornoStr + 'T00:00:00');
  const nuovoInizio = new Date(ultimoGiorno); nuovoInizio.setDate(nuovoInizio.getDate() + 1);
  const nuovoInizioStr = dataISO(nuovoInizio);
  el('campoSequenzaDataInizio').value = nuovoInizioStr;

  const ancora = new Date(ancoraStr + 'T00:00:00');
  const giorniTrascorsi = Math.round((nuovoInizio - ancora) / 86400000);
  const indiceIniziale = giorniTrascorsi % AppState.sequenzaTurni.length;
  generaSequenzaTurni(indiceIniziale);
}

const OPZIONI_SEQUENZA = { riposo:'Riposo', ...Object.fromEntries(Object.entries(MODELLI_TURNO).map(([k,v]) => [k, v.etichetta])), personalizzato:'Orario personalizzato…' };

const CAMPI_EXTRA_SEQUENZA = [
  { chiave:'servizioEsterno', etichetta:'Servizio esterno' },
  { chiave:'ordinePubblico', etichetta:'Ordine pubblico' },
  { chiave:'controlloTerritorio', etichetta:'Controllo territorio' },
  { chiave:'buonoPasto', etichetta:'Buono pasto' },
  { chiave:'reperibilita', etichetta:'Reperibilità' },
  { chiave:'missione', etichetta:'Missione' }
];
