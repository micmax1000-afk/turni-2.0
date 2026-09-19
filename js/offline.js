'use strict';
/* V23 — Stato connessione e supporto offline. Nessun dato personale viene inviato. */
const OFFLINE_KEY = 'turnips_offline_v23';
function statoOffline(){ return { online: navigator.onLine !== false, aggiornato: new Date().toISOString() }; }
function renderStatoConnessione(){
  const host=document.getElementById('statoConnessioneV23'); if(!host) return;
  const online=navigator.onLine !== false;
  host.className=`stato-connessione-v23 ${online?'online':'offline'}`;
  host.innerHTML=`<span class="stato-connessione-dot" aria-hidden="true"></span>`;
  host.title=online?'Connessione disponibile':'Sei offline: i dati locali restano disponibili';
  host.setAttribute('aria-label',online?'Connessione online':'Modalità offline');
}
function mostraPaginaOffline(){
  const p=document.getElementById('paginaOfflineV23'); if(!p) return;
  p.hidden=false; setTimeout(()=>p.classList.add('visibile'),10);
}
function nascondiPaginaOffline(){
  const p=document.getElementById('paginaOfflineV23'); if(!p) return;
  p.classList.remove('visibile'); setTimeout(()=>p.hidden=true,180);
}
function inizializzaOffline(){
  renderStatoConnessione();
  window.addEventListener('online',()=>{ renderStatoConnessione(); if(typeof mostraToast==='function') mostraToast('Connessione ripristinata: i dati si sincronizzano di nuovo.','successo'); nascondiPaginaOffline(); });
  window.addEventListener('offline',()=>{ renderStatoConnessione(); if(typeof mostraToast==='function') mostraToast('Modalità offline: i dati locali restano disponibili.','info'); mostraPaginaOffline(); });
  window.addEventListener('beforeinstallprompt',e=>{ window._turniInstallPrompt=e; const b=document.getElementById('btnInstallaAppV23'); if(b) b.hidden=false; });
  const b=document.getElementById('btnInstallaAppV23');
  b?.addEventListener('click',async()=>{ if(!window._turniInstallPrompt) return; window._turniInstallPrompt.prompt(); try{ await window._turniInstallPrompt.userChoice; }catch(e){} window._turniInstallPrompt=null; b.hidden=true; });
}
window.renderStatoConnessione=renderStatoConnessione;
window.inizializzaOffline=inizializzaOffline;
