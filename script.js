
function inizializzaImpostazioni(){
  const host = el('impostazioniBackupContainer');
  if(!host) return;
  ['sezioneBackup','sezioneBackupDrive'].forEach(id => {
    const n = el(id);
    if(!n) return;
    n.hidden = false;
    n.removeAttribute('hidden');
    if(n.parentElement !== host) host.appendChild(n);
  });
  const panel = el('impostazioniBackupPanel');
  if(panel) panel.hidden = true;
}
function mostraImpostazioniBackup(id){
  mostraScheda('impostazioni');
  inizializzaImpostazioni();
  const panel=el('impostazioniBackupPanel');
  if(panel) panel.hidden=false;
  const target=el(id);
  if(target){
    target.hidden = false;
    target.removeAttribute('hidden');
    target.style.display='block';
    target.scrollIntoView({behavior:'smooth',block:'start'});
  } else if(panel){
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }
}
'use strict';

function on(id, event, handler){
  const n = el(id);
  if(n) n.addEventListener(event, handler);
}


/* =========================================================
   SIMULATORE CEDOLINO — FASE 1
   Anagrafica + Calendario + Motore di classificazione ore
   ========================================================= */

const {
  CHIAVE_ANAGRAFICA,
  CHIAVE_TURNI,
  CHIAVE_TABELLE,
  CHIAVE_CONGUAGLI,
  CHIAVE_STORICO,
  CHIAVE_ASSENZE,
  CHIAVE_SEQUENZA,
  CHIAVE_NOTE_GIORNI,
  CHIAVE_SEQUENZA_ANCORA,
  CHIAVE_SEQUENZA_ULTIMO_GIORNO,
  CHIAVE_ULTIMO_BACKUP,
  CHIAVE_ASPETTATIVA_MIGRATA,
  CHIAVE_DISCLAIMER_MOSTRATO,
  CHIAVE_COLORI_TURNI
} = TurniPSConfig.keys;

// Espone le chiavi in scope globale condiviso (moduli classic script)
Object.assign(window, {
  CHIAVE_ANAGRAFICA, CHIAVE_TURNI, CHIAVE_TABELLE, CHIAVE_CONGUAGLI,
  CHIAVE_STORICO, CHIAVE_ASSENZE, CHIAVE_SEQUENZA, CHIAVE_NOTE_GIORNI,
  CHIAVE_SEQUENZA_ANCORA, CHIAVE_SEQUENZA_ULTIMO_GIORNO, CHIAVE_ULTIMO_BACKUP,
  CHIAVE_ASPETTATIVA_MIGRATA, CHIAVE_DISCLAIMER_MOSTRATO, CHIAVE_COLORI_TURNI
});

AppState.coloriTurni = caricaColoriTurni();

// Migrazioni prima del caricamento dei dati: garantisce che lo schema persistente sia aggiornato.
if(typeof turniPSRunMigrations==='function') turniPSRunMigrations();


/* ---------------------------------------------------------
   TABELLE UFFICIALI PREDEFINITE (FASE 2)
   Valori indicativi da fonti pubbliche (CCNL 2022-2024,
   Legge di Bilancio 2026) — l'utente li verifica e corregge
   dal pannello "Tabelle Ufficiali".
   --------------------------------------------------------- */
const TABELLE_PREDEFINITE = TurniPSData.TABELLE_PREDEFINITE;

AppState.anagrafica = caricaAnagrafica();
AppState.turni = caricaTurni(); // oggetto { 'YYYY-MM-DD': turnoData }
AppState.tabelle = caricaTabelle();
AppState.conguagliPerMese = caricaConguagli(); // oggetto { 'YYYY-MM': importo }
AppState.storico = caricaStorico(); // oggetto { 'YYYY-MM': { totaleLordo, netto } }

idContatore = 1; // già dichiarato in utils.js
// L'id deve restare unico anche quando si aggiunge una voce a un elenco già salvato in sessioni precedenti
// (dove idContatore riparte da 1): un id solo numerico rischiava di ripetersi e far confondere due voci diverse.


AppState.assenze = caricaAssenze(); // array [{ id, nome, valore, unita, personalizzata }]
AppState.indennitaPersonalizzate = caricaIndennitaPersonalizzate(); // array [{ id, nome, valore, unita: 'mese'|'turno' }]
TurniPSStorage.setItem(CHIAVE_ASSENZE, JSON.stringify(AppState.assenze)); // persiste subito l'eventuale merge di nuove voci predefinite

AppState.noteGiorni = caricaNoteGiorni(); // { 'AAAA-MM-GG': 'testo nota' }
AppState.sequenzaTurni = caricaSequenza(); // array di chiavi MODELLI_TURNO, es. ['sera01','pomeriggio','mattina','notte01','riposo']


// Addizionale regionale IRPEF 2026 — fonte: elenco ufficiale aliquote regionali (CSV fornito dall'utente).
// Nota: Puglia e Molise avevano nel CSV due set di aliquote diverse per la stessa fascia di reddito senza
// un campo che li distinguesse chiaramente; è stato usato il primo set indicato, da verificare se non corrisponde.


const oggi = new Date();
let meseCorrente = oggi.getMonth(); // 0-11
let annoCorrente = oggi.getFullYear();
let giornoSelezionato = null;
let turnoCopiato = null; // clipboard in memoria, non persistito

/* ---------------------------------------------------------
   FESTIVITÀ — Pasqua (algoritmo di Gauss) + festività fisse
   --------------------------------------------------------- */



// Categorizza il turno in base alla fascia oraria in cui ricadono la MAGGIOR PARTE
// delle ore svolte (non solo l'orario di inizio) — es. un turno 23:00-07:00 risulta
// "notte" perché la maggioranza delle ore ricade in quella fascia, non "sera".

// Sigle mostrate sulla cella del calendario per le assenze, fornite dall'utente
// (per le voci non elencate esplicitamente, o personalizzate, si usa un fallback dalle prime lettere del nome)


// festività "fisse" (non domenica): Capodanno, Epifania, Pasqua, Pasquetta, 25 aprile, 1 maggio, 2 giugno, Ferragosto, Ognissanti, Immacolata, Natale, S.Stefano


/* ---------------------------------------------------------
   MOTORE DI CLASSIFICAZIONE ORE
   Analizza una finestra temporale minuto per minuto e la
   suddivide in 5 categorie mutuamente esclusive:
   ordinarie / notturne / festive / domenicali / notturne-festive
   --------------------------------------------------------- */



/**
 * Classifica un turno completo: ore ordinarie del turno + straordinario
 * prima/dopo, riconoscendo automaticamente fascia notturna e festività.
 */


/* ---------------------------------------------------------
   PERSISTENZA
   --------------------------------------------------------- */

/* ---------------------------------------------------------
   MOTORE COMPETENZE — genera automaticamente le voci
   economiche da AppState.anagrafica + ore classificate + AppState.tabelle
   --------------------------------------------------------- */


// Produttività collettiva: si liquida una volta sola a luglio, sui giorni di presenza effettiva
// dell'intero anno solare precedente (non del mese in corso).


/* ---------------------------------------------------------
   MOTORE FISCALE — a cascata, come NoiPA
   --------------------------------------------------------- */


// Ricostruisce cosa arriva effettivamente sul conto in un dato mese: lo stipendio base si accredita
// il mese successivo a quello lavorato, le indennità accessorie con un mese di ritardo ulteriore.
// La tredicesima invece NON è sfasata: si accredita a dicembre stesso.
// Il calcolo fiscale (contributi/IRPEF/addizionali) qui è una STIMA: nella realtà NoiPA emette due
// cedolini separati (stipendio e accessorio) con trattamento fiscale proprio; qui viene sommato
// il lordo delle due componenti e applicato un unico calcolo, come approssimazione.



/* ---------------------------------------------------------
   UI — TABELLE UFFICIALI
   --------------------------------------------------------- */


/* ---------------------------------------------------------
   UI — ASSENZE DAL SERVIZIO (elenco personalizzabile)
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   UI — SEQUENZA AUTOMATICA TURNI (personalizzabile)
   --------------------------------------------------------- */


/* ---------------------------------------------------------
   COPIA / INCOLLA TURNO — singolo giorno e settimana precedente
   --------------------------------------------------------- */


// Il permesso breve si può consumare in due modi: come assenza a giornata intera (assenzaTipo, come le altre
// AppState.assenze orarie) oppure come permesso parziale dentro un turno lavorato normalmente (campoPermessoBreveAttivo).
// Questa funzione somma entrambe le fonti per il saldo annuo.
// "Ore rimanenti" di Permesso breve: si scala SOLO quando si prende il permesso, e resta scalato
// per sempre — recuperare l'ora lavorandola in seguito non restituisce il "diritto" di prenderne altro,
// serve solo a non perdere la retribuzione di quell'ora (vedi calcolaOreDaRecuperareAnno/OreRecuperateAnno).

// Ore di permesso breve prese ma non ancora recuperate lavorandole (debito residuo verso l'amministrazione).

// Ore di permesso breve già recuperate lavorandole (totale cumulativo dell'anno, non scala mai le ore rimanenti).

// Congedo ordinario: i giorni non goduti al 31/12 si sommano allo spettante del nuovo anno (riporto).
// Uso l'anno più vecchio con AppState.turni salvati come base del calcolo: non conosciamo l'anno di assunzione reale,
// quindi il riporto viene ricostruito solo a partire da lì (limite noto, spiegato in app).


// Elenco (FIFO) delle date di AppState.turni che hanno generato credito per una voce automatica (Recupero riposo/festivo)
// ancora disponibili: le prime date guadagnate sono considerate le prime consumate.


/* ---------------------------------------------------------
   UI — CEDOLINO SIMULATO
   --------------------------------------------------------- */


/* ---------------------------------------------------------
   UI — MODALE TURNO
   --------------------------------------------------------- */


/* ---------------------------------------------------------
   UI — MODALE ANAGRAFICA
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   BADGE GRADO — mostrina semplificata in SVG per qualifica
   (rappresentazione indicativa per categoria, non riproduzione
   ufficiale dei gradi) — truppa: barre rosse; sovrintendenti:
   rombi oro; ispettori: pentagoni oro; funzionari: stelle oro
   --------------------------------------------------------- */
// Parametro stipendiale per qualifica — fonte: tabella incrementi CCNL 2025/2027 (PDF condiviso dall'utente, gennaio 2027)


/* ---------------------------------------------------------
   INIZIALIZZAZIONE
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   BACKUP — esportazione/importazione completa dei dati
   --------------------------------------------------------- */



// Restituisce lo stesso oggetto dati usato per il backup manuale, riusato anche dal backup su Drive


// ============================================================================
// BACKUP AUTOMATICO SU GOOGLE DRIVE (funzione a pagamento, 1,99€ una tantum)
// ============================================================================
// ATTENZIONE: sostituisci questo segnaposto con il tuo Client ID reale ottenuto
// da Google Cloud Console (vedi setup-google-cloud.md). Senza un Client ID valido
// questa funzione non può attivarsi, ma il resto dell'app funziona normalmente.


 // ogni quanti giorni ritentare il backup automatico

let servizioPlayBilling = null;
let tokenClientGoogle = null;
let tokenAccessoDriveCorrente = null;

// --- Play Billing: verifica se l'utente ha già comprato la funzione ---


// --- Login Google e accesso a Drive (solo file creati da questa app, scope non invasivo) ---



// --- Upload effettivo su Drive: crea o aggiorna un unico file di backup ---



// --- Controllo automatico all'apertura dell'app: se sono passati troppi giorni, ritenta da solo ---


/* ---------------------------------------------------------
   AVVISO / CONFERMA — sostituiscono alert()/confirm() nativi,
   che in alcuni contesti (anteprima in-app, webview) possono
   non mostrarsi e far fallire silenziosamente l'operazione.
   --------------------------------------------------------- */


function inizializza(){
  if(window.TurniPSDataGuard && !TurniPSDataGuard.validate(AppState)) Object.assign(AppState, TurniPSDataGuard.normalize(AppState));
  applicaColoriTurni();
  if(!TurniPSStorage.getItem(CHIAVE_DISCLAIMER_MOSTRATO)){
    mostraAvviso(
      'Questa è un\'app indipendente, non ufficiale e non affiliata alla Polizia di Stato né ad alcun ente pubblico. I valori delle AppState.tabelle sono presi da fonti pubbliche online (siti sindacali, normativa pubblicata) e possono contenere errori o non essere aggiornati. L\'autore declina ogni responsabilità per incongruenze, errori o danni derivanti dall\'uso dell\'app: verifica sempre i dati sul tuo cedolino ufficiale prima di prendere decisioni.',
      'Prima di iniziare'
    );
    TurniPSStorage.setItem(CHIAVE_DISCLAIMER_MOSTRATO, '1');
  }
  aggiornaRiassuntoAnagrafica();
  renderCalendario();
  renderAvvisiApp();
  aggiornaStatoBackup();
  renderSezioneBackupDrive();
  if(typeof inizializzaOffline==='function') inizializzaOffline();
  inizializzaPlayBilling().then(() => renderSezioneBackupDrive());
  // Piccolo ritardo perché la libreria Google (caricata con "defer") abbia il tempo di essere pronta
  setTimeout(() => {
    inizializzaGoogleIdentity();
    controllaBackupDriveAutomatico();
  }, 800);
  if(Object.keys(AppState.turni).length > 0){
    const dataUltimoBackup = TurniPSStorage.getItem(CHIAVE_ULTIMO_BACKUP);
    const giorniPassati = dataUltimoBackup ? Math.floor((new Date() - new Date(dataUltimoBackup)) / 86400000) : Infinity;
    if(giorniPassati >= 30){
      mostraAvviso(dataUltimoBackup
        ? `Sono passati ${giorniPassati} giorni dall'ultimo backup. I tuoi dati vivono solo su questo dispositivo: se lo perdi o cambi telefono senza aver esportato un backup recente, li perdi. Vai su Backup Dati (in fondo a ogni pagina) per esportarne uno nuovo.`
        : `Non hai mai fatto un backup dei tuoi dati. Vivono solo su questo dispositivo: vai su Backup Dati (in fondo a ogni pagina) per esportarne uno.`);
    }
  }

  let timeoutNotaGiorno;
  const _campoNota = el('campoNotaGiorno');
  if(_campoNota) _campoNota.addEventListener('input', () => {
    if(!giornoSelezionato) return;
    clearTimeout(timeoutNotaGiorno);
    timeoutNotaGiorno = setTimeout(() => {
      const testo = el('campoNotaGiorno').value;
      if(testo) AppState.noteGiorni[giornoSelezionato] = testo;
      else delete AppState.noteGiorni[giornoSelezionato];
      salvaNoteGiorniStorage();
    }, 400);
  });

  // "Servizio svolto" in Azioni rapide: salvataggio indipendente (come la nota del giorno),
  // così si può compilare senza dover aprire il pannello completo di modifica turno.
  // Si applica solo a un giorno che ha già un turno: creare un turno "vuoto" solo per questo
  // campo farebbe comparire l'avviso "Turno incompleto" nella card del giorno.
  let timeoutServizioSvolto;
  const _campoServizioSvolto = el('campoServizioSvolto');
  if(_campoServizioSvolto) _campoServizioSvolto.addEventListener('input', () => {
    if(!giornoSelezionato) return;
    clearTimeout(timeoutServizioSvolto);
    timeoutServizioSvolto = setTimeout(() => {
      const testo = el('campoServizioSvolto').value;
      if(!AppState.turni[giornoSelezionato]){
        if(testo) mostraAvviso('Questo giorno non ha ancora un turno: aggiungilo prima con "✏️ Modifica turno del giorno selezionato".');
        return;
      }
      AppState.turni[giornoSelezionato].servizioSvolto = testo;
      salvaTurniStorage();
    }, 400);
  });

  if(!AppState.anagrafica) mostraScheda('anagrafica');

  // Scorciatoie dell'app (icona tenuta premuta sulla home, definite in manifest.json → shortcuts):
  // se l'anagrafica manca, resta prioritario chiederla prima di qualunque altra schermata.
  const scorciatoia = new URLSearchParams(window.location.search).get('scorciatoia');
  if(scorciatoia && AppState.anagrafica){
    if(scorciatoia === 'sequenza') setTimeout(() => el('settingsSequenza')?.click(), 50);
    else if(scorciatoia === 'cedolino') mostraScheda('cedolino');
  }

  el('btnMesePrec').addEventListener('click', () => {
    meseCorrente--; if(meseCorrente < 0){ meseCorrente = 11; annoCorrente--; }
    renderCalendario();
    el('contenitoreCedolino').hidden = true;
  });
  el('btnMeseSucc').addEventListener('click', () => {
    meseCorrente++; if(meseCorrente > 11){ meseCorrente = 0; annoCorrente++; }
    renderCalendario();
    el('contenitoreCedolino').hidden = true;
  });

  el('etichettaMese').addEventListener('click', () => {
    el('campoVaiMese').value = meseCorrente;
    el('campoVaiAnno').value = annoCorrente;
    el('overlayVaiAMese').hidden = false;
  });
  el('btnChiudiVaiAMese').addEventListener('click', () => { el('overlayVaiAMese').hidden = true; });
  el('overlayVaiAMese').addEventListener('click', e => { if(e.target.id === 'overlayVaiAMese') el('overlayVaiAMese').hidden = true; });
  el('btnVaiAMese').addEventListener('click', () => {
    const meseScelto = Number(el('campoVaiMese').value);
    const annoScelto = Number(el('campoVaiAnno').value);
    if(!annoScelto) return;
    meseCorrente = meseScelto; annoCorrente = annoScelto;
    renderCalendario();
    el('contenitoreCedolino').hidden = true;
    el('overlayVaiAMese').hidden = true;
  });
  el('btnVaiOggi').addEventListener('click', () => {
    const adesso = new Date();
    meseCorrente = adesso.getMonth(); annoCorrente = adesso.getFullYear();
    giornoSelezionato = dataISO(adesso);
    renderCalendario();
    el('contenitoreCedolino').hidden = true;
    el('overlayVaiAMese').hidden = true;
  });

  const btnOggiCalendario = el('btnOggiCalendario');
  if(btnOggiCalendario){
    btnOggiCalendario.addEventListener('click', () => {
      const adesso = new Date();
      meseCorrente = adesso.getMonth();
      annoCorrente = adesso.getFullYear();
      giornoSelezionato = dataISO(adesso);
      renderCalendario();
      el('contenitoreCedolino').hidden = true;
    });
  }
  const btnColoriHeader = el('btnApriColoriHeader');
  if(btnColoriHeader){
    btnColoriHeader.addEventListener('click', () => {
      apriPannelloColori();
    });
  }

  on('btnImpostazioni','click', () => mostraScheda('impostazioni'));
  on('btnImpostazioniBottom','click', () => mostraScheda('impostazioni'));
  on('btnStatisticheBottom','click', () => mostraScheda('statistiche'));
  on('settingsAnagrafica','click', () => mostraScheda('anagrafica'));
  on('settingsTabelle','click', () => mostraScheda('tabelle'));
  on('settingsColori','click', () => {
    const p = el('pannelloColoriTurni');
    if(p && p.hidden) apriPannelloColori();
    else p?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  on('btnApriAssenzeV64','click', () => {
    const p = el('sezioneAssenze');
    if(!p) return;
    p.hidden = !p.hidden;
    if(!p.hidden) p.scrollIntoView({behavior:'smooth',block:'start'});
  });
  on('settingsBackup','click', () => mostraImpostazioniBackup('sezioneBackup'));
  on('settingsDrive','click', () => mostraImpostazioniBackup('sezioneBackupDrive'));
  on('btnChiudiSettingsBackup','click', () => { const p=el('impostazioniBackupPanel'); if(p) p.hidden = true; });

  el('btnAnagrafica').addEventListener('click', () => mostraScheda('anagrafica'));
  on('btnStatistiche','click', () => mostraScheda('statistiche'));
  on('btnAggiornaStatistiche','click', renderStatistiche);
  on('campoAnnoStatistiche','change', renderStatistiche);
  el('btnSalvaAnagrafica').addEventListener('click', salvaAnagraficaDaModale);
  el('btnCancellaAnagrafica').addEventListener('click', () => {
    mostraConferma(
      'Questo cancellerà i dati anagrafici salvati (qualifica, anni di servizio, sede, regione, ecc.) e riporterà il form ai valori predefiniti. Turni, assenze, tabelle e cedolini generati non vengono toccati. Continuare?',
      cancellaAnagrafica
    );
  });
  el('campoQualifica').addEventListener('change', aggiornaVisualizzazioneParametro);

  on('btnTabelle','click', () => mostraScheda('tabelle'));
  el('btnSalvaTabelle').addEventListener('click', () => {
    leggiTabelleDaModale();
    mostraScheda('turni');
    aggiornaRiepilogoMensile();
    if(!el('contenitoreCedolino').hidden) renderCedolino();
  });
  el('btnResetTabelle').addEventListener('click', () => {
    AppState.tabelle = clonaTabelleConSoglie(TABELLE_PREDEFINITE);
    renderTabelle();
  });

  el('btnAggiungiAssenza').addEventListener('click', () => {
    AppState.assenze.push({ id: nuovoId(), nome:'Nuova voce', valore:0, unita:'gg', personalizzata:true });
    salvaAssenzeStorage();
    renderAssenze();
  });

  on('filtroCalendarioSelect','change', e => impostaFiltroCalendario(e.target.value));

  on('settingsSequenza','click', () => {
    mostraScheda('sequenza');
    el('sezioneSequenza')?.scrollIntoView({behavior:'smooth', block:'start'});
  });
  on('btnChiudiSequenza','click', () => {
    const seq = el('sezioneSequenza');
    if(seq) seq.hidden = true;
  });
  on('btnRitornaGeneratoreV44','click', () => {
    const dettagli = el('sezioneSequenza')?.querySelector('.opzioni-avanzate-sequenza');
    if(dettagli) dettagli.open = false;
    el('sezioneSequenza')?.scrollIntoView({behavior:'smooth', block:'start'});
  });
  el('btnAggiungiStepSequenza').addEventListener('click', () => {
    AppState.sequenzaTurni.push({ tipo:'riposo' });
    renderSequenza();
  });
  el('btnGeneraSequenza').addEventListener('click', () => generaSequenzaTurni());
  el('btnContinuaSequenza').addEventListener('click', continuaSequenzaTurni);

  function aggiornaInterfacciaGeneratoreSemplice(){
    const preset=el('campoSequenzaDurataPreset');
    const custom=el('contenitoreGiorniPersonalizzati');
    if(preset && custom) custom.hidden = preset.value !== 'personalizzato';
    aggiornaAnteprimaSequenzaSemplice();
  }

  on('btnApplicaModelloSemplice','click',()=>{
    const scelta=el('selettoreModelloSemplice')?.value;
    if(scelta==='quinta') el('btnModelloTurnoInQuinta')?.click();
    else if(scelta==='quinta10') mostraConferma('Questo sostituirà la sequenza con il modello in quinta di 10 giorni. Continuare?', applicaModelloTurnoInQuinta10);
    else if(scelta==='corta') el('btnModelloSettimanaCorta')?.click();
    else if(scelta==='lunga') el('btnModelloSettimanaLunga')?.click();
    else {
      const dettagli=el('sezioneSequenza')?.querySelector('.opzioni-avanzate-sequenza');
      if(dettagli) dettagli.open=true;
      mostraAvviso('Modalità personalizzata: apri le Opzioni avanzate e imposta i turni giorno per giorno.');
    }
  });

  function aggiornaVisibilitaFasciaOrariaSemplice(){
    const scelta = el('selettoreModelloSemplice')?.value;
    const contenitore = el('contenitoreFasciaOrariaSemplice');
    if(!contenitore) return;
    // La fascia oraria si applica solo ai modelli a orario fisso (settimana corta/lunga):
    // il turno in quinta ha orari propri già fissi (Sera/Pomeriggio/Mattina/Notte) e la
    // modalità personalizzata si gestisce dalle Opzioni avanzate — in entrambi i casi il
    // selettore non avrebbe alcun effetto, quindi lo nascondiamo per non creare confusione.
    contenitore.hidden = (scelta !== 'corta' && scelta !== 'lunga');
  }

  on('selettoreModelloSemplice','change',()=>{
    const scelta=el('selettoreModelloSemplice')?.value;
    aggiornaVisibilitaFasciaOrariaSemplice();
    if(scelta!=='personalizzata') aggiornaAnteprimaSequenzaSemplice();
  });
  aggiornaVisibilitaFasciaOrariaSemplice();

  function aggiornaGiorniDaPreset(){
    const preset = el('campoSequenzaDurataPreset').value;
    if(preset === 'personalizzato') return; // il numero resta quello digitato dall'utente
    const dataInizioStr = el('campoSequenzaDataInizio').value || dataISO(new Date());
    const inizio = new Date(dataInizioStr + 'T00:00:00');
    const fine = new Date(inizio);
    if(preset === 'settimana') fine.setDate(fine.getDate() + 7);
    else if(preset === 'mese') fine.setMonth(fine.getMonth() + 1);
    else if(preset === 'mese3') fine.setMonth(fine.getMonth() + 3);
    else if(preset === 'mese6') fine.setMonth(fine.getMonth() + 6);
    else if(preset === 'mese9') fine.setMonth(fine.getMonth() + 9);
    else if(preset === 'anno') fine.setFullYear(fine.getFullYear() + 1);
    const giorni = Math.round((fine - inizio) / 86400000);
    el('campoSequenzaGiorni').value = Math.min(giorni, 366);
  }
  el('campoSequenzaDurataPreset').addEventListener('change', () => { aggiornaGiorniDaPreset(); aggiornaInterfacciaGeneratoreSemplice(); });
  el('campoSequenzaDataInizio').addEventListener('change', () => { aggiornaGiorniDaPreset(); aggiornaAnteprimaSequenzaSemplice(); });
  el('campoSequenzaGiorni').addEventListener('input', () => { el('campoSequenzaDurataPreset').value = 'personalizzato'; aggiornaInterfacciaGeneratoreSemplice(); });
  aggiornaInterfacciaGeneratoreSemplice();

  el('btnModelloTurnoInQuinta').addEventListener('click', () => {
    mostraConferma(
      'Questo sostituirà tutti i passaggi attuali della sequenza con il turno in quinta predefinito (Sera, Pomeriggio, Mattina, Notte, Riposo). Continuare?',
      applicaModelloTurnoInQuinta
    );
  });
  el('btnModelloSettimanaCorta').addEventListener('click', () => {
    mostraConferma(
      'Questo sostituirà tutti i passaggi attuali della sequenza con il modello settimana corta (7 righe). Continuare?',
      applicaModelloSettimanaCorta
    );
  });
  el('btnModelloSettimanaLunga').addEventListener('click', () => {
    mostraConferma(
      'Questo sostituirà tutti i passaggi attuali della sequenza con il modello settimana lunga (7 righe). Continuare?',
      applicaModelloSettimanaLunga
    );
  });

  el('btnCancellaTurniMese').addEventListener('click', cancellaTurniMese);
  el('btnCancellaStorico').addEventListener('click', cancellaStorico);

  el('btnEsportaBackup').addEventListener('click', esportaBackup);
  el('btnImportaBackup').addEventListener('click', () => el('campoImportaBackup').click());
  on('btnAnnullaRipristino','click', () => {
    mostraConferma(
      'Vuoi annullare l’ultimo ripristino e recuperare i dati che erano presenti prima di importare il backup?',
      annullaUltimoRipristino,
      'Annulla ripristino'
    );
  });
  el('campoImportaBackup').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(file){
      try{
        const dati = await leggiBackup(file);
        mostraAnteprimaBackup(file, dati);
        mostraConferma(
          "Il ripristino sostituirà i dati attuali presenti nell'app. Prima di continuare assicurati di avere un backup recente dei dati attuali. Continuare?",
          () => importaBackup(file, dati),
          'Ripristina backup'
        );
      }catch(err){
        const preview=el('backupAnteprima'); if(preview) preview.hidden=true;
        mostraAvviso('Il file selezionato non è un backup valido o è danneggiato.');
      }
    }
    e.target.value = '';
  });

  el('btnGeneraCedolino').addEventListener('click', renderCedolino);
  el('btnGeneraAccreditoConto').addEventListener('click', renderAccreditoConto);
  el('btnStampaCedolino').addEventListener('click', () => stampaSezione('contenitoreCedolino'));
  el('btnNascondiCedolino').addEventListener('click', () => {
    el('contenitoreCedolino').hidden = true;
    el('contenitoreCedolino').innerHTML = '';
    el('btnStampaCedolino').hidden = true;
    el('btnNascondiCedolino').hidden = true;
  });
  el('btnCancellaAccreditoConto').addEventListener('click', () => {
    el('contenitoreAccreditoConto').hidden = true;
    el('contenitoreAccreditoConto').innerHTML = '';
    el('btnCancellaAccreditoConto').hidden = true;
  });

  el('campoAnnoRiepilogo').value = annoCorrente;
  el('btnCalcolaRiepilogoAnnuale').addEventListener('click', () => {
    const anno = Number(el('campoAnnoRiepilogo').value) || annoCorrente;
    renderRiepilogoAnnuale(anno);
  });
  el('btnCancellaRiepilogoAnnuale').addEventListener('click', () => {
    el('contenitoreRiepilogoAnnuale').hidden = true;
    el('btnCancellaRiepilogoAnnuale').hidden = true;
    el('btnStampaRiepilogoAnnuale').hidden = true;
  });
  el('btnStampaRiepilogoAnnuale').addEventListener('click', () => stampaSezione('contenitoreRiepilogoAnnuale'));
  el('campoConguagliMese').addEventListener('input', () => {
    AppState.conguagliPerMese[chiaveMese(annoCorrente, meseCorrente)] = Number(el('campoConguagliMese').value) || 0;
    salvaConguagliStorage();
  });
  renderStorico();

  function chiudiPannelloColori(){
    const p = el('pannelloColoriTurni');
    if(p) p.hidden = true;
  }
  function aggiornaPulsantiColoriDrive(){
    const attivo = typeof backupDriveAttivo === 'function' && backupDriveAttivo();
    ['btnEsportaColoriTurni','btnImportaColoriTurni'].forEach(id => {
      const b = el(id);
      if(!b) return;
      b.classList.toggle('btn-premium-bloccato', !attivo);
      b.title = attivo
        ? (id.indexOf('Esporta')>=0 ? 'Esporta i colori su file' : 'Importa colori da file')
        : 'Funzione a pagamento: attiva Backup Drive (1,99€)';
    });
  }
  function apriPannelloColori(){
    const p = el('pannelloColoriTurni');
    if(!p) return;
    p.hidden = false;
    renderColoriTurni();
    aggiornaPulsantiColoriDrive();
    p.scrollIntoView({behavior:'smooth', block:'nearest'});
  }
  el('btnApriColoriTurni')?.addEventListener('click', () => {
    const p = el('pannelloColoriTurni');
    if(!p) return;
    if(p.hidden) apriPannelloColori();
    else chiudiPannelloColori();
  });
  on('btnChiudiColoriTurni','click', chiudiPannelloColori);
  on('btnChiudiColoriTurni2','click', chiudiPannelloColori);
  on('btnEsportaColoriTurni','click', () => {
    if(typeof esportaBackupColori === 'function') esportaBackupColori();
  });
  on('btnImportaColoriTurni','click', () => {
    const inp = el('campoImportaColoriTurni');
    if(inp) inp.click();
  });
  on('campoImportaColoriTurni','change', (e) => {
    const file = e.target && e.target.files && e.target.files[0];
    if(file && typeof importaBackupColori === 'function') importaBackupColori(file);
    if(e.target) e.target.value = '';
  });
  el('btnRipristinaColoriTurni').addEventListener('click', () => {
    mostraConferma('Questo riporta tutti i colori dei turni ai valori predefiniti. Continuare?', () => {
      AppState.coloriTurni = {};
      CATEGORIE_COLORABILI.forEach(c => { AppState.coloriTurni[c.chiave] = c.predefinito; });
      salvaColoriTurniStorage();
      applicaColoriTurni();
      renderColoriTurni();
      if(typeof renderCalendario === 'function') renderCalendario();
    });
  });

  el('btnChiudiTurno').addEventListener('click', () => { el('pannelloTurno').hidden = true; });

  el('btnAggiungiSecondoStraordinario').addEventListener('click', () => {
    el('blocchStrSecondo').hidden = false;
    el('btnAggiungiSecondoStraordinario').hidden = true;
    el('campoStrDopoInizio')?.focus();
    aggiornaAnteprima();
  });
  el('btnRimuoviSecondoStraordinario').addEventListener('click', () => {
    el('campoStrDopoInizio').value = '';
    el('campoStrDopoFine').value = '';
    el('blocchStrSecondo').hidden = true;
    el('btnAggiungiSecondoStraordinario').hidden = false;
    aggiornaAnteprima();
  });

  el('campoRiposo').addEventListener('change', () => {
    if(el('campoRiposo').checked) el('campoAssenzaTipo').value = '';
    aggiornaVisibilitaCampiOrario(); aggiornaAnteprima();
  });
  el('campoAssenzaTipo').addEventListener('change', () => {
    if(el('campoAssenzaTipo').value) el('campoRiposo').checked = false;
    aggiornaVisibilitaCampiOrario(); aggiornaAnteprima();
  });
  el('campoRCOraInizio').addEventListener('input', aggiornaAnteprima);
  el('campoRCOraFine').addEventListener('input', aggiornaAnteprima);

  el('campoMissione').addEventListener('change', () => {
    const attiva = el('campoMissione').checked;
    el('campoDurataMissioneBox').style.display = attiva ? '' : 'none';
    if(attiva && Number(el('campoDurataMissione').value) === 0){
      // precompilo con le ore totali del turno come punto di partenza, modificabile
      const t = leggiTurnoDalModale();
      const c = classificaTurno(t);
      if(c.oreTotali > 0) el('campoDurataMissione').value = c.oreTotali;
    }
  });

  el('campoOrdinePubblico').addEventListener('change', () => {
    const attivo = el('campoOrdinePubblico').checked;
    el('campoOrdinePubblicoBox').style.display = attivo ? '' : 'none';
    el('campoOPPernottamentoBox').style.display = (attivo && el('campoOPSede').value === 'fuori') ? '' : 'none';
  });
  el('campoOPSede').addEventListener('change', () => {
    el('campoOPPernottamentoBox').style.display = el('campoOPSede').value === 'fuori' ? '' : 'none';
  });

  el('campoModelloTurno').addEventListener('change', () => {
    const scelta = el('campoModelloTurno').value;
    if(!scelta) return;
    if(scelta === 'riposo'){
      el('campoRiposo').checked = true;
      el('campoAssenzaTipo').value = '';
    } else {
      el('campoRiposo').checked = false;
      el('campoAssenzaTipo').value = '';
      el('campoOraInizio').value = MODELLI_TURNO[scelta].oraInizio;
      el('campoOraFine').value = MODELLI_TURNO[scelta].oraFine;
    }
    aggiornaVisibilitaCampiOrario();
    aggiornaAnteprima();
  });
  ['campoOraInizio','campoOraFine','campoStrPrimaInizio','campoStrPrimaFine','campoStrDopoInizio','campoStrDopoFine','campoSecondoOraInizio','campoSecondoOraFine'].forEach(id => {
    el(id).addEventListener('input', aggiornaAnteprima);
  });
  el('campoCompensaStraordinario').addEventListener('change', aggiornaAnteprima);
  el('campoPermessoBreveAttivo').addEventListener('change', () => {
    el('campiPermessoBreve').style.display = el('campoPermessoBreveAttivo').checked ? '' : 'none';
    aggiornaAnteprima();
  });
  el('campoPermessoBreveInizio').addEventListener('input', aggiornaAnteprima);
  el('campoPermessoBreveFine').addEventListener('input', aggiornaAnteprima);
  el('campoRecuperoPermessoBreveAttivo').addEventListener('change', () => {
    el('campiRecuperoPermessoBreve').style.display = el('campoRecuperoPermessoBreveAttivo').checked ? '' : 'none';
    aggiornaAnteprima();
  });
  el('campoRecuperoPermessoBreveInizio').addEventListener('input', aggiornaAnteprima);
  el('campoRecuperoPermessoBreveFine').addEventListener('input', aggiornaAnteprima);
  el('campoSecondoAttivo').addEventListener('change', () => {
    el('campiSecondoSegmento').style.display = el('campoSecondoAttivo').checked ? '' : 'none';
    aggiornaAnteprima();
  });

  el('btnSalvaTurno').addEventListener('click', () => {
    const nuovoTurno = leggiTurnoDalModale();
    const salva = () => {
      AppState.turni[giornoSelezionato] = nuovoTurno;
      salvaTurniStorage();
      el('pannelloTurno').hidden = true;
      renderCalendario();
      if(typeof renderStatistiche==='function' && !el('vistaStatistiche')?.hidden) renderStatistiche();
    };
    if(typeof rilevaSovrapposizioneStraordinario === 'function' && rilevaSovrapposizioneStraordinario(nuovoTurno)){
      mostraConferma('Le ore di straordinario che hai inserito si sovrappongono all\'orario del turno svolto: rischi di contare due volte le stesse ore. Vuoi salvare comunque?', salva, 'Attenzione: orari sovrapposti');
    } else {
      salva();
    }
  });
  on('tabCalendario','click', () => mostraScheda('calendario'));
  on('tabReport','click', () => mostraScheda('report'));
  on('tabTurni','click', () => mostraScheda('turni'));
  on('tabAltro','click', () => mostraScheda('altro'));

  // ===================== V60 — Popup rapido + selettore Modelli/Assenze =====================
  on('btnFabAggiungiV2','click', () => {
    if(!giornoSelezionato) return;
    giornoPerPopupV2 = giornoSelezionato;
    apriPopupRapidoGiornoV2();
  });
  on('btnPopupAggiungiTurno','click', () => { chiudiPopupRapidoGiornoV2(); apriSelettoreModelliV2('turni'); });
  on('btnPopupChiudi','click', () => chiudiPopupRapidoGiornoV2());
  on('btnPopupAggiungiEvento','click', () => {
    chiudiPopupRapidoGiornoV2();
    if(!giornoPerPopupV2) return;
    apriModaleTurno(giornoPerPopupV2);
    // "+ Evento" serve per una nota/promemoria, non per assegnare un turno: portiamo subito
    // l'attenzione lì invece di lasciare aperto lo stesso modulo di "+ Turno" senza differenza.
    setTimeout(() => el('campoNotaGiorno')?.focus(), 60);
  });
  on('btnChiudiSelettoreModelli','click', () => { el('overlaySelettoreModelli').hidden = true; });
  on('tabSelettoreModelliTurni','click', () => apriSelettoreModelliV2('turni'));
  on('tabSelettoreModelliAssenze','click', () => apriSelettoreModelliV2('assenze'));
  const listaModelliTurniHost = el('listaModelliTurni');
  if(listaModelliTurniHost) listaModelliTurniHost.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modello]');
    if(btn) applicaModelloV2(btn.dataset.modello);
  });
  const listaModelliAssenzeHost = el('listaModelliAssenze');
  if(listaModelliAssenzeHost) listaModelliAssenzeHost.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-assenza]');
    if(btn) applicaAssenzaV2(btn.dataset.assenza);
  });
  on('btnImpostazioni','click', () => mostraScheda('impostazioni'));
  on('btnStatistiche','click', () => mostraScheda('statistiche'));


  el('btnRimuoviTurno').addEventListener('click', () => {
    delete AppState.turni[giornoSelezionato];
    salvaTurniStorage();
    el('pannelloTurno').hidden = true;
    renderCalendario();
  });
}

// ===================== V60 — Calendario stile "Supershift": funzioni di supporto =====================
// Modelli pronti per l'inserimento rapido di un turno di lavoro. Colore preso dalla stessa
// personalizzazione già usata sul calendario (coloreCategoria), quindi resta coerente se l'utente
// cambia i colori da Impostazioni.
const MODELLI_TURNO_V2 = [
  { id:'sera', nome:'Sera', oraInizio:'19:00', oraFine:'01:00', sigla:'SE', chiaveColore:'sera' },
  { id:'pomeriggio', nome:'Pomeriggio', oraInizio:'13:00', oraFine:'19:00', sigla:'PO', chiaveColore:'pomeriggio' },
  { id:'mattina', nome:'Mattino', oraInizio:'07:00', oraFine:'13:00', sigla:'MA', chiaveColore:'mattina' },
  { id:'notte', nome:'Notte', oraInizio:'01:00', oraFine:'07:00', sigla:'NO', chiaveColore:'notte' },
  { id:'riposo', nome:'Riposo', riposo:true, sigla:'RI', chiaveColore:'riposo' }
];

let giornoPerPopupV2 = null;

// Tocco su una cella del calendario: se il giorno ha già qualcosa (turno, riposo o assenza),
// apre direttamente il dettaglio/modifica; se è vuoto, propone il popup rapido "+ Turno / + Evento"
// invece di aprire subito il modulo completo.
function gestisciTocchGiornoV2(iso){
  selezionaGiorno(iso);
  const t = AppState.turni[iso];
  const haGiaQualcosa = !!(t && (t.oraInizio || t.riposo || t.assenzaTipo));
  if(haGiaQualcosa){
    apriModaleTurno(iso);
  } else {
    giornoPerPopupV2 = iso;
    apriPopupRapidoGiornoV2();
  }
}

function apriPopupRapidoGiornoV2(){
  const p = el('popupRapidoGiorno');
  if(p) p.hidden = false;
  // Il tocco che ha aperto il popup (FAB o cella del calendario) sta ancora "in corso": rimandiamo
  // di un istante l'ascolto dei tocchi fuori dal popup, altrimenti si chiuderebbe da solo appena
  // aperto, scambiando lo stesso tocco per un "tocco fuori".
  setTimeout(() => document.addEventListener('click', chiudiPopupSeTocchiFuori), 0);
}
function chiudiPopupRapidoGiornoV2(){
  const p = el('popupRapidoGiorno');
  if(p) p.hidden = true;
  document.removeEventListener('click', chiudiPopupSeTocchiFuori);
}
function chiudiPopupSeTocchiFuori(e){
  const p = el('popupRapidoGiorno');
  if(p && !p.hidden && !p.contains(e.target)) chiudiPopupRapidoGiornoV2();
}

function apriSelettoreModelliV2(scheda){
  const overlay = el('overlaySelettoreModelli');
  if(!overlay) return;
  overlay.hidden = false;
  const tabTurni = el('tabSelettoreModelliTurni'), tabAssenze = el('tabSelettoreModelliAssenze');
  const listaTurni = el('listaModelliTurni'), listaAssenze = el('listaModelliAssenze');
  const suTurni = scheda !== 'assenze';
  if(tabTurni) { tabTurni.classList.toggle('attivo', suTurni); tabTurni.setAttribute('aria-selected', String(suTurni)); }
  if(tabAssenze) { tabAssenze.classList.toggle('attivo', !suTurni); tabAssenze.setAttribute('aria-selected', String(!suTurni)); }
  if(listaTurni) listaTurni.hidden = !suTurni;
  if(listaAssenze) listaAssenze.hidden = suTurni;
  renderListaModelliTurniV2();
  renderListaModelliAssenzeV2();
}

function renderListaModelliTurniV2(){
  const host = el('listaModelliTurni');
  if(!host) return;
  host.innerHTML = MODELLI_TURNO_V2.map(m => {
    const colore = typeof coloreCategoria === 'function' ? coloreCategoria(m.chiaveColore) : '#E8ECF0';
    const sotto = m.riposo ? 'giornata libera' : `${m.oraInizio} - ${m.oraFine}`;
    return `<button type="button" class="riga-modello-selettore" data-modello="${m.id}">
      <span class="cerchio-modello" style="background:${colore}">${m.sigla}</span>
      <span class="riga-modello-testo"><strong>${m.nome}</strong><small>${sotto}</small></span>
      <span class="riga-modello-freccia" aria-hidden="true">›</span>
    </button>`;
  }).join('');
}

function renderListaModelliAssenzeV2(){
  const host = el('listaModelliAssenze');
  if(!host) return;
  const assenze = (AppState.assenze || []).filter(a => a.nome !== 'Permesso breve');
  if(!assenze.length){
    host.innerHTML = '<p class="sotto-titolo" style="padding:8px 2px;">Nessuna assenza configurata. Aggiungine una dalla scheda Turni.</p>';
    return;
  }
  host.innerHTML = assenze.map(a => `<button type="button" class="riga-modello-selettore" data-assenza="${escapeHtml(a.id)}">
    <span class="cerchio-modello cerchio-modello-assenza">${escapeHtml((a.nome || '??').slice(0,2).toUpperCase())}</span>
    <span class="riga-modello-testo"><strong>${escapeHtml(a.nome)}</strong></span>
    <span class="riga-modello-freccia" aria-hidden="true">›</span>
  </button>`).join('');
}

function applicaModelloV2(idModello){
  if(!giornoPerPopupV2) return;
  const m = MODELLI_TURNO_V2.find(x => x.id === idModello);
  if(!m) return;
  const iso = giornoPerPopupV2;
  AppState.turni[iso] = m.riposo ? { data: iso, riposo: true } : { data: iso, oraInizio: m.oraInizio, oraFine: m.oraFine };
  salvaTurniStorage();
  el('overlaySelettoreModelli').hidden = true;
  renderCalendario();
  selezionaGiorno(iso);
  mostraToast(`${m.nome} aggiunto`, 'successo');
}

function applicaAssenzaV2(idAssenza){
  if(!giornoPerPopupV2) return;
  const iso = giornoPerPopupV2;
  AppState.turni[iso] = { data: iso, assenzaTipo: idAssenza };
  salvaTurniStorage();
  el('overlaySelettoreModelli').hidden = true;
  renderCalendario();
  selezionaGiorno(iso);
  const nomeAssenza = (AppState.assenze || []).find(a => a.id === idAssenza);
  mostraToast(`${nomeAssenza ? nomeAssenza.nome : 'Assenza'} aggiunta`, 'successo');
}

document.addEventListener('DOMContentLoaded', inizializza);

/* ---------------------------------------------------------
   PWA — registrazione service worker (offline + installabile)
   --------------------------------------------------------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(registrazione => {
      // Controlla subito se c'è un aggiornamento in attesa (senza aspettare il controllo
      // periodico del browser, che può metterci ore su un'app aperta raramente).
      registrazione.update().catch(() => {});

      // Se un nuovo service worker è già pronto ma non ancora attivo (successo prima che
      // questa pagina si caricasse), avvisa subito.
      if(registrazione.waiting) mostraAvvisoNuovaVersione(registrazione.waiting);

      // Se un nuovo service worker inizia l'installazione ORA (mentre l'app è aperta),
      // aspettiamo che finisca di installarsi e poi avvisiamo.
      registrazione.addEventListener('updatefound', () => {
        const installing = registrazione.installing;
        if(!installing) return;
        installing.addEventListener('statechange', () => {
          if(installing.state === 'installed' && navigator.serviceWorker.controller){
            mostraAvvisoNuovaVersione(installing);
          }
        });
      });
    }).catch((e) => console.warn('Service worker non registrato:', e));

    // Quando il nuovo service worker prende davvero il controllo (dopo skipWaiting), la pagina
    // corrente è rimasta con i file vecchi già caricati: un'unica ricarica automatica la porta
    // alla versione nuova. La guardia evita ricariche multiple se l'evento scattasse più volte.
    let giaRicaricato = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(giaRicaricato) return;
      giaRicaricato = true;
      window.location.reload();
    });
  });
}

// Avviso "nuova versione disponibile": invece di ricaricare subito da soli (interromperebbe
// l'utente a metà di qualcosa, es. mentre sta scrivendo un turno), mostriamo un invito esplicito;
// al tocco, diciamo al nuovo service worker di attivarsi — questo farà scattare 'controllerchange'
// sopra, che si occupa della ricarica.
function mostraAvvisoNuovaVersione(worker){
  if(document.getElementById('avvisoNuovaVersioneV65')) return; // non duplicare l'avviso
  const banner = document.createElement('div');
  banner.id = 'avvisoNuovaVersioneV65';
  banner.className = 'avviso-nuova-versione-v65';
  banner.innerHTML = '<span>🔄 Nuova versione disponibile.</span><button type="button">Aggiorna ora</button>';
  banner.querySelector('button').addEventListener('click', () => {
    worker.postMessage({ tipo: 'skipWaiting' });
    banner.remove();
  });
  document.body.appendChild(banner);
}
