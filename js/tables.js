/* FASE 1 — modulo estratto dal precedente script.js. */

// Le Tabelle contengono solo valori "ufficiali" già corretti di default: la maggior parte degli
// utenti non ha mai bisogno di aprirle. Restano nascoste dietro un interruttore per non
// sovraccaricare chi vuole solo usare l'app con i valori standard.
let mostraTabelleAvanzate = false;

function renderTabelle(){
  const qualifica = AppState.anagrafica ? AppState.anagrafica.qualifica : 'Agente';
  const regione = (AppState.anagrafica && AppState.anagrafica.regione) || 'Lombardia';
  const catRuolo = (MAPPA_GRADI[qualifica] || { cat:'truppa' }).cat;
  const NOMI_RUOLO = { truppa:'Agenti e Assistenti', sovr:'Sovrintendenti', isp:'Ispettori', funz:'Commissari/Funzionari' };
  const t = AppState.tabelle;
  const defs = window.TurniPSData?.TABELLE_PREDEFINITE || window.TABELLE_PREDEFINITE || {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const val = (obj, path) => path.split('.').reduce((a,k)=>a?.[k], obj);
  const row = (label, path, step='0.01', extra='') => {
    const current = val(t,path) ?? 0;
    const def = val(defs,path);
    const changed = def !== undefined && Number(current) !== Number(def);
    return `<div class="tabella-riga-v17" data-table-row data-label="${esc(label)}"><div class="tabella-label"><strong>${esc(label)}</strong><span class="tabella-stato ${changed?'modificato':'predefinito'}">${changed?'Modificato':'Predefinito'}</span></div><div class="tabella-edit"><input data-t="${esc(path)}" type="number" step="${step}" value="${esc(current)}" aria-label="${esc(label)}"><button type="button" class="tabella-reset-one" data-reset-table="${esc(path)}" title="Ripristina valore predefinito" ${def===undefined?'disabled':''}>↺</button></div>${extra?`<small>${esc(extra)}</small>`:''}</div>`;
  };
  const section=(id,title,icon,subtitle,body,cls='')=>`<section class="tabella-gruppo-v17 ${cls}" data-table-section="${id}"><button class="tabella-head-v17" type="button" aria-expanded="false"><span class="tabella-icon-v17">${icon}</span><span><strong>${title}</strong><small>${subtitle}</small></span><b>⌄</b></button><div class="tabella-body-v17" hidden>${body}</div></section>`;
  const bodyFisse = row('Stipendio annuo — in vigore (€)',`stipendiAnnuiAttuale.${qualifica}`)+row('Stipendio annuo — proiettato 2027 (€)',`stipendiAnnui2027.${qualifica}`)+row('Indennità pensionabile annua — in vigore (€)',`indennitaPensionabileAnnuaAttuale.${qualifica}`)+row('Indennità pensionabile annua — proiettata 2027 (€)',`indennitaPensionabileAnnua2027.${qualifica}`);
  const bodyStra = row('Diurno (€/h)',`straordinarioOrarioAttuale.${qualifica}.diurno`)+row('Notturno o festivo (€/h)',`straordinarioOrarioAttuale.${qualifica}.notturnoOFestivo`)+row('Notturno festivo (€/h)',`straordinarioOrarioAttuale.${qualifica}.notturnoFestivo`);
  const bodyStra27 = row('Diurno (€/h)',`straordinarioOrario2027.${qualifica}.diurno`)+row('Notturno o festivo (€/h)',`straordinarioOrario2027.${qualifica}.notturnoOFestivo`)+row('Notturno festivo (€/h)',`straordinarioOrario2027.${qualifica}.notturnoFestivo`);
  const bodyAssegno = row('Dopo 17 anni',`assegnoFunzioneAnnuo.${catRuolo}.soglia17`)+row('Dopo 27 anni',`assegnoFunzioneAnnuo.${catRuolo}.soglia27`)+row('Dopo 32 anni',`assegnoFunzioneAnnuo.${catRuolo}.soglia32`);
  const bodyInd = row('Turno notturno ordinario (€/h)',`indennitaTurnoNotturnoOraria`)+row('Presenza festiva/domenicale (€/turno)',`indennitaPresenzaFestivaTurno`)+row('Festività particolare (€/giorno)',`indennitaFestivitaParticolareGiorno`)+row('Compensazione riposo lavorato (€/giorno)',`indennitaCompensazioneRiposoLavorato`)+row('Ordine pubblico in sede (€/turno)',`indennitaOPInSede`)+row('Ordine pubblico fuori sede (€/turno)',`indennitaOPFuoriSede`)+row('Riduzione OP senza pernottamento (%)',`riduzioneOPSenzaPernottamento`,'1')+row('Servizio esterno (€/turno)',`indennitaServizioEsternoTurno`)+row('Controllo territorio serale (€/giorno)',`indennitaControlloTerritorioSeraleFlat`)+row('Controllo territorio notturno (€/giorno)',`indennitaControlloTerritorioNotturnoFlat`)+row('Reperibilità (€/turno)',`reperibilitaGiornaliera`)+row('Cambio turno (€/occorrenza)',`indennitaCambioTurno`)+row('Produttività collettiva (€/giorno)',`indennitaProduttivitaCollettiva`)+row('Missione — piena 4-8h (€/h)',`indennitaTrasfertaOraria`,'0.001')+row('Missione — ridotta oltre 8h (€/h)',`indennitaTrasfertaOrariaRidotta`,'0.001')+row('Quota sindacale (€/mese)',`sindacatoMensile`);
  const bodyFisc = row('Aliquota previdenziale (%)',`aliquotaPrevidenziale`)+row('No-tax area annua (€)',`noTaxAreaAnnua`,'1')+row('Detrazione lavoro dipendente (€/mese)',`detrazioneLavoroMensile`)+row('Detrazione coniuge (€/anno)',`detrazioneConiugeACaricoAnnua`)+row('Detrazione figlio over 21 (€/anno)',`detrazionePerFiglioOver21Annua`)+row('Trattamento integrativo (€/mese)',`trattamentoIntegrativoMensile`);
  const bodyBuono=row('Valore buono pasto (€)',`buonoPastoValore`);

  // Indennità personalizzate: voci libere definite dall'utente (es. "Vacanza contrattuale"),
  // non coperte dalle tabelle ufficiali sopra. A differenza delle righe fisse, qui il nome
  // stesso della voce è modificabile, non solo il suo importo.
  const bodyPersonalizzate = AppState.indennitaPersonalizzate.length
    ? AppState.indennitaPersonalizzate.map(ip => `
      <div class="riga-indennita-personalizzata" data-id="${esc(ip.id)}">
        <input type="text" class="nome-indennita-personalizzata" data-campo="nome" value="${esc(ip.nome)}" placeholder="Nome indennità (es. Vacanza contrattuale)">
        <div class="riga-indennita-controlli">
          <label>Importo (€)<input type="number" step="0.01" min="0" data-campo="valore" value="${esc(ip.valore)}"></label>
          <label>Tipo<select data-campo="unita">
            <option value="mese" ${ip.unita === 'turno' ? '' : 'selected'}>Fisso al mese</option>
            <option value="turno" ${ip.unita === 'turno' ? 'selected' : ''}>Per turno lavorato</option>
          </select></label>
          <button type="button" class="btn-rimuovi-indennita-personalizzata" data-rimuovi="${esc(ip.id)}" aria-label="Rimuovi ${esc(ip.nome)}" title="Rimuovi">🗑️</button>
        </div>
      </div>`).join('')
    : '<p class="sotto-titolo" style="padding:2px 0 10px;">Nessuna indennità personalizzata. Aggiungine una qui sotto (es. "Vacanza contrattuale").</p>';

  // IRPEF nazionale — 3 scaglioni. L'ultimo non ha una soglia "fino a" (si applica oltre la soglia precedente).
  const irpefDef = val(defs,'irpefScaglioni') || [];
  const bodyIrpef = irpefDef.map((sc,i,arr) => {
    const isLast = i === arr.length - 1;
    return (isLast ? '' : row(`Scaglione ${i+1} — fino a (€)`, `irpefScaglioni.${i}.fino`, '1')) +
      row(`Scaglione ${i+1} — aliquota (%)${isLast ? ' (oltre l\u2019ultima soglia)' : ''}`, `irpefScaglioni.${i}.aliquota`, '0.1');
  }).join('');

  // Addizionale regionale — mostriamo solo la regione impostata in Anagrafica, come per stipendio/qualifica.
  const datiRegione = val(defs, `regioniAddizionale.${regione}`);
  let bodyRegionale = '<p class="sotto-titolo" style="padding:2px 0 8px;">Imposta la regione in Anagrafica per modificarne l\u2019addizionale.</p>';
  if(datiRegione){
    if(datiRegione.tipo === 'unica'){
      bodyRegionale = row('Aliquota unica (%)', `regioniAddizionale.${regione}.valore`, '0.01');
    } else if(datiRegione.tipo === 'scaglioni'){
      bodyRegionale = datiRegione.scaglioni.map((sc,i,arr) => {
        const isLast = i === arr.length - 1;
        return (isLast ? '' : row(`Scaglione ${i+1} — fino a (€)`, `regioniAddizionale.${regione}.scaglioni.${i}.fino`, '1')) +
          row(`Scaglione ${i+1} — aliquota (%)${isLast ? ' (oltre l\u2019ultima soglia)' : ''}`, `regioniAddizionale.${regione}.scaglioni.${i}.aliquota`, '0.01');
      }).join('');
    }
  }

  el('corpoTabelle').innerHTML = `<div class="tabelle-v17"><div class="tabelle-hero-v17"><div><span class="tabella-eyebrow">CENTRO PARAMETRI</span><h3>Tabelle per ${esc(qualifica)}</h3><p>I valori ufficiali predefiniti sono già impostati correttamente per la tua qualifica e regione.</p></div><div class="tabella-hero-badge"><strong id="tabellaCountModificati">0</strong><small>modificati</small></div></div>
  <label class="switch-avanzate-v17">
    <input type="checkbox" id="toggleTabelleAvanzate" ${mostraTabelleAvanzate ? 'checked' : ''}>
    <span class="switch-avanzate-v17-testo"><strong>Mostra impostazioni avanzate</strong><small>Attivalo solo se hai bisogno di modificare manualmente stipendi, indennità, IRPEF o addizionali.</small></span>
  </label>
  ${mostraTabelleAvanzate ? `<div class="tabelle-toolbar-v17"><label class="tabella-search-v17"><span>⌕</span><input id="ricercaTabelle" type="search" placeholder="Cerca una voce…" autocomplete="off"></label><div class="tabella-filtri-v17" role="group" aria-label="Filtra tabelle"><button type="button" class="tabella-filtro-v17 attivo" data-table-filter="tutte">Tutte</button><button type="button" class="tabella-filtro-v17" data-table-filter="modificati">Modificate</button><button type="button" class="tabella-filtro-v17" data-table-filter="predefiniti">Predefinite</button></div></div><div class="tabella-notice-v17"><span>ⓘ</span><p><strong>Attenzione ai valori economici.</strong> I parametri modificati possono cambiare il netto stimato. Verifica sempre il cedolino ufficiale prima di usare i risultati.</p></div>${section('fisse','Voci fisse','💶','Stipendio e indennità pensionabile',bodyFisse)}${section('straordinario','Straordinario','⏱️','Tariffe orarie in vigore',bodyStra)}${section('straordinario27','Straordinario 2027','📅','Valori proiettati, non ancora in vigore',bodyStra27,'proiezione')}${section('assegno','Assegno di funzione','🎖️',`${NOMI_RUOLO[catRuolo]} — soglie di servizio`,bodyAssegno,catRuolo==='funz'?'attenzione':'')}${section('indennita','Indennità e trasferte','🚓','Servizi, missioni e accessorie',bodyInd)}${section('fiscale','Fiscale e previdenziale','🧾','Parametri utilizzati per la stima',bodyFisc)}${section('irpef','IRPEF nazionale','🧮','Scaglioni e aliquote — Legge di Bilancio',bodyIrpef)}${section('regionale','Addizionale regionale','🗺️',`${esc(regione)} — aggiorna quando cambia la delibera regionale`,bodyRegionale)}${section('buono','Buono pasto','🍽️','Valore informativo',bodyBuono)}${section('personalizzate','Indennità personalizzate','🎁','Voci libere non coperte dalle tabelle (es. Vacanza contrattuale)',bodyPersonalizzate + '<button type="button" class="btn-secondario" id="btnAggiungiIndennitaPersonalizzata" style="margin-top:10px;">+ Aggiungi indennità</button>')}<div class="tabelle-v17-footer"><button type="button" class="btn-secondario" id="btnResetTabelleV17">↺ Ripristina tutto</button><span>Le modifiche restano in memoria solo dopo <strong>Salva</strong>.</span></div>` : ''}</div>`;

  const toggleAvanzate = el('toggleTabelleAvanzate');
  if(toggleAvanzate) toggleAvanzate.addEventListener('change', () => {
    mostraTabelleAvanzate = toggleAvanzate.checked;
    renderTabelle();
  });
  const footerEsterno = el('footerTabelleEsterno');
  if(footerEsterno) footerEsterno.hidden = !mostraTabelleAvanzate;
  if(!mostraTabelleAvanzate) return; // il resto della funzione lavora solo sugli elementi delle sezioni avanzate, qui assenti

  const updateStatus=()=>{
    let changed=0;
    el('corpoTabelle').querySelectorAll('[data-table-row]').forEach(r=>{
      const input=r.querySelector('input[data-t]'); const def=val(defs,input.dataset.t); const is=def!==undefined && Number(input.value)!==Number(def);
      const badge=r.querySelector('.tabella-stato'); badge.className=`tabella-stato ${is?'modificato':'predefinito'}`; badge.textContent=is?'Modificato':'Predefinito'; r.dataset.state=is?'modificato':'predefinito'; if(is) changed++;
    }); el('tabellaCountModificati').textContent=changed;
  };
  el('corpoTabelle').querySelectorAll('.tabella-head-v17').forEach(b=>b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!open));b.nextElementSibling.hidden=open;b.querySelector('b').textContent=open?'⌄':'⌃';}));
  el('corpoTabelle').querySelectorAll('input[data-t]').forEach(i=>i.addEventListener('input',updateStatus));
  el('corpoTabelle').querySelectorAll('[data-reset-table]').forEach(b=>b.addEventListener('click',()=>{const d=val(defs,b.dataset.resetTable);if(d!==undefined){const i=el('corpoTabelle').querySelector(`input[data-t="${CSS.escape(b.dataset.resetTable)}"]`);if(i){i.value=d;updateStatus();}}}));
  el('corpoTabelle').querySelector('#ricercaTabelle').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();el('corpoTabelle').querySelectorAll('[data-table-row]').forEach(r=>r.classList.toggle('tabella-nascosta',q && !r.dataset.label.toLowerCase().includes(q)));});
  el('corpoTabelle').querySelectorAll('[data-table-filter]').forEach(b=>b.addEventListener('click',()=>{el('corpoTabelle').querySelectorAll('[data-table-filter]').forEach(x=>x.classList.remove('attivo'));b.classList.add('attivo');const f=b.dataset.tableFilter;el('corpoTabelle').querySelectorAll('[data-table-row]').forEach(r=>{const hide=f!=='tutte' && r.dataset.state!==(f==='modificati'?'modificato':'predefinito');r.classList.toggle('tabella-nascosta',hide);});}));
  el('btnResetTabelleV17').addEventListener('click',()=>{AppState.tabelle=clonaTabelleConSoglie(defs);renderTabelle();});

  // Indennità personalizzate: prima di aggiungere/rimuovere una voce, sincronizziamo dal DOM
  // le modifiche non ancora salvate alle altre righe, così un "+ Aggiungi" o "🗑️ Rimuovi" non
  // cancella per sbaglio ciò che si stava scrivendo in un'altra voce (stesso principio già
  // applicato altrove nell'app per evitare reset accidentali di caselle non ancora salvate).
  el('corpoTabelle').querySelectorAll('.btn-rimuovi-indennita-personalizzata').forEach(b => b.addEventListener('click', () => {
    leggiIndennitaPersonalizzateDalDom();
    AppState.indennitaPersonalizzate = AppState.indennitaPersonalizzate.filter(v => v.id !== b.dataset.rimuovi);
    salvaIndennitaPersonalizzateStorage();
    renderTabelle();
  }));
  const btnAggiungiIndennita = el('btnAggiungiIndennitaPersonalizzata');
  if(btnAggiungiIndennita) btnAggiungiIndennita.addEventListener('click', () => {
    leggiIndennitaPersonalizzateDalDom();
    AppState.indennitaPersonalizzate.push({ id: nuovoId(), nome: '', valore: 0, unita: 'mese' });
    salvaIndennitaPersonalizzateStorage();
    renderTabelle();
    const ultimoInput = el('corpoTabelle').querySelector('.riga-indennita-personalizzata:last-child .nome-indennita-personalizzata');
    if(ultimoInput) ultimoInput.focus();
  });

  updateStatus();
}

// Rilegge dal DOM i valori delle indennità personalizzate (nome/importo/tipo) e li riporta in
// AppState.indennitaPersonalizzate, senza però salvarli su storage — il salvataggio avviene
// insieme al resto delle Tabelle quando si preme "Salva", oppure subito prima di un
// aggiungi/rimuovi per non perdere modifiche in corso su altre righe.
function leggiIndennitaPersonalizzateDalDom(){
  const contenitore = el('corpoTabelle');
  if(!contenitore) return;
  contenitore.querySelectorAll('.riga-indennita-personalizzata').forEach(riga => {
    const voce = AppState.indennitaPersonalizzate.find(v => v.id === riga.dataset.id);
    if(!voce) return;
    const campoNome = riga.querySelector('[data-campo="nome"]');
    const campoValore = riga.querySelector('[data-campo="valore"]');
    const campoUnita = riga.querySelector('[data-campo="unita"]');
    voce.nome = (campoNome && campoNome.value.trim()) || 'Indennità personalizzata';
    voce.valore = Number(campoValore && campoValore.value) || 0;
    voce.unita = (campoUnita && campoUnita.value === 'turno') ? 'turno' : 'mese';
  });
}

function leggiTabelleDaModale(){
  el('corpoTabelle').querySelectorAll('input[data-t]').forEach(input => {
    const percorso = input.dataset.t.split('.');
    let ref = AppState.tabelle;
    for(let i = 0; i < percorso.length - 1; i++) ref = ref[percorso[i]];
    ref[percorso[percorso.length - 1]] = Number(input.value) || 0;
  });
  salvaTabelleStorage();
  leggiIndennitaPersonalizzateDalDom();
  salvaIndennitaPersonalizzateStorage();
}
