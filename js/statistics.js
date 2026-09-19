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
  // Un unico riepilogo annuale, invece di due pannelli separati con la stessa natura di dato
  // (entrambi totali sull'anno) — meno blocchi da scorrere, stessa informazione.
  const cards=[['🕐',oreFmt(s.ore),'Ore lavorate'],['📅',s.turni,'Giornate lavorate'],['⏱️',oreFmt(s.straordinario),'Straordinario'],['🗂️',s.assenze,'Assenze'],['🚓',s.missioni,'Missioni'],['💶',euroFmt(s.netto),'Netto registrato'],['💤',s.riposi,'Riposi'],['🛰️',s.reperibilita,'Reperibilità'],['🚗',s.servizioEsterno,'Servizio esterno'],['🛡️',s.ordinePubblico,'Ordine pubblico'],['💶',euroFmt(s.lordo),'Lordo registrato']];
  // I 3 andamenti mese-per-mese (Ore/Straordinario/Netto) ripetevano gli stessi 12 mesi tre
  // volte una sotto l'altra, più una tabella che li ripeteva una quarta volta: un solo grafico
  // con un selettore per cambiare vista mostra la stessa informazione senza la ripetizione.
  const maxOre=Math.max(...s.mesi.map(x=>x.ore),1), maxNet=Math.max(...s.mesi.map(x=>x.netto),1), maxStra=Math.max(...s.mesi.map(x=>x.straordinario),1);
  const righeOre=s.mesi.map(x=>`<div class="stat-v-row"><span>${NOMI_MESI[x.mese-1].slice(0,3)}</span><div class="stat-v-track"><div class="stat-v-fill" style="width:${x.ore?Math.max(3,x.ore/maxOre*100):0}%"></div></div><b>${x.ore?oreFmt(x.ore):'—'}</b></div>`).join('');
  const righeNet=s.mesi.map(x=>`<div class="stat-v-row"><span>${NOMI_MESI[x.mese-1].slice(0,3)}</span><div class="stat-v-track"><div class="stat-v-fill stat-netto" style="width:${x.netto?Math.max(3,x.netto/maxNet*100):0}%"></div></div><b>${x.netto?euroFmt(x.netto):'—'}</b></div>`).join('');
  const righeStra=s.mesi.map(x=>`<div class="stat-v-row"><span>${NOMI_MESI[x.mese-1].slice(0,3)}</span><div class="stat-v-track"><div class="stat-v-fill stat-stra" style="width:${x.straordinario?Math.max(3,x.straordinario/maxStra*100):0}%"></div></div><b>${x.straordinario?oreFmt(x.straordinario):'—'}</b></div>`).join('');
  host.innerHTML=`<div class="stat-v17">
    <div class="stat-cards-v17">${cards.map(x=>`<div class="stat-card"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('')}</div>
    ${!haDati?'<div class="stat-empty">📊 <strong>Nessun dato disponibile</strong><span>Inserisci turni o genera un cedolino per vedere le statistiche.</span></div>':''}
    <div class="stat-panel-v17">
      <div class="stat-switch-v17" role="group" aria-label="Scegli il grafico mensile">
        <button type="button" class="stat-switch-btn attivo" data-stat-grafico="ore">🕐 Ore</button>
        <button type="button" class="stat-switch-btn" data-stat-grafico="straordinario">⏱️ Straordinario</button>
        <button type="button" class="stat-switch-btn" data-stat-grafico="netto">💶 Netto</button>
      </div>
      <div data-stat-corpo="ore">${righeOre}</div>
      <div data-stat-corpo="straordinario" hidden>${righeStra}</div>
      <div data-stat-corpo="netto" hidden>${righeNet}</div>
    </div>
  </div>`;
  host.querySelectorAll('[data-stat-grafico]').forEach(btn => btn.addEventListener('click', () => {
    host.querySelectorAll('[data-stat-grafico]').forEach(b => b.classList.toggle('attivo', b === btn));
    host.querySelectorAll('[data-stat-corpo]').forEach(c => { c.hidden = (c.dataset.statCorpo !== btn.dataset.statGrafico); });
  }));
}
