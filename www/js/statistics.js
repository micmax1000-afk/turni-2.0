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
    const voce={mese:m+1,ore,straordinario:stra,turni:lavorati,riposi:rip,assenze:ass,missioni,reperibilita:rep,servizioEsterno:ext,ordinePubblico:op,netto:0,lordo:0};
    // Netto e lordo si calcolano da soli per ogni mese con turni inseriti (stesso calcolo del
    // cedolino), senza dover premere "Genera cedolino"; senza turni resta il valore salvato, se c'è.
    if(giorni.length && typeof generaCedolino==='function'){ const c=generaCedolino(anno,m); voce.netto=Number(c.netto)||0; voce.lordo=Number(c.comp.totaleLordo)||0; }
    else { voce.netto=Number(st.netto)||0; voce.lordo=Number(st.totaleLordo)||0; }
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
  const etichettaAnno=el('annoStatEtichetta'); if(etichettaAnno) etichettaAnno.textContent=anno;
  const haDati=s.mesi.some(x=>x.ore||x.turni||x.assenze||x.netto||x.lordo);
  const euroFmt=v=>typeof euro==='function'?euro(v):`${Number(v||0).toFixed(2)} €`;
  const oreFmt=v=>typeof formatOreDashboard==='function'?formatOreDashboard(v):`${Number(v||0).toFixed(1)} h`;
  // v3.8.6: stesso stile del Report — riquadro blu con il netto dell'anno, quattro caselle, righe con le icone.
  const tasse=Math.max(0,s.lordo-s.netto);
  const mesiConDati=s.mesi.filter(x=>x.netto>0).length;
  const ic=k=>typeof iconaIndennita==='function'?iconaIndennita(k):'';
  const gg=n=>`${n} ${n===1?'giorno':'giorni'}`;
  const righe=[[ic('servizioEsterno'),'Servizio esterno',s.servizioEsterno],[ic('ordinePubblico'),'Ordine pubblico',s.ordinePubblico],[ic('reperibilita'),'Reperibilità',s.reperibilita],[ic('missione'),'Missioni',s.missioni],['<span class="stat-ic-testo">🗂️</span>','Assenze',s.assenze]].filter(x=>x[2]>0);
  const maxOre=Math.max(...s.mesi.map(x=>x.ore),1), maxNet=Math.max(...s.mesi.map(x=>x.netto),1), maxStra=Math.max(...s.mesi.map(x=>x.straordinario),1);
  const barre=(campo,max,fmt,cls)=>s.mesi.map(x=>`<div class="stat-v-row"><span>${NOMI_MESI[x.mese-1].slice(0,3)}</span><div class="stat-v-track"><div class="stat-v-fill ${cls}" style="width:${x[campo]?Math.max(3,x[campo]/max*100):0}%"></div></div><b>${x[campo]?fmt(x[campo]):'—'}</b></div>`).join('');
  host.innerHTML=`<div class="stat-v17 stat-v5">
    ${!haDati?'<div class="stat-empty">📊 <strong>Nessun dato disponibile</strong><span>Inserisci i turni per vedere le statistiche.</span></div>':`
    <div class="report-hero stat-hero-v5">
      <div class="report-hero-et">💶 Netto del ${anno} <span class="report-hero-stima">stima</span></div>
      <div class="report-hero-cifra">${euroFmt(s.netto)}</div>
      <div class="report-hero-righe">
        <div><span>Lordo</span><b>${euroFmt(s.lordo)}</b></div>
        <div class="meno"><span>Tasse</span><b>−${euroFmt(tasse)}</b></div>
      </div>
      <div class="report-hero-spiega">Somma dei ${mesiConDati} ${mesiConDati===1?'mese lavorato':'mesi lavorati'} del ${anno}</div>
    </div>
    <div class="mese-tiles mese-tiles-4">
      <div><b>${s.turni}</b><span>turni</span></div>
      <div><b>${s.riposi}</b><span>riposi</span></div>
      <div><b>${formatOreMinuti(s.ore)}</b><span>ore</span></div>
      <div><b>${formatOreMinuti(s.straordinario)}</b><span>straord.</span></div>
    </div>
    ${righe.length?`<div class="mese-gruppo-v3 mese-ind-box-v4"><h3>Nell'anno</h3>${righe.map(([i,n,v])=>`<div class="mese-riga-v3 stat-riga-v5"><span class="mese-ind-icona">${i}</span><span>${n}</span><b>${gg(v)}</b></div>`).join('')}</div>`:''}
    <div class="mese-gruppo-v3 mese-ind-box-v4 stat-mesi-v5"><h3>Mese per mese</h3>
      <div class="stat-switch-v17" role="group" aria-label="Scegli il grafico mensile">
        <button type="button" class="stat-switch-btn attivo" data-stat-grafico="ore">Ore</button>
        <button type="button" class="stat-switch-btn" data-stat-grafico="straordinario">Straordinario</button>
        <button type="button" class="stat-switch-btn" data-stat-grafico="netto">Netto</button>
      </div>
      <div data-stat-corpo="ore">${barre('ore',maxOre,oreFmt,'')}</div>
      <div data-stat-corpo="straordinario" hidden>${barre('straordinario',maxStra,oreFmt,'stat-stra')}</div>
      <div data-stat-corpo="netto" hidden>${barre('netto',maxNet,euroFmt,'stat-netto')}</div>
    </div>`}
  </div>`;
  host.querySelectorAll('[data-stat-grafico]').forEach(btn => btn.addEventListener('click', () => {
    host.querySelectorAll('[data-stat-grafico]').forEach(b => b.classList.toggle('attivo', b === btn));
    host.querySelectorAll('[data-stat-corpo]').forEach(c => { c.hidden = (c.dataset.statCorpo !== btn.dataset.statGrafico); });
  }));
}
