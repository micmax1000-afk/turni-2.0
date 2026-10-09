/* FASE 1 — modulo estratto dal precedente script.js. */

function trovaAssenzaRecuperoFestivo(){
  return AppState.assenze.find(a => a.nome === 'Recupero festivo') || null;
}

function calcolaGiorniRecuperoFestivoAccumulati(){
  return Object.values(AppState.turni).filter(t => t.recuperoFestivoLavorato).length;
}

function trovaAssenzaRecuperoRiposo(){
  return AppState.assenze.find(a => a.nome === 'Recupero riposo') || null;
}

function calcolaGiorniRecuperoAccumulati(){
  return Object.values(AppState.turni).filter(t => t.compensazioneRiposo).length;
}

function calcolaOreCompensateAccumulate(){
  let totale = 0;
  for(const t of Object.values(AppState.turni)){
    if(t.riposo || t.assenzaTipo) continue;
    totale += classificaTurno(t).oreCompensate || 0;
  }
  return round2(totale);
}

function calcolaOreAssenzaUsate(assenzaId){
  let totale = 0;
  for(const t of Object.values(AppState.turni)){
    if(t.assenzaTipo !== assenzaId) continue;
    const f = finestraDaOrari(t.data, t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine);
    totale += f.ore;
  }
  return round2(totale);
}

function contaGiorniUsatiAssenza(assenzaId){
  return Object.values(AppState.turni).filter(t => t.assenzaTipo === assenzaId).length;
}

function contaGiorniUsatiAssenzaNelMese(assenzaId, anno, mese){
  const prefisso = `${anno}-${String(mese + 1).padStart(2, '0')}-`;
  return Object.entries(AppState.turni).filter(([iso, t]) => iso.startsWith(prefisso) && t.assenzaTipo === assenzaId).length;
}

function contaGiorniUsatiAssenzaNelAnno(assenzaId, anno){
  const prefisso = `${anno}-`;
  return Object.entries(AppState.turni).filter(([iso, t]) => iso.startsWith(prefisso) && t.assenzaTipo === assenzaId).length;
}

function calcolaOreAssenzaUsateNelAnno(assenzaId, anno){
  const prefisso = `${anno}-`;
  let totale = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso) || t.assenzaTipo !== assenzaId) continue;
    totale += finestraDaOrari(t.data, t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine).ore;
  }
  return round2(totale);
}

function calcolaOrePermessoBreveUsateAnno(anno){
  const voce = AppState.assenze.find(a => a.nome === 'Permesso breve');
  const idVoce = voce ? voce.id : null;
  const prefisso = `${anno}-`;
  let totale = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso)) continue;
    if(idVoce && t.assenzaTipo === idVoce){
      totale += finestraDaOrari(t.data, t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine).ore;
    } else if(t.permessoBreveAttivo){
      totale += finestraDaOrari(t.data, t.permessoBreveOraInizio, t.permessoBreveOraFine).ore;
    }
  }
  return round2(totale);
}

function calcolaOreDaRecuperareAnno(anno){
  const prefisso = `${anno}-`;
  let prese = 0, recuperate = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso)) continue;
    if(t.permessoBreveAttivo) prese += finestraDaOrari(t.data, t.permessoBreveOraInizio, t.permessoBreveOraFine).ore;
    if(t.recuperoPermessoBreveAttivo) recuperate += finestraDaOrari(t.data, t.recuperoPermessoBreveOraInizio, t.recuperoPermessoBreveOraFine).ore;
  }
  return round2(Math.max(0, prese - recuperate));
}

function calcolaOreRecuperateAnno(anno){
  const prefisso = `${anno}-`;
  let totale = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso)) continue;
    if(t.recuperoPermessoBreveAttivo) totale += finestraDaOrari(t.data, t.recuperoPermessoBreveOraInizio, t.recuperoPermessoBreveOraFine).ore;
  }
  return round2(totale);
}

function calcolaSaldoCongedoOrdinario(anno){
  const voce = AppState.assenze.find(a => a.nome === 'Congedo ordinario');
  if(!voce) return { valoreEffettivo: 0, usate: 0, riporto: 0 };
  const anniConDati = Object.keys(AppState.turni).map(iso => Number(iso.slice(0, 4)));
  const primoAnno = anniConDati.length ? Math.min(anno, ...anniConDati) : anno;
  let riporto = 0;
  for(let y = primoAnno; y < anno; y++){
    riporto += voce.valore - contaGiorniUsatiAssenzaNelAnno(voce.id, y);
  }
  return { valoreEffettivo: round2(voce.valore + riporto), usate: contaGiorniUsatiAssenzaNelAnno(voce.id, anno), riporto: round2(riporto) };
}

function elencoDateDisponibiliCredito(nomeVoce, campoFonte){
  const voce = AppState.assenze.find(a => a.nome === nomeVoce);
  if(!voce) return [];
  const dateGuadagnate = Object.entries(AppState.turni)
    .filter(([iso, t]) => t[campoFonte])
    .map(([iso]) => iso)
    .sort();
  const usate = contaGiorniUsatiAssenza(voce.id);
  return dateGuadagnate.slice(usate);
}

// Quanto spetta, quanto è stato usato e quanto resta di una voce (stesse regole di sempre:
// congedo ordinario con il riporto, L104 al mese, alcune voci all'anno, recuperi automatici).
const NOMI_ANNUALI_SEMPLICI = ['Congedo straordinario', 'Riposo legge', 'Donazione sangue', 'Ore studio', 'Permesso breve', 'Permesso sindacale'];
function saldoAssenza(a){
  const eRiposoCompensativo = a.nome === 'Riposo compensativo';
  const eRecuperoRiposo = a.nome === 'Recupero riposo';
  const eRecuperoFestivo = a.nome === 'Recupero festivo';
  const eL104 = a.nome === 'L104';
  const eCongedoOrdinario = a.nome === 'Congedo ordinario';
  const eAnnualeSemplice = NOMI_ANNUALI_SEMPLICI.includes(a.nome);
  const unita = eRiposoCompensativo ? 'h' : a.unita;
  const saldoCO = eCongedoOrdinario ? calcolaSaldoCongedoOrdinario(annoCorrente) : null;
  const spettanti = eRiposoCompensativo ? calcolaOreCompensateAccumulate()
    : eRecuperoRiposo ? calcolaGiorniRecuperoAccumulati()
    : eRecuperoFestivo ? calcolaGiorniRecuperoFestivoAccumulati()
    : eCongedoOrdinario ? saldoCO.valoreEffettivo
    : a.valore;
  const usate = eCongedoOrdinario ? saldoCO.usate
    : unita === 'h' ? (a.nome === 'Permesso breve' ? calcolaOrePermessoBreveUsateAnno(annoCorrente) : eAnnualeSemplice ? calcolaOreAssenzaUsateNelAnno(a.id, annoCorrente) : calcolaOreAssenzaUsate(a.id))
    : eL104 ? contaGiorniUsatiAssenzaNelMese(a.id, annoCorrente, meseCorrente)
    : eAnnualeSemplice ? contaGiorniUsatiAssenzaNelAnno(a.id, annoCorrente)
    : contaGiorniUsatiAssenza(a.id);
  return { spettanti, usate, rimangono: round2(spettanti - usate), unita, saldoCO, eRiposoCompensativo, eRecuperoRiposo, eRecuperoFestivo, eL104, eCongedoOrdinario, eAnnualeSemplice };
}
const ICONE_ASSENZE = { 'Congedo ordinario':'🌴', 'Congedo straordinario':'📋', 'Riposo legge':'🏛️', 'Riposo festivo':'🎉', 'Recupero festivo':'🔄', 'Recupero riposo':'🔄', 'Riposo compensativo':'♻️', 'Aspettativa':'🕰️', 'Maternità/Paternità':'👶', 'Congedo parentale':'🧸', 'L104':'♿', 'Donazione sangue':'🩸', 'Ore studio':'🎓', 'Permesso breve':'⏱️', 'Permesso sindacale':'🤝' };
const numeroIt = n => String(round2(n)).replace('.', ',');

// In cima: le tre cose che servono davvero (congedo, permesso breve, recuperi).
function renderDashboardAssenze(){
  const box = el('assenzeSummaryGrid');
  if(!box) return;
  const voce = nome => AppState.assenze.find(a => a.nome === nome);
  const resto = nome => { const v = voce(nome); return v ? saldoAssenza(v).rimangono : 0; };
  const tiles = [
    [numeroIt(resto('Congedo ordinario')), 'giorni di congedo'],
    [`${numeroIt(resto('Permesso breve'))} h`, 'permesso breve'],
    [numeroIt(resto('Recupero riposo') + resto('Recupero festivo')), 'recuperi']
  ];
  box.innerHTML = tiles.map(([v, t]) => `<div class="assenza-riepilogo"><b>${v}</b><small>${t}</small></div>`).join('');
  const sotto = el('sottotitoloAssenze');
  if(sotto) sotto.textContent = `Quanto ti resta nel ${annoCorrente}. Solo informativo: non cambia il cedolino.`;
}

function inizializzaFiltriAssenze(){
  const search = el('cercaAssenza');
  const filtri = [...document.querySelectorAll('[data-filtro-assenze]')];
  let unita = 'tutte';
  const applica = () => {
    const q = (search?.value || '').trim().toLowerCase();
    document.querySelectorAll('#corpoAssenze .card-assenza, #corpoAssenzeNonUsate .card-assenza, #corpoAssenzePersonalizzate .card-assenza').forEach(r => {
      const voce = AppState.assenze.find(a => a.id === r.dataset.id);
      const okTesto = !q || (voce?.nome || '').toLowerCase().includes(q);
      const okUnita = unita === 'tutte' || voce?.unita === unita;
      r.classList.toggle('assenza-nascosta', !(okTesto && okUnita));
      r.toggleAttribute('hidden', !(okTesto && okUnita));
    });
  };
  filtri.forEach(btn => btn.addEventListener('click', () => {
    unita = btn.dataset.filtroAssenze;
    filtri.forEach(b => b.classList.toggle('attivo', b === btn));
    applica();
  }));
  search?.addEventListener('input', applica);
}

function aggiornaCardAssenza(riga, voce){
  if(!riga || !voce) return;
  const eRiposoCompensativo = voce.nome === 'Riposo compensativo';
  const eRecuperoRiposo = voce.nome === 'Recupero riposo';
  const eRecuperoFestivo = voce.nome === 'Recupero festivo';
  const eL104 = voce.nome === 'L104';
  const eCongedoOrdinario = voce.nome === 'Congedo ordinario';
  const annuali = ['Congedo straordinario','Riposo legge','Donazione sangue','Ore studio','Permesso breve','Permesso sindacale'];
  const unita = eRiposoCompensativo ? 'h' : voce.unita;
  const saldoCO = eCongedoOrdinario ? calcolaSaldoCongedoOrdinario(annoCorrente) : null;
  const spettanti = eRiposoCompensativo ? calcolaOreCompensateAccumulate() : eRecuperoRiposo ? calcolaGiorniRecuperoAccumulati() : eRecuperoFestivo ? calcolaGiorniRecuperoFestivoAccumulati() : eCongedoOrdinario ? saldoCO.valoreEffettivo : voce.valore;
  const usate = eCongedoOrdinario ? saldoCO.usate : unita === 'h' ? (voce.nome === 'Permesso breve' ? calcolaOrePermessoBreveUsateAnno(annoCorrente) : annuali.includes(voce.nome) ? calcolaOreAssenzaUsateNelAnno(voce.id, annoCorrente) : calcolaOreAssenzaUsate(voce.id)) : eL104 ? contaGiorniUsatiAssenzaNelMese(voce.id, annoCorrente, meseCorrente) : annuali.includes(voce.nome) ? contaGiorniUsatiAssenzaNelAnno(voce.id, annoCorrente) : contaGiorniUsatiAssenza(voce.id);
  const rimangono = round2(spettanti - usate);
  const percentuale = spettanti > 0 ? Math.min(100, Math.max(0, usate / spettanti * 100)) : (rimangono <= 0 ? 100 : 0);
  const stato = rimangono < 0 ? 'esaurito' : rimangono === 0 ? 'zero' : percentuale >= 80 ? 'attenzione' : 'positivo';
  riga.classList.remove('positivo','attenzione','zero','esaurito');
  riga.classList.add(stato);
  const boxes = riga.querySelectorAll('.saldo-box strong');
  if(boxes[0]) boxes[0].textContent = rimangono;
  if(boxes[1]) boxes[1].textContent = usate;
  if(boxes[2]) boxes[2].textContent = spettanti || 0;
  const residuoCompatto = riga.querySelector('.card-assenza-compact-residuo');
  if(residuoCompatto){
    residuoCompatto.textContent = numeroIt(rimangono);
    const totale = residuoCompatto.nextElementSibling;
    if(totale) totale.textContent = `/ ${numeroIt(spettanti || 0)} ${unita}`;
  }
  const barra = riga.querySelector('.barra-residuo-assenza i');
  if(barra){
    const resto = spettanti > 0 ? Math.min(100, Math.max(0, rimangono / spettanti * 100)) : 0;
    barra.style.width = `${resto}%`;
    barra.style.background = rimangono < 0 ? '#D9534F' : (spettanti > 0 && resto <= 20) ? '#E08A00' : unita === 'h' ? '#2E7DD7' : '#2E9E5B';
  }
  const progress = riga.querySelector('.saldo-progress');
  if(progress){ progress.setAttribute('aria-valuenow', String(Math.round(percentuale))); const bar=progress.querySelector('span'); if(bar) bar.style.width=`${percentuale}%`; }
  const meta=riga.querySelector('.card-assenza-meta');
  if(meta){ const first=meta.querySelector('span'); const second=meta.querySelectorAll('span')[1]; if(first) first.textContent=eL104?`Usate a ${NOMI_MESI[meseCorrente]}: ${usate} ${unita}`:((annuali.includes(voce.nome)||eCongedoOrdinario)?`Usate nel ${annoCorrente}: ${usate} ${unita}`:`Usate: ${usate} ${unita}`); if(second) second.textContent=`${Math.round(percentuale)}% utilizzato`; }
  const status=riga.querySelector('.card-assenza-status');
  if(status) status.textContent=rimangono<0?'⚠ Esaurito':rimangono===0?'0 disponibili':percentuale>=80?'Quasi esaurito':'Disponibile';
}

function renderCardAssenzaItem(a){
    const { spettanti: valoreEffettivo, usate, rimangono, unita: unitaEffettiva, saldoCO, eRiposoCompensativo, eRecuperoRiposo, eRecuperoFestivo, eL104, eCongedoOrdinario, eAnnualeSemplice } = saldoAssenza(a);
    const automatica = eRiposoCompensativo || eRecuperoRiposo || eRecuperoFestivo;

    // Congedo ordinario: i giorni riportati dall'anno prima si consumano per primi (FIFO)
    let dettaglioRiporto = '';
    if(eCongedoOrdinario && saldoCO.riporto !== 0){
      const poolVecchi = Math.max(0, saldoCO.riporto);
      const vecchiRimasti = round2(Math.max(0, poolVecchi - usate));
      const nuoviRimasti = round2(rimangono - vecchiRimasti);
      dettaglioRiporto = `<div class="riga-assenza-nota" style="margin-top:2px;"><span class="sotto-titolo" style="font-size:0.75rem;">di cui riportati dal ${annoCorrente - 1}: ${saldoCO.riporto} gg (${vecchiRimasti} ancora disponibili, consumati per primi) · spettanti ${annoCorrente}: ${a.valore} gg (${nuoviRimasti} disponibili)</span></div>`;
    }

    // Elenco a comparsa delle date che hanno generato credito, ancora disponibili (Recupero riposo/festivo)
    let elencoDate = '';
    if(eRecuperoRiposo || eRecuperoFestivo){
      const campoFonte = eRecuperoRiposo ? 'compensazioneRiposo' : 'recuperoFestivoLavorato';
      const dateDisponibili = elencoDateDisponibiliCredito(a.nome, campoFonte);
      elencoDate = `
      <div class="riga-assenza-nota" style="margin-top:2px;">
        <button type="button" class="btn-elenco-date" data-toggle-date="${a.id}">📅 ${dateDisponibili.length ? `Vedi le ${dateDisponibili.length} date disponibili` : 'Nessuna data disponibile'}</button>
      </div>
      <div class="lista-date-disponibili" data-lista-date="${a.id}" style="display:none;">${dateDisponibili.map(d => `<span class="chip-data">${formattaDataBreve(d)}</span>`).join('')}</div>`;
    }
    // Permesso breve: ore prese non toccano più le ore rimanenti col recupero — mostro separatamente
    // quanto resta da recuperare e quanto è già stato recuperato lavorandolo (due conteggi indipendenti).
    let dettaglioRecuperoPB = '';
    if(a.nome === 'Permesso breve'){
      const daRecuperare = calcolaOreDaRecuperareAnno(annoCorrente);
      const recuperate = calcolaOreRecuperateAnno(annoCorrente);
      if(daRecuperare > 0 || recuperate > 0){
        dettaglioRecuperoPB = `<div class="riga-assenza-nota" style="margin-top:2px;"><span class="sotto-titolo" style="font-size:0.75rem;">Ore da recuperare: ${daRecuperare} h · Ore recuperate nel ${annoCorrente}: ${recuperate} h</span></div>`;
      }
    }

    const etichettaUsate = eL104 ? `Usate a ${NOMI_MESI[meseCorrente]}: ${usate} ${unitaEffettiva}`
      : (eAnnualeSemplice || eCongedoOrdinario) ? `Usate nel ${annoCorrente}: ${usate} ${unitaEffettiva}`
      : `Usate: ${usate} ${unitaEffettiva}`;
    const notaRicarica = eL104 ? ' <span class="sotto-titolo" style="font-size:0.7rem;">(si ricarica ogni mese)</span>'
      : eCongedoOrdinario ? ' <span class="sotto-titolo" style="font-size:0.7rem;">(i giorni non goduti si sommano all\'anno nuovo)</span>'
      : eAnnualeSemplice ? ' <span class="sotto-titolo" style="font-size:0.7rem;">(si ricarica ogni anno, non si accumula)</span>'
      : '';
    const percentuale = valoreEffettivo > 0 ? Math.min(100, Math.max(0, (usate / valoreEffettivo) * 100)) : (rimangono <= 0 ? 100 : 0);
    const statoSaldo = rimangono < 0 ? 'esaurito' : (rimangono === 0 ? 'zero' : (percentuale >= 80 ? 'attenzione' : 'positivo'));
    const icona = ICONE_ASSENZE[a.nome] || (unitaEffettiva === 'h' ? '⏱️' : '📅');
    const resto = valoreEffettivo > 0 ? Math.min(100, Math.max(0, rimangono / valoreEffettivo * 100)) : 0;
    const coloreResto = rimangono < 0 ? '#D9534F' : (valoreEffettivo > 0 && resto <= 20) ? '#E08A00' : unitaEffettiva === 'h' ? '#2E7DD7' : '#2E9E5B';
    const valoreVisuale = valoreEffettivo || 0;
    return `
    <article class="card-assenza ${statoSaldo} card-assenza-chiusa" data-id="${a.id}">
      <div class="card-assenza-compact" role="button" tabindex="0" aria-label="Apri dettagli e modifica">
        <span class="card-assenza-icon" aria-hidden="true">${icona}</span>
        <div class="card-assenza-compact-nome"><strong>${a.personalizzata ? (a.nome || 'Nuova voce') : a.nome}</strong></div>
        <div><strong class="card-assenza-compact-residuo">${numeroIt(rimangono)}</strong><small>/ ${numeroIt(valoreVisuale)} ${unitaEffettiva}</small></div>
        <span class="card-assenza-apri" aria-hidden="true">⌄</span>
      </div>
      <span class="barra-residuo-assenza" aria-hidden="true"><i style="width:${resto}%;background:${coloreResto}"></i></span>
      <div class="card-assenza-head">
        <div class="card-assenza-title">
          <span class="card-assenza-icon" aria-hidden="true">${icona}</span>
          <div><strong>${a.personalizzata ? '' : a.nome}</strong>${notaRicarica}</div>
        </div>
        <span class="card-assenza-status">${rimangono < 0 ? '⚠ Esaurito' : rimangono === 0 ? '0 disponibili' : percentuale >= 80 ? 'Quasi esaurito' : 'Disponibile'}</span>
      </div>
      ${a.personalizzata ? `<input class="card-assenza-name" type="text" data-campo="nome" value="${a.nome}">` : ''}
      <div class="card-assenza-main">
        <div class="saldo-box"><span>Disponibili</span><strong>${rimangono}</strong><small>${unitaEffettiva}</small></div>
        <div class="saldo-box"><span>Utilizzati</span><strong>${usate}</strong><small>${unitaEffettiva}</small></div>
        <div class="saldo-box saldo-spettanti"><span>Spettanti</span><strong>${valoreVisuale}</strong><small>${unitaEffettiva}</small></div>
      </div>
      <div class="saldo-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percentuale)}" aria-label="Utilizzo ${Math.round(percentuale)} percento">
        <span style="width:${percentuale}%"></span>
      </div>
      <div class="card-assenza-meta">
        <span>${etichettaUsate}</span>
        <span>${Math.round(percentuale)}% utilizzato</span>
      </div>
      <div class="card-assenza-edit">
        ${automatica
          ? `<span class="valore-automatico" title="Calcolato automaticamente">${valoreEffettivo} ${unitaEffettiva} · auto</span>`
          : `<label>Spettanti <input type="number" data-campo="valore" value="${a.valore}" step="1" min="0"></label>`}
        <label>Unità <select data-campo="unita" ${eRiposoCompensativo ? 'disabled' : ''}>
          <option value="gg" ${unitaEffettiva === 'gg' ? 'selected' : ''}>giorni</option>
          <option value="h" ${unitaEffettiva === 'h' ? 'selected' : ''}>ore</option>
        </select></label>
        ${a.personalizzata ? '<button class="riga-rimuovi" type="button" title="Rimuovi" aria-label="Rimuovi voce">✕</button>' : ''}
      </div>
      <div class="card-assenza-notes">
        ${dettaglioRiporto}${dettaglioRecuperoPB}${elencoDate}
      </div>
      <span class="indicatore-salvato">✓ Salvato</span>
    </article>`;
}

function renderAssenze(){
  renderDashboardAssenze();
  const box = el('corpoAssenze');
  const boxPersonalizzate = el('corpoAssenzePersonalizzate');
  // Le voci a zero e mai usate (es. Riposo festivo, Maternità) stanno in "Non usate", chiuso.
  const nonUsata = a => { const x = saldoAssenza(a); return !x.spettanti && !x.usate; };
  const ufficiali = AppState.assenze.filter(a => !a.personalizzata);
  box.innerHTML = ufficiali.filter(a => !nonUsata(a)).map(renderCardAssenzaItem).join('');
  const boxNonUsate = el('corpoAssenzeNonUsate'), gruppoNonUsate = el('gruppoAssenzeNonUsate');
  if(boxNonUsate && gruppoNonUsate){
    const nonUsate = ufficiali.filter(nonUsata);
    boxNonUsate.innerHTML = nonUsate.map(renderCardAssenzaItem).join('');
    gruppoNonUsate.hidden = !nonUsate.length;
    el('titoloAssenzeNonUsate').textContent = `Non usate (${nonUsate.length})`;
  }
  if(boxPersonalizzate){
    const personalizzate = AppState.assenze.filter(a => a.personalizzata);
    boxPersonalizzate.innerHTML = personalizzate.length
      ? personalizzate.map(renderCardAssenzaItem).join('')
      : '<p class="sotto-titolo" style="padding:10px 14px;margin:0;">Nessuna: aggiungine una con il pulsante qui sotto.</p>';
  }

  if(!window.__filtriAssenzeInizializzati){ inizializzaFiltriAssenze(); window.__filtriAssenzeInizializzati = true; }

  [box, el('corpoAssenzeNonUsate'), boxPersonalizzate].filter(Boolean).forEach(contenitore => wireEventiCardAssenza(contenitore));
}

// Collega gli eventi (modifica campo, apri/chiudi date, rimuovi) alle card già renderizzate in un
// contenitore — usata sia per la lista ufficiale sia per quella personalizzata, stessa logica.
function wireEventiCardAssenza(box){
  box.querySelectorAll('[data-toggle-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lista = box.querySelector(`[data-lista-date="${btn.dataset.toggleDate}"]`);
      if(lista) lista.style.display = lista.style.display === 'none' ? '' : 'none';
    });
  });

  box.querySelectorAll('.card-assenza').forEach(riga => {
    const id = riga.dataset.id;
    const voce = AppState.assenze.find(a => a.id === id);
    riga.querySelectorAll('input, select').forEach(campo => {
      const salvaModificaCampo = () => {
        if(campo.dataset.campo === 'valore') voce.valore = Math.max(0, Number(campo.value) || 0);
        else voce[campo.dataset.campo] = campo.value;
        salvaAssenzeStorage();
        aggiornaCardAssenza(riga, voce);
        if(voce.personalizzata){
          const titolo = riga.querySelector('.card-assenza-title strong');
          if(titolo) titolo.textContent = voce.nome || 'Nuova voce';
          const titoloCompatto = riga.querySelector('.card-assenza-compact-nome strong');
          if(titoloCompatto) titoloCompatto.textContent = voce.nome || 'Nuova voce';
        }
        renderDashboardAssenze();
        const indicatore = riga.querySelector('.indicatore-salvato');
        if(indicatore){
          indicatore.classList.add('visibile');
          clearTimeout(indicatore._timeoutSalvato);
          indicatore._timeoutSalvato = setTimeout(() => indicatore.classList.remove('visibile'), 1300);
        }
      };
      campo.addEventListener('input', salvaModificaCampo);
      campo.addEventListener('change', salvaModificaCampo);
    });
    const btnRimuovi = riga.querySelector('.riga-rimuovi');
    if(btnRimuovi){
      btnRimuovi.addEventListener('click', () => {
        AppState.assenze = AppState.assenze.filter(a => a.id !== id);
        salvaAssenzeStorage();
        renderAssenze();
      });
    }
  });
}

function popolaSelectAssenze(){
  const sel = el('campoAssenzaTipo');
  const valorePrecedente = sel.value;
  // Permesso breve ha una sua modalità dedicata dentro il turno (dalle-alle), non va più selezionato qui come assenza a giornata intera
  sel.innerHTML = '<option value="">— scegli —</option>' +
    AppState.assenze.filter(a => a.nome !== 'Permesso breve').map(a => `<option value="${a.id}">${a.nome} (${a.unita})</option>`).join('');
  sel.value = valorePrecedente;
}

const ASSENZE_PREDEFINITE = [
  { nome:'Congedo ordinario', valore:30, unita:'gg' },
  { nome:'Congedo straordinario', valore:45, unita:'gg' },
  { nome:'Riposo legge', valore:4, unita:'gg' },
  { nome:'Riposo festivo', valore:0, unita:'gg' },
  { nome:'Recupero festivo', valore:0, unita:'gg' },
  { nome:'Recupero riposo', valore:0, unita:'gg' },
  { nome:'Riposo compensativo', valore:0, unita:'h' },
  { nome:'Aspettativa', valore:730, unita:'gg' }, // 2 anni nell'arco della vita lavorativa (non annuale) — fonte: SIULP (https://siulp.it/i-tuoi-diritti/le-assenze-per-motivi-di-famiglia/), confermato anche dall'utente
  { nome:'Maternità/Paternità', valore:0, unita:'gg' }, // solo tracciamento date, nessun calcolo di importo (il pagamento varia nel tempo, vedi nota in Assenze)
  { nome:'Congedo parentale', valore:0, unita:'gg' }, // solo tracciamento date, nessun calcolo di importo (il pagamento varia nel tempo, vedi nota in Assenze)
  { nome:'L104', valore:3, unita:'gg' },
  { nome:'Donazione sangue', valore:12, unita:'gg' },
  { nome:'Ore studio', valore:150, unita:'h' },
  { nome:'Permesso breve', valore:54, unita:'h' },
  { nome:'Permesso sindacale', valore:36, unita:'h' }
];


function inizializzaCardAssenzeV45(){
  document.querySelectorAll('#corpoAssenze .card-assenza, #corpoAssenzeNonUsate .card-assenza, #corpoAssenzePersonalizzate .card-assenza').forEach(card=>{
    const trigger=card.querySelector('.card-assenza-compact');
    if(!trigger || trigger.dataset.v45Bound) return;
    trigger.dataset.v45Bound='1';
    const toggle=()=>{
      const aperta=card.classList.toggle('card-assenza-aperta');
      card.classList.toggle('card-assenza-chiusa',!aperta);
      trigger.setAttribute('aria-expanded',aperta?'true':'false');
    };
    trigger.addEventListener('click',toggle);
    trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
  });
}
const _renderAssenzeV45=renderAssenze;
renderAssenze=function(){
  _renderAssenzeV45();
  inizializzaCardAssenzeV45();
};
