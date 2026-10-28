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
  // v2.98: etichetta corta con l'unità sotto, casella a destra, ↺ solo sui valori cambiati.
  const etichetta = label => {
    const m = label.match(/^(.*?)\s*\(([^()]*)\)\s*(\([^()]*\))?$/);
    let testo = m ? m[1] + (m[3] ? ' ' + m[3] : '') : label, unita = m ? m[2] : '';
    if(unita === '€' && /\b(annuo|annua)\b/.test(testo)) unita = 'all’anno';
    testo = testo.replace(/\s+(annuo|annua)\b/, '').replace(/ — /g, ' · ');
    return { testo, unita };
  };
  const row = (label, path, step='0.01', extra='') => {
    const current = val(t,path) ?? 0;
    const def = val(defs,path);
    const changed = def !== undefined && Number(current) !== Number(def);
    const e = etichetta(label);
    return `<div class="tabella-riga-v17 riga-valore-v5${changed?' mod':''}" data-table-row data-label="${esc(label)}" data-state="${changed?'modificato':'predefinito'}"><span class="tabella-label">${esc(e.testo)}${e.unita?`<small>${esc(e.unita)}</small>`:''}${extra?`<small class="nota-valore-v5">${esc(extra)}</small>`:''}</span><input data-t="${esc(path)}" type="number" step="${step}" value="${esc(current)}" inputmode="decimal" aria-label="${esc(label)}"><button type="button" class="tabella-reset-one" data-reset-table="${esc(path)}" title="Torna al valore ufficiale" aria-label="Torna al valore ufficiale" ${def===undefined?'disabled':''}>↺</button></div>`;
  };
  const section=(id,title,icon,subtitle,body,cls='')=>`<section class="tabella-gruppo-v17 gruppo-tabelle-v5 ${cls}" data-table-section="${id}"><button class="tabella-head-v17" type="button" aria-expanded="false"><span class="tabella-icon-v17">${icon}</span><span class="testo-gruppo-v5"><strong>${title}</strong><small>${String(subtitle).split(' — ')[0]}</small></span><em class="conta-mod-v5" hidden></em><b>⌄</b></button><div class="tabella-body-v17" hidden>${body}</div></section>`;
  const bodyFisse = row('Stipendio annuo — in vigore (€)',`stipendiAnnuiAttuale.${qualifica}`)+row('Stipendio annuo — proiettato 2027 (€)',`stipendiAnnui2027.${qualifica}`)+row('Indennità pensionabile annua — in vigore (€)',`indennitaPensionabileAnnuaAttuale.${qualifica}`)+row('Indennità pensionabile annua — proiettata 2027 (€)',`indennitaPensionabileAnnua2027.${qualifica}`)+row('Vacanza contrattuale — fino al rinnovo (%)',`vacanzaContrattualePct`,'0.1','Dello stipendio tabellare; non serve se l\'hai già tra le indennità personalizzate');
  const bodyStra = row('Diurno (€/h)',`straordinarioOrarioAttuale.${qualifica}.diurno`)+row('Notturno o festivo (€/h)',`straordinarioOrarioAttuale.${qualifica}.notturnoOFestivo`)+row('Notturno festivo (€/h)',`straordinarioOrarioAttuale.${qualifica}.notturnoFestivo`);
  const bodyStra27 = row('Diurno (€/h)',`straordinarioOrario2027.${qualifica}.diurno`)+row('Notturno o festivo (€/h)',`straordinarioOrario2027.${qualifica}.notturnoOFestivo`)+row('Notturno festivo (€/h)',`straordinarioOrario2027.${qualifica}.notturnoFestivo`);
  const bodyAssegno = row('Dopo 17 anni',`assegnoFunzioneAnnuo.${catRuolo}.soglia17`)+row('Dopo 27 anni',`assegnoFunzioneAnnuo.${catRuolo}.soglia27`)+row('Dopo 32 anni',`assegnoFunzioneAnnuo.${catRuolo}.soglia32`);
  const bodyInd = row('Turno notturno ordinario (€/h)',`indennitaTurnoNotturnoOraria`)+row('Presenza festiva/domenicale (€/turno)',`indennitaPresenzaFestivaTurno`)+row('Festività particolare (€/giorno)',`indennitaFestivitaParticolareGiorno`)+row('Compensazione riposo lavorato (€/giorno)',`indennitaCompensazioneRiposoLavorato`)+row('Ordine pubblico in sede (€/turno)',`indennitaOPInSede`)+row('Ordine pubblico fuori sede (€/turno)',`indennitaOPFuoriSede`)+row('Riduzione OP senza pernottamento (%)',`riduzioneOPSenzaPernottamento`,'1')+row('Servizio esterno (€/turno)',`indennitaServizioEsternoTurno`)+row('Controllo territorio serale (€/giorno)',`indennitaControlloTerritorioSeraleFlat`)+row('Controllo territorio notturno (€/giorno)',`indennitaControlloTerritorioNotturnoFlat`)+row('Reperibilità (€/turno)',`reperibilitaGiornaliera`)+row('Cambio turno (€/occorrenza)',`indennitaCambioTurno`)+row('Produttività collettiva (€/giorno)',`indennitaProduttivitaCollettiva`)+row('Missione — piena 4-8h (€/h)',`indennitaTrasfertaOraria`,'0.001')+row('Missione — ridotta oltre 8h (€/h)',`indennitaTrasfertaOrariaRidotta`,'0.001');
  const bodyFisc = row('Contributi previdenziali (%)',`aliquotaPrevidenziale`,'0.01','INPDAP 8,80 + Fondo credito 0,35, su tutte le competenze')+row('Opera di previdenza (%)',`operaPrevidenzaAliquota`,'0.01','Sulla parte fissa (2,5% su 80%)')+row('Maggiorazione figurativa base pensionabile (%)',`maggiorazioneFigurativaPct`,'0.1','15 se nel cedolino c\'è la riga "Magg. INPDAP", altrimenti 0')+row('Totale detrazioni da cedolino (€/mese)',`detrazioniMensiliCedolino`,'0.01','Facoltativo: il "Totale detrazioni" del tuo cedolino. 0 = stima di legge')+row('No-tax area annua (€)',`noTaxAreaAnnua`,'1')+row('Detrazione figlio over 21 (€/anno)',`detrazionePerFiglioOver21Annua`)+row('Trattamento integrativo (€/mese)',`trattamentoIntegrativoMensile`,'0.01','Solo con reddito fino a 15.000 €');
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

  // Addizionale comunale: a differenza di tutto il resto di questa scheda, non è un valore
  // "ufficiale" uguale per tutti — dipende dal Comune di residenza di ciascuno — quindi resta
  // salvata in Anagrafica (non tra le tabelle predefinite), solo il controllo per modificarla
  // vive qui fisicamente, vicino all'addizionale regionale a cui è concettualmente imparentata.
  const bodyComunale = `<div class="tabella-riga-v17 riga-valore-v5"><span class="tabella-label">Aliquota<small>%</small></span><input type="number" id="campoAddComunaleTabelle" step="0.01" min="0" inputmode="decimal" value="${esc(AppState.anagrafica?.addComunale ?? 0.8)}"><i class="vuoto-v5"></i></div>`;

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

  // v2.95: riquadro azzurro (qualifica, versione, modificati) e tre righe, come le altre pagine.
  const infoSito = (typeof applicaTabelleSito === 'function') ? applicaTabelleSito() : null;
  const dataSito = infoSito && infoSito.aggiornato ? new Date(infoSito.aggiornato + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '';
  el('corpoTabelle').innerHTML = `<div class="tabelle-v17"><div class="tabelle-hero-v4"><span class="tabelle-hero-ico" aria-hidden="true">📊</span><span class="tabelle-hero-testo"><b>${esc(qualifica)}${regione ? ' · ' + esc(regione) : ''}</b><small>${infoSito ? `Versione ${esc(infoSito.versione)}${dataSito ? ' del ' + esc(dataSito) : ''}${infoSito.fonte === 'sito' ? ' · aggiornate dal sito' : ''}` : 'Valori ufficiali predefiniti'}</small>${infoSito && infoSito.nota ? `<small>${esc(infoSito.nota)}</small>` : ''}</span><span class="tabella-hero-badge"><strong id="tabellaCountModificati">0</strong><small>modificati</small></span></div>
  <div class="lista-tabelle-v4">
    ${infoSito ? `<button type="button" class="riga-tabelle-v4" id="btnControllaTabelle"><span aria-hidden="true">🔄</span><i>Controlla aggiornamenti</i><b aria-hidden="true">›</b></button>
    <a class="riga-tabelle-v4" href="${URL_PAGINA_TABELLE}" target="_blank" rel="noopener"><span aria-hidden="true">🌐</span><i>Fonti e tabelle sul sito</i><b aria-hidden="true">↗</b></a>` : ''}
    <label class="riga-tabelle-v4 switch-avanzate-v17"><span aria-hidden="true">✏️</span><i>Modifica i valori a mano<small>Solo se il tuo cedolino è diverso</small></i>
      <input type="checkbox" class="interruttore" id="toggleTabelleAvanzate" ${mostraTabelleAvanzate ? 'checked' : ''}></label>
  </div>
  ${mostraTabelleAvanzate ? `<div class="tabelle-toolbar-v17 cerca-tabelle-v5"><label class="tabella-search-v17"><span aria-hidden="true">⌕</span><input id="ricercaTabelle" type="search" placeholder="Cerca una voce…" autocomplete="off"></label><button type="button" class="filtro-mod-v5" id="filtroModificateTabelle" aria-pressed="false">Solo modificate · <span id="contaFiltroModificate">0</span></button></div><div class="lista-gruppi-v5">${section('fisse','Voci fisse','💶','Stipendio e indennità pensionabile',bodyFisse)}${section('straordinario','Straordinario','⏱️','Tariffe orarie in vigore',bodyStra)}${section('straordinario27','Straordinario 2027','📅','Valori proiettati, non ancora in vigore',bodyStra27,'proiezione')}${section('assegno','Assegno di funzione','🎖️',`${NOMI_RUOLO[catRuolo]} — soglie di servizio`,bodyAssegno,catRuolo==='funz'?'attenzione':'')}${section('indennita','Indennità e trasferte','🚓','Servizi, missioni e accessorie',bodyInd)}${section('fiscale','Fiscale e previdenziale','🧾','Parametri utilizzati per la stima',bodyFisc)}${section('irpef','IRPEF nazionale','🧮','Scaglioni e aliquote — Legge di Bilancio',bodyIrpef)}${section('regionale','Addizionale regionale','🗺️',`${esc(regione)} — aggiorna quando cambia la delibera regionale`,bodyRegionale)}${section('comunale','Addizionale comunale','🏛️','Dipende dal tuo Comune di residenza',bodyComunale)}${section('personalizzate','Indennità personalizzate','🎁','Voci libere non coperte dalle tabelle (es. Vacanza contrattuale)',bodyPersonalizzate + '<button type="button" class="btn-secondario" id="btnAggiungiIndennitaPersonalizzata" style="margin-top:10px;">+ Aggiungi indennità</button>')}</div><div class="tabelle-v17-footer piede-tabelle-v5"><button type="button" id="btnResetTabelleV17">↺ Ripristina tutti i valori ufficiali</button><p>Le modifiche si salvano da sole e cambiano subito i calcoli.</p></div>` : ''}</div>`;

  const toggleAvanzate = el('toggleTabelleAvanzate');
  if(toggleAvanzate) toggleAvanzate.addEventListener('change', () => {
    mostraTabelleAvanzate = toggleAvanzate.checked;
    renderTabelle();
  });
  // Controlla aggiornamenti funziona anche con "Modifica i valori a mano" spento.
  on('btnControllaTabelle','click',()=>aggiornaTabelleDalSito({ forza: true, avvisaSeUguali: true }));
  const footerEsterno = el('footerTabelleEsterno');
  if(footerEsterno) footerEsterno.hidden = true;
  document.querySelectorAll('.nota-tabelle-v4').forEach(n => { n.hidden = mostraTabelleAvanzate; });
  if(!mostraTabelleAvanzate) return; // il resto della funzione lavora solo sugli elementi delle sezioni avanzate, qui assenti

  const updateStatus=()=>{
    let changed=0;
    el('corpoTabelle').querySelectorAll('[data-table-row]').forEach(r=>{
      const input=r.querySelector('input[data-t]'); const def=val(defs,input.dataset.t); const is=def!==undefined && Number(input.value)!==Number(def);
      r.classList.toggle('mod',is); r.dataset.state=is?'modificato':'predefinito'; if(is) changed++;
    });
    el('corpoTabelle').querySelectorAll('.gruppo-tabelle-v5').forEach(g=>{
      const n=g.querySelectorAll('[data-table-row].mod').length, em=g.querySelector('.conta-mod-v5');
      em.hidden=!n; em.textContent=n===1?'1 modificata':`${n} modificate`;
    });
    el('tabellaCountModificati').textContent=changed;
    el('contaFiltroModificate').textContent=changed;
  };
  el('corpoTabelle').querySelectorAll('.tabella-head-v17').forEach(b=>b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!open));b.nextElementSibling.hidden=open;b.querySelector('b').textContent=open?'⌄':'⌃';}));
  el('corpoTabelle').querySelectorAll('input[data-t]').forEach(i=>i.addEventListener('input',updateStatus));
  el('corpoTabelle').querySelectorAll('[data-reset-table]').forEach(b=>b.addEventListener('click',()=>{const d=val(defs,b.dataset.resetTable);if(d!==undefined){const i=el('corpoTabelle').querySelector(`input[data-t="${CSS.escape(b.dataset.resetTable)}"]`);if(i){i.value=d;updateStatus();leggiTabelleDaModale();segnaTabelleSalvate();}}}));
  el('corpoTabelle').querySelector('#ricercaTabelle').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();el('corpoTabelle').querySelectorAll('[data-table-row]').forEach(r=>r.classList.toggle('tabella-nascosta',q && !r.dataset.label.toLowerCase().includes(q)));});
  // "Solo modificate": mostra solo i valori cambiati, con i loro gruppi aperti.
  on('filtroModificateTabelle','click',()=>{
    const b=el('filtroModificateTabelle'), attivo=b.getAttribute('aria-pressed')!=='true';
    b.setAttribute('aria-pressed',String(attivo)); b.classList.toggle('attivo',attivo);
    el('corpoTabelle').querySelectorAll('[data-table-row]').forEach(r=>r.classList.toggle('tabella-nascosta',attivo && r.dataset.state!=='modificato'));
    el('corpoTabelle').querySelectorAll('.gruppo-tabelle-v5').forEach(g=>{
      const vuoto=attivo && !g.querySelector('[data-table-row].mod'); g.hidden=vuoto;
      const h=g.querySelector('.tabella-head-v17'); const apri=attivo && !vuoto;
      if(attivo){ h.setAttribute('aria-expanded',String(apri)); h.nextElementSibling.hidden=!apri; h.querySelector('b').textContent=apri?'⌃':'⌄'; }
    });
  });
  el('btnResetTabelleV17').addEventListener('click',()=>mostraConferma('Riportare tutte le tabelle ai valori ufficiali? Le tue modifiche si perdono.',()=>{AppState.tabelle=clonaTabelleConSoglie(defs);salvaTabelleStorage();renderTabelle();segnaTabelleSalvate();}));

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
  // Addizionale comunale: vive in AppState.anagrafica (è un dato personale, non una tabella
  // ufficiale), quindi si legge e si salva separatamente dal resto di questa scheda.
  const campoComunale = el('campoAddComunaleTabelle');
  if(campoComunale && AppState.anagrafica){
    if(Number(campoComunale.value) !== Number(AppState.anagrafica.addComunale) || AppState.anagrafica.addComunaleConfermata){ AppState.anagrafica.addComunale = Number(campoComunale.value) || 0; AppState.anagrafica.addComunaleConfermata = true; }
    salvaAnagraficaStorage();
  }
}

// Le Tabelle si salvano da sole: dopo ogni modifica un "✓ Salvato" in alto.
function segnaTabelleSalvate(){
  const stato = el('statoSalvataggioTabelle');
  if(stato) stato.innerHTML = '<span class="stato-attivo">✓ Salvato</span> · le modifiche si salvano da sole';
}
