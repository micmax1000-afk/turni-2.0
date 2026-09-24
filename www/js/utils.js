/* FASE 1 — modulo estratto dal precedente script.js. */

var idContatore = (typeof idContatore !== 'undefined') ? idContatore : 1;
function nuovoId(){ return 'a' + Date.now().toString(36) + (idContatore++).toString(36) + Math.random().toString(36).slice(2, 6); }

// Ripristina in-place le soglie "fino: Infinity" perse per via del round-trip JSON (null -> Infinity).
function ripristinaSoglieInfinite(obj){
  if(!obj || typeof obj !== 'object') return obj;
  for(const k in obj){
    const v = obj[k];
    if(k === 'fino' && v === null) obj[k] = Infinity;
    else if(v && typeof v === 'object') ripristinaSoglieInfinite(v);
  }
  return obj;
}

// Clona un oggetto tabelle passando per JSON (necessario per uno snapshot sicuro), ma ripristina le soglie
// "fino: Infinity" (usate per l'ultimo scaglione IRPEF/addizionale regionale) che JSON.stringify trasformerebbe
// altrimenti in null, rompendo silenziosamente il calcolo dell'ultimo scaglione (vedi calcolaIRPEFAnnua).
function clonaTabelleConSoglie(fonte){
  return ripristinaSoglieInfinite(JSON.parse(JSON.stringify(fonte || {})));
}

function chiaveMese(anno, mese){ return `${anno}-${String(mese + 1).padStart(2,'0')}`; }

function dataISO(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function round2(n){ return Math.round(n * 100) / 100; }

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function euro(n){
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('it-IT', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €';
}

function formattaDataBreve(iso){
  const [a, m, g] = iso.split('-');
  return `${g}/${m}/${a}`;
}

const el = id => document.getElementById(id);
