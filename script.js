
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
AppState.reportBlocchi = caricaReportBlocchi(); // { prossimoTurno, riepilogoMese, riepilogoOre, statistiche, cedolino }
AppState.modelliTurno = caricaModelliTurno(); // array di modelli turno (5 di base + eventuali personalizzati)
AppState.pattern = caricaPattern(); // V2 — solo visualizzazione/modifica del ciclo per ora
AppState.eventiGiorno = caricaEventiGiorno(); // { iso: [{ id, titolo, tuttoIlGiorno, oraInizio, oraFine, note, luogo }] }
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
    const pp = el('sezioneAssenzePersonalizzate');
    if(!p) return;
    p.hidden = !p.hidden;
    if(pp) pp.hidden = p.hidden; // le due sezioni si aprono e chiudono sempre insieme
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

  on('btnAggiungiAssenzaPersonalizzata','click', () => {
    AppState.assenze.push({ id: nuovoId(), nome:'Nuova voce', valore:0, unita:'gg', personalizzata:true });
    salvaAssenzeStorage();
    renderAssenze();
  });

  on('filtroCalendarioSelect','change', e => impostaFiltroCalendario(e.target.value));
  on('btnModificaGiornoSelezionatoV2','click', () => { if(giornoSelezionato) apriModaleTurno(giornoSelezionato); });

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
    renderListaPatternSempliceV2(); // aggiorna il segno di spunta sulla riga scelta
  });
  aggiornaVisibilitaFasciaOrariaSemplice();
  const listaPatternSempliceHost = el('listaPatternSempliceV2');
  if(listaPatternSempliceHost) listaPatternSempliceHost.addEventListener('click', (e) => {
    const matita = e.target.closest('[data-modifica-pattern]');
    if(matita){ apriEditorPatternSempliceV2(matita.dataset.modificaPattern); return; }
    const btn = e.target.closest('[data-pattern-semplice]');
    if(!btn) return;
    const selettore = el('selettoreModelloSemplice');
    selettore.value = btn.dataset.patternSemplice;
    selettore.dispatchEvent(new Event('change'));
  });
  on('btnChiudiEditorPatternV2','click', () => { el('overlayEditorPatternV2').hidden = true; });
  on('btnFattoEditorPatternV2','click', () => { el('overlayEditorPatternV2').hidden = true; });
  const cicloPatternHostSemplice = el('cicloPatternV2');
  if(cicloPatternHostSemplice) cicloPatternHostSemplice.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-giorno-index]');
    if(!btn) return;
    giornoPatternSelezionatoSemplcieV2 = Number(btn.dataset.giornoIndex);
    renderCicloPatternSempliceV2();
    renderIndennitaGiornoPatternSempliceV2();
  });
  const tavolozzaPatternHostSemplice = el('tavolozzaPatternV2');
  if(tavolozzaPatternHostSemplice) tavolozzaPatternHostSemplice.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modello-id-pattern]');
    if(btn){ assegnaModelloAGiornoPatternSempliceV2(btn.dataset.modelloIdPattern); renderIndennitaGiornoPatternSempliceV2(); }
  });
  const indennitaPatternHostSemplice = el('corpoIndennitaGiornoPatternV2');
  if(indennitaPatternHostSemplice) indennitaPatternHostSemplice.addEventListener('change', aggiornaIndennitaGiornoPatternSempliceV2);

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
    el('campoStrOre2')?.focus();
    aggiornaAnteprima();
  });
  el('btnRimuoviSecondoStraordinario').addEventListener('click', () => {
    el('campoStrOre2').value = '';
    el('campoStrPosizione2').value = 'prima';
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
  ['campoStrOre1','campoStrPosizione1','campoStrOre2','campoStrPosizione2'].forEach(id => {
    const campo = el(id);
    if(campo) campo.addEventListener('input', aggiornaAnteprima);
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

  on('btnPersonalizzaReport','click', apriPersonalizzaReport);
  on('btnChiudiPersonalizzaReport','click', () => { el('overlayPersonalizzaReport').hidden = true; });
  on('btnFattoPersonalizzaReport','click', () => {
    AppState.reportBlocchi = {
      prossimoTurno: el('toggleReportProssimoTurno')?.checked !== false,
      riepilogoMese: el('toggleReportRiepilogoMese')?.checked !== false,
      riepilogoOre: el('toggleReportRiepilogoOre')?.checked !== false,
      statistiche: el('toggleReportStatistiche')?.checked !== false,
      cedolino: el('toggleReportCedolino')?.checked !== false
    };
    salvaReportBlocchiStorage();
    applicaVisibilitaReportBlocchi();
    el('overlayPersonalizzaReport').hidden = true;
  });

  // ===================== V60 — Popup rapido + selettore Modelli/Assenze =====================
  on('btnFabAggiungiV2','click', () => {
    // Chiusura di sicurezza: se un overlay precedente (selettore Modelli, straordinario rapido,
    // modifica modello) fosse rimasto aperto per qualche motivo, coprirebbe la matita in modo
    // invisibile — sembrerebbe che il tocco non faccia nulla. Li chiudiamo sempre prima di aprire
    // il popup, anche se erano già chiusi (innocuo in quel caso).
    ['overlaySelettoreModelli','overlayStraordinarioRapido','overlayModificaModello','overlayEvento','overlayEditorPatternV2'].forEach(id => { const o = el(id); if(o) o.hidden = true; });
    if(!giornoSelezionato) giornoSelezionato = dataISO(new Date());
    giornoPerPopupV2 = giornoSelezionato;
    apriPopupRapidoGiornoV2();
  });
  on('btnPopupAggiungiTurno','click', () => {
    chiudiPopupRapidoGiornoV2();
    // Se il giorno ha già un turno di lavoro, molto probabilmente stai tornando per aggiungere
    // indennità/straordinario, non per riassegnare da capo il turno — apriamo direttamente lì.
    const t = AppState.turni[giornoPerPopupV2];
    const haGiaTurno = !!(t && t.oraInizio && t.oraFine);
    apriSelettoreModelliV2(haGiaTurno ? 'indennita' : 'turni');
  });
  on('btnPopupChiudi','click', () => chiudiPopupRapidoGiornoV2());
  on('btnPopupModifica','click', () => { chiudiPopupRapidoGiornoV2(); if(giornoPerPopupV2) apriModaleTurno(giornoPerPopupV2); });
  on('btnPopupAggiungiEvento','click', () => {
    chiudiPopupRapidoGiornoV2();
    if(!giornoPerPopupV2) return;
    selezionaGiorno(giornoPerPopupV2);
    apriModificaEventoV2(null);
  });
  on('btnChiudiSelettoreModelli','click', () => { el('overlaySelettoreModelli').hidden = true; });
  on('tabSelettoreModelliTurni','click', () => apriSelettoreModelliV2('turni'));
  on('tabSelettoreModelliAssenze','click', () => apriSelettoreModelliV2('assenze'));
  on('tabSelettoreModelliIndennita','click', () => apriSelettoreModelliV2('indennita'));
  const listaModelliTurniHost = el('listaModelliTurni');
  if(listaModelliTurniHost) listaModelliTurniHost.addEventListener('click', (e) => {
    const btnNuovo = e.target.closest('#btnNuovoModelloV2');
    if(btnNuovo){ apriModificaModelloV2(null); return; }
    const btnMatita = e.target.closest('[data-modifica-modello]');
    if(btnMatita){ apriModificaModelloV2(btnMatita.dataset.modificaModello); return; }
    const btn = e.target.closest('[data-modello]');
    if(btn) applicaModelloV2(btn.dataset.modello);
  });
  const listaModelliAssenzeHost = el('listaModelliAssenze');
  if(listaModelliAssenzeHost) listaModelliAssenzeHost.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-assenza]');
    if(btn) applicaAssenzaV2(btn.dataset.assenza);
  });
  const listaModelliIndennitaHost = el('listaModelliIndennita');
  if(listaModelliIndennitaHost) listaModelliIndennitaHost.addEventListener('click', (e) => {
    if(e.target.closest('#btnIndennitaStraordinarioV2')){ apriStraordinarioRapidoV2(); return; }
    const btn = e.target.closest('[data-indennita]');
    if(btn) applicaIndennitaRapidaV2(btn.dataset.indennita);
  });
  on('btnImpostazioni','click', () => mostraScheda('impostazioni'));
  on('btnChiudiModificaModello','click', () => { el('overlayModificaModello').hidden = true; });
  on('btnSalvaModello','click', salvaModificaModelloV2);
  on('btnEliminaModello','click', eliminaModelloV2);
  on('btnNuovoEventoGiornoV2','click', () => apriModificaEventoV2(null));
  on('btnChiudiEvento','click', () => { el('overlayEvento').hidden = true; });
  on('btnSalvaEvento','click', salvaEventoV2);
  on('btnEliminaEvento','click', eliminaEventoV2);
  on('campoEventoTuttoIlGiorno','change', () => { el('campiEventoOrario').hidden = el('campoEventoTuttoIlGiorno').checked; });
  const listaEventiGiornoHost = el('listaEventiGiornoV2');
  if(listaEventiGiornoHost) listaEventiGiornoHost.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-evento-id]');
    if(btn) apriModificaEventoV2(btn.dataset.eventoId);
  });
  on('btnChiudiStraordinarioRapido','click', () => { el('overlayStraordinarioRapido').hidden = true; });
  on('btnSalvaStraordinarioRapido','click', salvaStraordinarioRapidoV2);
  on('btnStatistiche','click', () => mostraScheda('statistiche'));


  el('btnRimuoviTurno').addEventListener('click', () => {
    delete AppState.turni[giornoSelezionato];
    salvaTurniStorage();
    el('pannelloTurno').hidden = true;
    renderCalendario();
  });
}

// ===================== V60/V78 — Calendario stile "Supershift": funzioni di supporto =====================
// I modelli turno vivono in AppState.modelliTurno (persistente, modificabile e ampliabile) — vedi
// caricaModelliTurno() in storage.js per i 5 di base usati come seme al primo avvio.

let giornoPerPopupV2 = null;
let modelloInModificaV2 = null; // id del modello aperto nel mini-form di modifica/creazione (null = nuovo)

// Tocco su una cella del calendario: se il giorno ha già qualcosa (turno, riposo o assenza),
// apre direttamente il dettaglio/modifica; se è vuoto, propone il popup rapido "+ Turno / + Evento"
// invece di aprire subito il modulo completo.
function gestisciTocchGiornoV2(iso){
  ['overlaySelettoreModelli','overlayStraordinarioRapido','overlayModificaModello','overlayEvento','overlayEditorPatternV2'].forEach(id => { const o = el(id); if(o) o.hidden = true; });
  selezionaGiorno(iso);
  giornoPerPopupV2 = iso;
  apriPopupRapidoGiornoV2();
}

function apriPopupRapidoGiornoV2(){
  const p = el('popupRapidoGiorno');
  if(!p) return;
  const t = AppState.turni[giornoPerPopupV2];
  const haGiaQualcosa = !!(t && (t.oraInizio || t.riposo || t.assenzaTipo));
  el('btnPopupModifica').hidden = !haGiaQualcosa;
  el('dividerPopupModifica').hidden = !haGiaQualcosa;
  p.hidden = false;
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
  if(!p || p.hidden) return;
  if(p.contains(e.target)) return; // tocco dentro il popup stesso
  // La matita e le celle del calendario gestiscono da sole l'apertura/riapertura del popup per
  // il NUOVO giorno o contesto: se li escludessimo qui, questo stesso "tocco fuori" (che risale
  // fino a qui dopo aver già riaperto correttamente il popup un istante prima) lo richiuderebbe
  // subito di nuovo — esattamente il bug per cui il secondo giorno toccato sembrava non aprire nulla.
  if(e.target.closest('#btnFabAggiungiV2')) return;
  if(e.target.closest('.giorno-cella')) return;
  chiudiPopupRapidoGiornoV2();
}

function apriSelettoreModelliV2(scheda){
  const overlay = el('overlaySelettoreModelli');
  if(!overlay) return;
  overlay.hidden = false;
  const tabs = { turni: el('tabSelettoreModelliTurni'), assenze: el('tabSelettoreModelliAssenze'), indennita: el('tabSelettoreModelliIndennita') };
  const liste = { turni: el('listaModelliTurni'), assenze: el('listaModelliAssenze'), indennita: el('listaModelliIndennita') };
  const attiva = scheda === 'assenze' ? 'assenze' : scheda === 'indennita' ? 'indennita' : 'turni';
  Object.keys(tabs).forEach(k => {
    if(tabs[k]) { tabs[k].classList.toggle('attivo', k === attiva); tabs[k].setAttribute('aria-selected', String(k === attiva)); }
    if(liste[k]) liste[k].hidden = (k !== attiva);
  });
  renderListaModelliTurniV2();
  renderListaModelliAssenzeV2();
  renderListaModelliIndennitaV2();
}

function coloreModelloV2(m){
  if(typeof coloreCategoria !== 'function') return '#E8ECF0';
  if(m.riposo) return coloreCategoria('riposo');
  const categoria = (typeof categoriaTurno === 'function' && m.oraInizio && m.oraFine) ? categoriaTurno(m.oraInizio, m.oraFine) : null;
  return coloreCategoria(categoria || 'mattina');
}

// Lista visiva al posto del vecchio menu a tendina per "Quale turnazione?": stessa scelta di
// prima (quinta/quinta10/corta/lunga/personalizzata), ma con anteprima colorata. Il menu vero
// (selettoreModelloSemplice) resta nel DOM, solo nascosto: tutta la logica di applicazione e
// generazione sotto resta quella originale, invariata — qui cambia solo la scelta visiva.
function renderListaPatternSempliceV2(){
  const host = el('listaPatternSempliceV2');
  const selettore = el('selettoreModelloSemplice');
  if(!host || !selettore) return;
  const trovaModello = id => (AppState.modelliTurno || []).find(m => m.id === id);
  const pallini = ids => ids.map(id => {
    const m = trovaModello(id);
    const colore = m ? coloreModelloV2(m) : '#E8ECF0';
    return `<span style="width:16px;height:16px;border-radius:50%;background:${colore};margin-right:-5px;border:2px solid var(--pannello);display:inline-block;"></span>`;
  }).join('');
  const voci = [
    { value:'quinta', nome:'Turno in quinta', sotto:'5 giorni a rotazione', giorni:['sera','pomeriggio','mattina','notte','riposo'] },
    { value:'quinta10', nome:'Turno in quinta 10 giorni', sotto:'10 giorni a rotazione', giorni:['sera','pomeriggio','mattina','notte','riposo'] },
    { value:'corta', nome:'Settimana corta', sotto:'Lun–Ven, orario fisso', icona:'📅' },
    { value:'lunga', nome:'Settimana lunga', sotto:'Lun–Sab, orario fisso', icona:'📅' },
    { value:'personalizzata', nome:'Personalizzata', sotto:'la imposto tu', icona:'⚙️' }
  ];
  const selezionato = selettore.value;
  const mappaPatternId = { quinta:'pattern_quinta5', quinta10:'pattern_quinta10' };
  host.innerHTML = voci.map(v => {
    const attivo = v.value === selezionato;
    const anteprima = v.giorni ? `<span style="display:flex;flex-shrink:0;">${pallini(v.giorni)}</span>` : `<span style="font-size:1.1rem;flex-shrink:0;">${v.icona}</span>`;
    const patternId = mappaPatternId[v.value];
    const matita = patternId ? `<button type="button" class="riga-modello-matita" data-modifica-pattern="${patternId}" aria-label="Modifica ciclo di ${escapeHtml(v.nome)}">✏️</button>` : '';
    return `<div class="riga-modello-selettore">
      <button type="button" class="riga-modello-selettore-corpo" data-pattern-semplice="${v.value}" style="${attivo ? 'background:var(--carta);' : ''}">
        ${anteprima}
        <span class="riga-modello-testo"><strong>${escapeHtml(v.nome)}</strong><small>${escapeHtml(v.sotto)}</small></span>
        ${attivo ? '<span aria-hidden="true">✓</span>' : ''}
      </button>
      ${matita}
    </div>`;
  }).join('');
}

// ===================== Editor del ciclo (solo visualizzazione/modifica, non genera nulla) =====================
let patternInModificaSemplcieV2 = null;
let giornoPatternSelezionatoSemplcieV2 = 0;

function apriEditorPatternSempliceV2(patternId){
  const p = (AppState.pattern || []).find(x => x.id === patternId);
  if(!p) return;
  // Forziamo sempre la scheda Turni (con "Genera turni automaticamente" visibile) dietro
  // all'editor: se per qualche motivo era rimasta attiva Calendario (es. la matita del
  // calendario toccata per errore, o un'altra sequenza di navigazione), l'editor del ciclo
  // non deve mai aprirsi sopra la schermata sbagliata.
  mostraScheda('sequenza');
  patternInModificaSemplcieV2 = patternId;
  giornoPatternSelezionatoSemplcieV2 = 0;
  el('titoloEditorPatternV2').textContent = 'Ciclo — ' + p.nome;
  renderCicloPatternSempliceV2();
  renderTavolozzaPatternSempliceV2();
  renderIndennitaGiornoPatternSempliceV2();
  el('overlayEditorPatternV2').hidden = false;
}

function renderCicloPatternSempliceV2(){
  const host = el('cicloPatternV2');
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!host || !p) return;
  const modelli = AppState.modelliTurno || [];
  host.innerHTML = p.giorni.map((g, i) => {
    const m = modelli.find(x => x.id === g.modelloId);
    const colore = m ? coloreModelloV2(m) : '#E8ECF0';
    const sigla = m ? (m.sigla || '?') : '?';
    const selezionato = i === giornoPatternSelezionatoSemplcieV2;
    const bordo = selezionato ? 'border:2px solid var(--inchiostro);' : 'border:2px solid transparent;';
    const badge = (g.indennita && g.indennita.length) ? '<span style="font-size:.5rem;">🛡️</span>' : '';
    return `<button type="button" class="ciclo-pattern-giorno-v2" data-giorno-index="${i}" style="background:${colore};${bordo}">
      <span style="font-size:.6rem;font-weight:800;">${escapeHtml(sigla)}</span>${badge}
    </button>`;
  }).join('');
}

// Mostra la lista delle indennità fisse per il giorno del ciclo ATTUALMENTE selezionato — nascosta
// del tutto se quel giorno è un Riposo (non ha senso spuntare indennità su un giorno libero).
function renderIndennitaGiornoPatternSempliceV2(){
  const box = el('indennitaGiornoPatternV2');
  const corpo = el('corpoIndennitaGiornoPatternV2');
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!box || !corpo || !p) return;
  const giorno = p.giorni[giornoPatternSelezionatoSemplcieV2];
  if(!giorno){ box.hidden = true; return; }
  const modello = (AppState.modelliTurno || []).find(m => m.id === giorno.modelloId);
  if(!modello || modello.riposo){ box.hidden = true; return; }
  box.hidden = false;
  const attive = giorno.indennita || [];
  corpo.innerHTML = INDENNITA_RAPIDE_V2.map(x => `<label class="campo-modale campo-riga">
    <input type="checkbox" data-indennita-pattern="${x.chiave}" ${attive.includes(x.chiave) ? 'checked' : ''}> ${escapeHtml(x.nome)}
  </label>`).join('');
}

function aggiornaIndennitaGiornoPatternSempliceV2(){
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!p) return;
  const giorno = p.giorni[giornoPatternSelezionatoSemplcieV2];
  if(!giorno) return;
  const spuntate = Array.from(el('corpoIndennitaGiornoPatternV2').querySelectorAll('[data-indennita-pattern]:checked')).map(c => c.dataset.indennitaPattern);
  giorno.indennita = spuntate;
  salvaPatternStorage();
  renderCicloPatternSempliceV2(); // aggiorna il 🛡️ sul giorno nel ciclo
}

function renderTavolozzaPatternSempliceV2(){
  const host = el('tavolozzaPatternV2');
  if(!host) return;
  host.innerHTML = (AppState.modelliTurno || []).map(m => {
    const colore = coloreModelloV2(m);
    return `<button type="button" class="tavolozza-pattern-cerchio-v2" data-modello-id-pattern="${escapeHtml(m.id)}" style="background:${colore}" title="${escapeHtml(m.nome)}">${escapeHtml(m.sigla || '?')}</button>`;
  }).join('');
}

function assegnaModelloAGiornoPatternSempliceV2(modelloId){
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!p) return;
  const giorno = p.giorni[giornoPatternSelezionatoSemplcieV2];
  if(!giorno) return;
  giorno.modelloId = modelloId;
  salvaPatternStorage();
  renderCicloPatternSempliceV2();
}


function renderListaModelliTurniV2(){
  const host = el('listaModelliTurni');
  if(!host) return;
  const righe = (AppState.modelliTurno || []).map(m => {
    const colore = coloreModelloV2(m);
    const sotto = m.riposo ? 'giornata libera' : `${m.oraInizio} - ${m.oraFine}`;
    return `<div class="riga-modello-selettore">
      <button type="button" class="riga-modello-selettore-corpo" data-modello="${escapeHtml(m.id)}">
        <span class="cerchio-modello" style="background:${colore}">${escapeHtml(m.sigla || (m.nome||'??').slice(0,2).toUpperCase())}</span>
        <span class="riga-modello-testo"><strong>${escapeHtml(m.nome)}</strong><small>${escapeHtml(sotto)}</small></span>
      </button>
      <button type="button" class="riga-modello-matita" data-modifica-modello="${escapeHtml(m.id)}" aria-label="Modifica ${escapeHtml(m.nome)}">✏️</button>
    </div>`;
  }).join('');
  host.innerHTML = righe + `<button type="button" class="riga-modello-nuovo" id="btnNuovoModelloV2">＋ Nuovo turno personalizzato</button>`;
}

function renderListaModelliAssenzeV2(){
  const host = el('listaModelliAssenze');
  if(!host) return;
  const assenze = (AppState.assenze || []).filter(a => a.nome !== 'Permesso breve');
  if(!assenze.length){
    host.innerHTML = '<p class="sotto-titolo" style="padding:8px 2px;">Nessuna assenza configurata. Aggiungine una dalla scheda Turni.</p>';
    return;
  }
  host.innerHTML = assenze.map(a => `<button type="button" class="riga-modello-selettore-corpo riga-modello-selettore" data-assenza="${escapeHtml(a.id)}">
    <span class="cerchio-modello cerchio-modello-assenza">${escapeHtml(siglaAssenza(a.nome || '??'))}</span>
    <span class="riga-modello-testo"><strong>${escapeHtml(a.nome)}</strong></span>
    <span class="riga-modello-freccia" aria-hidden="true">›</span>
  </button>`).join('');
}

// Le indennità restano fisse (non modificabili, come deciso): qui solo etichetta+chiave del
// campo booleano già esistente nel turno, per poterle spuntare rapidamente dal popup.
const INDENNITA_RAPIDE_V2 = [
  { chiave:'missione', sigla:'MI', nome:'Missione' },
  { chiave:'ordinePubblico', sigla:'OP', nome:'Ordine pubblico' },
  { chiave:'servizioEsterno', sigla:'SE', nome:'Servizio esterno' },
  { chiave:'buonoPasto', sigla:'BP', nome:'Buono pasto' },
  { chiave:'reperibilita', sigla:'RE', nome:'Reperibilità' },
  { chiave:'controlloTerritorio', sigla:'CT', nome:'Controllo territorio' },
  { chiave:'cambioTurno', sigla:'CA', nome:'Cambio turno' },
  { chiave:'compensazioneRiposo', sigla:'CR', nome:'Recupero riposo' },
  { chiave:'recuperoFestivoLavorato', sigla:'RF', nome:'Recupero festivo' }
];
function renderListaModelliIndennitaV2(){
  const host = el('listaModelliIndennita');
  if(!host) return;
  const t = giornoPerPopupV2 ? (AppState.turni[giornoPerPopupV2] || {}) : {};
  const righeIndennita = INDENNITA_RAPIDE_V2.map(x => `<button type="button" class="riga-modello-selettore-corpo riga-modello-selettore" data-indennita="${x.chiave}">
    <span class="cerchio-modello cerchio-modello-assenza">${x.sigla}${t[x.chiave] ? ' ✓' : ''}</span>
    <span class="riga-modello-testo"><strong>${x.nome}</strong></span>
  </button>`).join('');
  const rigaStraordinario = `<button type="button" class="riga-modello-selettore-corpo riga-modello-selettore" id="btnIndennitaStraordinarioV2">
    <span class="cerchio-modello cerchio-modello-assenza">⏱️</span>
    <span class="riga-modello-testo"><strong>Straordinario</strong><small>ore, prima o dopo il turno</small></span>
  </button>`;
  host.innerHTML = rigaStraordinario + righeIndennita;
}

function applicaModelloV2(idModello){
  if(!giornoPerPopupV2) return;
  const m = (AppState.modelliTurno || []).find(x => x.id === idModello);
  if(!m) return;
  const iso = giornoPerPopupV2;
  AppState.turni[iso] = m.riposo ? { data: iso, riposo: true } : { data: iso, oraInizio: m.oraInizio, oraFine: m.oraFine };
  salvaTurniStorage();
  salvaUltimoModelloUsato('modello', m.id);
  renderCalendario();
  selezionaGiorno(iso);
  mostraToast(`${m.nome} aggiunto`, 'successo');
  // Invece di chiudere qui, passiamo subito alla scheda Indennità (resta lo stesso popup aperto):
  // così indennità/straordinario si aggiungono nello stesso momento, senza dover ritoccare il
  // giorno una seconda volta. Non ha senso per "Riposo" (nessun orario a cui agganciarsi).
  if(!m.riposo) apriSelettoreModelliV2('indennita');
  else el('overlaySelettoreModelli').hidden = true;
}

function applicaAssenzaV2(idAssenza){
  if(!giornoPerPopupV2) return;
  const iso = giornoPerPopupV2;
  AppState.turni[iso] = { data: iso, assenzaTipo: idAssenza };
  salvaTurniStorage();
  salvaUltimoModelloUsato('assenza', idAssenza);
  el('overlaySelettoreModelli').hidden = true;
  renderCalendario();
  selezionaGiorno(iso);
  const nomeAssenza = (AppState.assenze || []).find(a => a.id === idAssenza);
  mostraToast(`${nomeAssenza ? nomeAssenza.nome : 'Assenza'} aggiunta`, 'successo');
}

// Spunta/rimuove un'indennità rapida per il giorno del popup, senza aprire il pannello grande.
// Richiede che il giorno abbia già un turno di lavoro (le indennità si aggiungono a un turno,
// non stanno da sole) — se manca, avvisiamo invece di salvare qualcosa senza senso.
function applicaIndennitaRapidaV2(chiave){
  if(!giornoPerPopupV2) return;
  const iso = giornoPerPopupV2;
  const t = AppState.turni[iso];
  if(!t || !t.oraInizio || !t.oraFine){
    mostraToast('Assegna prima un turno di lavoro a questo giorno: le indennità si aggiungono a un turno.', 'avviso');
    return;
  }
  t[chiave] = !t[chiave];
  salvaTurniStorage();
  renderCalendario();
  const nome = (INDENNITA_RAPIDE_V2.find(x => x.chiave === chiave) || {}).nome || chiave;
  mostraToast(t[chiave] ? `${nome} aggiunta` : `${nome} rimossa`, 'successo');
  renderListaModelliIndennitaV2();
}

// ===================== Nuovo/modifica turno personalizzato =====================
function apriModificaModelloV2(id){
  modelloInModificaV2 = id;
  const m = id ? (AppState.modelliTurno || []).find(x => x.id === id) : null;
  el('titoloModificaModello').textContent = m ? `Modifica "${m.nome}"` : 'Nuovo turno';
  el('campoModModelloNome').value = m ? m.nome : '';
  const isRiposo = !!(m && m.riposo);
  el('campiModModelloOrario').hidden = isRiposo;
  el('campoModModelloInizio').value = m ? (m.oraInizio || '') : '';
  el('campoModModelloFine').value = m ? (m.oraFine || '') : '';
  // "Elimina" ha senso solo per un turno che già esiste, non per uno nuovo che stai ancora creando.
  el('btnEliminaModello').hidden = !m;
  el('overlayModificaModello').hidden = false;
}
function salvaModificaModelloV2(){
  const nome = el('campoModModelloNome').value.trim();
  if(!nome){ mostraToast('Dai un nome al turno prima di salvare.', 'avviso'); return; }
  const esistente = modelloInModificaV2 ? (AppState.modelliTurno || []).find(x => x.id === modelloInModificaV2) : null;
  const isRiposo = !!(esistente && esistente.riposo); // il tipo "riposo" non si crea da qui, solo si rinomina se già esistente
  if(!isRiposo){
    const oraInizio = el('campoModModelloInizio').value, oraFine = el('campoModModelloFine').value;
    if(!oraInizio || !oraFine){ mostraToast('Inserisci ora di inizio e fine.', 'avviso'); return; }
    if(esistente){ esistente.nome = nome; esistente.oraInizio = oraInizio; esistente.oraFine = oraFine; esistente.sigla = nome.slice(0,2).toUpperCase(); }
    else {
      AppState.modelliTurno.push({ id: 'personalizzato_' + Date.now(), nome, oraInizio, oraFine, sigla: nome.slice(0,2).toUpperCase() });
    }
  } else {
    esistente.nome = nome;
  }
  salvaModelliTurnoStorage();
  el('overlayModificaModello').hidden = true;
  renderListaModelliTurniV2();
  mostraToast(`"${nome}" salvato`, 'successo');
}
function eliminaModelloV2(){
  if(!modelloInModificaV2) return;
  AppState.modelliTurno = (AppState.modelliTurno || []).filter(x => x.id !== modelloInModificaV2);
  salvaModelliTurnoStorage();
  el('overlayModificaModello').hidden = true;
  renderListaModelliTurniV2();
  mostraToast('Turno eliminato', 'successo');
}

// ===================== Eventi del giorno (separati dal turno, più di uno per giorno) =====================
let eventoInModificaV2 = null; // { iso, id } dell'evento aperto nel mini-form, null = nuovo

function renderListaEventiGiornoV2(){
  const host = el('listaEventiGiornoV2');
  if(!host || !giornoSelezionato) return;
  const eventi = AppState.eventiGiorno[giornoSelezionato] || [];
  if(!eventi.length){ host.innerHTML = ''; return; }
  host.innerHTML = eventi.map(ev => {
    const quando = ev.tuttoIlGiorno ? 'Tutto il giorno' : `${ev.oraInizio || '—'} - ${ev.oraFine || '—'}`;
    return `<button type="button" class="riga-evento-giorno-v2" data-evento-id="${escapeHtml(ev.id)}">
      <span class="riga-evento-giorno-pallino" aria-hidden="true">●</span>
      <span class="riga-evento-giorno-testo"><strong>${escapeHtml(ev.titolo || 'Senza titolo')}</strong><small>${escapeHtml(quando)}</small></span>
      <span class="riga-modello-freccia" aria-hidden="true">›</span>
    </button>`;
  }).join('');
}

function apriModificaEventoV2(id){
  if(!giornoSelezionato) return;
  eventoInModificaV2 = id ? { iso: giornoSelezionato, id } : null;
  const ev = id ? (AppState.eventiGiorno[giornoSelezionato] || []).find(e => e.id === id) : null;
  el('titoloModaleEvento').textContent = ev ? 'Modifica evento' : 'Nuovo evento';
  el('campoEventoTitolo').value = ev ? (ev.titolo || '') : '';
  el('campoEventoTuttoIlGiorno').checked = !!(ev && ev.tuttoIlGiorno);
  el('campoEventoOraInizio').value = ev ? (ev.oraInizio || '') : '';
  el('campoEventoOraFine').value = ev ? (ev.oraFine || '') : '';
  el('campoEventoLuogo').value = ev ? (ev.luogo || '') : '';
  el('campoEventoNote').value = ev ? (ev.note || '') : '';
  el('campiEventoOrario').hidden = el('campoEventoTuttoIlGiorno').checked;
  el('btnEliminaEvento').hidden = !ev;
  el('overlayEvento').hidden = false;
}

function salvaEventoV2(){
  if(!giornoSelezionato) return;
  const titolo = el('campoEventoTitolo').value.trim();
  if(!titolo){ mostraToast('Dai un titolo all\'evento prima di salvare.', 'avviso'); return; }
  const tuttoIlGiorno = el('campoEventoTuttoIlGiorno').checked;
  const dati = {
    titolo,
    tuttoIlGiorno,
    oraInizio: tuttoIlGiorno ? '' : el('campoEventoOraInizio').value,
    oraFine: tuttoIlGiorno ? '' : el('campoEventoOraFine').value,
    luogo: el('campoEventoLuogo').value.trim(),
    note: el('campoEventoNote').value.trim()
  };
  if(!AppState.eventiGiorno[giornoSelezionato]) AppState.eventiGiorno[giornoSelezionato] = [];
  const lista = AppState.eventiGiorno[giornoSelezionato];
  if(eventoInModificaV2){
    const esistente = lista.find(e => e.id === eventoInModificaV2.id);
    if(esistente) Object.assign(esistente, dati);
  } else {
    lista.push({ id: 'evento_' + Date.now(), ...dati });
  }
  salvaEventiGiornoStorage();
  el('overlayEvento').hidden = true;
  renderListaEventiGiornoV2();
  renderCalendario();
  mostraToast('Evento salvato', 'successo');
}

function eliminaEventoV2(){
  if(!eventoInModificaV2) return;
  const lista = AppState.eventiGiorno[eventoInModificaV2.iso];
  if(lista){
    AppState.eventiGiorno[eventoInModificaV2.iso] = lista.filter(e => e.id !== eventoInModificaV2.id);
    if(!AppState.eventiGiorno[eventoInModificaV2.iso].length) delete AppState.eventiGiorno[eventoInModificaV2.iso];
  }
  salvaEventiGiornoStorage();
  el('overlayEvento').hidden = true;
  renderListaEventiGiornoV2();
  renderCalendario();
  mostraToast('Evento eliminato', 'successo');
}

// ===================== Straordinario rapido dalla scheda Indennità =====================
function apriStraordinarioRapidoV2(){
  if(!giornoPerPopupV2) return;
  const t = AppState.turni[giornoPerPopupV2];
  if(!t || !t.oraInizio || !t.oraFine){
    mostraToast('Assegna prima un turno di lavoro a questo giorno: lo straordinario si calcola a partire dal suo orario.', 'avviso');
    return;
  }
  el('campoStrRapidoOre').value = '';
  el('campoStrRapidoPosizione').value = 'prima';
  el('campoStrRapidoOrarioInizio').value = '';
  el('campoStrRapidoOrarioFine').value = '';
  el('overlayStraordinarioRapido').hidden = false;
}
function salvaStraordinarioRapidoV2(){
  if(!giornoPerPopupV2) return;
  const iso = giornoPerPopupV2;
  const t = AppState.turni[iso];
  if(!t || !t.oraInizio || !t.oraFine) return;
  const orarioManualeInizio = el('campoStrRapidoOrarioInizio').value;
  const orarioManualeFine = el('campoStrRapidoOrarioFine').value;
  let r;
  if(orarioManualeInizio && orarioManualeFine){
    r = { inizio: orarioManualeInizio, fine: orarioManualeFine };
  } else {
    const ore = el('campoStrRapidoOre').value;
    const posizione = el('campoStrRapidoPosizione').value;
    if(!ore || Number(ore) <= 0){ mostraToast('Inserisci quante ore di straordinario (oppure l\'orario esatto qui sotto).', 'avviso'); return; }
    r = calcolaOrarioStraordinarioDaOre(t.oraInizio, t.oraFine, ore, posizione);
  }
  // Il primo blocco straordinario libero va nella coppia "Prima"; se è già occupata (raro, da
  // un'aggiunta precedente) usiamo la coppia "Dopo" — le stesse due coppie usate dal pannello
  // completo, quindi tutto resta coerente comunque poi si riapra il turno.
  if(!t.straordinarioPrimaInizio){ t.straordinarioPrimaInizio = r.inizio; t.straordinarioPrimaFine = r.fine; }
  else { t.straordinarioDopoInizio = r.inizio; t.straordinarioDopoFine = r.fine; }
  salvaTurniStorage();
  el('overlayStraordinarioRapido').hidden = true;
  renderCalendario();
  mostraToast('Straordinario aggiunto', 'successo');
}

// ===================== Personalizza Report: mostra/nascondi blocchi a scelta =====================
// Applica lo stato attuale di AppState.reportBlocchi ai contenitori reali della pagina.
// "Prossimo turno" e "Riepilogo mese" restano dentro sezioneReportTop indipendentemente dal fatto
// che siano nascosti: nascondiamo solo i LORO elementi, non l'intera sezione (che ospita anche il
// titolo "Report" e il pulsante ⚙️, sempre visibili).
// Riepilogo di sola lettura del giorno selezionato, mostrato dentro "Il giorno e altri strumenti"
// sotto il calendario — così si vede cosa c'è quel giorno senza doverlo aprire, e da lì un
// pulsante porta dritto alla modifica se serve.
function aggiornaRiepilogoGiornoSelezionatoV2(){
  const box = el('riepilogoGiornoSelezionatoV2');
  const boxIndennita = el('indennitaGiornoSelezionatoV2');
  if(!box || !giornoSelezionato) return;
  const d = new Date(giornoSelezionato + 'T00:00:00');
  const dataLeggibile = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  const t = AppState.turni[giornoSelezionato];
  let testo;
  if(!t) testo = `${dataLeggibile} — nessun turno`;
  else if(t.riposo) testo = `${dataLeggibile} — Riposo`;
  else if(t.assenzaTipo){
    const voce = (AppState.assenze || []).find(a => a.id === t.assenzaTipo);
    testo = `${dataLeggibile} — ${voce ? voce.nome : 'Assenza'}`;
  } else if(t.oraInizio && t.oraFine) testo = `${dataLeggibile} — ${t.oraInizio} - ${t.oraFine}`;
  else testo = `${dataLeggibile} — turno incompleto`;
  box.textContent = testo;
  renderListaEventiGiornoV2();
  if(!boxIndennita) return;
  if(!t || !t.oraInizio || !t.oraFine){ boxIndennita.hidden = true; boxIndennita.innerHTML = ''; return; }
  const pezzi = [];
  INDENNITA_RAPIDE_V2.forEach(x => { if(t[x.chiave]) pezzi.push(`<span class="indennita-giorno-badge" title="${escapeHtml(x.nome)}">${x.sigla}</span>`); });
  if(typeof classificaTurno === 'function' && typeof totaleStraordinario === 'function'){
    const c = classificaTurno(t);
    const oreStr = totaleStraordinario(c);
    if(oreStr > 0) pezzi.push(`<span class="indennita-giorno-badge indennita-giorno-badge-str" title="Straordinario">⏱️ ${formatOreMinuti(oreStr)}</span>`);
  }
  if(!pezzi.length){ boxIndennita.hidden = true; boxIndennita.innerHTML = ''; return; }
  boxIndennita.hidden = false;
  boxIndennita.innerHTML = pezzi.join('');
}

function applicaVisibilitaReportBlocchi(){
  const b = AppState.reportBlocchi || {};
  const mappa = {
    prossimoTurno: 'prossimoTurnoWidget',
    riepilogoMese: 'riepilogoTurniV45',
    riepilogoOre: 'sezioneRiepilogo',
    statistiche: 'sezioneStatisticheGrafici',
    cedolino: 'sezioneCedolino'
  };
  Object.keys(mappa).forEach(chiave => {
    const el1 = el(mappa[chiave]);
    if(el1) el1.hidden = (b[chiave] === false);
  });
  // Il Cedolino comprende più sezioni oltre a quella principale: le nascondiamo tutte insieme.
  ['sezioneAccreditoConto','sezioneStorico','sezioneRiepilogoAnnuale'].forEach(id => {
    const n = el(id);
    if(n) n.hidden = (b.cedolino === false);
  });
}

function apriPersonalizzaReport(){
  const overlay = el('overlayPersonalizzaReport');
  if(!overlay) return;
  const b = AppState.reportBlocchi || {};
  const setChecked = (id, val) => { const c = el(id); if(c) c.checked = val !== false; };
  setChecked('toggleReportProssimoTurno', b.prossimoTurno);
  setChecked('toggleReportRiepilogoMese', b.riepilogoMese);
  setChecked('toggleReportRiepilogoOre', b.riepilogoOre);
  setChecked('toggleReportStatistiche', b.statistiche);
  setChecked('toggleReportCedolino', b.cedolino);
  overlay.hidden = false;
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
