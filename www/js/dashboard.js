'use strict';

/* FASE 2 — Dashboard mobile: riepilogo del mese visualizzato + oggi + prossimi giorni. */

function formatOreDashboard(n){
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function descrizioneTurnoDashboard(t){
  if(!t) return { titolo:'Nessun turno', dettaglio:'Giornata non ancora compilata', classe:'vuoto' };
  if(t.assenzaTipo){
    const voce = AppState.assenze.find(a => a.id === t.assenzaTipo);
    return { titolo: voce ? voce.nome : 'Assenza', dettaglio:'Assenza dal servizio', classe:'assenza' };
  }
  if(t.riposo) return { titolo:'Riposo', dettaglio:'Giornata di riposo', classe:'riposo' };
  if(t.oraInizio && t.oraFine){
    const c = classificaTurno(t);
    const categoria = categoriaTurno(t.oraInizio, t.oraFine, t.data);
    const nomi = { mattina:'Mattina', pomeriggio:'Pomeriggio', sera:'Sera', notte:'Notte' };
    const extra = [];
    if(t.servizioSvolto) extra.push(t.servizioSvolto);
    if(t.reperibilita) extra.push('Reperibilità');
    if(t.missione) extra.push('Missione');
    if(t.ordinePubblico) extra.push('Ordine pubblico');
    return {
      titolo: `${nomi[categoria] || 'Turno'} · ${t.oraInizio}–${t.oraFine}`,
      dettaglio: extra.length ? extra.slice(0,2).join(' · ') : `${formatOreDashboard(c.oreTotali)} ore`,
      classe: categoria || 'turno'
    };
  }
  return { titolo:'Turno incompleto', dettaglio:'Apri il giorno per completarlo', classe:'attenzione' };
}



function minutiDaOrario(ora){
  if(!ora || !/^\d{2}:\d{2}$/.test(ora)) return null;
  const [h,m] = ora.split(':').map(Number);
  return h*60+m;
}

function formatCountdownDashboard(minuti){
  const n = Math.max(0, Math.round(minuti));
  const h = Math.floor(n/60), m = n%60;
  if(h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
  return `${m} min`;
}

function turnoOperativoPerData(iso){
  const t = AppState.turni[iso];
  if(!t || t.riposo || t.assenzaTipo || !t.oraInizio || !t.oraFine) return null;
  return t;
}

function prossimoTurnoDashboard(){
  const base = new Date();
  for(let i=0;i<=60;i++){
    const d = new Date(base); d.setHours(0,0,0,0); d.setDate(d.getDate()+i);
    const iso = dataISO(d), t = turnoOperativoPerData(iso);
    if(t) return { iso, data:d, turno:t };
  }
  return null;
}

function renderOperativoDashboard(){
  const box = el('dashboardOperativoMain');
  if(!box) return;
  const now = new Date();
  const isoOggi = dataISO(now);
  const t = turnoOperativoPerData(isoOggi);
  const minutiOra = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;

  let stato = 'Nessun turno oggi', titolo = 'Giornata libera', dettaglio = 'Nessun turno lavorativo programmato', classe='libero', icona='✓';
  let prossimo = null;

  if(t){
    const start = minutiDaOrario(t.oraInizio), endBase = minutiDaOrario(t.oraFine);
    let end = endBase;
    if(end !== null && start !== null && end <= start) end += 24*60;
    let nowRel = minutiOra;
    if(end !== null && start !== null && end > 24*60 && nowRel < start) nowRel += 24*60;
    if(start !== null && end !== null && nowRel >= start && nowRel < end){
      const restante = end-nowRel;
      stato='IN SERVIZIO'; titolo=`Turno ${t.oraInizio}–${t.oraFine}`; dettaglio=`Fine turno tra ${formatCountdownDashboard(restante)}`; classe='in-servizio'; icona='●';
    } else if(start !== null && nowRel < start){
      const attesa = start-nowRel;
      stato='PROSSIMO TURNO'; titolo=`Inizio alle ${t.oraInizio}`; dettaglio=`Tra ${formatCountdownDashboard(attesa)}`; classe='in-arrivo'; icona='→';
    } else {
      stato='TURNO CONCLUSO'; titolo=`Turno ${t.oraInizio}–${t.oraFine}`; dettaglio='Per oggi hai terminato il servizio'; classe='concluso'; icona='✓';
    }
    const extra=[];
    if(t.servizioSvolto) extra.push(t.servizioSvolto);
    if(t.missione) extra.push('Missione');
    if(t.servizioEsterno) extra.push('Servizio esterno');
    if(t.reperibilita) extra.push('Reperibilità');
    if(t.ordinePubblico) extra.push('Ordine pubblico');
    if(t.controlloTerritorio) extra.push('Controllo territorio');
    if(extra.length) dettaglio += ` · ${extra.slice(0,2).join(' · ')}`;
  } else {
    prossimo = prossimoTurnoDashboard();
    if(prossimo){
      const diff = (prossimo.data - new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000;
      const quando = diff === 0 ? 'oggi' : diff === 1 ? 'domani' : prossimo.data.toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
      stato='PROSSIMO TURNO'; titolo=`${quando} · ${prossimo.turno.oraInizio}–${prossimo.turno.oraFine}`; dettaglio='Apri il calendario per vedere i dettagli'; classe='in-arrivo'; icona='→';
    } else {
      stato='CALENDARIO VUOTO'; titolo='Nessun turno programmato'; dettaglio='Aggiungi un turno dal calendario'; classe='libero'; icona='+';
    }
  }

  box.innerHTML=`<div class="dashboard-operativo-icon ${classe}">${icona}</div><div class="dashboard-operativo-copy"><span>${stato}</span><strong>${escapeHtml(titolo)}</strong><small>${escapeHtml(dettaglio)}</small></div>`;
  const mod = el('btnDashboardModificaOggi');
  const cal = el('btnDashboardCalendario');
  if(mod) mod.onclick=()=>{
    meseCorrente=now.getMonth(); annoCorrente=now.getFullYear(); giornoSelezionato=isoOggi; renderCalendario();
    const btn=el('btnApriModificaGiorno'); if(btn) btn.click();
  };
  if(cal) cal.onclick=()=>{
    meseCorrente=now.getMonth(); annoCorrente=now.getFullYear(); giornoSelezionato=isoOggi; renderCalendario();
    const area=el('calendarioGriglia'); if(area) area.scrollIntoView({behavior:'smooth',block:'center'});
  };
}

function aggiornaDashboard(){
  const titolo = el('dashboardTitolo');
  if(!titolo) return;
  titolo.textContent = `${NOMI_MESI[meseCorrente]} ${annoCorrente}`;

  const riepilogo = calcolaRiepilogoOreMese(annoCorrente, meseCorrente);
  const oreLavorate = Object.values(riepilogo.tot).reduce((sum,v) => sum + (Number(v)||0), 0);
  const stats = [
    ['Ore', formatOreDashboard(oreLavorate)],
    ['Presenze', String(riepilogo.giorniPresenzaEffettiva || 0)],
    ['Riposi', String(riepilogo.riposi || 0)],
    ['Straordinario', formatOreDashboard((riepilogo.tot.strDiurno||0)+(riepilogo.tot.strNotturno||0)+(riepilogo.tot.strFestivo||0)+(riepilogo.tot.strNotturnoFestivo||0))]
  ];
  el('dashboardStats').innerHTML = stats.map(([label,value]) => `<div class="dashboard-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');

  const oggi = new Date();
  const isoOggi = dataISO(oggi);
  const oggiInfo = descrizioneTurnoDashboard(AppState.turni[isoOggi]);
  el('dashboardOggiCard').innerHTML = `
    <div class="dashboard-today-icon">${oggiInfo.classe === 'vuoto' ? '＋' : oggiInfo.classe === 'riposo' ? 'R' : oggiInfo.classe === 'assenza' ? 'A' : '🕐'}</div>
    <div class="dashboard-today-content">
      <span class="dashboard-today-label">OGGI · ${oggi.getDate()} ${NOMI_MESI[oggi.getMonth()]}</span>
      <strong>${escapeHtml(oggiInfo.titolo)}</strong>
      <small>${escapeHtml(oggiInfo.dettaglio)}</small>
    </div>
    <button class="dashboard-open-day" id="btnDashboardApriOggi" type="button" aria-label="Apri oggi">›</button>`;

  const btnOggi = el('btnDashboardOggi');
  btnOggi.onclick = () => {
    meseCorrente = oggi.getMonth();
    annoCorrente = oggi.getFullYear();
    giornoSelezionato = isoOggi;
    renderCalendario();
  };
  el('btnDashboardApriOggi').onclick = btnOggi.onclick;
  renderOperativoDashboard();

  const lista = [];
  for(let i=1;i<=5;i++){
    const d = new Date(oggi);
    d.setDate(d.getDate()+i);
    const iso = dataISO(d);
    const info = descrizioneTurnoDashboard(AppState.turni[iso]);
    const giorno = d.toLocaleDateString('it-IT',{weekday:'short'}).replace('.','');
    lista.push(`<button class="dashboard-next-item ${info.classe}" type="button" data-dashboard-date="${iso}">
      <span class="dashboard-date"><b>${d.getDate()}</b><small>${giorno}</small></span>
      <span class="dashboard-next-info"><strong>${escapeHtml(info.titolo)}</strong><small>${escapeHtml(info.dettaglio)}</small></span>
      <span class="dashboard-chevron">›</span>
    </button>`);
  }
  el('dashboardProssimi').innerHTML = lista.join('');
  el('dashboardProssimi').querySelectorAll('[data-dashboard-date]').forEach(btn => btn.addEventListener('click', () => {
    const iso = btn.dataset.dashboardDate;
    const d = new Date(iso + 'T00:00:00');
    meseCorrente = d.getMonth();
    annoCorrente = d.getFullYear();
    giornoSelezionato = iso;
    renderCalendario();
  }));
}


function aggiornaRiepilogoVisualeMese(){
  const box = el('riepilogoMeseVisuale');
  if(!box) return;
  const statsEl = el('riepilogoMeseStats');
  const distribuzioneEl = el('riepilogoMeseDistribuzione');
  const extraEl = el('riepilogoMeseExtra');
  const periodoEl = el('riepilogoMesePeriodo');
  const giorniNelMese = new Date(annoCorrente, meseCorrente + 1, 0).getDate();
  let lavorati = 0, riposi = 0, assenze = 0, nonCompilati = 0;
  let ore = 0, straordinario = 0, missioni = 0, reperibilita = 0, esterno = 0, op = 0, festivi = 0;
  for(let g=1; g<=giorniNelMese; g++){
    const iso = dataISO(new Date(annoCorrente, meseCorrente, g));
    const t = AppState.turni[iso];
    if(!t){ nonCompilati++; continue; }
    if(t.assenzaTipo){ assenze++; continue; }
    if(t.riposo){ riposi++; continue; }
    if(t.oraInizio && t.oraFine){
      lavorati++;
      const c = classificaTurno(t);
      ore += Number(c.oreTotali || 0);
      straordinario += totaleStraordinario(c);
      if(t.missione) missioni++;
      if(t.reperibilita) reperibilita++;
      if(t.servizioEsterno) esterno++;
      if(t.ordinePubblico) op++;
      if((c.festive||0)+(c.notturneFestive||0)>0) festivi++;
    } else {
      nonCompilati++;
    }
  }
  const totaleOre = ore + straordinario;
  const stats = [
    ['🕐', formatOreDashboard(totaleOre), 'Ore totali', 'ore'],
    ['📅', String(lavorati), 'Turni', 'turni'],
    ['⏱', formatOreDashboard(straordinario), 'Straordinario', 'straordinario'],
    ['💤', String(riposi), 'Riposi', 'riposi'],
    ['A', String(assenze), 'Assenze', 'assenze'],
    ['◆', String(missioni), 'Missioni', 'missioni']
  ];
  statsEl.innerHTML = stats.map(([ic,val,label,cl]) => `<div class="riepilogo-mese-stat ${cl}"><span class="riepilogo-mese-stat-icon">${ic}</span><strong>${escapeHtml(val)}</strong><small>${escapeHtml(label)}</small></div>`).join('');

  const totale = Math.max(giorniNelMese,1);
  const pct = n => Math.round((n/totale)*100);
  distribuzioneEl.innerHTML = `
    <div class="riepilogo-barra-head"><strong>Distribuzione giornate</strong><span>${giorniNelMese} giorni</span></div>
    <div class="riepilogo-barra" role="img" aria-label="${lavorati} turni, ${riposi} riposi, ${assenze} assenze, ${nonCompilati} non compilati">
      <span class="barra-turni" style="width:${pct(lavorati)}%"></span>
      <span class="barra-riposi" style="width:${pct(riposi)}%"></span>
      <span class="barra-assenze" style="width:${pct(assenze)}%"></span>
      <span class="barra-vuoti" style="width:${pct(nonCompilati)}%"></span>
    </div>
    <div class="riepilogo-legenda">
      <span><i class="dot dot-turni"></i>Turni ${lavorati}</span>
      <span><i class="dot dot-riposi"></i>Riposi ${riposi}</span>
      <span><i class="dot dot-assenze"></i>Assenze ${assenze}</span>
      <span><i class="dot dot-vuoti"></i>Da compilare ${nonCompilati}</span>
    </div>`;

  const extra = [
    ['Missioni', missioni], ['Reperibilità', reperibilita], ['Esterno', esterno], ['Ordine pubblico', op], ['Festivi lavorati', festivi]
  ];
  extraEl.innerHTML = `<div class="riepilogo-extra-head"><strong>Servizi ed eventi</strong><span>${ore ? `${formatOreDashboard(ore)} ore ordinarie` : 'Nessuna ora registrata'}</span></div><div class="riepilogo-extra-grid">${extra.map(([label,val]) => `<div><span>${escapeHtml(label)}</span><strong>${val}</strong></div>`).join('')}</div>`;
  periodoEl.textContent = `${NOMI_MESI[meseCorrente]} ${annoCorrente}`;
}

if(!window.__dashboardTimer){ window.__dashboardTimer=setInterval(()=>{ if(typeof renderOperativoDashboard==='function') renderOperativoDashboard(); }, 60000); }
