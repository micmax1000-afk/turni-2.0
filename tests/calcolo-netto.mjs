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


// ── Dati dei cedolini reali (solo importi). Le voci "Rischio gruppo IV" sono nei test come personalizzate solo per far tornare i totali.
const pers = (...v) => v.map(([nome, unita, importo]) => ({ nome, unita, importo }));
const VAC = ['Vacanza contrattuale', 'mese', 19.79], RISCHIO = n => ['Rischio gruppo IV (solo test)', 'turno', n];
const calc = (comp, mese, extra = '') => run(`AppState.tabelle = clonaTabelleConSoglie(TABELLE_PREDEFINITE); AppState.anagrafica = { qualifica: 'Assistente Capo Coordinatore', regione: 'Piemonte', coniugeACarico: 'si', sindacato: 'si', anni: 24, addComunale: 0.8 };
  AppState.tabelle.sindacatoMensile = 9.77; AppState.tabelle.detrazioniMensiliCedolino = 0; ${extra}
  calcolaRitenute(__in, ${mese})`, comp);
const nettoMese = (r) => r.lordo - r.contributi - r.irpefTotale + r.detrazioni + r.trattamentoIntegrativo - r.addizionali - r.sindacato;

console.log('\nMaggiorazione figurativa 15% (NoiPA 090/2013)');
const mg = run(`AppState.tabelle = clonaTabelleConSoglie(TABELLE_PREDEFINITE); (1979.44 + 19.79) * AppState.tabelle.maggiorazioneFigurativaPct / 100`);
ok('15% × (stipendio parametrato 1.979,44 + vacanza contrattuale 19,79) = 299,88', vicino(mg, 299.88, 0.01), mg);

console.log('\nSettembre 2026 (accessorie di luglio)');
const sett = { fisse: { stipendioTabellare: 1979.44, iis: 0, indennitaPensionabile: 758.49, assegnoFunzione: 147.53 },
  accessorie: { strDiurno: 138.90, strNotturno: 47.13, indServizioEsterno: 144, indFestiva: 42, indTurnoNotturno: 103.20, indControlloTerritorio: 45 },
  personalizzate: pers(VAC, RISCHIO(21.60)) };
let r = calc(sett, 8);
ok('lordo 3.447,08', vicino(r.lordo, 3447.08, 0.05), r.lordo);
ok('contributi 385,79', vicino(r.contributi, 385.79, 0.10), r.contributi);
ok('imponibile fiscale 3.061,29', vicino(r.imponibile, 3061.29, 0.10), r.imponibile);
ok('IRPEF lorda 776,88', vicino(r.irpefTotale, 776.88, 0.15), r.irpefTotale);
ok('altre ritenute 10,37', vicino(r.sindacato, 10.37, 0.01), r.sindacato);
ok('con "Totale detrazioni" 174 inserito il netto prima dei conguagli è 2.448,04 (+ addizionali stimate)', (() => { const x = calc(sett, 8, 'AppState.tabelle.detrazioniMensiliCedolino = 174;'); return vicino(nettoMese(x) + x.addizionali, 2448.04, 0.30) && vicino(x.addizionali, 120.94, 15); })());

console.log('\nFebbraio 2026 (accessorie di dicembre 2025): nessuna rata di addizionali');
const febb = { fisse: { stipendioTabellare: 1979.44, iis: 0, indennitaPensionabile: 758.49, assegnoFunzione: 145.03 },
  accessorie: { indFestivitaParticolare: 80, indServizioEsterno: 144, indTurnoNotturno: 77.40, indFestiva: 56, indControlloTerritorio: 45, strDiurno: 97.23, strNotturno: 15.71 },
  personalizzate: pers(VAC, RISCHIO(21.60)) };
r = calc(febb, 1, 'AppState.tabelle.detrazioniMensiliCedolino = 174;');
ok('contributi 385,06', vicino(r.contributi, 385.06, 0.10), r.contributi);
ok('IRPEF dopo detrazioni 600,76', vicino(r.irpefTotale - r.detrazioni, 600.76, 0.15), r.irpefTotale - r.detrazioni);
ok('addizionali 0 (le rate vanno da marzo a novembre)', r.addizionali === 0, r.addizionali);
ok('netto 2.443,50 (prima del debito di conguaglio 217,60)', vicino(nettoMese(r), 2443.50, 0.30), nettoMese(r));

console.log('\nDicembre 2025 con tredicesima (IRPEF 35%)');
const dic = { fisse: { stipendioTabellare: 1979.44, iis: 0, indennitaPensionabile: 758.49, assegnoFunzione: 146.53, tredicesima: 2904.25 },
  accessorie: { indTurnoNotturno: 86, indFestiva: 42, indControlloTerritorio: 40, indServizioEsterno: 144 }, personalizzate: pers(VAC, RISCHIO(21.60)) };
r = calc(dic, 11, 'AppState.tabelle.irpefScaglioni[1].aliquota = 35; AppState.tabelle.sindacatoMensile = 9.045; AppState.tabelle.detrazioniMensiliCedolino = 178;');
ok('lordo 6.142,10', vicino(r.lordo, 6142.10, 0.05), r.lordo);
ok('contributi 702,72 (Opera e maggiorazione raddoppiate sulla tredicesima)', vicino(r.contributi, 702.72, 0.10), r.contributi);
ok('imponibile fiscale 5.439,38', vicino(r.imponibile, 5439.38, 0.10), r.imponibile);
ok('IRPEF lorda 1.623,73 (618,80 sulla parte fissa + 1.004,93 al 35%)', vicino(r.irpefTotale, 1623.73, 0.30), r.irpefTotale);
ok('altre ritenute 18,69 (quota sindacale doppia + Fondo assistenza)', vicino(r.sindacato, 18.69, 0.02), r.sindacato);
ok('nessuna rata di addizionali a dicembre', r.addizionali === 0);
ok('netto 3.974,96', vicino(nettoMese(r), 3974.96, 0.40), nettoMese(r));

console.log('\nLuglio 2026 con produttività collettiva (tassata all\'aliquota media)');
const lug = { fisse: { stipendioTabellare: 1979.44, iis: 0, indennitaPensionabile: 758.49, assegnoFunzione: 147.53 },
  accessorie: { indFestivitaParticolare: 40, indServizioEsterno: 114, indCompensazioneRiposo: 12, indTurnoNotturno: 103.20, indFestiva: 42, indControlloTerritorio: 45, strNotturno: 31.42, indProduttivitaCollettiva: 1737.06, indCambioTurno: 20 },
  personalizzate: pers(VAC, RISCHIO(17.10)) };
r = calc(lug, 6, 'AppState.tabelle.detrazioniMensiliCedolino = 174;');
ok('lordo 5.067,03', vicino(r.lordo, 5067.03, 0.05), r.lordo);
ok('contributi 534,01', vicino(r.contributi, 534.01, 0.10), r.contributi);
ok('IRPEF lorda 1.139,32 (±8: l\'aliquota media è una stima)', vicino(r.irpefTotale, 1139.32, 8), r.irpefTotale);
ok('netto 3.557,33 prima di conguagli e addizionali (±8)', vicino(nettoMese(r) + r.addizionali, 3557.33, 8), nettoMese(r) + r.addizionali);

console.log('\nNetto in busta delle accessorie (cedolino "Pagamenti vari" dicembre 2025)');
const n35 = run(`AppState.tabelle.aliquotaPrevidenziale = 9.15; nettoVoceInBusta(269.03, 35)`);
ok('269,03 € lordi → 158,87 € netti', vicino(n35, 158.87, 0.02), n35);
const n33 = run(`nettoVoceInBusta(13.89, 33)`);
ok('un\'ora di straordinario diurno al 33% → circa 8,45 €', vicino(n33, 8.45, 0.02), n33);
const arr = run(`nettoVoceInBusta(6.66, 33) + 0.0`);
ok('arretrati 6,66 € → circa 4,46 € (nel cedolino senza contributi: qui con contributi, quindi meno)', arr < 4.46);

console.log('\nAssegno funzionale e tredicesima');
const af = run(`AppState.anagrafica.qualifica = 'Assistente Capo Coordinatore'; AppState.anagrafica.anni = 24; calcolaAssegnoFunzioneMensile()`);
ok('assegno funzionale a 24 anni = 147,53', vicino(af, 147.53, 0.01), af);

console.log(falliti ? `\n${falliti} controlli falliti` : '\nTutto ok');
process.exit(falliti ? 1 : 0);
