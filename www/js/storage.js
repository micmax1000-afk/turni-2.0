/* Turni & Accessorio PS — Persistenza e repository dati (Fase 1)
 * Compatibilità: le funzioni mantengono i nomi originali così l'interfaccia
 * esistente continua a funzionare senza modifiche.
 */
'use strict';

// Adapter unico per la persistenza: il resto dell'app non accede mai direttamente a localStorage.
// Ogni chiamata è protetta: se lo storage del dispositivo desse un errore per qualsiasi motivo
// (spazio esaurito, restrizioni della WebView dentro l'app Android, ecc.), non deve mai bloccare
// il resto della schermata che si stava disegnando in quel momento.
const TurniPSStorage = Object.freeze({
  getItem: (chiave) => { try{ return window.localStorage.getItem(chiave); }catch(e){ console.warn('Storage non disponibile (lettura):', chiave, e); return null; } },
  setItem: (chiave, valore) => { try{ window.localStorage.setItem(chiave, valore); return true; }catch(e){ console.warn('Storage non disponibile (scrittura):', chiave, e); return false; } },
  removeItem: (chiave) => { try{ window.localStorage.removeItem(chiave); }catch(e){ console.warn('Storage non disponibile (rimozione):', chiave, e); } },
  clear: () => { try{ window.localStorage.clear(); }catch(e){ console.warn('Storage non disponibile (pulizia):', e); } }
});

function caricaColoriTurni(){
  const predefiniti = {};
  CATEGORIE_COLORABILI.forEach(c => { predefiniti[c.chiave] = c.predefinito; });
  try{
    const salvati = JSON.parse(TurniPSStorage.getItem(CHIAVE_COLORI_TURNI));
    if(salvati && typeof salvati === 'object'){
      // Unisce i salvati; se manca o è transparent usa il predefinito (colori automatici)
      const out = { ...predefiniti };
      Object.keys(salvati).forEach(k => {
        if(salvati[k] && salvati[k] !== 'transparent') out[k] = salvati[k];
      });
      return out;
    }
  }catch{}
  return predefiniti;
}

function salvaColoriTurniStorage(){ TurniPSStorage.setItem(CHIAVE_COLORI_TURNI, JSON.stringify(AppState.coloriTurni)); }

function caricaAssenze(){
  try{
    const salvate = JSON.parse(TurniPSStorage.getItem(CHIAVE_ASSENZE));
    if(salvate && Array.isArray(salvate) && salvate.length){
      // aggiungo eventuali nuove voci predefinite non ancora presenti nel salvataggio dell'utente
      const nomiEsistenti = salvate.map(a => a.nome);
      const mancanti = ASSENZE_PREDEFINITE
        .filter(a => !nomiEsistenti.includes(a.nome))
        .map(a => ({ id: nuovoId(), ...a, personalizzata:false }));
      const risultato = mancanti.length ? [...salvate, ...mancanti] : salvate;
      // rimosse dall'elenco predefinito: tolgo anche da eventuali salvataggi precedenti (solo se non rinominate/personalizzate dall'utente)
      const rimosseDaElencoPredefinito = ['Riposo settimanale', 'Permesso lutto/grave infermità familiare'];
      const risultatoFiltrato = risultato.filter(a => a.personalizzata || !rimosseDaElencoPredefinito.includes(a.nome));
      // il Riposo compensativo è sempre e solo in ore (valore/saldo automatico)
      risultatoFiltrato.forEach(a => {
        if(a.nome === 'Riposo compensativo') a.unita = 'h';
        if(a.nome === 'Recupero riposo') a.unita = 'gg';
        if(a.nome === 'Recupero festivo') a.unita = 'gg';
      });
      // Aspettativa: il vecchio valore predefinito era 0, aggiornato a 730 (2 anni) — ma questa correzione
      // va fatta UNA SOLA VOLTA: se ripetuta ad ogni caricamento, sovrascriverebbe anche uno 0 impostato
      // di proposito dall'utente (es. aspettativa esaurita), che deve invece poter restare 0.
      if(!TurniPSStorage.getItem(CHIAVE_ASPETTATIVA_MIGRATA)){
        const vocaAsp = risultatoFiltrato.find(a => a.nome === 'Aspettativa');
        if(vocaAsp && vocaAsp.valore === 0) vocaAsp.valore = 730;
        TurniPSStorage.setItem(CHIAVE_ASPETTATIVA_MIGRATA, '1');
      }
      // riordino secondo l'ordine predefinito (le voci personalizzate restano in coda, nell'ordine in cui sono state aggiunte)
      const ordinePredefinito = ASSENZE_PREDEFINITE.map(a => a.nome);
      risultatoFiltrato.sort((a, b) => {
        const ia = ordinePredefinito.indexOf(a.nome), ib = ordinePredefinito.indexOf(b.nome);
        if(ia === -1 && ib === -1) return 0;
        if(ia === -1) return 1;
        if(ib === -1) return -1;
        return ia - ib;
      });
      // Riparazione: il vecchio generatore di id (numerico, riparte da 1 ad ogni sessione) poteva produrre
      // collisioni quando si aggiungeva una voce mancante a un elenco già esistente (es. "Riposo festivo"
      // riaggiunta con lo stesso id già usato da un'altra voce, causando sigle/saldi sbagliati). Se trovo
      // id duplicati, assegno un id nuovo e univoco a tutte le occorrenze tranne la prima.
      const idVisti = new Set();
      risultatoFiltrato.forEach(a => {
        if(idVisti.has(a.id)) a.id = nuovoId();
        idVisti.add(a.id);
      });
      return risultatoFiltrato;
    }
  }catch{}
  TurniPSStorage.setItem(CHIAVE_ASPETTATIVA_MIGRATA, '1'); // parte già con 730, non serve mai migrarla
  return ASSENZE_PREDEFINITE.map(a => ({ id: nuovoId(), ...a, personalizzata:false }));
}

function salvaAssenzeStorage(){ TurniPSStorage.setItem(CHIAVE_ASSENZE, JSON.stringify(AppState.assenze)); }

function caricaIndennitaPersonalizzate(){
  try{
    const salvate = JSON.parse(TurniPSStorage.getItem(CHIAVE_INDENNITA_PERSONALIZZATE));
    return Array.isArray(salvate) ? salvate : [];
  }catch{ return []; }
}
function salvaIndennitaPersonalizzateStorage(){ TurniPSStorage.setItem(CHIAVE_INDENNITA_PERSONALIZZATE, JSON.stringify(AppState.indennitaPersonalizzate)); }

function caricaReportBlocchi(){
  const predefinito = { prossimoTurno: true, riepilogoMese: true, riepilogoOre: true, statistiche: true, cedolino: true };
  try{
    const salvato = JSON.parse(TurniPSStorage.getItem(CHIAVE_REPORT_BLOCCHI));
    return (salvato && typeof salvato === 'object') ? Object.assign(predefinito, salvato) : predefinito;
  }catch{ return predefinito; }
}
function salvaReportBlocchiStorage(){ TurniPSStorage.setItem(CHIAVE_REPORT_BLOCCHI, JSON.stringify(AppState.reportBlocchi)); }

// "Ultimo modello/assenza usato": per la pressione lunga su un giorno vuoto, che ripete
// l'ultima scelta fatta dal selettore Modelli/Assenze senza doverlo riaprire.
function salvaUltimoModelloUsato(tipo, id){
  try{ TurniPSStorage.setItem(CHIAVE_ULTIMO_MODELLO_USATO, JSON.stringify({ tipo, id })); }catch{}
}
function caricaUltimoModelloUsato(){
  try{
    const v = JSON.parse(TurniPSStorage.getItem(CHIAVE_ULTIMO_MODELLO_USATO));
    return (v && v.tipo && v.id) ? v : null;
  }catch{ return null; }
}

// Modelli turno: partono da questi 5 di base, ma da qui in poi vivono in AppState.modelliTurno
// (modificabili e ampliabili dall'utente) — questo array serve solo come "seme" iniziale al primo
// avvio, o come ripristino se l'utente svuota tutto per errore.
const MODELLI_TURNO_BASE_V2 = [
  { id:'sera', nome:'Sera', oraInizio:'19:00', oraFine:'01:00', sigla:'SE' },
  { id:'pomeriggio', nome:'Pomeriggio', oraInizio:'13:00', oraFine:'19:00', sigla:'PO' },
  { id:'mattina', nome:'Mattino', oraInizio:'07:00', oraFine:'13:00', sigla:'MA' },
  { id:'notte', nome:'Notte', oraInizio:'01:00', oraFine:'07:00', sigla:'NO' },
  { id:'riposo', nome:'Riposo', riposo:true, sigla:'RI' },
  { id:'aggiornamentoProfessionale', nome:'Aggiornamento professionale', oraInizio:'08:00', oraFine:'14:00', sigla:'AG' },
  { id:'addestramentoTiro', nome:'Addestramento tiro', oraInizio:'08:00', oraFine:'14:00', sigla:'AT' },
  { id:'ufficio', nome:'Ufficio', oraInizio:'08:00', oraFine:'14:00', sigla:'UF' }
];
// Turni aggiunti dopo il primo rilascio dei Modelli: chi ha già l'app installata ha un elenco
// salvato che non li contiene. Li aggiungiamo qui, una volta sola, senza toccare nulla che
// l'utente abbia già personalizzato (nome, orario) sugli altri turni.
function aggiungiModelliMancantiV2(elenco){
  const idPresenti = new Set(elenco.map(m => m.id));
  const idNuovi = ['aggiornamentoProfessionale', 'addestramentoTiro', 'ufficio'];
  const daAggiungere = MODELLI_TURNO_BASE_V2.filter(base => idNuovi.includes(base.id) && !idPresenti.has(base.id));
  return daAggiungere.length ? [...elenco, ...daAggiungere.map(m => ({...m}))] : elenco;
}
function caricaModelliTurno(){
  try{
    const salvati = JSON.parse(TurniPSStorage.getItem(CHIAVE_MODELLI_TURNO));
    if(Array.isArray(salvati) && salvati.length){
      const aggiornato = aggiungiModelliMancantiV2(salvati);
      if(aggiornato !== salvati) TurniPSStorage.setItem(CHIAVE_MODELLI_TURNO, JSON.stringify(aggiornato));
      return aggiornato;
    }
  }catch{}
  return MODELLI_TURNO_BASE_V2.map(m => ({ ...m }));
}
function salvaModelliTurnoStorage(){ TurniPSStorage.setItem(CHIAVE_MODELLI_TURNO, JSON.stringify(AppState.modelliTurno)); }

// Pattern (V2, solo visualizzazione/modifica del ciclo per ora — la generazione vera usa ancora
// la logica originale in sequence.js). Seme iniziale: gli stessi due "Turno in quinta" di sempre,
// così l'editor mostra da subito qualcosa di riconoscibile.
const PATTERN_BASE_V2 = [
  { id:'pattern_quinta5', nome:'Turno in quinta', giorni:[
    {modelloId:'sera'},{modelloId:'pomeriggio'},{modelloId:'mattina'},{modelloId:'notte'},{modelloId:'riposo'}
  ]},
  { id:'pattern_quinta10', nome:'Turno in quinta 10 giorni', giorni:[
    {modelloId:'sera'},{modelloId:'pomeriggio'},{modelloId:'mattina'},{modelloId:'notte'},{modelloId:'riposo'},
    {modelloId:'sera'},{modelloId:'pomeriggio'},{modelloId:'mattina'},{modelloId:'mattina'},{modelloId:'riposo'}
  ]},
  { id:'pattern_settimana_corta', nome:'Settimana corta', giorni:[
    {modelloId:'ufficio'},
    {modelloId:'ufficio', secondoTurno:{oraInizio:'15:00', oraFine:'18:00'}},
    {modelloId:'ufficio'},
    {modelloId:'ufficio', secondoTurno:{oraInizio:'15:00', oraFine:'18:00'}},
    {modelloId:'ufficio'},
    {modelloId:'riposo'},{modelloId:'riposo'}
  ]},
  { id:'pattern_settimana_lunga', nome:'Settimana lunga', giorni:[
    {modelloId:'ufficio'},{modelloId:'ufficio'},{modelloId:'ufficio'},{modelloId:'ufficio'},{modelloId:'ufficio'},{modelloId:'ufficio'},
    {modelloId:'riposo'}
  ]}
];
// Come aggiungiModelliMancantiV2: chi ha già i pattern salvati (senza le due Settimane, aggiunte
// dopo) le riceve qui una volta sola, senza toccare i pattern che l'utente ha già modificato.
function aggiungiPatternMancantiV2(elenco){
  const idPresenti = new Set(elenco.map(p => p.id));
  const idNuovi = ['pattern_settimana_corta', 'pattern_settimana_lunga'];
  const daAggiungere = PATTERN_BASE_V2.filter(base => idNuovi.includes(base.id) && !idPresenti.has(base.id));
  return daAggiungere.length
    ? [...elenco, ...daAggiungere.map(p => ({ id:p.id, nome:p.nome, giorni: p.giorni.map(g => ({...g})) }))]
    : elenco;
}
function caricaPattern(){
  try{
    const salvati = JSON.parse(TurniPSStorage.getItem(CHIAVE_PATTERN_TURNI));
    if(Array.isArray(salvati) && salvati.length){
      const aggiornato = aggiungiPatternMancantiV2(salvati);
      if(aggiornato !== salvati) TurniPSStorage.setItem(CHIAVE_PATTERN_TURNI, JSON.stringify(aggiornato));
      return aggiornato;
    }
  }catch{}
  return PATTERN_BASE_V2.map(p => ({ id:p.id, nome:p.nome, giorni: p.giorni.map(g => ({ modelloId:g.modelloId, indennita: g.indennita || [], secondoTurno: g.secondoTurno || null })) }));
}
function salvaPatternStorage(){ TurniPSStorage.setItem(CHIAVE_PATTERN_TURNI, JSON.stringify(AppState.pattern)); }

function caricaEventiGiorno(){
  try{
    const v = JSON.parse(TurniPSStorage.getItem(CHIAVE_EVENTI_GIORNO));
    return (v && typeof v === 'object') ? v : {};
  }catch{ return {}; }
}
function salvaEventiGiornoStorage(){ TurniPSStorage.setItem(CHIAVE_EVENTI_GIORNO, JSON.stringify(AppState.eventiGiorno)); }

function caricaNoteGiorni(){
  try{ return JSON.parse(TurniPSStorage.getItem(CHIAVE_NOTE_GIORNI)) || {}; }catch{ return {}; }
}

function salvaNoteGiorniStorage(){ TurniPSStorage.setItem(CHIAVE_NOTE_GIORNI, JSON.stringify(AppState.noteGiorni)); }

function caricaSequenza(){
  try{
    const salvata = JSON.parse(TurniPSStorage.getItem(CHIAVE_SEQUENZA));
    if(salvata && Array.isArray(salvata) && salvata.length){
      // compatibilità con il vecchio formato (array di stringhe)
      return salvata.map(p => typeof p === 'string' ? { tipo: p } : p);
    }
  }catch{}
  return [{tipo:'sera01'}, {tipo:'pomeriggio'}, {tipo:'mattina'}, {tipo:'notte01'}, {tipo:'riposo'}]; // turno in quinta predefinito
}

function salvaSequenzaStorage(){ TurniPSStorage.setItem(CHIAVE_SEQUENZA, JSON.stringify(AppState.sequenzaTurni)); }

function caricaTabelle(){
  try{
    const salvate = JSON.parse(TurniPSStorage.getItem(CHIAVE_TABELLE));
    if(!salvate) return clonaTabelleConSoglie(TABELLE_PREDEFINITE);
    // Migrazione: le vecchie AppState.tabelle salvate avevano lo straordinario a 4 gruppi
    // (es. "Agenti/Assistenti"), incompatibile con la nuova struttura per qualifica.
    if(salvate.straordinarioOrario && !salvate.straordinarioOrario['Agente']){
      delete salvate.straordinarioOrario;
    }
    // Migrazione: il vecchio assegno di funzione era un unico valore per tutti i ruoli,
    // incompatibile con la nuova struttura differenziata per ruolo.
    if(salvate.assegnoFunzioneAnnuo && !salvate.assegnoFunzioneAnnuo.truppa){
      delete salvate.assegnoFunzioneAnnuo;
    }
    return ripristinaSoglieInfinite({ ...clonaTabelleConSoglie(TABELLE_PREDEFINITE), ...salvate });
  }catch{ return clonaTabelleConSoglie(TABELLE_PREDEFINITE); }
}

function salvaTabelleStorage(){ TurniPSStorage.setItem(CHIAVE_TABELLE, JSON.stringify(AppState.tabelle)); }

function caricaConguagli(){
  try{ return JSON.parse(TurniPSStorage.getItem(CHIAVE_CONGUAGLI)) || {}; }catch{ return {}; }
}

function salvaConguagliStorage(){ TurniPSStorage.setItem(CHIAVE_CONGUAGLI, JSON.stringify(AppState.conguagliPerMese)); }

function caricaStorico(){
  try{ return JSON.parse(TurniPSStorage.getItem(CHIAVE_STORICO)) || {}; }catch{ return {}; }
}

function salvaStoricoStorage(){ TurniPSStorage.setItem(CHIAVE_STORICO, JSON.stringify(AppState.storico)); }

function caricaAnagrafica(){
  try{ return JSON.parse(TurniPSStorage.getItem(CHIAVE_ANAGRAFICA)) || null; }catch{ return null; }
}

function salvaAnagraficaStorage(){ TurniPSStorage.setItem(CHIAVE_ANAGRAFICA, JSON.stringify(AppState.anagrafica)); }

function caricaTurni(){
  try{ return JSON.parse(TurniPSStorage.getItem(CHIAVE_TURNI)) || {}; }catch{ return {}; }
}

function salvaTurniStorage(){ TurniPSStorage.setItem(CHIAVE_TURNI, JSON.stringify(AppState.turni)); }
