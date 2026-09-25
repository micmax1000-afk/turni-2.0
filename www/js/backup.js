/* FASE 1 — modulo estratto dal precedente script.js. */

// Salva/condivide un file di testo: dentro l'app Android usa i moduli nativi (Filesystem +
// finestra di condivisione), perché il download del browser (link con "download") non fa nulla
// dentro una WebView — non c'è un vero gestore dei download in ascolto. Sul sito normale (o in
// un browser qualsiasi) resta invece il download classico, invariato.
async function salvaOCondividiFile(nomeFile, contenutoTesto, tipoMime){
  const nativo = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if(nativo && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem){
    try{
      const { Filesystem } = window.Capacitor.Plugins;
      await Filesystem.writeFile({ path: nomeFile, data: contenutoTesto, directory: 'CACHE', encoding: 'utf8' });
      const risultato = await Filesystem.getUri({ path: nomeFile, directory: 'CACHE' });
      if(window.Capacitor.Plugins.Share){
        await window.Capacitor.Plugins.Share.share({ title: nomeFile, url: risultato.uri, dialogTitle: 'Salva o condividi il file' });
      }
      return true;
    }catch(e){
      console.warn('Salvataggio nativo non riuscito, provo il metodo del browser:', e);
      // continua sotto con il metodo del browser, come ripiego
    }
  }
  const blob = new Blob([contenutoTesto], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function aggiornaStatoBackup(){
  const box = el('statoBackup');
  if(!box) return;
  const dataStr = TurniPSStorage.getItem(CHIAVE_ULTIMO_BACKUP);
  const cEDati = Object.keys(AppState.turni).length > 0;
  if(!dataStr){
    box.innerHTML = cEDati
      ? '⚠ Non hai ancora fatto nessun backup. Esportane uno per non rischiare di perdere i tuoi dati.'
      : 'Nessun backup ancora effettuato.';
    box.className = cEDati ? 'sotto-titolo avviso-backup' : 'sotto-titolo';
    return;
  }
  const giorni = Math.floor((new Date() - new Date(dataStr)) / 86400000);
  const dataFormattata = formattaDataBreve(dataStr.slice(0, 10));
  if(giorni >= 14){
    box.innerHTML = `⚠ Ultimo backup: ${dataFormattata} (${giorni} giorni fa). Ti conviene farne uno nuovo.`;
    box.className = 'sotto-titolo avviso-backup';
  } else {
    box.innerHTML = `✓ Ultimo backup: ${dataFormattata} (${giorni === 0 ? 'oggi' : giorni === 1 ? '1 giorno fa' : giorni + ' giorni fa'}).`;
    box.className = 'sotto-titolo';
  }
}

async function esportaBackup(){
  const dati = {
    versioneBackup: 1,
    dataEsportazione: new Date().toISOString(),
    anagrafica: AppState.anagrafica,
    turni: AppState.turni,
    tabelle: AppState.tabelle,
    conguagliPerMese: AppState.conguagliPerMese,
    storico: AppState.storico,
    assenze: AppState.assenze,
    sequenzaTurni: AppState.sequenzaTurni,
    noteGiorni: AppState.noteGiorni,
    modelliTurno: AppState.modelliTurno,
    pattern: AppState.pattern,
    eventiGiorno: AppState.eventiGiorno,
    sequenzaAncora: TurniPSStorage.getItem(CHIAVE_SEQUENZA_ANCORA) || null
  };
  // coloriTurni: solo nel backup Drive a pagamento (costruisciDatiBackup) e export colori dedicato
  await salvaOCondividiFile(`backup-simulatore-cedolino-${dataISO(new Date())}.json`, JSON.stringify(dati, null, 2), 'application/json');
  TurniPSStorage.setItem(CHIAVE_ULTIMO_BACKUP, new Date().toISOString());
  aggiornaStatoBackup();
  if(typeof mostraToast === 'function') mostraToast('Backup esportato correttamente. Conserva il file anche fuori dal telefono.', 'successo');
}

function costruisciDatiBackup(){
  return {
    versioneBackup: 1,
    dataEsportazione: new Date().toISOString(),
    anagrafica: AppState.anagrafica,
    turni: AppState.turni,
    tabelle: AppState.tabelle,
    conguagliPerMese: AppState.conguagliPerMese,
    storico: AppState.storico,
    assenze: AppState.assenze,
    sequenzaTurni: AppState.sequenzaTurni,
    noteGiorni: AppState.noteGiorni,
    coloriTurni: AppState.coloriTurni || {},
    sequenzaAncora: TurniPSStorage.getItem(CHIAVE_SEQUENZA_ANCORA) || null
  };
}

/** True se l'utente ha attivato il backup Drive a pagamento. */
function backupDriveAttivo(){
  return TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO) === '1';
}

function richiediBackupDrivePerColori(){
  const msg = "L'esportazione e l'importazione dei colori turni sono riservate al Backup automatico su Google Drive (funzione a pagamento, 1,99€). Attivala da Impostazioni → Backup Drive.";
  if(typeof mostraAvviso === 'function') mostraAvviso(msg, 'Funzione a pagamento');
  else alert(msg);
  if(typeof mostraImpostazioniBackup === 'function'){
    try { mostraImpostazioniBackup('sezioneBackupDrive'); } catch(e){}
  } else if(typeof mostraScheda === 'function'){
    try { mostraScheda('impostazioni'); } catch(e){}
  }
}

/** Esporta solo i colori turni — disponibile solo con Backup Drive attivo. */
function esportaBackupColori(){
  if(!backupDriveAttivo()){
    richiediBackupDrivePerColori();
    return;
  }
  const dati = {
    tipo: 'colori-turni',
    versione: 1,
    dataEsportazione: new Date().toISOString(),
    coloriTurni: Object.assign({}, AppState.coloriTurni || {})
  };
  if(!dati.coloriTurni || !Object.keys(dati.coloriTurni).length){
    const pre = {};
    (typeof CATEGORIE_COLORABILI !== 'undefined' ? CATEGORIE_COLORABILI : []).forEach(c => {
      pre[c.chiave] = c.predefinito;
    });
    dati.coloriTurni = pre;
  }
  salvaOCondividiFile(`colori-turni-${dataISO(new Date())}.json`, JSON.stringify(dati, null, 2), 'application/json').then(() => {
    if(typeof mostraToast === 'function') mostraToast('Colori esportati. Conserva il file.', 'successo');
    else if(typeof mostraAvviso === 'function') mostraAvviso('Colori esportati correttamente.');
  });
}

/** Importa colori — solo con Backup Drive attivo. */
function importaBackupColori(file){
  if(!backupDriveAttivo()){
    richiediBackupDrivePerColori();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const dati = JSON.parse(reader.result);
      const colori = dati.coloriTurni || (dati.tipo === 'colori-turni' ? dati.colori : null);
      if(!colori || typeof colori !== 'object'){
        mostraAvviso('Il file non contiene colori turni validi.');
        return;
      }
      AppState.coloriTurni = Object.assign({}, AppState.coloriTurni || {}, colori);
      Object.keys(AppState.coloriTurni).forEach(k => {
        if(!AppState.coloriTurni[k] || AppState.coloriTurni[k] === 'transparent'){
          const cat = (typeof CATEGORIE_COLORABILI !== 'undefined') && CATEGORIE_COLORABILI.find(c => c.chiave === k);
          if(cat) AppState.coloriTurni[k] = cat.predefinito;
        }
      });
      salvaColoriTurniStorage();
      applicaColoriTurni();
      if(typeof renderColoriTurni === 'function') renderColoriTurni();
      if(typeof renderCalendario === 'function') renderCalendario();
      if(typeof mostraToast === 'function') mostraToast('Colori importati.', 'successo');
      else mostraAvviso('Colori importati correttamente.');
    }catch(e){
      mostraAvviso('File colori non valido o corrotto.');
    }
  };
  reader.onerror = () => mostraAvviso('Impossibile leggere il file.');
  reader.readAsText(file);
}

// Modulo di acquisto per Capacitor (Google Play Billing diretto, senza bundler — vedi
// capacitor-plugin-cdv-purchase, usato tramite il ponte nativo di Capacitor come già facciamo
// per Filesystem/Share, non tramite il suo pacchetto JS che richiederebbe un bundler che questo
// progetto non ha). Il vecchio meccanismo (Digital Goods API / PaymentRequest) restava pensato
// per Bubblewrap/TWA e non esiste dentro una WebView Capacitor: qui sotto proviamo prima quello
// nuovo, e se non c'è (es. vecchia build Bubblewrap ancora in giro) ripieghiamo sul vecchio.
let listenerAcquistiCollegato = false;

function pluginAcquistiNativo(){
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PurchasePlugin) || null;
}

async function inizializzaPlayBilling(){
  const plugin = pluginAcquistiNativo();
  if(plugin){
    try{
      await plugin.init();
      if(!listenerAcquistiCollegato){
        listenerAcquistiCollegato = true;
        await plugin.addListener('purchasesUpdated', (dati) => {
          const acquisti = dati.purchases || [];
          const trovato = acquisti.find(p => p.productId === PLAY_PRODUCT_ID_BACKUP_DRIVE || (p.productIds || []).includes(PLAY_PRODUCT_ID_BACKUP_DRIVE));
          if(!trovato) return;
          TurniPSStorage.setItem(CHIAVE_BACKUP_DRIVE_ATTIVO, '1');
          if(!trovato.acknowledged && trovato.purchaseToken){
            plugin.acknowledgePurchase({ purchaseToken: trovato.purchaseToken }).catch(() => {});
          }
          if(typeof renderSezioneBackupDrive === 'function') renderSezioneBackupDrive();
          if(typeof mostraAvviso === 'function') mostraAvviso('Acquisto completato! Ora collega il tuo account Google Drive per attivare il backup automatico.');
        });
      }
      await verificaAcquistoBackupDrive();
      return;
    }catch(e){
      console.warn('Play Billing (Capacitor) non disponibile:', e);
      // continua sotto con il vecchio meccanismo, come ripiego
    }
  }
  if(!('getDigitalGoodsService' in window)) return; // non siamo dentro una TWA/Play Store, niente da fare
  try{
    servizioPlayBilling = await window.getDigitalGoodsService('https://play.google.com/billing');
    await verificaAcquistoBackupDrive();
  }catch(e){
    // API non disponibile in questo contesto (es. durante lo sviluppo nel browser normale): normale, non è un errore
  }
}

async function verificaAcquistoBackupDrive(){
  const plugin = pluginAcquistiNativo();
  if(plugin){
    try{
      return await new Promise(async (resolve) => {
        let risolto = false;
        const concludi = (haAcquistato) => {
          if(risolto) return;
          risolto = true;
          TurniPSStorage.setItem(CHIAVE_BACKUP_DRIVE_ATTIVO, haAcquistato ? '1' : '0');
          resolve(haAcquistato);
        };
        const handle = await plugin.addListener('setPurchases', (dati) => {
          handle.remove();
          const acquisti = dati.purchases || [];
          concludi(acquisti.some(p => p.productId === PLAY_PRODUCT_ID_BACKUP_DRIVE || (p.productIds || []).includes(PLAY_PRODUCT_ID_BACKUP_DRIVE)));
        });
        plugin.getPurchases().catch(() => { handle.remove(); concludi(TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO) === '1'); });
        setTimeout(() => { handle.remove(); concludi(TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO) === '1'); }, 5000); // tetto di sicurezza
      });
    }catch(e){
      return TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO) === '1';
    }
  }
  if(!servizioPlayBilling) return false;
  try{
    const acquisti = await servizioPlayBilling.listPurchases();
    const haAcquistato = acquisti.some(a => a.itemId === PLAY_PRODUCT_ID_BACKUP_DRIVE);
    TurniPSStorage.setItem(CHIAVE_BACKUP_DRIVE_ATTIVO, haAcquistato ? '1' : '0');
    return haAcquistato;
  }catch(e){
    // Se non riusciamo a controllare (es. offline), ci fidiamo di quanto risultava l'ultima volta
    return TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO) === '1';
  }
}

async function acquistaBackupDrive(){
  const plugin = pluginAcquistiNativo();
  if(plugin){
    try{
      await plugin.buy({ productId: PLAY_PRODUCT_ID_BACKUP_DRIVE });
      // L'esito vero arriva dall'evento 'purchasesUpdated' già collegato in inizializzaPlayBilling()
    }catch(e){
      if(e && e.message !== 'USER_CANCELED') mostraAvviso('Acquisto non riuscito. Riprova più tardi.');
    }
    return;
  }
  if(!servizioPlayBilling){
    mostraAvviso('Questa funzione è disponibile solo nella versione installata dal Play Store, non nel browser.');
    return;
  }
  try{
    const paymentMethods = [{ supportedMethods: 'https://play.google.com/billing', data: { sku: PLAY_PRODUCT_ID_BACKUP_DRIVE } }];
    const paymentDetails = { total: { label: 'Backup automatico su Drive', amount: { currency: 'EUR', value: '0' } } };
    const request = new PaymentRequest(paymentMethods, paymentDetails);
    const response = await request.show();
    await response.complete('success');
    TurniPSStorage.setItem(CHIAVE_BACKUP_DRIVE_ATTIVO, '1');
    mostraAvviso('Acquisto completato! Ora collega il tuo account Google Drive per attivare il backup automatico.');
    renderSezioneBackupDrive();
  }catch(e){
    // L'utente ha annullato, o l'acquisto non è andato a buon fine: nessun errore da mostrare, semplicemente non si sblocca
  }
}

function aggiornaStatoDrive(stato, messaggio=''){
  TurniPSStorage.setItem(CHIAVE_STATO_BACKUP_DRIVE, stato);
  if(messaggio) TurniPSStorage.setItem(CHIAVE_MESSAGGIO_BACKUP_DRIVE, messaggio);
  renderSezioneBackupDrive();
}

function inizializzaGoogleIdentity(){
  if(typeof google === 'undefined' || !google.accounts) return;
  if(!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('INSERISCI-QUI')) return;
  tokenClientGoogle = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (risposta) => {
      if(risposta && risposta.access_token){
        tokenAccessoDriveCorrente = risposta.access_token;
        aggiornaStatoDrive('collegato');
        eseguiBackupSuDrive();
      } else {
        aggiornaStatoDrive('errore', 'Google non ha restituito un token di accesso.');
      }
    }
  });
}

function collegaGoogleDrive(){
  if(!navigator.onLine){ aggiornaStatoDrive('offline', 'Sei offline. Collegati a Internet per usare Google Drive.'); return; }
  if(!tokenClientGoogle){
    aggiornaStatoDrive('configurazione', 'Il collegamento Google non è configurato o non è ancora pronto.');
    return;
  }
  aggiornaStatoDrive('connessione', 'Connessione a Google Drive in corso…');
  tokenClientGoogle.requestAccessToken({ prompt: '' });
}

async function rispostaDriveOk(risposta, operazione){
  if(risposta.ok) return true;
  let dettaglio='';
  try { const body=await risposta.json(); dettaglio=body.error?.message || ''; } catch(e){}
  if(risposta.status===401){
    tokenAccessoDriveCorrente=null;
    TurniPSStorage.removeItem(CHIAVE_ID_FILE_DRIVE);
    aggiornaStatoDrive('ricollega', 'Autorizzazione Google scaduta. Ricollega Google Drive e riprova.');
  } else if(risposta.status===403){
    aggiornaStatoDrive('negato', 'Google ha negato l’operazione. Verifica i permessi del tuo account.');
  } else {
    aggiornaStatoDrive('errore', `${operazione} non riuscito${dettaglio ? ': '+dettaglio : '.'}`);
  }
  return false;
}

async function trovaFileBackupDrive(){
  if(!tokenAccessoDriveCorrente) return null;
  try{
    const q = encodeURIComponent("name = 'backup-turni-accessorio-ps.json' and trashed = false");
    const risposta = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=10`, {
      headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`}
    });
    if(!await rispostaDriveOk(risposta,'Ricerca del backup')){
      return null;
    }
    const dati = await risposta.json();
    const file = Array.isArray(dati.files) ? dati.files[0] : null;
    if(file && file.id) TurniPSStorage.setItem(CHIAVE_ID_FILE_DRIVE,file.id);
    return file || null;
  }catch(e){
    return null;
  }
}

async function eseguiBackupSuDrive(){
  if(!tokenAccessoDriveCorrente) return false;
  if(!navigator.onLine){ aggiornaStatoDrive('offline', 'Backup rimandato: dispositivo offline.'); return false; }
  aggiornaStatoDrive('backup', 'Salvataggio del backup su Google Drive…');
  const dati=costruisciDatiBackup();
  const contenuto=JSON.stringify(dati, null, 2);
  let idFileEsistente=TurniPSStorage.getItem(CHIAVE_ID_FILE_DRIVE);
  try{
    if(!idFileEsistente){
      const trovato = await trovaFileBackupDrive();
      idFileEsistente = trovato && trovato.id ? trovato.id : null;
    }
    let risposta;
    if(idFileEsistente){
      risposta=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(idFileEsistente)}?uploadType=media`,{
        method:'PATCH',
        headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`,'Content-Type':'application/json'},
        body:contenuto
      });
      if(!await rispostaDriveOk(resposta,'Aggiornamento del backup')) return false;
    } else {
      const metadati={name:'backup-turni-accessorio-ps.json',mimeType:'application/json'};
      const form=new FormData();
      form.append('metadata',new Blob([JSON.stringify(metadati)],{type:'application/json'}));
      form.append('file',new Blob([contenuto],{type:'application/json'}));
      risposta=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`},body:form});
      if(!await rispostaDriveOk(risposta,'Creazione del backup')) return false;
      const risultato=await risposta.json();
      if(!risultato.id){ aggiornaStatoDrive('errore','Google ha risposto senza un ID file. Il backup non è stato confermato.'); return false; }
      TurniPSStorage.setItem(CHIAVE_ID_FILE_DRIVE,risultato.id);
    }
    const adesso=new Date().toISOString();
    TurniPSStorage.setItem(CHIAVE_ULTIMO_BACKUP_DRIVE,adesso);
    aggiornaStatoDrive('ok','Backup salvato e confermato da Google Drive.');
    aggiornaStatoBackup();
    return true;
  }catch(e){
    aggiornaStatoDrive(navigator.onLine ? 'errore' : 'offline', navigator.onLine ? 'Errore di rete durante il backup. Nessuna conferma di salvataggio ricevuta.' : 'Backup rimandato: dispositivo offline.');
    return false;
  }
}


async function ripristinaBackupDaDrive(){
  if(!tokenAccessoDriveCorrente){
    aggiornaStatoDrive('non_collegato','Collega prima Google Drive per ripristinare un backup.');
    return false;
  }
  if(!navigator.onLine){
    aggiornaStatoDrive('offline','Sei offline. Collegati a Internet per ripristinare il backup.');
    return false;
  }

  aggiornaStatoDrive('ripristino','Lettura del backup da Google Drive…');

  try{
    let idFile = TurniPSStorage.getItem(CHIAVE_ID_FILE_DRIVE);
    if(!idFile){
      const trovato = await trovaFileBackupDrive();
      idFile = trovato && trovato.id ? trovato.id : null;
    }
    if(!idFile){
      aggiornaStatoDrive('errore','Nessun backup Turni & Accessorio PS trovato su Google Drive.');
      return false;
    }

    const risposta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(idFile)}?alt=media`,
      {headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`}}
    );

    if(!await rispostaDriveOk(risposta,'Lettura del backup')) return false;

    const contenuto = await risposta.text();
    let dati;
    try{
      dati = JSON.parse(contenuto);
      analizzaBackup(dati);
    }catch(e){
      aggiornaStatoDrive('errore','Il backup presente su Google Drive non è valido.');
      return false;
    }

    const file = new File(
      [contenuto],
      'backup-turni-accessorio-ps-drive.json',
      {type:'application/json', lastModified:Date.now()}
    );

    mostraAnteprimaBackup(file,dati);
    mostraConferma(
      'Il ripristino da Google Drive sostituirà i dati attuali. Prima di continuare assicurati di avere un backup recente. Continuare?',
      () => {
        importaBackup(file,dati);
        aggiornaStatoDrive('ok','Backup letto da Google Drive e pronto per il ripristino.');
      },
      'Ripristina da Drive'
    );
    return true;
  }catch(e){
    aggiornaStatoDrive('errore','Errore di rete durante la lettura del backup da Google Drive.');
    return false;
  }
}

function controllaBackupDriveAutomatico(){
  if(TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO)!=='1') return;
  if(!navigator.onLine || !tokenClientGoogle) return;
  const ultimo=TurniPSStorage.getItem(CHIAVE_ULTIMO_BACKUP_DRIVE);
  const giorniPassati=ultimo?(Date.now()-new Date(ultimo).getTime())/86400000:Infinity;
  if(giorniPassati<GIORNI_TRA_BACKUP_DRIVE) return;
  tokenClientGoogle.requestAccessToken({prompt:''});
}

function renderSezioneBackupDrive(){
  const box=el('sezioneBackupDrive'); if(!box) return;
  const acquistato=TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO)==='1';
  const idFile=TurniPSStorage.getItem(CHIAVE_ID_FILE_DRIVE);
  const ultimo=TurniPSStorage.getItem(CHIAVE_ULTIMO_BACKUP_DRIVE);
  const stato=TurniPSStorage.getItem(CHIAVE_STATO_BACKUP_DRIVE)||'non_collegato';
  const messaggio=TurniPSStorage.getItem(CHIAVE_MESSAGGIO_BACKUP_DRIVE)||'';
  if(!acquistato){
    box.innerHTML=`<h3>☁️ Backup automatico su Google Drive</h3><p class="sotto-titolo">Attiva il backup automatico per salvare una copia dei dati sul tuo Google Drive.</p><button class="btn-primario" id="btnAcquistaBackupDrive" type="button">Attiva per 1,99€</button>`;
    const btn=el('btnAcquistaBackupDrive'); if(btn) btn.addEventListener('click',acquistaBackupDrive);
    return;
  }
  const statoTesto={ok:'✓ Backup confermato da Google Drive',backup:'⏳ Salvataggio in corso…',collegato:'✓ Account Google collegato',connessione:'⏳ Collegamento a Google…',offline:'⚠ Offline — operazione rimandata',ripristino:'⏳ Lettura del backup da Drive…',errore:'⚠ Backup non confermato',ricollega:'🔑 È necessario ricollegare Google',negato:'⚠ Permesso Google negato',configurazione:'⚙️ Configurazione Google mancante',non_collegato:'Non ancora collegato'}[stato]||stato;
  box.innerHTML=`<h3>☁️ Backup automatico su Google Drive</h3><p class="sotto-titolo">${statoTesto}</p>${messaggio?`<p class="sotto-titolo">${messaggio}</p>`:''}${ultimo?`<p class="sotto-titolo">Ultimo backup confermato: ${new Date(ultimo).toLocaleString('it-IT')}</p>`:''}<div class="u-flex-gap-08"><button class="btn-secondario" id="btnCollegaDrive" type="button">${idFile?'🔄 Sincronizza ora':'🔗 Collega Google Drive'}</button>${idFile?'<button class="btn-secondario" id="btnScollegaDrive" type="button">Scollega</button><button class="btn-secondario" id="btnRipristinaDrive" type="button">📥 Ripristina da Drive</button>':''}</div>`;
  const btn=el('btnCollegaDrive'); if(btn) btn.addEventListener('click',collegaGoogleDrive);
  const scollega=el('btnScollegaDrive'); if(scollega) scollega.addEventListener('click',()=>{ tokenAccessoDriveCorrente=null; TurniPSStorage.removeItem(CHIAVE_ID_FILE_DRIVE); aggiornaStatoDrive('non_collegato','Google Drive scollegato. I dati locali non sono stati modificati.'); });
  const ripristina=el('btnRipristinaDrive'); if(ripristina) ripristina.addEventListener('click',ripristinaBackupDaDrive);
}

function analizzaBackup(dati){
  if(!dati || typeof dati !== 'object' || Array.isArray(dati)) throw new Error('Formato non valido');
  const version = Number(dati.versioneBackup || 1);
  if(!Number.isInteger(version) || version < 1 || version > 1) throw new Error('Versione backup non supportata');
  if(dati.turni !== undefined && (typeof dati.turni !== 'object' || Array.isArray(dati.turni))) throw new Error('Turni non validi');
  if(dati.assenze !== undefined && !Array.isArray(dati.assenze)) throw new Error('Assenze non valide');
  if(dati.noteGiorni !== undefined && (typeof dati.noteGiorni !== 'object' || Array.isArray(dati.noteGiorni))) throw new Error('Note non valide');
  const sezioni = {
    anagrafica: !!dati.anagrafica,
    turni: dati.turni && typeof dati.turni === 'object' ? Object.keys(dati.turni).length : 0,
    assenze: Array.isArray(dati.assenze) ? dati.assenze.length : 0,
    storico: dati.storico && typeof dati.storico === 'object' ? Object.keys(dati.storico).length : 0,
    tabelle: dati.tabelle && typeof dati.tabelle === 'object' ? Object.keys(dati.tabelle).length : 0,
    conguagli: dati.conguagliPerMese && typeof dati.conguagliPerMese === 'object' ? Object.keys(dati.conguagliPerMese).length : 0,
    sequenza: Array.isArray(dati.sequenzaTurni) ? dati.sequenzaTurni.length : 0,
    note: dati.noteGiorni && typeof dati.noteGiorni === 'object' ? Object.keys(dati.noteGiorni).length : 0
  };
  if(!Object.values(sezioni).some(v => v === true || v > 0)) throw new Error('Backup vuoto');
  return {version, data: dati.dataEsportazione || null, sezioni};
}

function formattaDimensioneBackup(bytes){
  if(bytes < 1024) return `${bytes} B`;
  if(bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

function mostraAnteprimaBackup(file, dati){
  const info=analizzaBackup(dati);
  const data=info.data ? new Date(info.data).toLocaleString('it-IT') : 'non indicata';
  const s=info.sezioni;
  const righe=[
    `Backup del: ${data}`,
    `Dimensione file: ${formattaDimensioneBackup(file.size)}`,
    `Turni: ${s.turni}`,
    `Assenze: ${s.assenze}`,
    `Storico cedolini: ${s.storico}`,
    `Tabelle: ${s.tabelle}`,
    `Conguagli: ${s.conguagli}`,
    `Sequenza: ${s.sequenza} passaggi`,
    `Note: ${s.note}`
  ];
  el('backupAnteprima').innerHTML = `<strong>Anteprima backup</strong><div>${righe.map(x=>`<span>${x}</span>`).join('')}</div>`;
  el('backupAnteprima').hidden=false;
}

function leggiBackup(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{ try { const dati=JSON.parse(reader.result); analizzaBackup(dati); resolve(dati); } catch(e){ reject(e); } };
    reader.onerror=()=>reject(new Error('Impossibile leggere il file'));
    reader.readAsText(file);
  });
}

const CHIAVE_SNAPSHOT_RIPRISTINO = 'turnips_snapshot_pre_ripristino_v1';

function creaSnapshotPreRipristino(){
  try{
    const snapshot = {
      data: new Date().toISOString(),
      anagrafica: AppState.anagrafica,
      turni: AppState.turni,
      tabelle: AppState.tabelle,
      conguagliPerMese: AppState.conguagliPerMese,
      storico: AppState.storico,
      assenze: AppState.assenze,
      sequenzaTurni: AppState.sequenzaTurni,
      noteGiorni: AppState.noteGiorni,
      coloriTurni: AppState.coloriTurni || {},
      sequenzaAncora: TurniPSStorage.getItem(CHIAVE_SEQUENZA_ANCORA) || null
    };
    TurniPSStorage.setItem(CHIAVE_SNAPSHOT_RIPRISTINO, JSON.stringify(snapshot));
    return true;
  }catch(e){
    return false;
  }
}

function ripristinaSnapshotPreRipristino(){
  try{
    const raw = TurniPSStorage.getItem(CHIAVE_SNAPSHOT_RIPRISTINO);
    if(!raw) return false;
    const dati = JSON.parse(raw);
    AppState.anagrafica = dati.anagrafica ?? null;
    AppState.turni = dati.turni && typeof dati.turni === 'object' ? dati.turni : {};
    AppState.tabelle = dati.tabelle && typeof dati.tabelle === 'object' ? dati.tabelle : AppState.tabelle;
    AppState.conguagliPerMese = dati.conguagliPerMese && typeof dati.conguagliPerMese === 'object' ? dati.conguagliPerMese : {};
    AppState.storico = dati.storico && typeof dati.storico === 'object' ? dati.storico : {};
    AppState.assenze = Array.isArray(dati.assenze) ? dati.assenze : [];
    AppState.sequenzaTurni = Array.isArray(dati.sequenzaTurni) ? dati.sequenzaTurni : [];
    AppState.noteGiorni = dati.noteGiorni && typeof dati.noteGiorni === 'object' ? dati.noteGiorni : {};
    AppState.coloriTurni = dati.coloriTurni && typeof dati.coloriTurni === 'object' ? dati.coloriTurni : {};
    salvaAnagraficaStorage(); salvaTurniStorage(); salvaTabelleStorage();
    salvaConguagliStorage(); salvaStoricoStorage(); salvaAssenzeStorage(); salvaSequenzaStorage();
    salvaNoteGiorniStorage(); salvaColoriTurniStorage();
    if(dati.sequenzaAncora) TurniPSStorage.setItem(CHIAVE_SEQUENZA_ANCORA, dati.sequenzaAncora);
    else TurniPSStorage.removeItem(CHIAVE_SEQUENZA_ANCORA);
    if(typeof applicaColoriTurni === 'function') applicaColoriTurni();
    if(typeof renderCalendario === 'function') renderCalendario();
    if(typeof renderStorico === 'function') renderStorico();
    aggiornaRiassuntoAnagrafica();
    return true;
  }catch(e){
    return false;
  }
}

function annullaUltimoRipristino(){
  if(!ripristinaSnapshotPreRipristino()){
    if(typeof mostraAvviso === 'function') mostraAvviso('Non è disponibile un ripristino precedente da annullare.');
    return;
  }
  TurniPSStorage.removeItem(CHIAVE_SNAPSHOT_RIPRISTINO);
  if(typeof mostraToast === 'function') mostraToast('Ripristino annullato. I dati precedenti sono stati recuperati.', 'successo');
  else if(typeof mostraAvviso === 'function') mostraAvviso('Ripristino annullato. I dati precedenti sono stati recuperati.');
}

function importaBackup(file, datiGiaLetti){
  const applica = (dati) => {
    try{
      analizzaBackup(dati);
      if(!creaSnapshotPreRipristino()) throw new Error('Impossibile creare la copia di sicurezza');
      if(dati.anagrafica !== undefined) AppState.anagrafica = dati.anagrafica;
      if(dati.turni) AppState.turni = dati.turni;
      if(dati.tabelle) AppState.tabelle = dati.tabelle;
      if(dati.conguagliPerMese) AppState.conguagliPerMese = dati.conguagliPerMese;
      if(dati.storico) AppState.storico = dati.storico;
      if(dati.assenze) AppState.assenze = dati.assenze;
      if(dati.sequenzaTurni) AppState.sequenzaTurni = dati.sequenzaTurni;
      if(dati.noteGiorni){ AppState.noteGiorni = dati.noteGiorni; salvaNoteGiorniStorage(); }
      if(dati.sequenzaAncora) TurniPSStorage.setItem(CHIAVE_SEQUENZA_ANCORA, dati.sequenzaAncora);
      if(dati.coloriTurni && typeof dati.coloriTurni === 'object'){
        AppState.coloriTurni = Object.assign({}, dati.coloriTurni);
        salvaColoriTurniStorage();
        if(typeof applicaColoriTurni === 'function') applicaColoriTurni();
      }

      salvaAnagraficaStorage(); salvaTurniStorage(); salvaTabelleStorage();
      salvaConguagliStorage(); salvaStoricoStorage(); salvaAssenzeStorage(); salvaSequenzaStorage();

      aggiornaRiassuntoAnagrafica();
      renderCalendario();
      renderStorico();
      el('contenitoreCedolino').hidden = true;
      mostraAvviso('Backup importato correttamente.');
      if(typeof mostraToast === 'function') mostraToast('Dati ripristinati correttamente.', 'successo');
      const preview=el('backupAnteprima'); if(preview) preview.hidden=true;
    }catch(e){
      ripristinaSnapshotPreRipristino();
      mostraAvviso(e && e.message === 'Impossibile creare la copia di sicurezza'
        ? 'Ripristino annullato: non è stato possibile creare una copia di sicurezza dei dati attuali.'
        : 'Ripristino non completato. I dati precedenti sono stati ripristinati.');
    }
  };
  if(datiGiaLetti) applica(datiGiaLetti);
  else leggiBackup(file).then(applica).catch(()=>mostraAvviso('File di backup non valido o corrotto.'));
}

const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || 'INSERISCI-QUI-IL-TUO-CLIENT-ID.apps.googleusercontent.com';

const PLAY_PRODUCT_ID_BACKUP_DRIVE = 'backup_drive_automatico';

const CHIAVE_BACKUP_DRIVE_ATTIVO = 'simCedolino_backupDriveAttivo_v1';

const CHIAVE_ULTIMO_BACKUP_DRIVE = 'simCedolino_ultimoBackupDrive_v1';


const CHIAVE_STATO_BACKUP_DRIVE = 'simCedolino_statoBackupDrive_v1';
const CHIAVE_MESSAGGIO_BACKUP_DRIVE = 'simCedolino_messaggioBackupDrive_v1';
const GIORNI_TRA_BACKUP_DRIVE = 3;

const CHIAVE_ID_FILE_DRIVE = 'simCedolino_idFileDrive_v1';
