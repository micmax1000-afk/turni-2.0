// Controlli del calcolo di lordo e netto, senza browser: carica i file veri dell'app in un contesto Node.
// Avvio: `node tests/calcolo-netto.mjs`  (esce con codice 1 se un controllo fallisce)
// Il cedolino di riferimento è quello reale di settembre 2026 (Assistente Capo Coordinatore, coniuge a carico).
// Nel file ci sono solo importi: nessun dato personale.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WWW = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const leggi = f => fs.readFileSync(path.join(WWW, f), 'utf8');
const estrai = (src, nome) => { const i = src.indexOf(`function ${nome}(`); let d = 0, j = src.indexOf('{', i); for(let k = j; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };

const ctx = { window: {}, console, Math, Number, String, Object, JSON, Array, Infinity, Date };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(leggi('js/data/tabelle-2026.js'), ctx);
vm.runInContext(leggi('js/utils.js'), ctx);
vm.runInContext(estrai(leggi('js/calendar.js'), 'calcolaAliquotaAddizionaleRegionale'), ctx);
vm.runInContext(estrai(leggi('js/profile.js'), 'normalizzaSindacato'), ctx);
const profilo = leggi('js/profile.js'); const m = profilo.indexOf('const MAPPA_GRADI'); vm.runInContext(profilo.slice(m, profilo.indexOf('};', m) + 2).replace('const MAPPA_GRADI', 'var MAPPA_GRADI'), ctx);
vm.runInContext(leggi('js/payroll.js'), ctx);
vm.runInContext(`var TABELLE_PREDEFINITE = window.TurniPSData.TABELLE_PREDEFINITE;
  var AppState = { tabelle: clonaTabelleConSoglie(TABELLE_PREDEFINITE), anagrafica: null, conguagliPerMese: {}, indennitaPersonalizzate: [] };`, ctx);

let falliti = 0;
const ok = (nome, cond, dett = '') => { console.log(`  ${cond ? '✔' : '✘'} ${nome}${!cond && dett ? ' — ' + dett : ''}`); if(!cond) falliti++; };
const vicino = (a, b, tol) => Math.abs(a - b) <= tol;
const run = (codice, input) => { ctx.__in = input; return vm.runInContext(codice, ctx); };

console.log('\nCedolino reale 09/2026');
const comp = {
  fisse: { stipendioTabellare: 1979.44, iis: 0, indennitaPensionabile: 758.49, assegnoFunzione: 147.53 },
  accessorie: { strDiurno: 138.90, strNotturno: 47.13, indServizioEsterno: 144, indFestiva: 42, indTurnoNotturno: 103.20, indControlloTerritorio: 45 },
  personalizzate: [
    { nome: 'Vacanza contrattuale', unita: 'mese', importo: 19.79 },
    { nome: 'Rischio gruppo IV (solo per questo test)', unita: 'turno', importo: 21.60 }
  ]
};
const r = run(`AppState.anagrafica = { qualifica: 'Assistente Capo Coordinatore', regione: 'Piemonte', coniugeACarico: 'si', sindacato: 'si', anni: 24, addComunale: 0.8 };
  AppState.tabelle.maggiorazionePrevidenzialeBase = 299.88;
  calcolaRitenute(__in)`, comp);
ok('lordo 3.447,08', vicino(r.lordo, 3447.08, 0.05), r.lordo);
ok('contributi 385,79', vicino(r.contributi, 385.79, 0.05), r.contributi);
ok('imponibile fiscale 3.061,29', vicino(r.imponibile, 3061.29, 0.05), r.imponibile);
ok('IRPEF lorda 776,88', vicino(r.irpefTotale, 776.88, 0.10), r.irpefTotale);
ok('detrazioni 174 (± 20)', vicino(r.detrazioni, 174, 20), r.detrazioni);
const alt = run(`AppState.tabelle.sindacatoMensile = 9.77; calcolaRitenute(__in).sindacato`, comp);
ok('altre ritenute 10,37 (quota sindacale 9,77 + Fondo assistenza 0,60)', vicino(alt, 10.37, 0.01), alt);
run(`AppState.tabelle.sindacatoMensile = TABELLE_PREDEFINITE.sindacatoMensile`);

console.log('\nStraordinario');
const base = JSON.parse(JSON.stringify(comp));
const conStr = h => { const c = JSON.parse(JSON.stringify(comp)); c.accessorie.strDiurno += h * 13.89; return c; };
const netto = c => run(`(function(c){ const r = calcolaRitenute(c); return r.lordo - r.contributi - r.irpefTotale + r.detrazioni + r.trattamentoIntegrativo - r.addizionali - r.sindacato; })(__in)`, c);
const n0 = netto(base), n3 = netto(conStr(3));
const lordo3 = 3 * 13.89, nettoStr = n3 - n0;
console.log(`  3 ore diurne: lordo ${lordo3.toFixed(2)} → netto ${nettoStr.toFixed(2)}`);
ok('lo straordinario netto è positivo e minore del lordo', nettoStr > 0 && nettoStr < lordo3);
ok('niente 15% agevolato: il netto è sotto il 70% del lordo', nettoStr < lordo3 * 0.70);

console.log('\nAssegno funzionale e tredicesima');
const af = run(`AppState.anagrafica.qualifica = 'Assistente Capo Coordinatore'; AppState.anagrafica.anni = 24; calcolaAssegnoFunzioneMensile()`);
ok('assegno funzionale a 24 anni = 147,53', vicino(af, 147.53, 0.01), af);
const dic = JSON.parse(JSON.stringify(comp)); dic.fisse.tredicesima = 1979.44;
const rd = run(`calcolaRitenute(__in)`, dic);
ok('dicembre: la tredicesima non fa salire il reddito annuo stimato di ×12', rd.redditoAnnuoStimato < r.redditoAnnuoStimato + 3000, rd.redditoAnnuoStimato);

console.log(falliti ? `\n${falliti} controlli falliti` : '\nTutto ok');
process.exit(falliti ? 1 : 0);
