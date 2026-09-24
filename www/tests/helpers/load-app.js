/*
 * Carica i VERI file sorgente dell'app (js/*.js) in una sandbox Node tramite il modulo "vm",
 * così i test verificano il codice realmente spedito nell'app e non una sua reimplementazione
 * separata (che potrebbe divergere e nascondere regressioni, come è già successo in passato:
 * il bug dell'IRPEF negativa oltre i 50.000€ non sarebbe mai stato scoperto testando una copia
 * "pulita" della formula anziché il codice reale con il suo bug di serializzazione JSON).
 *
 * La sandbox imita l'ambiente browser quel poco che serve a questi file per caricarsi senza
 * errori: window (= lo stesso oggetto globale, come nei browser), un document/localStorage
 * minimi, e nient'altro. Non è un DOM completo: i test devono limitarsi alle funzioni di
 * calcolo puro (classificaTurno, calcolaIRPEFAnnua, ecc.), non a quelle che manipolano l'interfaccia.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..', '..');

function creaLocalStorageFinto(){
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => { store.clear(); }
  };
}

function creaElementoDomFinto(){
  return {
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    setAttribute(){}, getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    appendChild(){}, closest(){ return null; }
  };
}

function creaSandbox(){
  const sandbox = {};
  sandbox.window = sandbox; // in un browser "window" È l'oggetto globale: replichiamo la stessa identità.
  sandbox.globalThis = sandbox;
  sandbox.console = console;
  sandbox.localStorage = creaLocalStorageFinto();
  sandbox.navigator = { serviceWorker: undefined, onLine: true };
  sandbox.document = {
    readyState: 'complete',
    getElementById: () => null, // el(...) restituirà sempre null: sufficiente per le funzioni di calcolo puro.
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => creaElementoDomFinto()
  };
  vm.createContext(sandbox);
  return sandbox;
}

function caricaFile(sandbox, percorsoRelativo){
  const percorsoAssoluto = path.join(RADICE, percorsoRelativo);
  const codice = fs.readFileSync(percorsoAssoluto, 'utf8');
  vm.runInContext(codice, sandbox, { filename: percorsoRelativo });
}

// Ordine di caricamento: deve rispecchiare quello reale in index.html per le dipendenze fra file.
const FILE_APP = [
  'js/config.js',
  'js/state.js',
  'js/data/tabelle-2026.js',
  'js/utils.js',
  'js/shifts.js',
  'js/absences.js',
  'js/calendar.js',
  'js/storage.js',
  'js/tables.js',
  'js/profile.js',
  'js/sequence.js',
  'js/ui.js',
  'js/payroll.js'
];

/** Restituisce una sandbox "fresca" con l'app caricata, pronta per un singolo test. */
function caricaApp(){
  const sandbox = creaSandbox();
  for(const file of FILE_APP) caricaFile(sandbox, file);
  // script.js (non caricato qui, perché fa init pesanti sul DOM) espone questo alias globale
  // prima di richiamare caricaTabelle(). Lo replichiamo per fedeltà al comportamento reale.
  sandbox.TABELLE_PREDEFINITE = sandbox.TurniPSData.TABELLE_PREDEFINITE;
  return sandbox;
}

module.exports = { caricaApp };
