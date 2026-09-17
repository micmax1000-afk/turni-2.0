/* Statistiche — calcolo reale a partire da AppState */
'use strict';

function statisticheAnno(anno){
  const out={mesi:[],ore:0,turni:0,riposi:0,assenze:0,straordinario:0,missioni:0,reperibilita:0,servizioEsterno:0,ordinePubblico:0,netto:0,lordo:0};
  for(let m=0;m<12;m++){
    const mm=String(m+1).padStart(2,'0');
    const prefix=`${anno}-${mm}-`;
    const r=typeof calcolaRiepilogoOreMese==='function'?calcolaRiepilogoOreMese(anno,m):null;
    const tot=r?.tot||{};
    const ore=Object.values(tot).reduce((s,v)=>s+(Number(v)||0),0);
    const stra=['strDiurno','strNotturno','strFestivo','strNotturnoFestivo'].reduce((s,k)=>s+(Number(tot[k])||0),0);
    const key=`${anno}-${mm}`;
    const st=AppState.storico?.[key]||{};
    const giorni=Object.entries(AppState.turni||{}).filter(([d])=>d.startsWith(prefix)).map(([,t])=>t||{});
    const ass=giorni.filter(t=>!!(t.assenzaTipo||t.assenza||t.tipoAssenza)).length;
    const rip=giorni.filter(t=>t.riposo===true||t.tipo==='riposo'||t.modello==='riposo').length;
    const lavorati=giorni.filter(t=>!t.assenzaTipo && !t.assenza && !t.tipoAssenza && !t.riposo && t.oraInizio && t.oraFine).length;
    const missioni=giorni.filter(t=>t.missione).length;
    const rep=giorni.filter(t=>t.reperibilita).length;
    const ext=giorni.filter(t=>t.servizioEsterno).length;
    const op=giorni.filter(t=>t.ordinePubblico).length;
    const voce={mese:m+1,ore,straordinario:stra,turni:lavorati,riposi:rip,assenze:ass,missioni,reperibilita:rep,servizioEsterno:ext,ordinePubblico:op,netto:Number(st.netto)||0,lordo:Number(st.totaleLordo)||0};
    out.mesi.push(voce);
    ['ore','straordinario','turni','riposi','assenze','missioni','reperibilita','servizioEsterno','ordinePubblico','netto','lordo'].forEach(k=>out[k]+=voce[k]);
  }
  return out;
}

function renderStatistiche(){
  const host=el('contenitoreStatistiche');
  if(!host) return;
  const anno=Number(el('campoAnnoStatistiche')?.value)||new Date().getFullYear();
  const s=statisticheAnno(anno);
  const haDati=s.mesi.some(x=>x.ore||x.turni||x.assenze||x.netto||x.lordo);
  const euroFmt=v=>typeof euro==='function'?euro(v):`${Number(v||0).toFixed(2)} €`;
  const oreFmt=v=>typeof formatOreDashboard==='function'?formatOreDashboard(v):`${Number(v||0).toFixed(1)} h`;
  const cards=[['🕐',oreFmt(s.ore),'Ore lavorate'],['📅',s.turni,'Giornate lavorate'],['⏱️',oreFmt(s.straordinario),'Straordinario'],['🗂️',s.assenze,'Assenze'],['🚓',s.missioni,'Missioni'],['💶',euroFmt(s.netto),'Netto registrato']];
  const maxOre=Math.max(...s.mesi.map(x=>x.ore),1), maxNet=Math.max(...s.mesi.map(x=>x.netto),1), maxStra=Math.max(...s.mesi.map(x=>x.straordinario),1);
  const righeOre=s.mesi.map(x=>`<div class="stat-v-row"><span>${NOMI_MESI[x.mese-1].slice(0,3)}</span><div class="stat-v-track"><div class="stat-v-fill" style="width:${x.ore?Math.max(3,x.ore/maxOre*100):0}%"></div></div><b>${x.ore?oreFmt(x.ore):'—'}</b></div>`).join('');
  const righeNet=s.mesi.map(x=>`<div class="stat-v-row"><span>${NOMI_MESI[x.mese-1].slice(0,3)}</span><div class="stat-v-track"><div class="stat-v-fill stat-netto" style="width:${x.netto?Math.max(3,x.netto/maxNet*100):0}%"></div></div><b>${x.netto?euroFmt(x.netto):'—'}</b></div>`).join('');
  const righeStra=s.mesi.map(x=>`<div class="stat-v-row"><span>${NOMI_MESI[x.mese-1].slice(0,3)}</span><div class="stat-v-track"><div class="stat-v-fill stat-stra" style="width:${x.straordinario?Math.max(3,x.straordinario/maxStra*100):0}%"></div></div><b>${x.straordinario?oreFmt(x.straordinario):'—'}</b></div>`).join('');
  host.innerHTML=`<div class="stat-v17">
    <div class="stat-cards-v17">${cards.map(x=>`<div class="stat-card"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('')}</div>
    ${!haDati?'<div class="stat-empty">📊 <strong>Nessun dato disponibile</strong><span>Inserisci turni o genera un cedolino per vedere le statistiche.</span></div>':''}
    <div class="stat-panel-v17"><h3>🕐 Ore lavorate</h3>${righeOre}</div>
    <div class="stat-panel-v17"><h3>⏱️ Straordinario per mese</h3>${righeStra}</div>
    <div class="stat-panel-v17"><h3>💶 Netto registrato</h3>${righeNet}</div>
    <div class="stat-panel-v17 stat-dettagli"><h3>Riepilogo</h3><div><span>💤 Riposi</span><strong>${s.riposi}</strong></div><div><span>🛰️ Reperibilità</span><strong>${s.reperibilita}</strong></div><div><span>🚗 Servizio esterno</span><strong>${s.servizioEsterno}</strong></div><div><span>🛡️ Ordine pubblico</span><strong>${s.ordinePubblico}</strong></div><div><span>💶 Lordo registrato</span><strong>${euroFmt(s.lordo)}</strong></div></div>
    <div class="stat-panel-v17"><h3>📋 Dettaglio mensile</h3><div class="stat-tabella-scroll"><table class="stat-tabella"><thead><tr><th>Mese</th><th>Ore</th><th>Turni</th><th>Assenze</th><th>Str.</th><th>Netto</th></tr></thead><tbody>${s.mesi.map(x=>`<tr><td>${NOMI_MESI[x.mese-1]}</td><td>${x.ore?oreFmt(x.ore):'—'}</td><td>${x.turni||'—'}</td><td>${x.assenze||'—'}</td><td>${x.straordinario?oreFmt(x.straordinario):'—'}</td><td>${x.netto?euroFmt(x.netto):'—'}</td></tr>`).join('')}</tbody></table></div></div>
  </div>`;
}
