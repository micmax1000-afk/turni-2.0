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
    eventiGiorno: AppState.eventiGiorno || {},
    modelliTurno: Array.isArray(AppState.modelliTurno) ? AppState.modelliTurno : null,
    calendarioAColori: (TurniPSStorage.getItem(CHIAVE_CALENDARIO_A_COLORI) === '1'),
    stileCalendario: TurniPSStorage.getItem(CHIAVE_STILE_CALENDARIO) === 'moderno' ? 'moderno' : 'classico',
    tema: TurniPSStorage.getItem(CHIAVE_TEMA) || 'auto',
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
      // Prima di poter comprare, il plugin ha bisogno di interrogare il catalogo di Google Play
      // per questo prodotto (prezzo, nome, ecc.) — senza questo passaggio buy() fallisce sempre
      // con "Product not registered", anche se l'app è installata correttamente dal Play Store.
      try{
        await plugin.getAvailableProducts({ inAppSkus: [PLAY_PRODUCT_ID_BACKUP_DRIVE], subsSkus: [] });
      }catch(e){
        console.warn('Interrogazione del catalogo prodotti non riuscita:', e);
      }
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

// L'accesso a Google Drive usa due strade diverse a seconda di dove gira l'app, perché Google
// Identity Services (il popup del sito normale) non funziona dentro una WebView Android — stesso
// genere di problema già risolto per i pagamenti. Dentro l'app Capacitor usiamo invece il modulo
// nativo di accesso Google, che apre la vera schermata di accesso di sistema.
function pluginGoogleSignInNativo(){
  return (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleSignIn) || null;
}

async function inizializzaGoogleIdentity(){
  if(!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('INSERISCI-QUI')) return;
  const pluginNativo = pluginGoogleSignInNativo();
  if(pluginNativo){
    try{
      await pluginNativo.initialize({ clientId: GOOGLE_CLIENT_ID, scopes: ['https://www.googleapis.com/auth/drive.file'] });
      tokenClientGoogle = 'nativo'; // segnaposto: indica solo che l'inizializzazione è andata a buon fine
    }catch(e){
      console.warn('Google Sign-In nativo non disponibile:', e);
    }
    return;
  }
  if(typeof google === 'undefined' || !google.accounts) return;
  tokenClientGoogle = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (risposta) => {
      if(risposta && risposta.access_token){
        tokenAccessoDriveCorrente = risposta.access_token;
        aggiornaStatoDrive('collegato');
        const pendente = azioneDrivePendente; azioneDrivePendente = null;
        if(pendente) pendente();
      } else {
        aggiornaStatoDrive('errore', 'Google non ha restituito un token di accesso.');
      }
    }
  });
}

// Azione da eseguire non appena Google restituisce il token (solo per la strada "sito", che risponde
// in un secondo momento tramite callback).
let azioneDrivePendente = null;

/** Si assicura di avere l'accesso a Google Drive, poi esegue l'azione richiesta (salva o ripristina). */
async function richiediAccessoDrive(azione){
  if(tokenAccessoDriveCorrente){ azione(); return; }
  if(!navigator.onLine){ aggiornaStatoDrive('offline', 'Sei offline. Collegati a Internet per usare Google Drive.'); return; }
  if(!tokenClientGoogle){
    aggiornaStatoDrive('configurazione', 'Il collegamento Google non è configurato o non è ancora pronto.');
    return;
  }
  aggiornaStatoDrive('connessione', 'Connessione a Google Drive in corso…');
  const pluginNativo = pluginGoogleSignInNativo();
  if(pluginNativo){
    try{
      const risultato = await pluginNativo.signIn();
      if(risultato && risultato.accessToken){
        tokenAccessoDriveCorrente = risultato.accessToken;
        aggiornaStatoDrive('collegato');
        azione();
      } else {
        aggiornaStatoDrive('errore', 'Google non ha restituito un token di accesso.');
      }
    }catch(e){
      if(e && e.code === 'SIGN_IN_CANCELED') aggiornaStatoDrive('configurazione', 'Accesso annullato.');
      else aggiornaStatoDrive('errore', 'Accesso a Google non riuscito. Riprova.');
    }
    return;
  }
  azioneDrivePendente = azione;
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

// ── Backup su Drive: ogni salvataggio è un file NUOVO (mai sovrascritto). Si tengono le ultime 5
// copie; le più vecchie vengono cancellate. Il permesso drive.file vede solo i file creati dall'app.
const MAX_COPIE_BACKUP_DRIVE = 5;
const PREFISSO_FILE_BACKUP_DRIVE = 'backup-turni-accessorio-ps';
const CHIAVE_BACKUP_DRIVE_AUTO = 'simCedolino_backupDriveAuto_v1';
const CHIAVE_IMPRONTA_BACKUP_DRIVE = 'simCedolino_improntaBackupDrive_v1';

/** Elenco delle copie su Drive, dalla più recente. false = errore. */
async function elencaBackupDrive(){
  if(!tokenAccessoDriveCorrente) return false;
  try{
    const q = encodeURIComponent("trashed = false");
    const risposta = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&orderBy=createdTime%20desc&fields=files(id,name,createdTime,modifiedTime,size)&pageSize=100`, {
      headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`}
    });
    if(!await rispostaDriveOk(risposta,'Ricerca dei backup')) return false;
    const dati = await risposta.json();
    return (Array.isArray(dati.files) ? dati.files : [])
      .filter(f => f && f.id && String(f.name || '').startsWith(PREFISSO_FILE_BACKUP_DRIVE))
      .sort((x,y) => String(y.createdTime).localeCompare(String(x.createdTime)));
  }catch(e){
    return false;
  }
}

function improntaDatiBackup(dati){
  const testo = JSON.stringify(Object.assign({}, dati, {dataEsportazione:null}));
  let h = 5381;
  for(let i=0;i<testo.length;i++) h = ((h*33) ^ testo.charCodeAt(i)) >>> 0;
  return h.toString(36) + ':' + testo.length;
}

function nomeFileBackupDrive(){
  const d = new Date(), z = n => String(n).padStart(2,'0');
  return `${PREFISSO_FILE_BACKUP_DRIVE}-${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}.json`;
}

async function salvaBackupSuDrive(opz){
  const automatico = !!(opz && opz.automatico);
  if(!tokenAccessoDriveCorrente) return false;
  if(!navigator.onLine){ aggiornaStatoDrive('offline', 'Backup rimandato: dispositivo offline.'); return false; }
  const appVuota = !Object.keys(AppState.turni || {}).length && !Object.keys(AppState.eventiGiorno || {}).length
    && !(AppState.assenze || []).length && !Object.keys(AppState.storico || {}).length && !AppState.anagrafica;
  aggiornaStatoDrive('backup', 'Salvataggio del backup su Google Drive…');
  try{
    const elenco = await elencaBackupDrive();
    if(elenco === false){
      if(TurniPSStorage.getItem(CHIAVE_STATO_BACKUP_DRIVE) === 'backup') aggiornaStatoDrive('errore','Non riesco a controllare i backup su Google Drive. Riprova tra poco.');
      return false;
    }
    if(appVuota){
      // Telefono nuovo o app reinstallata: non si salva nulla (una copia vuota farebbe uscire quelle buone
      // dalle 5 conservate). Se su Drive c'è un backup, lo si propone subito.
      if(elenco.length && !automatico){
        aggiornaStatoDrive('collegato', 'Trovato un backup su Google Drive.');
        ripristinaBackupDaDrive({proposto:true});
      } else {
        aggiornaStatoDrive('collegato', 'Nessun dato da salvare su questo telefono.');
      }
      return false;
    }
    const dati = costruisciDatiBackup();
    const impronta = improntaDatiBackup(dati);
    if(elenco.length && impronta === TurniPSStorage.getItem(CHIAVE_IMPRONTA_BACKUP_DRIVE)){
      aggiornaStatoDrive('ok', 'Nessuna modifica dall’ultimo backup: su Drive c’è già la copia aggiornata.');
      return true;
    }
    const metadati = {name: nomeFileBackupDrive(), mimeType:'application/json'};
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadati)], {type:'application/json'}));
    form.append('file', new Blob([JSON.stringify(dati, null, 2)], {type:'application/json'}));
    const risposta = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime', {
      method:'POST', headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`}, body:form
    });
    if(!await rispostaDriveOk(risposta,'Creazione del backup')) return false;
    const nuovo = await risposta.json();
    if(!nuovo.id){ aggiornaStatoDrive('errore','Google ha risposto senza un ID file. Il backup non è stato confermato.'); return false; }
    TurniPSStorage.setItem(CHIAVE_ULTIMO_BACKUP_DRIVE, new Date().toISOString());
    TurniPSStorage.setItem(CHIAVE_IMPRONTA_BACKUP_DRIVE, impronta);
    // Si tengono le ultime 5 copie: le più vecchie vengono cancellate da Drive.
    const tutte = [nuovo].concat(elenco);
    let cancellate = 0;
    for(const vecchia of tutte.slice(MAX_COPIE_BACKUP_DRIVE)){
      try{
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(vecchia.id)}`, {
          method:'DELETE', headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`}
        });
        if(r.ok || r.status === 204) cancellate++;
      }catch(e){}
    }
    const conservate = Math.min(tutte.length, MAX_COPIE_BACKUP_DRIVE);
    aggiornaStatoDrive('ok', `Backup salvato su Google Drive. Copie conservate: ${conservate} su ${MAX_COPIE_BACKUP_DRIVE}${cancellate ? ' (la più vecchia è stata cancellata)' : ''}.`);
    aggiornaStatoBackup();
    return true;
  }catch(e){
    aggiornaStatoDrive(navigator.onLine ? 'errore' : 'offline', navigator.onLine ? 'Errore di rete durante il backup. Nessuna conferma di salvataggio ricevuta.' : 'Backup rimandato: dispositivo offline.');
    return false;
  }
}

function formattaCopiaBackupDrive(f){
  const data = f.createdTime ? new Date(f.createdTime).toLocaleString('it-IT', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : f.name;
  const kb = f.size ? ` · ${Math.max(1, Math.round(Number(f.size)/1024))} KB` : '';
  return `${data}${kb}`;
}

/** Legge una copia da Drive, la controlla e chiede conferma prima di sostituire i dati del telefono. */
async function leggiERipristinaCopiaDrive(copia, proposto){
  aggiornaStatoDrive('ripristino','Lettura del backup da Google Drive…');
  try{
    const risposta = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(copia.id)}?alt=media`, {
      headers:{'Authorization':`Bearer ${tokenAccessoDriveCorrente}`}
    });
    if(!await rispostaDriveOk(risposta,'Lettura del backup')) return false;
    const contenuto = await risposta.text();
    let dati;
    try{ dati = JSON.parse(contenuto); analizzaBackup(dati); }
    catch(e){ aggiornaStatoDrive('errore','Il backup selezionato su Google Drive non è valido.'); return false; }
    const file = new File([contenuto], 'backup-turni-accessorio-ps-drive.json', {type:'application/json', lastModified:Date.now()});
    mostraAnteprimaBackup(file, dati);
    const quando = formattaCopiaBackupDrive(copia);
    mostraConferma(
      proposto
        ? `Ho trovato un backup dei tuoi dati su Google Drive (${quando}). Vuoi ripristinarlo su questo telefono?`
        : `Ripristinare la copia del ${quando}? I dati attuali di questo telefono verranno sostituiti. Prima di continuare assicurati di averne un backup recente.`,
      () => {
        importaBackup(file, dati);
        aggiornaStatoDrive('ok','Backup ripristinato da Google Drive.');
      },
      'Ripristina da Drive'
    );
    aggiornaStatoDrive('collegato');
    return true;
  }catch(e){
    aggiornaStatoDrive('errore','Errore di rete durante la lettura del backup da Google Drive.');
    return false;
  }
}

async function ripristinaBackupDaDrive(opz){
  const proposto = !!(opz && opz.proposto === true); // chiamata dall'app (telefono nuovo) e non dal pulsante
  if(!tokenAccessoDriveCorrente) return false;
  if(!navigator.onLine){
    aggiornaStatoDrive('offline','Sei offline. Collegati a Internet per ripristinare il backup.');
    return false;
  }
  aggiornaStatoDrive('ripristino','Ricerca dei backup su Google Drive…');
  const elenco = await elencaBackupDrive();
  if(elenco === false){
    if(TurniPSStorage.getItem(CHIAVE_STATO_BACKUP_DRIVE) === 'ripristino') aggiornaStatoDrive('errore','Non riesco a leggere i backup su Google Drive. Riprova tra poco.');
    return false;
  }
  if(!elenco.length){
    aggiornaStatoDrive('errore','Nessun backup Turni & Accessorio PS trovato su Google Drive.');
    return false;
  }
  if(proposto) return leggiERipristinaCopiaDrive(elenco[0], true);
  // Scelta della copia (le ultime 5)
  aggiornaStatoDrive('collegato');
  const lista = el('listaBackupDrive'), overlay = el('overlayScegliBackupDrive');
  if(!lista || !overlay) return leggiERipristinaCopiaDrive(elenco[0], false);
  lista.innerHTML = '';
  elenco.slice(0, MAX_COPIE_BACKUP_DRIVE).forEach((copia, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-secondario'; b.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:8px;';
    b.textContent = `📥 ${formattaCopiaBackupDrive(copia)}${i === 0 ? ' · più recente' : ''}`;
    b.addEventListener('click', () => { overlay.hidden = true; leggiERipristinaCopiaDrive(copia, false); });
    lista.appendChild(b);
  });
  overlay.hidden = false;
  return true;
}

async function controllaBackupDriveAutomatico(){
  if(TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO)!=='1') return;
  if(TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_AUTO)!=='1') return; // spento di default
  if(!navigator.onLine || !tokenClientGoogle) return;
  const ultimo=TurniPSStorage.getItem(CHIAVE_ULTIMO_BACKUP_DRIVE);
  const giorniPassati=ultimo?(Date.now()-new Date(ultimo).getTime())/86400000:Infinity;
  if(giorniPassati<GIORNI_TRA_BACKUP_DRIVE) return;
  const pluginNativo = pluginGoogleSignInNativo();
  if(pluginNativo){
    try{
      const risultato = await pluginNativo.signIn();
      if(risultato && risultato.accessToken){
        tokenAccessoDriveCorrente = risultato.accessToken;
        salvaBackupSuDrive({automatico:true});
      }
    }catch(e){ /* nessun account disponibile o accesso annullato: riprova al prossimo avvio */ }
    return;
  }
  azioneDrivePendente = () => salvaBackupSuDrive({automatico:true});
  tokenClientGoogle.requestAccessToken({prompt:''});
}

function renderSezioneBackupDrive(){
  const box=el('sezioneBackupDrive'); if(!box) return;
  const acquistato=TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_ATTIVO)==='1';
  const ultimo=TurniPSStorage.getItem(CHIAVE_ULTIMO_BACKUP_DRIVE);
  const stato=TurniPSStorage.getItem(CHIAVE_STATO_BACKUP_DRIVE)||'non_collegato';
  const messaggio=TurniPSStorage.getItem(CHIAVE_MESSAGGIO_BACKUP_DRIVE)||'';
  if(!acquistato){
    box.innerHTML=`<h3>☁️ Backup su Google Drive</h3><p class="sotto-titolo">Salva copie dei dati sul tuo Google Drive e ripristinale quando serve (fino a 5 copie conservate).</p><button class="btn-primario" id="btnAcquistaBackupDrive" type="button">Attiva per 1,99€</button>`;
    const btn=el('btnAcquistaBackupDrive'); if(btn) btn.addEventListener('click',acquistaBackupDrive);
    return;
  }
  const statoTesto={ok:'✓ Backup confermato da Google Drive',backup:'⏳ Salvataggio in corso…',collegato:'✓ Account Google collegato',connessione:'⏳ Collegamento a Google…',offline:'⚠ Offline — operazione rimandata',ripristino:'⏳ Lettura da Drive…',errore:'⚠ Operazione non riuscita',ricollega:'🔑 È necessario ricollegare Google',negato:'⚠ Permesso Google negato',configurazione:'⚙️ Configurazione Google mancante',non_collegato:'Non ancora collegato'}[stato]||stato;
  const auto=TurniPSStorage.getItem(CHIAVE_BACKUP_DRIVE_AUTO)==='1';
  box.innerHTML=`<h3>☁️ Backup su Google Drive</h3><p class="sotto-titolo">${statoTesto}</p>${messaggio?`<p class="sotto-titolo">${messaggio}</p>`:''}${ultimo?`<p class="sotto-titolo">Ultimo backup confermato: ${new Date(ultimo).toLocaleString('it-IT')}</p>`:''}<div class="u-flex-gap-08"><button class="btn-primario" id="btnSalvaDrive" type="button">☁️ Salva su Drive</button><button class="btn-secondario" id="btnRipristinaDrive" type="button">📥 Ripristina da Drive</button></div><label class="campo-modale campo-riga"><input type="checkbox" id="chkBackupDriveAuto"${auto?' checked':''}> Salva automaticamente ogni ${GIORNI_TRA_BACKUP_DRIVE} giorni</label><p class="sotto-titolo">Ogni salvataggio crea una copia nuova: nessuna copia viene sovrascritta. Si conservano le ultime ${MAX_COPIE_BACKUP_DRIVE}, le più vecchie vengono cancellate da Drive.</p><button class="btn-secondario" id="btnScollegaDrive" type="button">Scollega</button>`;
  const salva=el('btnSalvaDrive'); if(salva) salva.addEventListener('click',()=>richiediAccessoDrive(()=>salvaBackupSuDrive()));
  const ripristina=el('btnRipristinaDrive'); if(ripristina) ripristina.addEventListener('click',()=>richiediAccessoDrive(()=>ripristinaBackupDaDrive()));
  const chk=el('chkBackupDriveAuto'); if(chk) chk.addEventListener('change',()=>{ TurniPSStorage.setItem(CHIAVE_BACKUP_DRIVE_AUTO, chk.checked ? '1' : '0'); });
  const scollega=el('btnScollegaDrive'); if(scollega) scollega.addEventListener('click',()=>{ tokenAccessoDriveCorrente=null; TurniPSStorage.removeItem(CHIAVE_ID_FILE_DRIVE); aggiornaStatoDrive('non_collegato','Google Drive scollegato. I dati locali non sono stati modificati.'); });
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
    note: dati.noteGiorni && typeof dati.noteGiorni === 'object' ? Object.keys(dati.noteGiorni).length : 0,
    eventi: dati.eventiGiorno && typeof dati.eventiGiorno === 'object' ? Object.keys(dati.eventiGiorno).length : 0
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
      if(dati.eventiGiorno && typeof dati.eventiGiorno === 'object' && !Array.isArray(dati.eventiGiorno)){
        const eventiPrima = AppState.eventiGiorno || {};
        AppState.eventiGiorno = dati.eventiGiorno;
        salvaEventiGiornoStorage();
        // Gli allarmi di Android non fanno parte del backup: si annullano quelli degli eventi
        // di prima e si riprogrammano i promemoria futuri, uno alla volta e senza messaggi.
        if(typeof riprogrammaPromemoriaEventi === 'function' && typeof annullaPromemoriaEvento === 'function'){
          (async () => {
            try{
              for(const iso of Object.keys(eventiPrima)) for(const ev of (eventiPrima[iso] || [])){
                if(ev && ev.id) await annullaPromemoriaEvento(ev.id);
              }
              await riprogrammaPromemoriaEventi({ soloAggiungi: false });
            }catch(e){ console.warn('Promemoria del backup non riprogrammati:', e); }
          })();
        }
      }
      if(Array.isArray(dati.modelliTurno) && dati.modelliTurno.length){
        AppState.modelliTurno = dati.modelliTurno;
        salvaModelliTurnoStorage();
      }
      if(typeof dati.calendarioAColori === 'boolean'){
        TurniPSStorage.setItem(CHIAVE_CALENDARIO_A_COLORI, dati.calendarioAColori ? '1' : '0');
        if(dati.stileCalendario === 'moderno' || dati.stileCalendario === 'classico') TurniPSStorage.setItem(CHIAVE_STILE_CALENDARIO, dati.stileCalendario);
        if(['auto', 'chiaro', 'scuro'].includes(dati.tema)){ TurniPSStorage.setItem(CHIAVE_TEMA, dati.tema); if(typeof applicaTema === 'function') applicaTema(); }
        if(typeof aggiornaClasseCalendarioColori === 'function') aggiornaClasseCalendarioColori();
      }
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
// Data di ultima modifica del file su Drive nel momento in cui QUESTO telefono l'ha scritto o ripristinato:
// se su Drive risulta diversa, il file è stato cambiato altrove e non va sovrascritto di nascosto.
const CHIAVE_MODIFICA_DRIVE = 'simCedolino_modificaDrive_v1';
