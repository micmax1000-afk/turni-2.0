// Genera la pagina "Tabelle economiche" e il file per l'app (turni/tabelle.json) del sito
// micmax-apps-site a partire dalle tabelle dell'app (www/js/data/tabelle-2026.js).
// Uso: node scripts/genera-tabelle-sito.js ../micmax-apps-site
// Quando cambiano i valori: aggiorna tabelle-2026.js, alza VERSIONE_TABELLE, rilancia lo script.
const fs = require('fs'), path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'www', 'js', 'data', 'tabelle-2026.js'));
const D = window.TurniPSData, T = D.TABELLE_PREDEFINITE;
const sito = process.argv[2];
if(!sito){ console.error('Indica la cartella del sito, es. ../micmax-apps-site'); process.exit(1); }
const dataLeggibile = new Date(D.AGGIORNAMENTO_TABELLE + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const e = v => Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const q = Object.keys(T.stipendiAnnuiAttuale);
const gruppi = [['Ruolo agenti e assistenti', q.slice(0,5)], ['Ruolo sovrintendenti', q.slice(5,9)], ['Ruolo ispettori', q.slice(9,15)], ['Ruolo commissari', q.slice(15)]];
const righeStip = gruppi.map(([g, l]) => `<tr class="gr"><td colspan="3">${g}</td></tr>` + l.map(k => `<tr><td>${k}</td><td>${e((T.stipendiAnnuiAttuale[k] + T.indennitaPensionabileAnnuaAttuale[k]) / 12)}</td><td class="p">${e((T.stipendiAnnui2027[k] + T.indennitaPensionabileAnnua2027[k]) / 12)}</td></tr>`).join('')).join('');
const righeStr = q.map(k => { const a = T.straordinarioOrarioAttuale[k], b = T.straordinarioOrario2027[k]; return `<tr><td>${k}</td><td>${e(a.diurno)}</td><td>${e(a.notturnoOFestivo)}</td><td>${e(a.notturnoFestivo)}</td></tr>`; }).join('');
const righeStr27 = q.map(k => { const b = T.straordinarioOrario2027[k]; return `<tr><td>${k}</td><td>${e(b.diurno)}</td><td>${e(b.notturnoOFestivo)}</td><td>${e(b.notturnoFestivo)}</td></tr>`; }).join('');
const ind = [
 ['Servizio esterno', `${e(T.indennitaServizioEsternoTurno)} a turno`, 'SIULP'],
 ['Ordine pubblico in sede', `${e(T.indennitaOPInSede)} a turno`, 'SIULP'],
 ['Ordine pubblico fuori sede', `${e(T.indennitaOPFuoriSede)} a turno`, 'SIULP'],
 ['Controllo territorio', `${e(T.indennitaControlloTerritorioSeraleFlat)} serale · ${e(T.indennitaControlloTerritorioNotturnoFlat)} notturno`, 'Accordo'],
 ['Turno notturno', `${e(T.indennitaTurnoNotturnoOraria)} l'ora`, 'D.P.R.'],
 ['Presenza festiva', `${e(T.indennitaPresenzaFestivaTurno)} a turno`, 'D.P.R.'],
 ['Festività particolari', `${e(T.indennitaFestivitaParticolareGiorno)} al giorno`, 'SIULP'],
 ['Reperibilità', `${e(T.reperibilitaGiornaliera)} al giorno`, 'SIULP'],
 ['Cambio turno', `${e(T.indennitaCambioTurno)} a cambio`, 'FESI 2025'],
 ['Lavorato sul riposo', `${e(T.indennitaCompensazioneRiposoLavorato)} al giorno`, 'D.P.R. 164/2002'],
 ['Missione (trasferta)', `${e(T.indennitaTrasfertaOraria)} l'ora`, 'SIULP'],
 ['Buono pasto', `${e(T.buonoPastoValore)} (fuori busta)`, ''],
];
const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tabelle — Turni & Accessorio PS</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:760px;margin:0 auto;padding:20px 16px 60px;line-height:1.5;color:#1E2129;background:#ECEFEA}
h1{font-size:1.45rem;color:#1B2440;margin:0 0 4px}h2{font-size:1.1rem;color:#1B2440;margin:28px 0 8px}
.agg{color:#666B63;font-size:.85rem;margin:0 0 14px}
.stato{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.stato span{font-size:.78rem;font-weight:700;padding:4px 10px;border-radius:999px}
.vig{background:#D7F0E1;color:#1E6B3F}.pro{background:#FFF0CC;color:#7A5300}
.box{background:#fff;border:1px solid #D7D9CD;border-radius:12px;padding:14px 16px;margin:10px 0}
.avv{background:#FFF7E0;border-color:#F2D58A;font-size:.9rem}
nav{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}nav a{flex:0 0 auto;background:#fff;border:1px solid #D7D9CD;border-radius:999px;padding:6px 12px;font-size:.85rem;color:#1B2440;text-decoration:none;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:.88rem;background:#fff;border-radius:12px;overflow:hidden}
th{background:#1B2440;color:#fff;text-align:right;padding:8px 10px;font-size:.78rem}th:first-child{text-align:left}
td{padding:7px 10px;border-top:1px solid #ECEFEA;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}td:first-child{text-align:left;white-space:normal}
tr.gr td{background:#F4F5F2;font-weight:700;font-size:.78rem;color:#666B63;text-transform:uppercase;letter-spacing:.04em}
td.p{color:#7A5300}
.nota{font-size:.82rem;color:#666B63;margin:6px 2px}
.ind{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:8px 0;border-top:1px solid #ECEFEA}.ind:first-child{border-top:0}
.ind b{font-variant-numeric:tabular-nums;text-align:right}.ind small{grid-column:1/-1;color:#666B63;font-size:.76rem}
.fonti li{margin:4px 0;font-size:.88rem}
.scroll{overflow-x:auto}
details summary{cursor:pointer;color:#1B2440}
a{color:#2E4A8F}
</style></head><body>
<h1>Tabelle economiche</h1>
<p class="agg">Turni & Accessorio PS · aggiornate al ${dataLeggibile} · versione ${D.VERSIONE_TABELLE}</p>
<div class="stato"><span class="vig">● 2026 in vigore — D.P.R. 53/2025</span><span class="pro">● 2027 proiettato — ipotesi di accordo 15/07/2026</span></div>
<div class="box avv"><strong>Valori indicativi.</strong> Raccolti da fonti pubbliche (decreti, sindacati). Possono contenere errori o non essere aggiornati: verifica sempre il tuo cedolino ufficiale. L'app usa queste stesse tabelle.</div>
<nav><a href="#stipendi">Stipendi</a><a href="#straordinario">Straordinario</a><a href="#indennita">Indennità</a><a href="#fisco">Tasse</a><a href="#fonti">Fonti</a></nav>
<h2 id="stipendi">Stipendio mensile lordo</h2>
<p class="nota">Stipendio tabellare + indennità pensionabile, al mese (12 mensilità).</p>
<div class="scroll"><table><tr><th>Qualifica</th><th>2026</th><th>dal 2027*</th></tr>${righeStip}</table></div>
<p class="nota">* Proiezione dall'ipotesi di accordo 2025–2027: in vigore solo dopo il decreto di recepimento.</p>
<h2 id="straordinario">Straordinario (€/ora, 2026)</h2>
<div class="scroll"><table><tr><th>Qualifica</th><th>Diurno</th><th>Nott./fest.</th><th>Nott. fest.</th></tr>${righeStr}</table></div>
<details class="box"><summary><strong>Straordinario dal 2027 (proiettato)</strong></summary><div class="scroll" style="margin-top:10px"><table><tr><th>Qualifica</th><th>Diurno</th><th>Nott./fest.</th><th>Nott. fest.</th></tr>${righeStr27}</table></div><p class="nota">Ipotesi di accordo 2025–2027: in vigore solo dopo il decreto di recepimento.</p></details>
<h2 id="indennita">Indennità accessorie</h2>
<div class="box">${ind.map(([n, v, f]) => `<div class="ind"><span>${n}</span><b>${v}</b>${f ? `<small>Fonte: ${f}</small>` : ''}</div>`).join('')}</div>
<h2 id="fisco">Tasse e contributi (2026)</h2>
<div class="box">
<div class="ind"><span>Contributi previdenziali</span><b>${T.aliquotaPrevidenziale} %</b></div>
<div class="ind"><span>IRPEF</span><b>${T.irpefScaglioni.map(s => s.aliquota + '%').join(' · ')}</b><small>Scaglioni: fino a 28.000 € · fino a 50.000 € · oltre</small></div>
<div class="ind"><span>Detassazione accessorie</span><b>${T.aliquotaDetassazioneAccessori} %</b><small>Fino a ${e(T.sogliaDetassazioneAccessoriAnnua)} l'anno di indennità</small></div>
<div class="ind"><span>Detrazione lavoro dipendente</span><b>${e(T.detrazioneLavoroMensile)} /mese</b></div>
<div class="ind"><span>Addizionale regionale</span><b>per regione</b><small>Tabella completa nell'app, in Altro → Tabelle ufficiali</small></div>
</div>
<h2 id="fonti">Fonti</h2>
<ul class="fonti"><li>D.P.R. 24 marzo 2025, n. 53 — recepimento accordo 2022–2024 (stipendi, indennità pensionabile, straordinario)</li><li>Ipotesi di accordo comparto Sicurezza-Difesa 2025–2027, firmata il 15 luglio 2026 (valori 2027 proiettati)</li><li>SIULP — schede sul trattamento economico accessorio</li><li>Accordo FESI 2025 (cambio turno, produttività collettiva)</li><li>Legge di Bilancio 2026 (IRPEF)</li></ul>
<p class="nota">App indipendente, non ufficiale, non affiliata alla Polizia di Stato. L'app scarica questi stessi valori dal file <a href="turni/tabelle.json">turni/tabelle.json</a> (senza inviare nessun dato).</p>
<p class="nota"><a href="index.html">← Home</a> · <a href="privacy-turni.html">Privacy</a></p>
</body></html>`;
fs.writeFileSync(path.join(sito, 'tabelle-turni.html'), html);
fs.mkdirSync(path.join(sito, 'turni'), { recursive: true });
const json = { formato: 1, versione: D.VERSIONE_TABELLE, aggiornato: D.AGGIORNAMENTO_TABELLE,
  nota: process.argv[3] || '', fonte: 'https://micmax-apps.netlify.app/tabelle-turni.html', tabelle: T };
fs.writeFileSync(path.join(sito, 'turni', 'tabelle.json'), JSON.stringify(json, null, 1) + '\n');
console.log('Scritti tabelle-turni.html e turni/tabelle.json, versione', D.VERSIONE_TABELLE);
