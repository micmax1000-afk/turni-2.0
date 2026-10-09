
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
  CHIAVE_COLORI_TURNI,
  CHIAVE_CALENDARIO_A_COLORI
} = TurniPSConfig.keys;

// Espone le chiavi in scope globale condiviso (moduli classic script)
Object.assign(window, {
  CHIAVE_ANAGRAFICA, CHIAVE_TURNI, CHIAVE_TABELLE, CHIAVE_CONGUAGLI,
  CHIAVE_STORICO, CHIAVE_ASSENZE, CHIAVE_SEQUENZA, CHIAVE_NOTE_GIORNI,
  CHIAVE_SEQUENZA_ANCORA, CHIAVE_SEQUENZA_ULTIMO_GIORNO, CHIAVE_ULTIMO_BACKUP,
  CHIAVE_ASPETTATIVA_MIGRATA, CHIAVE_DISCLAIMER_MOSTRATO, CHIAVE_COLORI_TURNI,
  CHIAVE_CALENDARIO_A_COLORI
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


function aggiornaClasseCalendarioColori(){
  document.body.classList.toggle('calendario-senza-colori', !calendarioAColoriAttivo());
  document.body.classList.toggle('calendario-moderno', calendarioModernoAttivo());
  document.querySelectorAll('[data-stile-calendario]').forEach(b => {
    const attivo = b.dataset.stileCalendario === (calendarioModernoAttivo() ? 'moderno' : 'classico');
    b.classList.toggle('attivo', attivo);
    b.setAttribute('aria-pressed', attivo ? 'true' : 'false');
  });
}

// Numero di versione mostrato in Impostazioni — letto da manifest.json, la stessa fonte
// aggiornata ad ogni rilascio, così sul telefono si vede sempre quella davvero installata,
// senza doverla dedurre indirettamente da GitHub o dai file scaricati.
function mostraVersioneApp(){
  const box = document.getElementById('versioneAppTesto');
  if(!box) return;
  fetch('manifest.json').then(r => r.json()).then(m => {
    if(m && m.version) box.textContent = `Versione ${m.version}`;
  }).catch(() => {});
}

// Barra in basso: l'icona del Calendario mostra il giorno di oggi.
function aggiornaIconaCalendarioOggi(){
  const t = document.getElementById('iconaCalendarioGiorno');
  if(t) t.textContent = String(new Date().getDate());
}
// Su Android, con la tastiera aperta una barra fissa in basso sale sopra la tastiera e copre il
// campo in cui si scrive: mentre si scrive in un campo di testo la nascondiamo.
function inizializzaBarraETastiera(){
  const campoTesto = e => e && e.matches && e.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=file]), textarea, select, [contenteditable="true"]');
  document.addEventListener('focusin', e => { if(campoTesto(e.target)) document.body.classList.add('scrittura-in-corso'); });
  document.addEventListener('focusout', e => { if(campoTesto(e.target)) setTimeout(() => { if(!campoTesto(document.activeElement)) document.body.classList.remove('scrittura-in-corso'); }, 120); });
}

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
  mostraVersioneApp();
  aggiornaClasseCalendarioColori();
  aggiornaIconaCalendarioOggi();
  document.addEventListener('visibilitychange', () => { if(!document.hidden) aggiornaIconaCalendarioOggi(); });
  inizializzaBarraETastiera();
  // La finestra "Modifica turno" stava dentro la scheda Calendario: aperta dalla scheda Turni
  // restava invisibile. Spostata in fondo alla pagina, si apre da qualunque scheda.
  const overlayModello = el('overlayModificaModello');
  if(overlayModello) document.body.appendChild(overlayModello);
  renderModelliTabTurni();
  aggiornaRiassuntoAnagraficaAltro();
  on('btnReportMesePrec', 'click', () => el('btnMesePrec').click());
  on('btnReportMeseSucc', 'click', () => el('btnMeseSucc').click());
  on('tabReport', 'click', renderReportHero);
  const cambiaAnnoStatistiche = d => {
    const campo = el('campoAnnoStatistiche');
    campo.value = (Number(campo.value) || new Date().getFullYear()) + d;
    renderStatistiche();
  };
  on('btnAnnoStatPrec', 'click', () => cambiaAnnoStatistiche(-1));
  on('btnAnnoStatSucc', 'click', () => cambiaAnnoStatistiche(1));
  // Stampa dell'anno: calcola il riepilogo annuale (non più sullo schermo) e lo stampa.
  on('btnStampaAnnoStatistiche', 'click', () => {
    const anno = Number(el('campoAnnoStatistiche').value) || new Date().getFullYear();
    el('campoAnnoRiepilogo').value = anno;
    renderRiepilogoAnnuale(anno);
    stampaSezione('contenitoreRiepilogoAnnuale');
  });
  on('tabTurni', 'click', renderModelliTabTurni);
  on('tabAltro', 'click', aggiornaRiassuntoAnagraficaAltro);
  const listaModelliTab = el('listaModelliTabTurni');
  if(listaModelliTab) listaModelliTab.addEventListener('click', e => {
    const b = e.target.closest('[data-modello-tab]');
    if(b) apriModificaModelloV2(b.dataset.modelloTab || null);
  });
  // Promemoria degli eventi: si rimettono quelli che Android potrebbe aver cancellato e si
  // programmano le prossime volte degli eventi che si ripetono. Con calma, dopo l'avvio.
  setTimeout(() => { riprogrammaPromemoriaEventi(); }, 4000);
  // Piccolo ritardo perché la libreria Google (caricata con "defer") abbia il tempo di essere pronta
  setTimeout(() => {
    inizializzaGoogleIdentity();
    controllaBackupDriveAutomatico();
  }, 800);
  // Nessun avviso/popup sul backup (tolto su richiesta): si esporta quando si vuole da Backup Dati.

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
  on('btnChiudiAssenze','click', () => {
    const sez = el('sezioneAssenze');
    if(sez) sez.hidden = true;
  });
  const listaPatternSempliceHost = el('listaPatternSempliceV2');
  if(listaPatternSempliceHost) listaPatternSempliceHost.addEventListener('click', (e) => {
    if(e.target.closest('#btnNuovoPatternV2')){ nuovoPatternV2(); return; }
    const matita = e.target.closest('[data-modifica-pattern]');
    if(matita){ apriEditorPatternSempliceV2(matita.dataset.modificaPattern); return; }
    const btn = e.target.closest('[data-pattern-semplice]');
    if(!btn) return;
    const mappaPatternIdRiga = { quinta:'pattern_quinta5', quinta10:'pattern_quinta10', corta:'pattern_settimana_corta', lunga:'pattern_settimana_lunga' };
    const patternId = mappaPatternIdRiga[btn.dataset.patternSemplice];
    if(patternId) apriEditorPatternSempliceV2(patternId); // un solo tocco: apre subito l'editor, con generazione inclusa
  });
  on('campoEditorPatternNome','change', rinominaPatternSempliceV2);
  on('btnAggiungiGiornoEditorPatternV2','click', aggiungiGiornoPatternSempliceV2);
  on('btnRimuoviGiornoEditorPatternV2','click', rimuoviGiornoPatternSempliceV2);
  on('btnEliminaPatternV2','click', eliminaPatternSempliceV2);
  on('btnChiudiEditorPatternV2','click', () => { el('overlayEditorPatternV2').hidden = true; });
  on('campoEditorPatternDurataPreset','change', () => {
    aggiornaGiorniEditorPatternV2();
    const c = el('contenitoreEditorPatternGiorniPersonalizzati');
    if(c) c.hidden = el('campoEditorPatternDurataPreset').value !== 'personalizzato';
  });
  on('campoEditorPatternDataInizio','change', aggiornaGiorniEditorPatternV2);
  on('campoEditorPatternGiorni','input', () => { el('campoEditorPatternDurataPreset').value = 'personalizzato'; });
  on('btnGeneraEditorPatternV2','click', generaDaEditorPatternV2);
  on('btnContinuaEditorPatternV2','click', continuaDaEditorPatternV2);
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
  on('campoPatternStraordinarioAttivo','change', aggiornaStraordinarioRientroPatternSempliceV2);
  on('campoPatternStraordinarioQuando','change', aggiornaStraordinarioRientroPatternSempliceV2);
  on('campoPatternStraordinarioInizio','change', aggiornaStraordinarioRientroPatternSempliceV2);
  on('campoPatternStraordinarioFine','change', aggiornaStraordinarioRientroPatternSempliceV2);
  on('campoPatternRientroAttivo','change', aggiornaStraordinarioRientroPatternSempliceV2);
  on('campoPatternRientroInizio','change', aggiornaStraordinarioRientroPatternSempliceV2);
  on('campoPatternRientroFine','change', aggiornaStraordinarioRientroPatternSempliceV2);

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
    el('toggleCalendarioAColori').checked = calendarioAColoriAttivo();
    aggiornaAspettoBlocCoCloriPersonalizzati();
    p.scrollIntoView({behavior:'smooth', block:'nearest'});
  }
  // Il blocco di personalizzazione resta visibile e utilizzabile anche a calendario spento
  // (puoi comunque prepararlo in anticipo), solo visivamente attenuato per far capire che non
  // sta avendo effetto finché non riaccendi l'interruttore sopra.
  function aggiornaAspettoBlocCoCloriPersonalizzati(){
    const wrap = el('corpoColoriTurniWrap');
    if(wrap) wrap.style.opacity = calendarioAColoriAttivo() ? '1' : '.45';
  }
  el('toggleCalendarioAColori')?.addEventListener('change', () => {
    const acceso = el('toggleCalendarioAColori').checked;
    TurniPSStorage.setItem(CHIAVE_CALENDARIO_A_COLORI, acceso ? '1' : '0');
    aggiornaClasseCalendarioColori();
    aggiornaAspettoBlocCoCloriPersonalizzati();
    renderCalendario();
  });
  document.querySelectorAll('[data-stile-calendario]').forEach(b => b.addEventListener('click', () => {
    TurniPSStorage.setItem(CHIAVE_STILE_CALENDARIO, b.dataset.stileCalendario);
    aggiornaClasseCalendarioColori();
    renderCalendario();
  }));
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
  // "Lavorato sul riposo" e "Riposo" sono per definizione incompatibili: se il giorno era di
  // riposo ma ci hai lavorato, la casella "Riposo" va tolta, altrimenti il turno viene comunque
  // trattato come un giorno di riposo puro e la maturazione del recupero non viene mai contata.
  el('campoCompensazioneRiposo').addEventListener('change', () => {
    if(el('campoCompensazioneRiposo').checked) el('campoRiposo').checked = false;
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
    ['overlaySelettoreModelli','overlayStraordinarioRapido','overlayRientroRapido','overlayModificaModello','overlayEvento','overlayEditorPatternV2'].forEach(id => { const o = el(id); if(o) o.hidden = true; });
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
    if(e.target.closest('#btnRientroTurniV2')){ apriRientroRapidoV2(); return; }
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
  el('campoModModelloColore').addEventListener('input', () => {
    modelloColoreForzatoV2 = el('campoModModelloColore').value;
    dipingiSwatchModelloV2();
    aggiornaStatoColoreModelloV2();
  });
  on('btnModModelloColoreAutomatico','click', () => {
    modelloColoreForzatoV2 = null;
    const m = modelloInModificaV2 ? (AppState.modelliTurno || []).find(x => x.id === modelloInModificaV2) : null;
    el('campoModModelloColore').value = coloreAutomaticoPerModello(m);
    dipingiSwatchModelloV2();
    aggiornaStatoColoreModelloV2();
  });
  on('btnEliminaModello','click', eliminaModelloV2);
  on('btnNuovoEventoGiornoV2','click', () => apriModificaEventoV2(null));
  on('btnChiudiEvento','click', () => { el('overlayEvento').hidden = true; });
  on('btnChiudiScegliBackupDrive','click', () => { el('overlayScegliBackupDrive').hidden = true; });
  on('btnSalvaEvento','click', salvaEventoV2);
  on('btnEliminaEvento','click', eliminaEventoV2);
  on('btnEliminaEventoGiorno','click', eliminaEventoSoloGiornoV2);
  on('campoEventoRipeti','change', aggiornaVistaRipetiEvento);
  on('btnAttivaNotificheEvento','click', attivaNotifichePromemoria);
  // Tornando dalle impostazioni di Android: si ricontrolla se le notifiche sono state attivate.
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && el('overlayEvento') && !el('overlayEvento').hidden) controllaPermessiPromemoria();
  });
  const prossimiHost = el('listaProssimiEventiV2');
  if(prossimiHost) prossimiHost.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-evento-giorno]');
    if(btn) apriEventoDaProssimi(btn);
  });
  on('campoEventoTuttoIlGiorno','change', () => {
    aggiornaVistaOrariEvento();
    ridisegnaPromemoriaEvento(null); // ripartono dal valore predefinito del nuovo tipo di evento
  });
  on('btnAggiungiPromemoria','click', () => {
    const tutt = el('campoEventoTuttoIlGiorno').checked;
    if(el('listaPromemoriaEvento').children.length >= MAX_PROMEMORIA_EVENTO){
      mostraToast('Puoi aggiungere al massimo ' + MAX_PROMEMORIA_EVENTO + ' promemoria.', 'avviso'); return;
    }
    // Propone il primo orario non ancora usato (un doppione verrebbe scartato al salvataggio).
    const usati = new Set(leggiPromemoriaDalForm().map(p => p.min));
    const preferiti = tutt ? [0, -1, 1440, 2880, 10080] : [10, 30, 60, 1440, 0, 5, 15, 120];
    const min = preferiti.find(m => !usati.has(m));
    aggiungiRigaPromemoria({ min: min === undefined ? (tutt ? 0 : 10) : min });
    aggiornaTestoPromemoriaEvento();
  });
  on('campoEventoAvvisoDurata','change', aggiornaCampiAvvisoEvento);
  const listaEventiGiornoHost = el('listaEventiGiornoV2');
  if(listaEventiGiornoHost) listaEventiGiornoHost.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-evento-id]');
    if(btn) apriModificaEventoV2(btn.dataset.eventoId, btn.dataset.eventoIso);
  });
  on('btnChiudiStraordinarioRapido','click', () => { el('overlayStraordinarioRapido').hidden = true; });
  on('btnSalvaStraordinarioRapido','click', salvaStraordinarioRapidoV2);
  on('btnChiudiRientroRapido','click', () => { el('overlayRientroRapido').hidden = true; });
  on('btnSalvaRientroRapido','click', salvaRientroRapidoV2);
  on('btnRimuoviRientroRapido','click', rimuoviRientroRapidoV2);
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
  ['overlaySelettoreModelli','overlayStraordinarioRapido','overlayRientroRapido','overlayModificaModello','overlayEvento','overlayEditorPatternV2'].forEach(id => { const o = el(id); if(o) o.hidden = true; });
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
  // Colore scelto a mano per il modello, altrimenti quello della sua categoria (Sera, Notte...).
  // Prima categoriaTurno veniva chiamata senza data e il risultato ricadeva sempre su "Mattina".
  if(m.colore) return m.colore;
  return coloreAutomaticoPerModello(m);
}

// Lista visiva dei pattern: ogni riga si tocca per aprire subito l'editor (ciclo + indennità +
// generazione, tutto in un unico posto) — non c'è più un concetto di riga "selezionata" da
// applicare a parte, dato che il tocco apre già tutto quello che serve.
function renderListaPatternSempliceV2(){
  const host = el('listaPatternSempliceV2');
  if(!host) return;
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
    { value:'lunga', nome:'Settimana lunga', sotto:'Lun–Sab, orario fisso', icona:'📅' }
  ];
  const mappaPatternId = { quinta:'pattern_quinta5', quinta10:'pattern_quinta10', corta:'pattern_settimana_corta', lunga:'pattern_settimana_lunga' };
  const idPatternNoti = new Set(Object.values(mappaPatternId));
  const righeNote = voci.map(v => {
    const anteprima = v.giorni ? `<span style="display:flex;flex-shrink:0;">${pallini(v.giorni)}</span>` : `<span style="font-size:1.1rem;flex-shrink:0;">${v.icona}</span>`;
    const patternId = mappaPatternId[v.value];
    const matita = patternId ? `<button type="button" class="riga-modello-matita" data-modifica-pattern="${patternId}" aria-label="Modifica ciclo di ${escapeHtml(v.nome)}">✏️</button>` : '';
    return `<div class="riga-modello-selettore">
      <button type="button" class="riga-modello-selettore-corpo" data-pattern-semplice="${v.value}">
        ${anteprima}
        <span class="riga-modello-testo"><strong>${escapeHtml(v.nome)}</strong><small>${escapeHtml(v.sotto)}</small></span>
      </button>
      ${matita}
    </div>`;
  }).join('');
  // Pattern creati da te con "+ Nuovo pattern": non rientrano nei 4 noti sopra, li aggiungiamo
  // qui con la stessa struttura (anteprima colorata + matita), toccabili per aprire l'editor.
  const righePersonali = (AppState.pattern || []).filter(p => !idPatternNoti.has(p.id)).map(p => {
    const idsGiorni = p.giorni.slice(0, 6).map(g => g.modelloId);
    return `<div class="riga-modello-selettore">
      <button type="button" class="riga-modello-selettore-corpo" data-modifica-pattern="${escapeHtml(p.id)}">
        <span style="display:flex;flex-shrink:0;">${pallini(idsGiorni)}</span>
        <span class="riga-modello-testo"><strong>${escapeHtml(p.nome)}</strong><small>${p.giorni.length} giorni</small></span>
      </button>
      <button type="button" class="riga-modello-matita" data-modifica-pattern="${escapeHtml(p.id)}" aria-label="Modifica ${escapeHtml(p.nome)}">✏️</button>
    </div>`;
  }).join('');
  host.innerHTML = righeNote + righePersonali + `<button type="button" class="riga-modello-nuovo" id="btnNuovoPatternV2">＋ Nuovo pattern</button>`;
}

// ===================== Editor del ciclo (solo visualizzazione/modifica, non genera nulla) =====================
let patternInModificaSemplcieV2 = null;
let giornoPatternSelezionatoSemplcieV2 = 0;

function apriEditorPatternSempliceV2(patternId){
  let p = (AppState.pattern || []).find(x => x.id === patternId);
  if(!p){
    // Una delle 4 righe fisse (Turno in quinta/10gg/Settimana corta/lunga) resta sempre visibile
    // in elenco anche se l'hai eliminata: qui la ricreiamo da zero, così ritoccarla funziona
    // sempre come "ricomincia da capo" invece di restare una riga che non apre più nulla.
    const seme = PATTERN_BASE_V2.find(x => x.id === patternId);
    if(!seme) return;
    p = { id:seme.id, nome:seme.nome, giorni: seme.giorni.map(g => ({ modelloId:g.modelloId, indennita: g.indennita || [], secondoTurno: g.secondoTurno || null })) };
    AppState.pattern.push(p);
    salvaPatternStorage();
    mostraToast('Pattern ricreato da zero', 'successo');
  }
  // Forziamo sempre la scheda Turni (con "Genera turni automaticamente" visibile) dietro
  // all'editor: se per qualche motivo era rimasta attiva Calendario (es. la matita del
  // calendario toccata per errore, o un'altra sequenza di navigazione), l'editor del ciclo
  // non deve mai aprirsi sopra la schermata sbagliata.
  mostraScheda('sequenza');
  patternInModificaSemplcieV2 = patternId;
  giornoPatternSelezionatoSemplcieV2 = 0;
  el('titoloEditorPatternV2').textContent = 'Ciclo — ' + p.nome;
  el('campoEditorPatternNome').value = p.nome;
  renderCicloPatternSempliceV2();
  renderTavolozzaPatternSempliceV2();
  renderIndennitaGiornoPatternSempliceV2();
  if(!el('campoEditorPatternDataInizio').value) el('campoEditorPatternDataInizio').value = dataISO(new Date());
  aggiornaGiorniEditorPatternV2();
  el('overlayEditorPatternV2').hidden = false;
}

function aggiornaGiorniEditorPatternV2(){
  const preset = el('campoEditorPatternDurataPreset').value;
  if(preset === 'personalizzato') return; // il numero resta quello digitato dall'utente
  const dataInizioStr = el('campoEditorPatternDataInizio').value || dataISO(new Date());
  const inizio = new Date(dataInizioStr + 'T00:00:00');
  const fine = new Date(inizio);
  if(preset === 'settimana') fine.setDate(fine.getDate() + 7);
  else if(preset === 'mese') fine.setMonth(fine.getMonth() + 1);
  else if(preset === 'mese3') fine.setMonth(fine.getMonth() + 3);
  else if(preset === 'mese6') fine.setMonth(fine.getMonth() + 6);
  else if(preset === 'anno') fine.setFullYear(fine.getFullYear() + 1);
  const giorni = Math.round((fine - inizio) / 86400000);
  el('campoEditorPatternGiorni').value = Math.min(giorni, 366);
}

// Applica il pattern attualmente aperto nell'editor e genera i turni — vale per QUALSIASI
// pattern (non solo Turno in quinta), usando sequenzaDaPatternV2() come unico traduttore verso
// la generazione originale, che restiamo a riusare invariata.
function generaDaEditorPatternV2(){
  const daPattern = sequenzaDaPatternV2(patternInModificaSemplcieV2);
  if(!daPattern){ mostraAvviso('Questo pattern non ha giorni da generare.'); return; }
  AppState.sequenzaTurni = daPattern;
  salvaSequenzaStorage();
  // La generazione vera legge dai campi originali (campoSequenzaDataInizio/Giorni): li
  // allineiamo a quanto scelto qui nell'editor, invece di duplicare la logica di generazione.
  el('campoSequenzaDataInizio').value = el('campoEditorPatternDataInizio').value;
  el('campoSequenzaGiorni').value = el('campoEditorPatternGiorni').value;
  generaSequenzaTurni();
}

function continuaDaEditorPatternV2(){
  const daPattern = sequenzaDaPatternV2(patternInModificaSemplcieV2);
  if(!daPattern){ mostraAvviso('Questo pattern non ha giorni da generare.'); return; }
  AppState.sequenzaTurni = daPattern;
  salvaSequenzaStorage();
  continuaSequenzaTurni();
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

  const str = giorno.straordinario || null;
  el('campoPatternStraordinarioAttivo').checked = !!str;
  el('campiPatternStraordinario').hidden = !str;
  el('campoPatternStraordinarioQuando').value = str ? (str.quando || 'dopo') : 'dopo';
  el('campoPatternStraordinarioInizio').value = str ? (str.oraInizio || '') : '';
  el('campoPatternStraordinarioFine').value = str ? (str.oraFine || '') : '';

  const rientro = giorno.secondoTurno || null;
  el('campoPatternRientroAttivo').checked = !!rientro;
  el('campiPatternRientro').hidden = !rientro;
  el('campoPatternRientroInizio').value = rientro ? (rientro.oraInizio || '') : '';
  el('campoPatternRientroFine').value = rientro ? (rientro.oraFine || '') : '';
}

// Legge i campi di straordinario/rientro dal form e li salva sul giorno selezionato del pattern.
function aggiornaStraordinarioRientroPatternSempliceV2(){
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!p) return;
  const giorno = p.giorni[giornoPatternSelezionatoSemplcieV2];
  if(!giorno) return;

  const strAttivo = el('campoPatternStraordinarioAttivo').checked;
  el('campiPatternStraordinario').hidden = !strAttivo;
  giorno.straordinario = strAttivo ? {
    quando: el('campoPatternStraordinarioQuando').value,
    oraInizio: el('campoPatternStraordinarioInizio').value,
    oraFine: el('campoPatternStraordinarioFine').value
  } : null;

  const rientroAttivo = el('campoPatternRientroAttivo').checked;
  el('campiPatternRientro').hidden = !rientroAttivo;
  giorno.secondoTurno = rientroAttivo ? {
    oraInizio: el('campoPatternRientroInizio').value,
    oraFine: el('campoPatternRientroFine').value
  } : null;

  salvaPatternStorage();
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

function rinominaPatternSempliceV2(){
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!p) return;
  const nome = el('campoEditorPatternNome').value.trim();
  if(!nome) return;
  p.nome = nome;
  salvaPatternStorage();
  el('titoloEditorPatternV2').textContent = 'Ciclo — ' + nome;
  renderListaPatternSempliceV2();
}

function aggiungiGiornoPatternSempliceV2(){
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!p) return;
  const primoModello = (AppState.modelliTurno || [])[0];
  p.giorni.push({ modelloId: primoModello ? primoModello.id : '', indennita: [] });
  giornoPatternSelezionatoSemplcieV2 = p.giorni.length - 1;
  salvaPatternStorage();
  renderCicloPatternSempliceV2();
  renderIndennitaGiornoPatternSempliceV2();
  renderListaPatternSempliceV2();
}

function rimuoviGiornoPatternSempliceV2(){
  const p = (AppState.pattern || []).find(x => x.id === patternInModificaSemplcieV2);
  if(!p) return;
  if(p.giorni.length <= 1){ mostraAvviso('Il ciclo deve avere almeno un giorno: non puoi togliere l\'ultimo rimasto.'); return; }
  p.giorni.splice(giornoPatternSelezionatoSemplcieV2, 1);
  giornoPatternSelezionatoSemplcieV2 = Math.max(0, Math.min(giornoPatternSelezionatoSemplcieV2, p.giorni.length - 1));
  salvaPatternStorage();
  renderCicloPatternSempliceV2();
  renderIndennitaGiornoPatternSempliceV2();
  renderListaPatternSempliceV2();
}

function nuovoPatternV2(){
  const primoModello = (AppState.modelliTurno || [])[0];
  const p = { id:'pattern_' + Date.now(), nome:'Nuovo pattern', giorni:[{ modelloId: primoModello ? primoModello.id : '', indennita:[] }] };
  AppState.pattern.push(p);
  salvaPatternStorage();
  apriEditorPatternSempliceV2(p.id);
}

function eliminaPatternSempliceV2(){
  if(!patternInModificaSemplcieV2) return;
  mostraConferma('Eliminare definitivamente questo pattern? I turni già generati sul calendario non verranno toccati.', () => {
    AppState.pattern = AppState.pattern.filter(p => p.id !== patternInModificaSemplcieV2);
    salvaPatternStorage();
    el('overlayEditorPatternV2').hidden = true;
    renderListaPatternSempliceV2();
  });
}


// Report: in cima quanto arriva sul conto il mese dopo quello visualizzato, più ore e netto
// dello straordinario. Stessi calcoli di "Cosa arriva sul conto" e del riepilogo ore.
function renderReportHero(){
  const box = el('reportHero');
  if(!box) return;
  el('reportMeseEtichetta').textContent = `${NOMI_MESI[meseCorrente]} ${annoCorrente}`;
  try{
    const euroFmt = v => typeof euro === 'function' ? euro(v) : `${Number(v || 0).toFixed(2)} €`;
    // Quanto arriva sul conto NEL mese visualizzato: stipendio del mese prima + accessorie di due mesi prima.
    const acc = generaAccreditoConto(annoCorrente, meseCorrente);
    const r = calcolaRiepilogoOreMese(annoCorrente, meseCorrente), t = r.tot;
    const ore = t.ordinarie + t.notturne + t.festive + t.domenicali + t.notturneFestive + t.strDiurno + t.strNotturno + t.strFestivo + t.strNotturnoFestivo;
    const ns = calcolaEffettoNettoStraordinario(annoCorrente, meseCorrente);
    // Riquadri in cima a "Il mese" (al posto del vecchio "Riepilogo mese").
    const strOre = t.strDiurno + t.strNotturno + t.strFestivo + t.strNotturnoFestivo;
    if(el('meseTileTurni')){
      el('meseTileTurni').textContent = r.giorniPresenzaEffettiva;
      el('meseTileRiposi').textContent = r.riposi;
      el('meseTileStraordinario').textContent = `${String(Math.round(strOre * 100) / 100).replace('.', ',')} h`;
    }
    const precedente = NOMI_MESI[(meseCorrente + 11) % 12].toLowerCase();
    const dueMesiPrima = NOMI_MESI[(meseCorrente + 10) % 12].toLowerCase();
    box.innerHTML = `
      <div class="report-hero-et">💰 Arriva sul conto a ${NOMI_MESI[meseCorrente].toLowerCase()}</div>
      <div class="report-hero-cifra">${euroFmt(acc.netto)}</div>
      <div class="report-hero-det">Stipendio di ${precedente} + accessorie di ${dueMesiPrima} · stima</div>
      <div class="report-hero-tiles">
        <div><b>${String(Math.round(ore * 10) / 10).replace('.', ',')}</b><span>ore lavorate</span></div>
        <div><b class="${ns.netto > 0 ? 'pos' : ''}">${ns.netto > 0 ? '+' : ''}${euroFmt(ns.netto)}</b><span>netto straordinario</span></div>
      </div>`;
    box.hidden = false;
  }catch(e){
    console.warn('Riquadro Report non calcolato:', e);
    box.hidden = true;
  }
}

// Scheda Turni: i modelli di turno con il loro colore e orario, toccandone uno si modifica.
function renderModelliTabTurni(){
  const host = el('listaModelliTabTurni');
  if(!host) return;
  const righe = (AppState.modelliTurno || []).map(m => {
    const colore = coloreModelloV2(m);
    const forte = typeof scurisciColore === 'function' ? scurisciColore(colore, 0.35) : colore;
    const sigla = m.sigla || (m.nome || '??').slice(0, 2).toUpperCase();
    const sotto = m.riposo ? 'Giornata libera' : `${m.oraInizio} – ${m.oraFine}`;
    return `<button type="button" class="riga-strumento-turni riga-modello-tab" data-modello-tab="${escapeHtml(m.id)}">
      <span class="chip-modello-tab"><b style="background:${escapeHtml(forte)};color:${testoSuColore(forte)}">${escapeHtml(sigla)}</b>${m.riposo ? '' : `<em style="background:${escapeHtml(colore)};color:${testoSuColore(colore)}">${escapeHtml(m.oraInizio || '')}</em>`}</span>
      <i>${escapeHtml(m.nome)}<small>${escapeHtml(sotto)}</small></i><b>›</b>
    </button>`;
  }).join('');
  host.innerHTML = righe + `<button type="button" class="riga-strumento-turni riga-modello-nuovo-tab" data-modello-tab=""><span>＋</span><i>Nuovo modello di turno</i></button>`;
}
// Scheda Altro: sotto "Anagrafica" un riassunto (qualifica · regione).
function aggiornaRiassuntoAnagraficaAltro(){
  const box = el('riassuntoAnagraficaAltro');
  if(!box) return;
  const a = AppState.anagrafica || {};
  const parti = [a.qualifica, a.regione].filter(Boolean);
  box.textContent = parti.length ? parti.join(' · ') : 'Da compilare: serve per il cedolino';
}

function renderListaModelliTurniV2(){
  renderModelliTabTurni();
  const host = el('listaModelliTurni');
  if(!host) return;
  const tGiornoCorrente = giornoPerPopupV2 ? (AppState.turni[giornoPerPopupV2] || {}) : {};
  const rientroSotto = (tGiornoCorrente.secondoAttivo && tGiornoCorrente.secondoOraInizio && tGiornoCorrente.secondoOraFine)
    ? `${tGiornoCorrente.secondoOraInizio} - ${tGiornoCorrente.secondoOraFine} ✓`
    : 'aggiungi un secondo turno a oggi';
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
  host.innerHTML = righe + `<button type="button" class="riga-modello-selettore-corpo riga-modello-selettore" id="btnRientroTurniV2" style="border-top:1px dashed var(--bordo);margin-top:4px;">
    <span class="cerchio-modello" style="background:var(--sfondo-secondario,#f3f5f9);border:1.5px dashed var(--bordo);">🔁</span>
    <span class="riga-modello-testo"><strong>Rientro</strong><small>${rientroSotto}</small></span>
  </button>` + `<button type="button" class="riga-modello-nuovo" id="btnNuovoModelloV2">＋ Nuovo turno personalizzato</button>`;
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
  { chiave:'compensazioneRiposo', sigla:'LR', nome:'Lavorato sul riposo' },
  { chiave:'recuperoFestivoLavorato', sigla:'LF', nome:'Lavorato in festivo' }
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
  AppState.turni[iso] = m.riposo ? { data: iso, riposo: true } : { data: iso, oraInizio: m.oraInizio, oraFine: m.oraFine, modelloId: m.id };
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
let modelloColoreForzatoV2 = null;
function coloreAutomaticoPerModello(m){
  if(!m) return coloreCategoria('mattina');
  if(m.riposo) return coloreCategoria('riposo');
  const categorieProprie = ['ufficio', 'aggiornamentoProfessionale', 'addestramentoTiro'];
  if(categorieProprie.includes(m.id)) return coloreCategoria(m.id);
  if(m.oraInizio && m.oraFine){
    const cat = categoriaTurno(m.oraInizio, m.oraFine, '2026-01-01');
    return coloreCategoria(cat);
  }
  return coloreCategoria('mattina');
}
// Il quadratino viene dipinto direttamente col colore scelto, invece di affidarsi solo a come la
// WebView disegna il campo colore nativo: così mostra sempre il colore vero, in ogni caso.
function dipingiSwatchModelloV2(){
  const campo = el('campoModModelloColore');
  if(campo && campo.parentElement) campo.parentElement.style.background = campo.value;
}
function aggiornaStatoColoreModelloV2(){
  const stato = el('modModelloColoreStato');
  if(!stato) return;
  stato.textContent = modelloColoreForzatoV2
    ? 'Colore scelto a mano — resta questo, qualsiasi orario tu imposti.'
    : 'Colore automatico, in base alla fascia oraria del turno.';
}
function apriModificaModelloV2(id){
  modelloInModificaV2 = id;
  const m = id ? (AppState.modelliTurno || []).find(x => x.id === id) : null;
  el('titoloModificaModello').textContent = m ? `Modifica "${m.nome}"` : 'Nuovo turno';
  el('campoModModelloNome').value = m ? m.nome : '';
  // Mattino, Pomeriggio, Sera, Notte e Riposo hanno una lettera fissa sul calendario (M/P/S/N/R),
  // qualunque nome tu dia loro: il campo resta visibile ma bloccato, così non sembra modificabile.
  const lettereFisse = (typeof SIGLA_SINGOLA_CATEGORIA !== 'undefined') ? SIGLA_SINGOLA_CATEGORIA : {};
  const lettera = m ? lettereFisse[m.id] : null;
  const campoSigla = el('campoModModelloSigla');
  campoSigla.disabled = !!lettera;
  campoSigla.value = lettera ? lettera : (m ? String(m.sigla || '').slice(0, 2) : '');
  el('testoEtichettaSigla').textContent = lettera ? 'Sigla (fissa)' : 'Sigla (2 lettere, per i turni che crei tu)';
  const isRiposo = !!(m && m.riposo);
  el('campiModModelloOrario').hidden = isRiposo;
  el('campoModModelloInizio').value = m ? (m.oraInizio || '') : '';
  el('campoModModelloFine').value = m ? (m.oraFine || '') : '';
  modelloColoreForzatoV2 = (m && m.colore) || null;
  el('campoModModelloColore').value = modelloColoreForzatoV2 || coloreAutomaticoPerModello(m);
  dipingiSwatchModelloV2();
  aggiornaStatoColoreModelloV2();
  // "Elimina" ha senso solo per un turno che già esiste, non per uno nuovo che stai ancora creando.
  el('btnEliminaModello').hidden = !m;
  el('overlayModificaModello').hidden = false;
}
function salvaModificaModelloV2(){
  const nome = el('campoModModelloNome').value.trim();
  if(!nome){ mostraToast('Dai un nome al turno prima di salvare.', 'avviso'); return; }
  // Sigla: quella scritta a mano ha sempre la precedenza; solo se lasci il campo vuoto la
  // ricaviamo noi dalle prime due lettere del nome, come prima.
  const siglaScritta = el('campoModModelloSigla').value.trim().toUpperCase().slice(0, 2);
  let sigla = siglaScritta || nome.slice(0,2).toUpperCase();
  const esistente = modelloInModificaV2 ? (AppState.modelliTurno || []).find(x => x.id === modelloInModificaV2) : null;
  // Campo bloccato (turni di base): la sigla memorizzata resta com'è, non la sostituiamo con la lettera.
  if(el('campoModModelloSigla').disabled && esistente && esistente.sigla) sigla = esistente.sigla;
  const isRiposo = !!(esistente && esistente.riposo); // il tipo "riposo" non si crea da qui, solo si rinomina se già esistente
  const orarioPrima = esistente && !isRiposo ? { inizio: esistente.oraInizio, fine: esistente.oraFine } : null;
  let modelloSalvato;
  if(!isRiposo){
    const oraInizio = el('campoModModelloInizio').value, oraFine = el('campoModModelloFine').value;
    if(!oraInizio || !oraFine){ mostraToast('Inserisci ora di inizio e fine.', 'avviso'); return; }
    if(esistente){ esistente.nome = nome; esistente.oraInizio = oraInizio; esistente.oraFine = oraFine; esistente.sigla = sigla; modelloSalvato = esistente; }
    else {
      modelloSalvato = { id: 'personalizzato_' + Date.now(), nome, oraInizio, oraFine, sigla };
      AppState.modelliTurno.push(modelloSalvato);
    }
  } else {
    esistente.nome = nome;
    esistente.sigla = sigla;
    modelloSalvato = esistente;
  }
  if(modelloColoreForzatoV2) modelloSalvato.colore = modelloColoreForzatoV2;
  else delete modelloSalvato.colore;
  salvaModelliTurnoStorage();
  el('overlayModificaModello').hidden = true;
  renderListaModelliTurniV2();
  renderCalendario();
  mostraToast(`"${nome}" salvato`, 'successo');
  if(orarioPrima && (orarioPrima.inizio !== modelloSalvato.oraInizio || orarioPrima.fine !== modelloSalvato.oraFine)){
    proponiAggiornamentoTurniDelModello(modelloSalvato, orarioPrima);
  }
}

// Ogni giorno del calendario conserva il proprio orario (copiato dal modello quando il turno è
// stato inserito): cambiare il modello non tocca i giorni già inseriti. Qui si chiede se farlo.
// Giorni coinvolti: quelli inseriti con questo modello e quelli senza modello con l'orario di prima.
function proponiAggiornamentoTurniDelModello(modello, orarioPrima){
  const oggi = dataISO(new Date());
  const giorni = Object.keys(AppState.turni || {}).filter(iso => {
    const t = AppState.turni[iso];
    if(!t || t.riposo || t.assenzaTipo || !t.oraInizio) return false;
    if(t.modelloId) return t.modelloId === modello.id;
    return t.oraInizio === orarioPrima.inizio && t.oraFine === orarioPrima.fine;
  });
  if(!giorni.length) return;
  const futuri = giorni.filter(iso => iso >= oggi);
  el('testoAggiornaTurni').textContent =
    `Hai cambiato l'orario di "${modello.nome}" (${orarioPrima.inizio}–${orarioPrima.fine} → ${modello.oraInizio}–${modello.oraFine}). ` +
    `Nel calendario ci sono ${giorni.length} giorni con questo turno, di cui ${futuri.length} da oggi in poi.`;
  el('btnAggTurniFuturi').hidden = !futuri.length;
  const chiudi = () => { el('overlayAggiornaTurni').hidden = true; };
  const applica = elenco => {
    elenco.forEach(iso => { AppState.turni[iso].oraInizio = modello.oraInizio; AppState.turni[iso].oraFine = modello.oraFine; });
    salvaTurniStorage();
    chiudi();
    renderCalendario();
    mostraToast(`Aggiornati ${elenco.length} giorni del calendario`, 'successo');
  };
  el('btnAggTurniFuturi').onclick = () => applica(futuri);
  el('btnAggTurniTutti').onclick = () => applica(giorni);
  el('btnAggTurniNessuno').onclick = chiudi;
  el('overlayAggiornaTurni').hidden = false;
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
  const eventi = eventiDelGiorno(giornoSelezionato);
  if(!eventi.length){ host.innerHTML = ''; return; }
  host.innerHTML = eventi.map(({ ev, isoOrigine }) => rigaEventoHtml(ev, isoOrigine)).join('');
}

// Una riga dell'elenco eventi: titolo, orario, luogo, 🔔 se ha promemoria, 🔁 se si ripete.
function rigaEventoHtml(ev, isoOrigine, etichettaGiorno){
  const quando = ev.tuttoIlGiorno ? 'Tutto il giorno'
    : ev.oraInizio && !ev.oraFine ? `Alle ${ev.oraInizio}` : `${ev.oraInizio || '—'} - ${ev.oraFine || '—'}`;
  const dettaglio = [etichettaGiorno, quando, ev.luogo].filter(Boolean).join(' · ');
  const icone = (promemoriaDiEvento(ev).length ? '🔔' : '') + (ev.ripeti ? '🔁' : '');
  return `<button type="button" class="riga-evento-giorno-v2" data-evento-id="${escapeHtml(ev.id)}" data-evento-iso="${escapeHtml(isoOrigine)}">
      <span class="riga-evento-giorno-pallino" aria-hidden="true">●</span>
      <span class="riga-evento-giorno-testo"><strong>${escapeHtml(ev.titolo || 'Senza titolo')}</strong><small>${escapeHtml(dettaglio)}</small></span>
      ${icone ? `<span class="riga-evento-giorno-icone" aria-hidden="true">${icone}</span>` : ''}
      <span class="riga-modello-freccia" aria-hidden="true">›</span>
    </button>`;
}

// ── Eventi che si ripetono ──
// L'evento resta salvato solo nel giorno in cui è nato (isoOrigine); le ripetizioni si calcolano.
// ev.ripeti: '' | 'settimana' | '2settimane' | 'mese' | 'anno'; ev.ripetiFino: ultimo giorno (facoltativo);
// ev.eccezioni: giorni cancellati uno per uno ("Elimina solo questo giorno").
function dataDaIso(iso){ return new Date(`${iso}T12:00:00`); } // mezzogiorno: niente sorprese con l'ora legale
function eventoCadeIl(isoOrigine, ev, iso){
  if(!ev || (ev.eccezioni || []).includes(iso)) return false;
  if(iso === isoOrigine) return true;
  if(!ev.ripeti || iso < isoOrigine) return false;
  if(ev.ripetiFino && iso > ev.ripetiFino) return false;
  const a = dataDaIso(isoOrigine), b = dataDaIso(iso);
  switch(ev.ripeti){
    case 'settimana': return Math.round((b - a) / 86400000) % 7 === 0;
    case '2settimane': return Math.round((b - a) / 86400000) % 14 === 0;
    case 'mese': return a.getDate() === b.getDate(); // il 31 salta i mesi più corti, come Google Calendar
    case 'anno': return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
    default: return false;
  }
}
// Tutti gli eventi di un giorno, comprese le ripetizioni di eventi nati in giorni precedenti.
function eventiDelGiorno(iso){
  const out = [];
  Object.keys(AppState.eventiGiorno || {}).forEach(o => {
    if(o > iso) return;
    (AppState.eventiGiorno[o] || []).forEach(ev => {
      if(ev && (o === iso || ev.ripeti) && eventoCadeIl(o, ev, iso)) out.push({ ev, isoOrigine: o });
    });
  });
  const chiave = x => x.ev.tuttoIlGiorno ? '' : (x.ev.oraInizio || '99');
  return out.sort((x, y) => chiave(x).localeCompare(chiave(y)));
}
// I prossimi giorni (al massimo "quanti") in cui cade l'evento, a partire da "daIso" compreso.
function prossimeOccorrenzeEvento(isoOrigine, ev, daIso, quanti){
  const out = [];
  const d = dataDaIso(isoOrigine > daIso ? isoOrigine : daIso);
  for(let i = 0; i < 800 && out.length < quanti; i++){
    const iso = dataISO(d);
    if(!ev.ripeti && iso > isoOrigine) break;
    if(ev.ripetiFino && iso > ev.ripetiFino) break;
    if(eventoCadeIl(isoOrigine, ev, iso)) out.push(iso);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ── Prossimi eventi (7 giorni) sotto il calendario ──
function renderProssimiEventiV2(){
  const box = el('prossimiEventiV2'), host = el('listaProssimiEventiV2');
  if(!box || !host) return;
  const adesso = new Date();
  const oraAdesso = `${due(adesso.getHours())}:${due(adesso.getMinutes())}`;
  const righe = [];
  for(let i = 0; i < 7; i++){
    const d = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() + i, 12);
    const iso = dataISO(d);
    const etichetta = i === 0 ? 'Oggi' : i === 1 ? 'Domani'
      : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
    eventiDelGiorno(iso).forEach(({ ev, isoOrigine }) => {
      // Oggi: si tolgono gli eventi già finiti.
      if(i === 0 && !ev.tuttoIlGiorno && (ev.oraFine || ev.oraInizio) && (ev.oraFine || ev.oraInizio) <= oraAdesso) return;
      righe.push(rigaEventoHtml(ev, isoOrigine, etichetta).replace('<button ', `<button data-evento-giorno="${iso}" `));
    });
  }
  box.hidden = !righe.length;
  host.innerHTML = righe.join('');
}
function apriEventoDaProssimi(btn){
  const iso = btn.dataset.eventoGiorno;
  const d = dataDaIso(iso);
  meseCorrente = d.getMonth();
  annoCorrente = d.getFullYear();
  giornoSelezionato = iso;
  renderCalendario();
  apriModificaEventoV2(btn.dataset.eventoId, btn.dataset.eventoIso);
}

function apriModificaEventoV2(id, isoOrigine){
  if(!giornoSelezionato) return;
  const isoEvento = isoOrigine || giornoSelezionato;
  const ev = id ? (AppState.eventiGiorno[isoEvento] || []).find(e => e.id === id) : null;
  // iso = giorno in cui l'evento è salvato; giorno = quello aperto (diverso per una ripetizione)
  eventoInModificaV2 = ev ? { iso: isoEvento, id, giorno: giornoSelezionato } : null;
  el('titoloModaleEvento').textContent = ev ? 'Modifica evento' : 'Nuovo evento';
  el('campoEventoTitolo').value = ev ? (ev.titolo || '') : '';
  el('campoEventoTuttoIlGiorno').checked = !!(ev && ev.tuttoIlGiorno);
  const pre = ev ? null : orariPredefinitiEvento(giornoSelezionato);
  el('campoEventoOraInizio').value = ev ? (ev.oraInizio || '') : pre.inizio;
  el('campoEventoOraFine').value = ev ? (ev.oraFine || '') : pre.fine;
  el('campoEventoLuogo').value = ev ? (ev.luogo || '') : '';
  el('campoEventoNote').value = ev ? (ev.note || '') : '';
  el('campoEventoOraPromemoria').value = ev && ev.oraPromemoria ? ev.oraPromemoria : '08:00';
  el('campoEventoRipeti').value = ev && ev.ripeti ? ev.ripeti : '';
  el('campoEventoRipetiFino').value = ev && ev.ripetiFino ? ev.ripetiFino : '';
  aggiornaVistaRipetiEvento();
  aggiornaVistaOrariEvento();
  // Nuovo evento: un promemoria "10 minuti prima" già pronto, come Google Calendar.
  ridisegnaPromemoriaEvento(ev ? promemoriaDiEvento(ev) : null);
  el('campoEventoAvvisoDurata').value = ev && ev.avvisoSecondi ? String(ev.avvisoSecondi) : '0';
  el('campoEventoAvvisoModo').value = ev && ev.avvisoModo ? ev.avvisoModo : 'suono_vibra';
  aggiornaCampiAvvisoEvento();
  el('btnEliminaEvento').hidden = !ev;
  el('btnEliminaEvento').textContent = ev && ev.ripeti ? '🗑️ Tutta la serie' : '🗑️ Elimina';
  el('btnEliminaEventoGiorno').hidden = !(ev && ev.ripeti);
  el('overlayEvento').hidden = false;
  controllaPermessiPromemoria();
}

function aggiornaVistaRipetiEvento(){
  const ripeti = el('campoEventoRipeti').value;
  el('campoEventoRipetiFinoWrap').hidden = !ripeti;
  el('hintRipetiEvento').hidden = !(ripeti && eventoInModificaV2);
}

// Notifiche dell'app spente: lo diciamo subito nel modulo, con un tasto per riattivarle.
// Lo stato si legge dal modulo nativo (lo stesso interruttore delle impostazioni di Android);
// il permesso di Capacitor è solo il ripiego.
async function notificheAttive(){
  const avviso = pluginAvvisoEvento();
  if(avviso){ try{ const r = await avviso.statoNotifiche(); if(r && typeof r.attive === 'boolean') return r.attive; }catch(e){} }
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  if(!plugin) return true;
  try{ const p = await plugin.checkPermissions(); return p.display === 'granted'; }catch(e){ return true; }
}
let timerPermessiEvento = null;
async function controllaPermessiPromemoria(){
  const box = el('avvisoPermessiEvento'); if(!box) return;
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  const aperto = el('overlayEvento') && !el('overlayEvento').hidden;
  if(!plugin || !aperto || !el('listaPromemoriaEvento').children.length){ box.hidden = true; }
  else box.hidden = await notificheAttive();
  // Finché l'avviso è visibile si ricontrolla ogni 2 secondi: tornando dalle impostazioni di
  // Android sparisce da solo, anche sui telefoni che non segnalano il ritorno nell'app.
  clearTimeout(timerPermessiEvento);
  if(!box.hidden) timerPermessiEvento = setTimeout(controllaPermessiPromemoria, 2000);
}
async function attivaNotifichePromemoria(){
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  if(!plugin) return;
  // 1) Se Android può ancora mostrare la richiesta, la mostriamo (con un limite di tempo: dopo un
  //    "no" definitivo alcuni telefoni non rispondono proprio).
  try{
    const stato = await plugin.checkPermissions();
    if(stato && String(stato.display).startsWith('prompt')){
      const r = await Promise.race([plugin.requestPermissions(), new Promise(ok => setTimeout(() => ok(null), 5000))]);
      if(r && r.display === 'granted' && await notificheAttive()){
        el('avvisoPermessiEvento').hidden = true;
        mostraToast('Notifiche attivate', 'successo');
        return;
      }
    }
  }catch(e){}
  if(await notificheAttive()){ el('avvisoPermessiEvento').hidden = true; mostraToast('Notifiche attivate', 'successo'); return; }
  // 2) Altrimenti si aprono le impostazioni delle notifiche dell'app.
  const avviso = pluginAvvisoEvento();
  if(avviso){
    try{
      mostraToast('Attiva «Mostra notifiche» e poi torna nell\'app.', 'info', 5000);
      await avviso.apriImpostazioniNotifiche();
      return;
    }catch(e){ console.warn('Impostazioni notifiche non aperte:', e); }
  }
  mostraAvviso('Apri Impostazioni di Android → App → Turni → Notifiche e attivale.', 'Notifiche disattivate');
}

// Le notifiche Android vogliono un numero intero (32 bit) come identificativo, non la stringa
// "evento_1234567890123" che usiamo noi internamente — ne ricaviamo uno stabile dalle ultime
// cifre, così lo stesso evento ottiene sempre lo stesso numero (utile per sostituire/annullare
// il promemoria quando l'evento viene modificato o cancellato).
function idNotificaDaEvento(idEvento, indice){
  const cifre = String(idEvento).replace(/\D/g, '').slice(-9);
  const n = parseInt(cifre, 10) || 1;
  if(indice == null) return n; // id "vecchio" (un solo promemoria): serve ancora per annullare quelli già programmati
  return (n % 100000000) * 10 + indice; // un id diverso per ogni promemoria, sempre sotto il limite di Android
}

// ── Promemoria multipli (come Google Calendar) ──
const MAX_PROMEMORIA_EVENTO = 5;
const OPZIONI_PROMEMORIA_ORARIO = [
  [0, "All'orario dell'evento"], [5, '5 minuti prima'], [10, '10 minuti prima'], [15, '15 minuti prima'],
  [30, '30 minuti prima'], [60, '1 ora prima'], [120, '2 ore prima'], [1440, '1 giorno prima']
];
const OPZIONI_PROMEMORIA_TUTTO = [
  [0, 'Il giorno stesso'], [-1, 'La sera prima (20:00)'], [1440, '1 giorno prima'],
  [2880, '2 giorni prima'], [10080, '1 settimana prima']
];

// Elenco dei promemoria di un evento, anche per gli eventi salvati con le versioni precedenti.
function promemoriaDiEvento(ev){
  if(!ev) return [];
  if(Array.isArray(ev.promemoria)) return ev.promemoria.filter(p => p && Number.isFinite(p.min));
  if(ev.ricordami && !ev.tuttoIlGiorno) return [{ min: ev.anticipoMinuti || 0 }];
  return [];
}
function quandoPromemoria(iso, ev, p){
  if(ev.tuttoIlGiorno){
    if(p.min < 0){ const d = new Date(`${iso}T20:00:00`); d.setDate(d.getDate() - 1); return d; }
    const d = new Date(`${iso}T${ev.oraPromemoria || '08:00'}:00`);
    d.setDate(d.getDate() - Math.round(p.min / 1440));
    return d;
  }
  if(!ev.oraInizio) return null;
  const d = new Date(`${iso}T${ev.oraInizio}:00`);
  d.setMinutes(d.getMinutes() - p.min);
  return d;
}
const due = n => String(n).padStart(2, '0');
// Nuovo evento: inizio all'ora tonda successiva (oggi) o alle 9:00 (altri giorni), durata 1 ora.
function orariPredefinitiEvento(iso){
  let h = 9;
  const ora = new Date();
  const oggi = `${ora.getFullYear()}-${due(ora.getMonth() + 1)}-${due(ora.getDate())}`;
  if(iso === oggi) h = Math.min(ora.getHours() + 1, 23);
  return { inizio: `${due(h)}:00`, fine: h >= 23 ? '23:59' : `${due(h + 1)}:00` };
}
function aggiornaVistaOrariEvento(){
  const tutt = el('campoEventoTuttoIlGiorno').checked;
  el('campiEventoOrario').hidden = tutt;
  el('campoEventoOraPromemoriaWrap').hidden = !tutt;
}
function aggiungiRigaPromemoria(p){
  const tutt = el('campoEventoTuttoIlGiorno').checked;
  const opzioni = tutt ? OPZIONI_PROMEMORIA_TUTTO : OPZIONI_PROMEMORIA_ORARIO;
  const riga = document.createElement('div');
  riga.className = 'riga-promemoria';
  const sel = document.createElement('select');
  sel.className = 'pr-sel';
  opzioni.forEach(([v, t]) => sel.add(new Option(t, String(v))));
  if(!tutt) sel.add(new Option('Personalizzata…', 'x'));
  const num = document.createElement('input');
  num.type = 'number'; num.min = '1'; num.max = '999'; num.className = 'pr-num'; num.hidden = true; num.inputMode = 'numeric';
  const uni = document.createElement('select');
  uni.className = 'pr-unita'; uni.hidden = true;
  [['1', 'minuti'], ['60', 'ore'], ['1440', 'giorni']].forEach(([v, t]) => uni.add(new Option(t, v)));
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'pr-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Togli promemoria');
  const min = p && Number.isFinite(p.min) ? p.min : (tutt ? 0 : 10);
  if(opzioni.some(([v]) => v === min)){
    sel.value = String(min);
  } else if(!tutt){
    sel.value = 'x';
    const f = min % 1440 === 0 ? 1440 : (min % 60 === 0 ? 60 : 1);
    uni.value = String(f); num.value = String(Math.max(1, Math.round(min / f)));
  } else {
    sel.add(new Option(`${Math.round(min / 1440)} giorni prima`, String(min))); sel.value = String(min);
  }
  const mostra = () => { const c = sel.value === 'x'; num.hidden = !c; uni.hidden = !c; };
  sel.addEventListener('change', mostra);
  x.addEventListener('click', () => { riga.remove(); aggiornaTestoPromemoriaEvento(); });
  mostra();
  riga.append(sel, num, uni, x);
  el('listaPromemoriaEvento').appendChild(riga);
}
function ridisegnaPromemoriaEvento(lista){
  el('listaPromemoriaEvento').innerHTML = '';
  const tutt = el('campoEventoTuttoIlGiorno').checked;
  const elenco = lista === null || lista === undefined ? [{ min: tutt ? 0 : 10 }] : lista;
  elenco.slice(0, MAX_PROMEMORIA_EVENTO).forEach(aggiungiRigaPromemoria);
  aggiornaTestoPromemoriaEvento();
}
function leggiPromemoriaDalForm(){
  const out = [];
  el('listaPromemoriaEvento').querySelectorAll('.riga-promemoria').forEach(riga => {
    const sel = riga.querySelector('.pr-sel');
    let min;
    if(sel.value === 'x'){
      const n = parseInt(riga.querySelector('.pr-num').value, 10);
      if(!(n > 0)) return;
      min = n * parseInt(riga.querySelector('.pr-unita').value, 10);
    } else {
      min = parseInt(sel.value, 10);
    }
    if(Number.isFinite(min) && !out.some(p => p.min === min)) out.push({ min });
  });
  return out;
}
function aggiornaTestoPromemoriaEvento(){
  const tutt = el('campoEventoTuttoIlGiorno').checked;
  const n = el('listaPromemoriaEvento').children.length;
  el('hintPromemoriaEvento').textContent = !n
    ? 'Nessun promemoria: tocca «Aggiungi promemoria» se ne vuoi uno.'
    : (tutt ? "Evento senza orario: i promemoria arrivano all'ora scelta qui sopra (tranne «La sera prima», alle 20:00)." : 'Puoi aggiungerne più di uno (massimo ' + MAX_PROMEMORIA_EVENTO + ').');
  el('btnAggiungiPromemoria').hidden = n >= MAX_PROMEMORIA_EVENTO;
  aggiornaCampiAvvisoEvento();
  controllaPermessiPromemoria();
}

// ── Avviso evento (suono/vibrazione di pochi secondi, anche in silenzioso) ──
// Funziona solo nell'app Android: è un piccolo modulo nativo (AvvisoEventoPlugin).
function pluginAvvisoEvento(){
  const C = window.Capacitor;
  if(!C || !(C.isNativePlatform && C.isNativePlatform())) return null;
  if(C.Plugins && C.Plugins.AvvisoEvento) return C.Plugins.AvvisoEvento;
  try{ return C.registerPlugin ? C.registerPlugin('AvvisoEvento') : null; }catch(e){ return null; }
}
function aggiornaCampiAvvisoEvento(){
  const wrap = el('campoEventoAvvisoWrap'); if(!wrap) return;
  const visibile = !!pluginAvvisoEvento() && el('listaPromemoriaEvento').children.length > 0;
  wrap.hidden = !visibile;
  el('campoEventoAvvisoModoWrap').hidden = el('campoEventoAvvisoDurata').value === '0';
}

// Slot di notifica per evento: 0..9 (fino a 5 promemoria × le prossime 2 ripetizioni).
const SLOT_NOTIFICA_EVENTO = 10;
const RIPETIZIONI_PROGRAMMATE = 2;
async function annullaNotificheEvento(idEvento, plugin, avviso, tranne){
  const ids = [idNotificaDaEvento(idEvento)];
  for(let i = 0; i < SLOT_NOTIFICA_EVENTO; i++) ids.push(idNotificaDaEvento(idEvento, i));
  const daAnnullare = tranne ? ids.filter(id => !tranne.has(id)) : ids;
  if(!daAnnullare.length) return;
  try{ await plugin.cancel({ notifications: daAnnullare.map(id => ({ id })) }); }catch(e){}
  if(avviso){ for(const id of daAnnullare){ try{ await avviso.annulla({ id }); }catch(e){} } }
}

// iso = giorno in cui l'evento è salvato (per un evento che si ripete: il primo).
// opzioni.silenzioso: nessun messaggio e nessuna richiesta di permessi (apertura app, ripristino backup).
// opzioni.soloAggiungi: riprogramma senza annullare nulla (all'apertura dell'app: le notifiche già
//   comparse restano dove sono).
async function schedulaPromemoriaEvento(iso, evento, opzioni = {}){
  const avvisa = (testo) => { if(!opzioni.silenzioso) mostraToast(testo, 'avviso'); };
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  if(!plugin) return; // sul sito normale (o fuori dall'app) i promemoria non sono disponibili
  const avviso = pluginAvvisoEvento();
  const lista = promemoriaDiEvento(evento).slice(0, MAX_PROMEMORIA_EVENTO);
  const adesso = Date.now();
  const futuri = [];
  let passati = 0;
  // Evento che si ripete: si programmano le prossime 2 volte; le successive le aggiunge
  // l'apertura dell'app (riprogrammaPromemoriaEventi).
  const giorni = evento.ripeti ? prossimeOccorrenzeEvento(iso, evento, dataISO(new Date()), 60) : [iso];
  let ripetizione = 0;
  for(const giorno of giorni){
    if(ripetizione >= RIPETIZIONI_PROGRAMMATE) break;
    let usata = false;
    lista.forEach((p, indice) => {
      const quando = quandoPromemoria(giorno, evento, p);
      if(!quando) return;
      if(quando.getTime() <= adesso){ passati++; return; }
      futuri.push({ slot: ripetizione * MAX_PROMEMORIA_EVENTO + indice, quando, p, giorno });
      usata = true;
    });
    if(usata) ripetizione++;
  }
  const idsNuovi = new Set(futuri.map(f => idNotificaDaEvento(evento.id, f.slot)));
  // Con il modulo nativo un id riprogrammato sostituisce da solo quello vecchio: si annullano
  // solo gli altri, così una notifica dello stesso evento già comparsa non sparisce.
  if(!opzioni.soloAggiungi) await annullaNotificheEvento(evento.id, plugin, avviso, avviso ? idsNuovi : null);
  // Evento già passato (es. annotato dopo): niente avviso, non c'è nulla da ricordare.
  const inizioEvento = new Date(`${iso}T${evento.tuttoIlGiorno || !evento.oraInizio ? '23:59' : evento.oraInizio}:00`);
  if(passati && !evento.ripeti && inizioEvento.getTime() > adesso){
    avvisa(futuri.length ? 'Qualche promemoria è già passato: non verrà inviato.' : "L'orario del promemoria è già passato: non verrà inviato.");
  }
  if(!futuri.length) return;
  const corpo = (f) => {
    const giornoTesto = `${f.giorno.slice(8, 10)}/${f.giorno.slice(5, 7)}`;
    if(evento.tuttoIlGiorno){
      const base = evento.luogo ? `Tutto il giorno — ${evento.luogo}` : 'Tutto il giorno';
      return f.p.min !== 0 ? `Il ${giornoTesto}: ${base}` : base;
    }
    const base = evento.luogo ? `${evento.oraInizio} — ${evento.luogo}` : `Alle ${evento.oraInizio}`;
    return f.p.min >= 1440 ? `Il ${giornoTesto}: ${base}` : base;
  };
  try{
    // 1) Permesso notifiche (Android 13+): lo chiediamo esplicitamente, così se è negato lo diciamo.
    try{
      let perm = await plugin.checkPermissions();
      if(perm.display !== 'granted' && !opzioni.silenzioso) perm = await plugin.requestPermissions();
      if(perm.display !== 'granted'){
        avvisa('Notifiche disattivate per l\'app: attivale dalle impostazioni di Android.');
        return;
      }
    }catch(e){ console.warn('Permesso notifiche non verificabile:', e); }
    // 2) Modulo nativo: sia l'avviso forte (suono/vibrazione per pochi secondi) sia la notifica
    //    normale (durata 0), entrambi con i tasti Posticipa e Spegni.
    if(avviso){
      if(evento.avvisoSecondi > 0 && !opzioni.silenzioso){
        try{
          // Android 12+: per l'orario preciso serve il permesso "Allarmi e promemoria" (chiesto una volta sola).
          const chiave = 'turni_allarmi_esatti_chiesto';
          const ex = await plugin.checkExactNotificationSetting();
          if(ex && ex.exact_alarm === 'denied' && !localStorage.getItem(chiave)){
            localStorage.setItem(chiave, '1');
            await plugin.changeExactNotificationSetting();
          }
        }catch(e){}
      }
      for(const f of futuri){
        await avviso.programma({
          id: idNotificaDaEvento(evento.id, f.slot),
          titolo: evento.titolo,
          testo: corpo(f),
          quandoMs: f.quando.getTime(),
          durataSec: evento.avvisoSecondi > 0 ? evento.avvisoSecondi : 0,
          modo: evento.avvisoModo || 'suono_vibra'
        });
      }
      return;
    }
    // 3) Senza modulo nativo: notifiche di Capacitor. Canale v2: su Android le impostazioni di un
    //    canale già creato non si possono più cambiare. Importanza alta = suono + primo piano.
    try{ await plugin.deleteChannel({ id: 'promemoria_eventi' }); }catch(e){}
    try{
      await plugin.createChannel({
        id: 'promemoria_eventi_v2',
        name: 'Promemoria eventi',
        description: 'Avvisi per gli eventi del calendario',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true
      });
    }catch(e){ console.warn('Canale notifiche non creato:', e); }
    // 4) allowWhileIdle: senza, Android usa un allarme che NON sveglia il telefono e con schermo
    //    spento / risparmio energetico la notifica compare in ritardo o mai.
    await plugin.schedule({ notifications: futuri.map(f => ({
      id: idNotificaDaEvento(evento.id, f.slot),
      title: evento.titolo,
      body: corpo(f),
      channelId: 'promemoria_eventi_v2',
      schedule: { at: f.quando, allowWhileIdle: true }
    })) });
  }catch(e){
    console.warn('Promemoria non programmato:', e);
    avvisa('Non è stato possibile programmare il promemoria.');
  }
}

// All'apertura dell'app (e dopo un ripristino): riprogramma i promemoria futuri di tutti gli eventi.
// Serve se Android li ha cancellati (app chiusa forzatamente, risparmio energetico aggressivo) e
// per far "scorrere" gli eventi che si ripetono, di cui si programmano solo le prossime volte.
async function riprogrammaPromemoriaEventi(opzioni = { soloAggiungi: true }){
  if(!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications)) return;
  const oggi = dataISO(new Date());
  for(const iso of Object.keys(AppState.eventiGiorno || {})){
    for(const ev of (AppState.eventiGiorno[iso] || [])){
      if(!ev || !ev.id || !promemoriaDiEvento(ev).length) continue;
      if(ev.ripeti ? (ev.ripetiFino && ev.ripetiFino < oggi) : iso < oggi) continue;
      try{ await schedulaPromemoriaEvento(iso, ev, { silenzioso: true, soloAggiungi: !!opzioni.soloAggiungi }); }catch(e){}
    }
  }
}

async function annullaPromemoriaEvento(idEvento){
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  if(!plugin) return;
  await annullaNotificheEvento(idEvento, plugin, pluginAvvisoEvento());
}

function salvaEventoV2(){
  if(!giornoSelezionato) return;
  const titolo = el('campoEventoTitolo').value.trim();
  if(!titolo){ mostraToast('Dai un titolo all\'evento prima di salvare.', 'avviso'); return; }
  const tuttoIlGiorno = el('campoEventoTuttoIlGiorno').checked;
  const promemoria = leggiPromemoriaDalForm();
  const isoEvento = eventoInModificaV2 ? eventoInModificaV2.iso : giornoSelezionato;
  const ripeti = el('campoEventoRipeti').value;
  const ripetiFino = ripeti ? el('campoEventoRipetiFino').value : '';
  if(ripetiFino && ripetiFino < isoEvento){
    mostraToast('La data «Fino al» viene prima dell\'evento.', 'avviso');
    return;
  }
  if(!tuttoIlGiorno && promemoria.length && !el('campoEventoOraInizio').value){
    mostraToast("Imposta l'orario di Inizio: serve per il promemoria.", 'avviso');
    return;
  }
  const dati = {
    titolo,
    tuttoIlGiorno,
    oraInizio: tuttoIlGiorno ? '' : el('campoEventoOraInizio').value,
    oraFine: tuttoIlGiorno ? '' : el('campoEventoOraFine').value,
    luogo: el('campoEventoLuogo').value.trim(),
    note: el('campoEventoNote').value.trim(),
    promemoria,
    oraPromemoria: el('campoEventoOraPromemoria').value || '08:00',
    ricordami: promemoria.length > 0,
    anticipoMinuti: promemoria.length ? Math.max(0, promemoria[0].min) : 0,
    avvisoSecondi: parseInt(el('campoEventoAvvisoDurata').value, 10) || 0,
    avvisoModo: el('campoEventoAvvisoModo').value || 'suono_vibra',
    ripeti,
    ripetiFino
  };
  if(!ripeti) dati.eccezioni = []; // senza ripetizioni i giorni "saltati" non hanno più senso
  if(!AppState.eventiGiorno[isoEvento]) AppState.eventiGiorno[isoEvento] = [];
  const lista = AppState.eventiGiorno[isoEvento];
  let eventoSalvato;
  if(eventoInModificaV2){
    const esistente = lista.find(e => e.id === eventoInModificaV2.id);
    if(esistente){ Object.assign(esistente, dati); eventoSalvato = esistente; }
  } else {
    eventoSalvato = { id: 'evento_' + Date.now(), ...dati };
    lista.push(eventoSalvato);
  }
  salvaEventiGiornoStorage();
  if(eventoSalvato) schedulaPromemoriaEvento(isoEvento, eventoSalvato);
  el('overlayEvento').hidden = true;
  renderListaEventiGiornoV2();
  renderCalendario();
  mostraToast('Evento salvato', 'successo');
}

// Evento che si ripete: toglie solo la ripetizione del giorno aperto, il resto della serie resta.
function eliminaEventoSoloGiornoV2(){
  if(!eventoInModificaV2) return;
  const { iso, id, giorno } = eventoInModificaV2;
  const ev = (AppState.eventiGiorno[iso] || []).find(e => e.id === id);
  if(!ev) return;
  ev.eccezioni = [...new Set([...(ev.eccezioni || []), giorno])];
  salvaEventiGiornoStorage();
  schedulaPromemoriaEvento(iso, ev, { silenzioso: true });
  el('overlayEvento').hidden = true;
  renderListaEventiGiornoV2();
  renderCalendario();
  mostraToast('Evento tolto da questo giorno', 'successo');
}

function eliminaEventoV2(){
  if(!eventoInModificaV2) return;
  annullaPromemoriaEvento(eventoInModificaV2.id);
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

function apriRientroRapidoV2(){
  if(!giornoPerPopupV2) return;
  const t = AppState.turni[giornoPerPopupV2];
  if(!t || !t.oraInizio || !t.oraFine){
    mostraToast('Assegna prima un turno di lavoro a questo giorno: il rientro si aggiunge a un turno già presente.', 'avviso');
    return;
  }
  el('campoRientroRapidoInizio').value = t.secondoOraInizio || '';
  el('campoRientroRapidoFine').value = t.secondoOraFine || '';
  el('btnRimuoviRientroRapido').hidden = !t.secondoAttivo;
  el('overlayRientroRapido').hidden = false;
}
function salvaRientroRapidoV2(){
  if(!giornoPerPopupV2) return;
  const iso = giornoPerPopupV2;
  const t = AppState.turni[iso];
  if(!t || !t.oraInizio || !t.oraFine) return;
  const inizio = el('campoRientroRapidoInizio').value;
  const fine = el('campoRientroRapidoFine').value;
  if(!inizio || !fine){ mostraToast('Inserisci sia l\'ora di inizio sia quella di fine del rientro.', 'avviso'); return; }
  t.secondoAttivo = true;
  t.secondoOraInizio = inizio;
  t.secondoOraFine = fine;
  salvaTurniStorage();
  el('overlayRientroRapido').hidden = true;
  renderCalendario();
  renderListaModelliTurniV2();
  mostraToast('Rientro aggiunto', 'successo');
}
function rimuoviRientroRapidoV2(){
  if(!giornoPerPopupV2) return;
  const t = AppState.turni[giornoPerPopupV2];
  if(!t) return;
  t.secondoAttivo = false;
  t.secondoOraInizio = '';
  t.secondoOraFine = '';
  salvaTurniStorage();
  el('overlayRientroRapido').hidden = true;
  renderCalendario();
  renderListaModelliTurniV2();
  mostraToast('Rientro rimosso', 'successo');
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
  } else if(t.oraInizio && t.oraFine){
    testo = `${dataLeggibile} — ${t.oraInizio} - ${t.oraFine}`;
    if(t.secondoAttivo && t.secondoOraInizio && t.secondoOraFine) testo += ` / ${t.secondoOraInizio} - ${t.secondoOraFine}`;
  }
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
    // NOTA: qui prima c'era anche una ricarica automatica quando il nuovo service worker
    // prendeva il controllo ("controllerchange"). Rimossa: con aggiornamenti ravvicinati come
    // in questa fase di lavoro, poteva scattare ad ogni apertura dell'app invece che una sola
    // volta, causando un ciclo di ricariche continue che impediva di usare l'app. Ora la
    // ricarica avviene solo al tocco esplicito di "Aggiorna ora" qui sotto, mai da sola.
  });
}

// Avviso "nuova versione disponibile": invece di ricaricare subito da soli (interromperebbe
// l'utente a metà di qualcosa, es. mentre sta scrivendo un turno), mostriamo un invito esplicito;
// al tocco, diciamo al nuovo service worker di attivarsi e ricarichiamo noi stessi la pagina
// dopo una breve pausa — non dipendiamo più dall'evento "controllerchange" del browser, che si
// è dimostrato inaffidabile con aggiornamenti così ravvicinati.
function mostraAvvisoNuovaVersione(worker){
  if(document.getElementById('avvisoNuovaVersioneV65')) return; // non duplicare l'avviso
  const banner = document.createElement('div');
  banner.id = 'avvisoNuovaVersioneV65';
  banner.className = 'avviso-nuova-versione-v65';
  banner.innerHTML = '<span>🔄 Nuova versione disponibile.</span><button type="button">Aggiorna ora</button>';
  banner.querySelector('button').addEventListener('click', () => {
    worker.postMessage({ tipo: 'skipWaiting' });
    banner.remove();
    setTimeout(() => window.location.reload(), 300);
  });
  document.body.appendChild(banner);
}
