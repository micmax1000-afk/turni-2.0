// Controlli automatici di Turni & Accessorio PS.
// Avvio: `npm test` (serve il browser di Playwright: `npx playwright install chromium`).
// Apre l'app vera in un browser senza finestra, con una data fissa (9 ottobre 2026) e dati di
// prova, e controlla calcoli, calendario, eventi, promemoria, turni e Report.
// Esce con codice 1 se anche un solo controllo fallisce.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const TIPI = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const server = http.createServer((req, res) => {
  const file = path.join(RADICE, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if(!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_APP = `http://127.0.0.1:${server.address().port}/index.html`;

let falliti = 0, superati = 0;
const ok = (nome, condizione, dettaglio = '') => {
  if(condizione){ superati++; console.log(`  ✔ ${nome}`); }
  else { falliti++; console.log(`  ✘ ${nome}${dettaglio ? ' — ' + dettaglio : ''}`); }
};
const sezione = t => console.log(`\n${t}`);

// Dati di prova: ciclo Sera/Pomeriggio/Mattina/Notte/Riposo a settembre e ottobre 2026.
const CICLO = [['19:00','01:00','sera'],['13:00','19:00','pomeriggio'],['07:00','13:00','mattina'],['01:00','07:00','notte'],null];
function turniDiProva(){
  const t = {};
  for(const m of ['09','10']) for(let d = 1; d <= 30; d++){
    const iso = `2026-${m}-${String(d).padStart(2,'0')}`, c = CICLO[(d - 1) % 5];
    t[iso] = c ? { data: iso, oraInizio: c[0], oraFine: c[1], modelloId: c[2] } : { data: iso, riposo: true };
  }
  return t;
}

const browser = await chromium.launch();
async function apri({ turni = {}, eventi = {}, stile = 'classico', colori = true, scuro = false, nativo = false } = {}){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Rome', colorScheme: scuro ? 'dark' : 'light' });
  const p = await ctx.newPage();
  const errori = [];
  p.on('pageerror', e => errori.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-09T10:00:00+02:00'));
  await p.addInitScript(([t, e, s, c, n]) => {
    if(sessionStorage.getItem('preparato')) return;
    localStorage.clear();
    localStorage.setItem('simCedolino_turni_v1', t);
    localStorage.setItem('simCedolino_eventiGiorno_v1', e);
    localStorage.setItem('simCedolino_stileCalendario_v1', s);
    localStorage.setItem('simCedolino_calendarioAColori_v1', c ? '1' : '0');
    localStorage.setItem('simCedolino_anagrafica_v1', JSON.stringify({ qualifica: 'Assistente Capo', regione: 'Lazio', coniugeACarico: 'no', sindacato: 'si' }));
    sessionStorage.setItem('preparato', '1');
    if(n){
      // Finti moduli Android, per vedere cosa verrebbe programmato.
      window.__log = [];
      const f = (nome, risposta) => a => { window.__log.push([nome, JSON.parse(JSON.stringify(a || {}))]); return Promise.resolve(risposta || {}); };
      window.Capacitor = { isNativePlatform: () => true, Plugins: {
        LocalNotifications: { cancel: f('ln.cancel'), schedule: f('ln.schedule'), checkPermissions: f('ln.check', { display: 'granted' }), requestPermissions: f('ln.req', { display: 'granted' }), createChannel: f('x'), deleteChannel: f('x'), checkExactNotificationSetting: f('x', { exact_alarm: 'granted' }) },
        AvvisoEvento: { programma: f('av.programma'), annulla: f('av.annulla'), statoNotifiche: f('stato', { attive: true }), apriImpostazioniNotifiche: f('impostazioni') } } };
    }
  }, [JSON.stringify(turni), JSON.stringify(eventi), stile, colori, nativo]);
  await p.goto(URL_APP);
  await p.waitForFunction(() => typeof renderCalendario === 'function' && document.querySelector('.giorno-cella'));
  await p.click('#tabCalendario');
  return { p, ctx, errori };
}

// ─────────────────────────────────────────────────────────────
sezione('Calcoli (ore, straordinari, festivi, indennità)');
{
  const { p, ctx, errori } = await apri();
  const r = await p.evaluate(() => {
    const T = (data, o) => classificaTurno(Object.assign({ data }, o));
    const out = {
      notteFeriale: T('2026-10-07', { oraInizio:'22:00', oraFine:'06:00' }),
      str2023: T('2026-10-06', { oraInizio:'14:00', oraFine:'20:00', straordinarioDopoInizio:'20:00', straordinarioDopoFine:'23:00' }),
      domenica: T('2026-10-11', { oraInizio:'08:00', oraFine:'14:00' }),
      permesso: T('2026-10-14', { oraInizio:'08:00', oraFine:'14:00', permessoBreveAttivo:true, permessoBreveOraInizio:'10:00', permessoBreveOraFine:'12:00' }),
      compensato: T('2026-10-15', { oraInizio:'08:00', oraFine:'14:00', straordinarioDopoInizio:'14:00', straordinarioDopoFine:'17:00', compensaStraordinario:true }),
      ognissanti: T('2026-10-31', { oraInizio:'22:00', oraFine:'06:00', straordinarioDopoInizio:'06:00', straordinarioDopoFine:'08:00' }),
      primaDomenica: T('2026-11-09', { oraInizio:'00:00', oraFine:'06:00', straordinarioPrimaInizio:'22:00', straordinarioPrimaFine:'00:00' }),
      natale: T('2026-12-25', { oraInizio:'08:00', oraFine:'14:00' }),
      vigilia: T('2026-12-24', { oraInizio:'14:00', oraFine:'20:00', straordinarioDopoInizio:'20:00', straordinarioDopoFine:'02:00' }),
      pasqua: [eFestivoFisso('2027-03-28'), eFestivoFisso('2027-03-29'), eFestivoFisso('2027-03-30')],
      tab: AppState.tabelle
    };
    // Mese con missioni, OP, reperibilità (anche in un giorno di assenza: non va pagata)
    const v = n => AppState.assenze.find(a => a.nome === n);
    AppState.turni = {
      '2026-10-05': { data:'2026-10-05', oraInizio:'08:00', oraFine:'14:00', straordinarioDopoInizio:'14:00', straordinarioDopoFine:'16:00' },
      '2026-10-07': { data:'2026-10-07', oraInizio:'22:00', oraFine:'06:00', reperibilita:true },
      '2026-10-11': { data:'2026-10-11', oraInizio:'08:00', oraFine:'14:00', ordinePubblico:true, opSede:'in' },
      '2026-10-12': { data:'2026-10-12', oraInizio:'07:00', oraFine:'13:00', missione:true, durataMissioneOre:6 },
      '2026-10-13': { data:'2026-10-13', oraInizio:'07:00', oraFine:'17:00', missione:true, durataMissioneOre:10 },
      '2026-10-19': { data:'2026-10-19', assenzaTipo: v('Congedo ordinario').id, oraInizio:'08:00', oraFine:'14:00', reperibilita:true }
    };
    out.ottobre = calcolaCompetenze(2026, 9);
    out.dicembre = calcolaCompetenze(2026, 11);
    out.cedolino = generaCedolino(2026, 9);
    return out;
  });
  const t = r.tab, a = r.ottobre.accessorie, tar = t.straordinarioOrarioAttuale['Assistente Capo'], r2 = x => Math.round(x * 100) / 100;
  ok('notte 22-06 feriale: 8h notturne', r.notteFeriale.notturne === 8);
  ok('straordinario 20-23: 2h diurno + 1h notturno (notte dalle 22)', r.str2023.strDiurno === 2 && r.str2023.strNotturno === 1);
  ok('domenica 8-14: 6h domenicali', r.domenica.domenicali === 6);
  ok('permesso breve 10-12 in turno 8-14: 4h ordinarie', r.permesso.ordinarie === 4 && r.permesso.orePermessoBreve === 2);
  ok('straordinario a recupero: nulla in paga, 3h compensate', r.compensato.strDiurno === 0 && r.compensato.oreCompensate === 3);
  ok('notte sab 31/10 → dom 1/11 (Ognissanti): 2h notturne + 6h notturne festive', r.ognissanti.notturne === 2 && r.ognissanti.notturneFestive === 6);
  ok('straordinario 06-08 dopo quella notte: festivo (domenica), non diurno', r.ognissanti.strFestivo === 2 && r.ognissanti.strDiurno === 0);
  ok('straordinario "prima" 22-24 di domenica, prima di un turno lunedì 00-06: notturno festivo', r.primaDomenica.strNotturnoFestivo === 2);
  ok('Natale 8-14: 6h festive', r.natale.festive === 6);
  ok('Vigilia, straordinario 20-02: 2h diurno, 2h notturno, 2h notturno festivo', r.vigilia.strDiurno === 2 && r.vigilia.strNotturno === 2 && r.vigilia.strNotturnoFestivo === 2);
  ok('Pasqua e Pasquetta 2027 festive, il giorno dopo no', r.pasqua.join() === 'true,true,false');
  ok('importo straordinario diurno = ore × tariffa', a.strDiurno === r2(r.ottobre.tot.strDiurno * tar.diurno));
  ok('indennità notturna = ore notturne × tariffa', a.indTurnoNotturno === r2(r.ottobre.tot.notturne * t.indennitaTurnoNotturnoOraria));
  ok('missioni: 6h a tariffa piena + 10h a tariffa ridotta', a.indMissioni === r2(6 * t.indennitaTrasfertaOraria + 10 * t.indennitaTrasfertaOrariaRidotta));
  ok('ordine pubblico in sede (≥ 4h)', a.indOP === t.indennitaOPInSede);
  ok('reperibilità pagata una volta sola (non nel giorno di assenza)', a.indReperibilita === r2(t.reperibilitaGiornaliera));
  ok('tredicesima solo a dicembre', r.dicembre.fisse.tredicesima > 0 && !('tredicesima' in r.ottobre.fisse));
  ok('cedolino: netto positivo e minore del lordo', r.cedolino.netto > 0 && r.cedolino.netto < r.cedolino.comp.totaleLordo);
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Calendario, barra in basso e messaggi');
for(const stile of ['classico', 'moderno']){
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), stile });
  const c = await p.evaluate(() => {
    const n = document.querySelector('.barra-schede').getBoundingClientRect();
    return {
      celle: document.querySelectorAll('#calendarioGriglia .giorno-cella[data-data]').length,
      moderno: document.body.classList.contains('calendario-moderno'),
      etichetta1: document.querySelector('.giorno-cella[data-data="2026-10-01"] .mod-turno b')?.innerText,
      barraInBasso: n.bottom <= innerHeight && n.bottom > innerHeight - 40,
      nomi: [...document.querySelectorAll('.barra-schede small')].map(s => s.textContent).join(','),
      oggiIcona: document.getElementById('iconaCalendarioGiorno').textContent,
      matita: !!document.getElementById('btnFabAggiungiV2')
    };
  });
  ok(`${stile}: 31 giorni nel calendario`, c.celle === 31);
  ok(`${stile}: stile applicato`, c.moderno === (stile === 'moderno'));
  if(stile === 'moderno') ok('moderno: etichetta del 1/10 "Sera"', c.etichetta1 === 'Sera');
  ok(`${stile}: barra in basso con Calendario/Report/Turni/Altro e il giorno di oggi (9)`, c.barraInBasso && c.nomi === 'Calendario,Report,Turni,Altro' && c.oggiIcona === '9');
  ok(`${stile}: matita tolta`, !c.matita);
  if(stile === 'moderno'){
    await p.evaluate(() => mostraToast('Prova', 'successo', 5000));
    const t = await p.evaluate(() => { const r = document.querySelector('#toastContainer .toast-v20').getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; });
    ok('i messaggi a comparsa sono visibili sullo schermo', t);
    await p.click('.giorno-cella[data-data="2026-10-20"]');
    ok('toccando un giorno si apre il menu rapido', await p.evaluate(() => !document.getElementById('popupRapidoGiorno').hidden));
  }
  ok(`${stile}: nessun errore JavaScript`, !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Eventi (ripetizioni, elimina un giorno o tutta la serie)');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), stile: 'moderno' });
  await p.evaluate(() => { giornoSelezionato = '2026-10-20'; renderCalendario(); });
  await p.click('#btnNuovoEventoGiornoV2');
  ok('modulo evento aperto, riquadro "notifiche disattivate" nascosto', await p.evaluate(() => !document.getElementById('overlayEvento').hidden && !document.getElementById('avvisoPermessiEvento').offsetParent));
  await p.fill('#campoEventoTitolo', 'Palestra');
  await p.selectOption('#campoEventoRipeti', 'settimana');
  await p.click('#btnAggiungiPromemoria');
  await p.click('#btnSalvaEvento');
  const ev = await p.evaluate(() => AppState.eventiGiorno['2026-10-20'][0]);
  ok('evento salvato: ogni settimana, 2 promemoria diversi (10 e 30 minuti)', ev.ripeti === 'settimana' && ev.promemoria.map(x => x.min).join() === '10,30');
  ok('compare anche il 27/10 e il 3/11', await p.evaluate(() => eventiDelGiorno('2026-10-27').length === 1 && eventiDelGiorno('2026-11-03').length === 1));
  await p.evaluate(() => { giornoSelezionato = '2026-10-27'; renderListaEventiGiornoV2(); });
  await p.locator('#listaEventiGiornoV2 [data-evento-id]').first().click();
  await p.click('#btnEliminaEventoGiorno');
  ok('"Solo questo giorno" toglie il 27 e lascia il 3/11', await p.evaluate(() => eventiDelGiorno('2026-10-27').length === 0 && eventiDelGiorno('2026-11-03').length === 1));
  await p.evaluate(() => { giornoSelezionato = '2026-10-20'; renderListaEventiGiornoV2(); });
  await p.locator('#listaEventiGiornoV2 [data-evento-id]').first().click();
  await p.click('#btnEliminaEvento');
  ok('"Tutta la serie" elimina tutto', await p.evaluate(() => !AppState.eventiGiorno['2026-10-20'] && eventiDelGiorno('2026-11-03').length === 0));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Promemoria (moduli Android simulati)');
{
  const ev = (id, titolo, ora, extra) => Object.assign({ id, titolo, tuttoIlGiorno:false, oraInizio:ora, oraFine:'', promemoria:[{min:10},{min:60}] }, extra || {});
  const eventi = { '2026-10-10': [ev('evento_1700000000123', 'Visita', '10:00')], '2026-01-01': [ev('evento_1700000000456', 'Corso', '19:00', { ripeti:'settimana', promemoria:[{min:30}] })], '2025-01-01': [ev('evento_1700000000789', 'Vecchio', '09:00')] };
  const { p, ctx, errori } = await apri({ eventi, nativo: true });
  await p.waitForFunction(() => window.__log.filter(x => x[0] === 'av.programma').length >= 4, null, { timeout: 15000 }).catch(() => {});
  const log = await p.evaluate(() => window.__log.filter(x => x[0] === 'av.programma').map(x => x[1]));
  const visita = log.filter(x => x.titolo === 'Visita'), corso = log.filter(x => x.titolo === 'Corso');
  ok('all\'apertura: 2 promemoria per "Visita", notifica normale (durata 0)', visita.length === 2 && visita.every(x => x.durataSec === 0));
  ok('evento settimanale: programmate le prossime 2 volte (15 e 22 ottobre)', corso.length === 2 && corso.map(x => new Date(x.quandoMs).getDate()).join() === '15,22');
  ok('evento passato non programmato', !log.some(x => x.titolo === 'Vecchio'));
  ok('all\'apertura non si annulla nulla (le notifiche già comparse restano)', await p.evaluate(() => !window.__log.some(x => x[0] === 'av.annulla')));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Turni: cambio orario di un modello');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), stile: 'moderno' });
  await p.click('#tabTurni');
  ok('i modelli hanno colori diversi', await p.evaluate(() => new Set([...document.querySelectorAll('.chip-modello-tab b')].map(b => b.style.background)).size >= 4));
  await p.locator('#listaModelliTabTurni [data-modello-tab="sera"]').click();
  ok('la finestra "Modifica turno" si apre dalla scheda Turni', await p.locator('#overlayModificaModello').isVisible());
  await p.fill('#campoModModelloInizio', '18:40');
  await p.fill('#campoModModelloFine', '00:15');
  await p.click('#btnSalvaModello');
  ok('compare la domanda "Aggiornare il calendario?"', await p.locator('#overlayAggiornaTurni').isVisible());
  await p.click('#btnAggTurniFuturi');
  const r = await p.evaluate(() => ({ futuro: AppState.turni['2026-10-11'].oraInizio, passato: AppState.turni['2026-10-06'].oraInizio }));
  ok('"da oggi in poi": l\'11/10 diventa 18:40, il 6/10 resta 19:00', r.futuro === '18:40' && r.passato === '19:00');
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Report');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva() });
  await p.click('#tabReport');
  const r = await p.evaluate(() => ({ hero: document.getElementById('reportHero').innerText, atteso: euro(generaAccreditoConto(2026, 9).netto), mese: document.getElementById('reportMeseEtichetta').innerText, tiles: [...document.querySelectorAll('#meseTilesReport b')].map(b => b.innerText), cards: [...document.querySelectorAll('#contenitoreStatistiche .stat-card small')].map(s => s.innerText) }));
  ok('riquadro blu: accredito del mese visualizzato (ottobre)', r.mese === 'Ottobre 2026' && /a ottobre/.test(r.hero) && r.hero.includes(r.atteso));
  ok('importi con il punto delle migliaia', /^\d\.\d{3},\d{2} €$/.test(r.atteso));
  ok('"Il mese": turni e riposi', r.tiles[0] === '24' && r.tiles[1] === '6');
  ok('statistiche: niente riquadri a zero', !r.cards.includes('Missioni') && r.cards.includes('Ore lavorate'));
  ok('prossimo turno e riepilogo mese tolti', await p.evaluate(() => !document.getElementById('prossimoTurnoWidget').offsetParent && !document.getElementById('riepilogoTurniV45').offsetParent));
  await p.click('#btnGeneraCedolino');
  ok('Genera cedolino funziona', await p.evaluate(() => !document.getElementById('contenitoreCedolino').hidden));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Tutte le schede, tema chiaro e scuro');
for(const scuro of [false, true]){
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), stile: 'moderno', scuro });
  for(const t of ['tabReport', 'tabTurni', 'tabAltro', 'tabCalendario']){ await p.click('#' + t); }
  await p.click('#tabAltro'); await p.click('#settingsAnagrafica');
  await p.click('#tabAltro'); await p.click('#settingsTabelle');
  const sfondo = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(`tema ${scuro ? 'scuro' : 'chiaro'}: sfondo ${sfondo}`, scuro ? sfondo === 'rgb(18, 21, 28)' : sfondo !== 'rgb(18, 21, 28)');
  ok(`tema ${scuro ? 'scuro' : 'chiaro'}: tutte le schede si aprono senza errori`, !errori.length, errori.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${superati} controlli superati, ${falliti} falliti`);
process.exit(falliti ? 1 : 0);
