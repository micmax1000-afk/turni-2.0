/* Turni & Accessorio PS — Persistenza e repository dati (Fase 1)
 * Compatibilità: le funzioni mantengono i nomi originali così l'interfaccia
 * esistente continua a funzionare senza modifiche.
 */
'use strict';

// Adapter unico per la persistenza: il resto dell'app non accede mai direttamente a localStorage.
const TurniPSStorage = Object.freeze({
  getItem: (chiave) => window.localStorage.getItem(chiave),
  setItem: (chiave, valore) => window.localStorage.setItem(chiave, valore),
  removeItem: (chiave) => window.localStorage.removeItem(chiave),
  clear: () => window.localStorage.clear()
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
