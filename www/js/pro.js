/* Versione Pro (acquisto unico su Google Play) e "Offrimi un caffè".
   Gratis restano calendario, turni, ore e indennità del mese, quanto arriva sul conto, assenze ed eventi.
   Con la Pro: cedolino completo, statistiche dell'anno, backup su Drive, promemoria del turno e widget,
   "Suona anche in silenzioso". Chi aveva già comprato il backup Drive da 1,99 € ha la Pro. */
'use strict';

// Chi usava già l'app prima della Pro (ci sono turni salvati) la riceve in regalo: si controlla una volta sola.
function controllaRegaloPro(){
  if(TurniPSStorage.getItem(CHIAVE_PRO_REGALO) !== null) return;
  let usata = false;
  try{ const t = JSON.parse(TurniPSStorage.getItem('simCedolino_turni_v1') || '{}'); usata = !!(t && Object.keys(t).length); }catch(e){}
  TurniPSStorage.setItem(CHIAVE_PRO_REGALO, usata ? '1' : '0');
}
function proAttivo(){
  controllaRegaloPro();
  return TurniPSStorage.getItem(CHIAVE_PRO_ATTIVO) === '1'
    || TurniPSStorage.getItem(CHIAVE_PRO_REGALO) === '1'
    || TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO) === '1';
}

function apriPaginaPro(){
  aggiornaInterfacciaPro();
  el('overlayPro').hidden = false;
  el('overlayPro').scrollTop = 0;
}
function chiudiPaginaPro(){ el('overlayPro').hidden = true; }

const BADGE_PRO = '<em class="badge-pro">PRO</em>';
// Etichette PRO, pagina Pro e riga in Altro: tutto in base a proAttivo().
function aggiornaInterfacciaPro(){
  const pro = proAttivo();
  document.querySelectorAll('[data-badge-pro]').forEach(n => {
    const b = n.querySelector('.badge-pro');
    if(pro && b) b.remove();
    if(!pro && !b) n.insertAdjacentHTML('beforeend', BADGE_PRO);
  });
  const o = el('overlayPro');
  if(o){
    o.classList.toggle('pro-attiva', pro);
    el('titoloPaginaPro').textContent = pro ? 'Pro attiva' : 'Turni & Accessorio Pro';
    el('sottoPaginaPro').textContent = pro ? 'Grazie! Hai tutte le funzioni.' : 'Un solo acquisto, tuo per sempre. Nessun abbonamento.';
  }
  const riga = el('riassuntoProAltro');
  if(riga) riga.textContent = pro ? 'Attiva ✓ — grazie!' : 'Cedolino, statistiche, backup e altro';
  if(typeof renderSezioneBackupDrive === 'function') renderSezioneBackupDrive();
  aggiornaRigheBenvenutoPro();
}
// Nel primo avvio, promemoria del turno e widget si mostrano solo a chi ha la Pro.
function aggiornaRigheBenvenutoPro(){
  const pro = proAttivo();
  ['benvenutoPromemoria', 'benvenutoWidget'].forEach(id => { const r = el(id) && el(id).closest('label'); if(r) r.hidden = !pro; });
}

// Interruttori Pro: senza la Pro, accenderli apre la pagina Pro (spegnerli si può sempre).
function bloccaSenzaPro(id){
  const c = el(id);
  if(!c) return;
  c.addEventListener('click', e => {
    if(!c.checked || proAttivo()) return;
    e.preventDefault();
    c.checked = false;
    apriPaginaPro();
  });
}

function inizializzaPro(){
  on('btnChiudiPro', 'click', chiudiPaginaPro);
  on('btnAcquistaPro', 'click', () => acquistaProdotto(PLAY_PRODUCT_ID_PRO));
  on('btnOffriCaffePro', 'click', () => acquistaProdotto(PLAY_PRODUCT_ID_CAFFE));
  on('btnOffriCaffeAltro', 'click', () => acquistaProdotto(PLAY_PRODUCT_ID_CAFFE));
  on('btnApriProAltro', 'click', apriPaginaPro);
  on('btnRipristinaPro', 'click', async () => {
    if(!pluginAcquistiNativo()){ mostraAvviso('Gli acquisti si ripristinano dall\'app Android installata dal Play Store.'); return; }
    await verificaAcquistoBackupDrive();
    aggiornaInterfacciaPro();
    mostraToast(proAttivo() ? '⭐ Pro ripristinata' : 'Nessun acquisto Pro trovato su questo account Google', proAttivo() ? 'successo' : 'avviso');
  });
  ['campoPromemoriaTurno', 'campoWidget', 'campoEventoAvvisoForte'].forEach(bloccaSenzaPro);
  aggiornaInterfacciaPro();
}
