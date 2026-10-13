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
  await ctx.route('https://micmax-apps.netlify.app/**', r => r.fulfill({ status: 404, body: '' }));
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
        AvvisoEvento: { coloriBarre: f('barre'), programma: f('av.programma'), annulla: f('av.annulla'), statoNotifiche: f('stato', { attive: true }), apriImpostazioniNotifiche: f('impostazioni'),
          stampa: a => { window.__log.push(['stampa', a, document.documentElement.getAttribute('data-tema'), !document.getElementById('contenitoreCedolino').hidden]); return new Promise(r => setTimeout(r, 300)); } } } };
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
  const fm = await p.evaluate(() => { const f = [...document.querySelectorAll('#calendarioGriglia .giorno-cella.fuori-mese')]; return { n: f.length, primo: f[0]?.innerText.trim().split(/\s+/)[0], ultimo: f[f.length - 1]?.innerText.trim().split(/\s+/)[0], conTurno: f.filter(x => /Sera|Pom|Matt|Notte|Riposo|S|P|M|N|R/.test(x.innerText)).length, toccabili: f.filter(x => getComputedStyle(x).pointerEvents !== 'none').length }; });
  ok(`${stile}: giorni del mese prima e dopo sbiaditi (28–30 settembre, 1 novembre), non toccabili`, fm.n === 4 && fm.primo === '28' && fm.ultimo === '1' && fm.toccabili === 0, JSON.stringify(fm));
  ok(`${stile}: stile applicato`, c.moderno === (stile === 'moderno'));
  if(stile === 'moderno'){
    ok('moderno: etichetta del 1/10 "Sera"', c.etichetta1 === 'Sera');
    const m = await p.evaluate(() => {
      AppState.turni['2026-10-02'] = Object.assign({}, AppState.turni['2026-10-02'], { missione: true, durataMissioneOre: 6, reperibilita: true, servizioEsterno: true, buonoPasto: true });
      renderCalendario();
      const q = d => document.querySelector(`.giorno-cella[data-data="${d}"]`);
      return {
        orari: [...document.querySelectorAll('.mod-turno')].some(e => /\d{1,2}:\d{2}/.test(e.textContent)),
        indennita: [...q('2026-10-02').querySelectorAll('.mod-indennita [aria-label]')].map(b => b.getAttribute('aria-label')).join(','),
        senzaIndennita: !q('2026-10-03').querySelector('.mod-indennita'),
        badgeInAlto: !!document.querySelector('.giorno-cella .mod-badge')
      };
    });
    ok('moderno: nessun orario nelle etichette', !m.orari);
    ok('moderno: icone di missione e reperibilità; servizio esterno e buono pasto nascosti all\'inizio', m.indennita === 'Missione,Reperibilità', m.indennita);
    ok('moderno: giorno senza indennità senza riga in più, niente simboli in alto', m.senzaIndennita && !m.badgeInAlto);
  }
  ok(`${stile}: barra in basso con Calendario/Report/Assenze/Turni/Altro e il giorno di oggi (9)`, c.barraInBasso && c.nomi === 'Calendario,Report,Assenze,Turni,Altro' && c.oggiIcona === '9', c.nomi);
  ok(`${stile}: matita tolta`, !c.matita);
  if(stile === 'moderno'){
    await p.evaluate(() => mostraToast('Prova', 'successo', 5000));
    const t = await p.evaluate(() => { const r = document.querySelector('#toastContainer .toast-v20').getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; });
    ok('i messaggi a comparsa sono visibili sullo schermo', t);
    await p.click('.giorno-cella[data-data="2026-10-20"]');
    ok('toccando un giorno: si seleziona e lo mostra il riquadro, nessun popup', await p.evaluate(() => giornoSelezionato === '2026-10-20' && !document.getElementById('popupRapidoGiorno') && document.getElementById('overlaySelettoreModelli').hidden && /20 ottobre/i.test(document.querySelector('.giorno-v3-data').textContent)));
    await p.click('.giorno-cella[data-data="2026-10-20"]');
    ok('secondo tocco sullo stesso giorno: si apre "Cosa vuoi aggiungere?"', await p.evaluate(() => !document.getElementById('overlaySelettoreModelli').hidden && giornoPerPopupV2 === '2026-10-20'));
    await p.evaluate(() => { document.getElementById('overlaySelettoreModelli').hidden = true; });
    await p.click('#btnTurnoGiornoV3');
    ok('pulsante "🔄 Turno" nel riquadro: apre "Cosa vuoi aggiungere?"', await p.evaluate(() => !document.getElementById('overlaySelettoreModelli').hidden));
    await p.evaluate(() => { document.getElementById('overlaySelettoreModelli').hidden = true; });
    await p.evaluate(() => { AppState.turni['2026-10-03'] = Object.assign({}, AppState.turni['2026-10-03'], { data: '2026-10-03', oraInizio: '07:00', oraFine: '13:00', ordinePubblico: true }); selezionaGiorno('2026-10-03'); });
    await p.click('#indennitaGiornoSelezionatoV2 .indennita-giorno-badge');
    ok('toccando un simbolo del giorno si apre la legenda con 11 simboli', await p.evaluate(() => !document.getElementById('overlaySimboli').hidden && document.querySelectorAll('#listaSimboli .riga-simbolo svg').length === 11));
    await p.click('#listaSimboli [data-simbolo="servizioEsterno"]');
    ok('acceso "Servizio esterno": compare nella casella', await p.evaluate(() => [...document.querySelectorAll('.giorno-cella[data-data="2026-10-02"] .mod-indennita [aria-label]')].some(b => b.getAttribute('aria-label') === 'Servizio esterno')));
    await p.click('#btnChiudiSimboli');
    await p.click('#tabAltro'); await p.click('#settingsSimboli');
    ok('la stessa legenda si apre da Altro, con la scelta salvata', await p.evaluate(() => !document.getElementById('overlaySimboli').hidden && document.querySelector('#listaSimboli [data-simbolo="servizioEsterno"]').checked && !document.querySelector('#listaSimboli [data-simbolo="buonoPasto"]').checked));
    await p.click('#btnChiudiSimboli'); await p.click('#tabCalendario');
    await p.evaluate(() => { giornoPerPopupV2 = '2026-10-02'; apriSelettoreModelliV2('indennita'); });
    ok('menu "Cosa vuoi aggiungere?": icone al posto delle sigle, ✓ su quelle attive', await p.evaluate(() => document.querySelectorAll('#listaModelliIndennita .riga-indennita-menu > span svg').length === 10 && document.querySelector('[data-indennita="missione"]').classList.contains('attiva') && document.querySelector('[data-indennita="missione"] i').textContent === '✓'));
    await p.evaluate(() => apriSelettoreModelliV2('turni'));
    ok('menu Turni: barra colorata, orario e durata, ✓ sul turno del giorno, rari in "Altri turni", niente matite', await p.evaluate(() => { const r = [...document.querySelectorAll('#listaModelliTurni .riga-turno-menu')]; const att = document.querySelector('#listaModelliTurni .riga-turno-menu.attiva'); return r.length >= 5 && !!att && !!att.querySelector('em') && /\d h/.test(document.querySelector('#listaModelliTurni .riga-turno-menu small').textContent) && /^Altri turni \(\d\)$/.test(document.querySelector('#listaModelliTurni details summary').textContent) && !document.querySelector('#listaModelliTurni [data-modifica-modello]') && !!document.getElementById('btnGestisciTurniV2'); }));
    await p.click('#btnGestisciTurniV2');
    ok('"Gestisci i turni →" porta alla scheda Turni', await p.evaluate(() => document.getElementById('overlaySelettoreModelli').hidden && [...document.querySelectorAll('.tessera-modello')].some(x => x.offsetParent)));
    await p.click('#tabCalendario');
    await p.evaluate(() => { document.getElementById('overlaySelettoreModelli').hidden = true; giornoSelezionato = '2026-10-02'; renderCalendario(); });
    ok('riquadro del giorno: icona e nome per esteso', await p.evaluate(() => /Missione/.test(document.getElementById('indennitaGiornoSelezionatoV2').innerText) && !!document.querySelector('.indennita-giorno-badge svg')));
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
  await p.click('#sceltaColoreEvento [data-colore-evento="#2E9E5B"]');
  await p.selectOption('#campoEventoRipeti', 'settimana');
  await p.click('#btnAggiungiPromemoria');
  await p.click('#btnSalvaEvento');
  const ev = await p.evaluate(() => AppState.eventiGiorno['2026-10-20'][0]);
  ok('evento salvato: ogni settimana, 2 promemoria diversi (10 e 30 minuti)', ev.ripeti === 'settimana' && ev.promemoria.map(x => x.min).join() === '10,30');
  ok('colore dell\'evento salvato e usato nella casella', ev.colore === '#2E9E5B' && await p.evaluate(() => getComputedStyle(document.querySelector('.giorno-cella[data-data="2026-10-27"] .mod-evento')).backgroundColor === 'rgb(46, 158, 91)'));
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
  const tab = await p.evaluate(() => ({ tessere: [...document.querySelectorAll('.griglia-modelli-tab [data-modello-tab]:not(.tessera-nuovo)')].map(b => b.dataset.modelloTab).join(), altri: [...document.querySelectorAll('.altri-modelli [data-modello-tab]')].map(b => b.dataset.modelloTab).join(), sera: document.querySelector('[data-modello-tab="sera"]').innerText, assenzeQui: !!document.querySelector('#vistaAssenze #btnApriAssenzeV64') }));
  ok('Turni: in alto i 5 modelli usati, gli altri 3 in "Altri modelli"', tab.tessere === 'sera,pomeriggio,mattina,notte,riposo' && tab.altri.split(',').length === 3, tab.tessere + ' | ' + tab.altri);
  ok('tessera con orario, durata e volte nel mese', /19:00 – 01:00 · 6 h/.test(tab.sera) && /6 volte a ottobre/.test(tab.sera), tab.sera);
  ok('"Assenze e permessi" non è più in Turni', !tab.assenzeQui);
  ok('i modelli hanno colori diversi', await p.evaluate(() => new Set([...document.querySelectorAll('.tessera-modello > b')].map(b => b.style.background)).size >= 4));
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
sezione('Assenze nella barra e sequenza automatica');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), stile: 'moderno' });
  await p.click('#tabAssenze');
  ok('Assenze nella barra apre la pagina delle assenze', await p.evaluate(() => !!document.getElementById('sezioneAssenze').offsetParent && document.getElementById('tabAssenze').classList.contains('attiva') && !document.getElementById('btnApriAssenzeV64')));
  const ass = await p.evaluate(() => ({ titolo: document.querySelector('#sezioneAssenze h2').textContent, hero: document.getElementById('assenzeSummaryGrid').innerText.replace(/\s+/g, ' '), anelli: document.querySelectorAll('#corpoAssenze .saldo-anello').length, colonne: getComputedStyle(document.getElementById('corpoAssenze')).gridTemplateColumns.split(' ').length, congedo: document.querySelector('#corpoAssenze .card-assenza-compact')?.innerText.replace(/\s+/g, ' '), nonUsate: document.getElementById('titoloAssenzeNonUsate').textContent, festivoInNonUsate: [...document.querySelectorAll('#corpoAssenzeNonUsate .card-assenza-compact-nome')].some(n => n.textContent.includes('Riposo festivo')) }));
  ok('senza saldi di partenza: nessun numero inventato, "congedo ordinario da inserire"', ass.titolo === 'Assenze e permessi' && /Ti restano nel 2026 — giorni/.test(ass.hero) && /da inserire/.test(ass.hero) && /permesso breve/.test(ass.hero), ass.hero);
  ok('…riquadro "Da dove partiamo?" e scheda del congedo che chiede i giorni', await p.evaluate(() => /Da dove partiamo/.test(el('saldiPartenzaBox').textContent) && /Quanti giorni ti restano oggi/.test(document.querySelector('#corpoAssenze .card-da-inserire')?.textContent || '')));
  ok('ogni voce in una scheda con l\'anello, due per riga', ass.anelli > 3 && ass.colonne === 2, JSON.stringify(ass));
  ok('ogni voce: quanto rimane e quanto è stato usato (Congedo straordinario: rimangono 45, usati 0 su 45)', /Congedo straordinario/.test(ass.congedo) && /Rimangono 45 gg/i.test(ass.congedo) && /Usati 0 su 45/.test(ass.congedo), ass.congedo);
  // Saldi di partenza: un recupero guadagnato prima della data non conta, uno dopo sì.
  await p.evaluate(() => { AppState.turni['2026-10-01'].compensazioneRiposo = true; AppState.turni['2026-10-15'].compensazioneRiposo = true; salvaTurniStorage(); });
  await p.click('#saldiPartenzaBox [data-apri-saldi]');
  ok('"Inserisci i saldi di partenza" apre la finestra con i campi', await p.evaluate(() => !el('overlaySaldiPartenza').hidden && !!el('saldoCongedo') && !!el('saldoRiposoCompensativo')));
  await p.fill('#saldoCongedo', '41'); await p.fill('#saldoCongedoVecchi', '11'); await p.fill('#saldoRecuperoRiposo', '2'); await p.fill('#saldoRiposoCompensativo', '6');
  await p.click('[data-saldo-campo="saldoRecuperoFestivo"][data-saldo-delta="1"]');
  await p.click('#btnSalvaSaldiPartenza');
  const sp = await p.evaluate(() => { const v = n => saldoAssenza(AppState.assenze.find(a => a.nome === n), rifAssenze()); return { salvati: JSON.parse(localStorage.getItem('simCedolino_saldiPartenza_v1')), hero: el('assenzeSummaryGrid').innerText.replace(/\s+/g, ' '), riass: el('saldiPartenzaBox').innerText.replace(/\s+/g, ' '), co: v('Congedo ordinario').rimangono, rr: v('Recupero riposo').rimangono, rf: v('Recupero festivo').rimangono, rc: v('Riposo compensativo').rimangono }; });
  ok('saldi salvati con la data di oggi (+1 col pulsante per il recupero festivo)', sp.salvati.data === '2026-10-09' && sp.salvati.congedo === 41 && sp.salvati.congedoVecchi === 11 && sp.salvati.recuperoFestivo === 1, JSON.stringify(sp.salvati));
  ok('dopo: 41 giorni di congedo in alto e riassunto "Saldi di partenza" con Correggi', /41 giorni/.test(sp.hero) && /Saldi di partenza al 9 ottobre 2026/.test(sp.riass) && /Correggi/.test(sp.riass), sp.hero + ' | ' + sp.riass);
  ok('recupero riposo: 2 di partenza + quello del 15 (quello del 1° non conta più) = 3; festivo 1; riposo compensativo 6 h', sp.rr === 3 && sp.rf === 1 && sp.rc === 6, JSON.stringify(sp));
  await p.evaluate(() => { window.__originali = { a: AppState.turni['2026-10-05'], b: AppState.turni['2026-10-21'] }; const co = AppState.assenze.find(a => a.nome === 'Congedo ordinario').id; AppState.turni['2026-10-05'] = { data: '2026-10-05', assenzaTipo: co }; AppState.turni['2026-10-21'] = { data: '2026-10-21', assenzaTipo: co }; salvaTurniStorage(); renderAssenze(); });
  const co2 = await p.evaluate(() => { const v = saldoAssenza(AppState.assenze.find(a => a.nome === 'Congedo ordinario'), rifAssenze()); const c = [...document.querySelectorAll('#corpoAssenze .card-assenza')].find(x => /Congedo ordinario/.test(x.textContent)); return { r: v.rimangono, u: v.usate, card: c.querySelector('.card-assenza-compact').innerText.replace(/\s+/g, ' ') }; });
  ok('congedo: si scalano solo i giorni dopo i saldi (il 21 sì, il 5 no): 40, "Usati 1 su 41"', co2.r === 40 && co2.u === 1 && /Rimangono 40 gg/i.test(co2.card) && /Usati 1 su 41/.test(co2.card), JSON.stringify(co2));
  const anni = await p.evaluate(() => { const s = calcolaSaldoCongedoOrdinario(2027); return s; });
  ok('a gennaio 2027: i 40 avanzati + i 30 spettanti = 70', anni.valoreEffettivo === 70 && anni.riporto === 40, JSON.stringify(anni));
  await p.click('#saldiPartenzaBox [data-apri-saldi]');
  ok('"Correggi" riapre i numeri già inseriti', await p.evaluate(() => el('saldoCongedo').value === '41' && el('saldoRecuperoRiposo').value === '2'));
  await p.click('#btnChiudiSaldiPartenza');
  await p.evaluate(() => { AppState.turni['2026-10-05'] = window.__originali.a; AppState.turni['2026-10-21'] = window.__originali.b; salvaTurniStorage(); });
  ok('i saldi di partenza finiscono nel backup', await p.evaluate(() => JSON.stringify(costruisciDatiBackup()).includes('saldiPartenza')));
  ok('voci a zero in "Non usate"', /^Non usate \(\d+\)$/.test(ass.nonUsate) && ass.festivoInNonUsate, ass.nonUsate);
  await p.click('.card-assenza[data-id] .card-assenza-compact');
  ok('tocco su una scheda: si apre il dettaglio a tutta larghezza', await p.evaluate(() => { const c = document.querySelector('#corpoAssenze .card-assenza-aperta'); return !!c && c.getBoundingClientRect().width > document.getElementById('corpoAssenze').getBoundingClientRect().width - 2; }));
  await p.click('#tabAltro');
  await p.click('#settingsAnagrafica');
  await p.click('[data-passo="campoAnni"][data-delta="1"]');
  await p.selectOption('#campoRegione', 'Toscana');
  const an = await p.evaluate(() => ({ salvata: JSON.parse(localStorage.getItem('simCedolino_anagrafica_v1')), testata: document.querySelector('.testata-anagrafica').innerText, ancoraQui: !document.getElementById('vistaAnagrafica').hidden }));
  ok('Anagrafica: si salva da sola (anni +1, regione) senza uscire dalla pagina', an.salvata.anni == 1 && an.salvata.regione === 'Toscana' && an.ancoraQui, JSON.stringify(an.salvata));
  ok('testata: qualifica, parametro e regione', /Assistente Capo/.test(an.testata) && /116,50/.test(an.testata) && /Toscana/.test(an.testata), an.testata);
  await p.click('#btnChiudiAnagrafica');
  await p.evaluate(() => { const v = AppState.assenze.find(a => a.nome === 'Congedo ordinario'); AppState.turni['2026-10-20'] = { data: '2026-10-20', assenzaTipo: v.id }; salvaTurniStorage(); });
  await p.click('#tabTurni'); await p.click('#settingsSequenza');
  ok('la sequenza si apre a pagina intera', await p.evaluate(() => !document.getElementById('vistaSequenza').hidden && document.getElementById('vistaAssenze').hidden));
  await p.locator('[data-modifica-pattern="pattern_quinta5"]').click();
  await p.locator('#sceltaFaseSequenza [data-fase="3"]').click();
  const etichetta = await p.locator('#btnGeneraEditorPatternV2').innerText();
  ok('pulsante: "Genera 92 giorni · fino al 08/01/2027"', etichetta === 'Genera 92 giorni · fino al 08/01/2027', etichetta);
  ok('anteprima: il 20 (ferie) resta tratteggiato', await p.evaluate(() => [...document.querySelectorAll('#anteprimaSeqGriglia .g-resta em')].map(e => e.textContent).join() === '20'));
  await p.click('#btnGeneraEditorPatternV2');
  const r = await p.evaluate(() => ({ g9: AppState.turni['2026-10-09'].modelloId, g10: !!AppState.turni['2026-10-10'].riposo, g11: AppState.turni['2026-10-11'].modelloId, g20: !!AppState.turni['2026-10-20'].assenzaTipo, g21: AppState.turni['2026-10-21'].modelloId, gen8: !!AppState.turni['2027-01-08']?.riposo, gen9: !!AppState.turni['2027-01-09'] }));
  ok('"Quel giorno fai: Notte": 9/10 Notte, 10 Riposo, 11 Sera', r.g9 === 'notte' && r.g10 && r.g11 === 'sera');
  ok('le ferie del 20 restano, il 21 continua il ciclo; si ferma l\'8 gennaio', r.g20 && r.g21 === 'sera' && r.gen8 && !r.gen9, JSON.stringify(r));
  await p.click('#tabTurni');
  ok('in Turni: "In uso: Turno in quinta · fino al 08/01/2027"', await p.evaluate(() => document.getElementById('statoSequenzaTurni').textContent === 'In uso: Turno in quinta · fino al 08/01/2027'));
  await p.click('#settingsSequenza');
  await p.click('[data-continua-pattern="pattern_quinta5"]');
  const c = await p.evaluate(() => ({ da: document.getElementById('campoEditorPatternDataInizio').value, fase: document.querySelector('#sceltaFaseSequenza .attivo').textContent }));
  ok('"Continua": riparte dal 9 gennaio con Sera (dopo il Riposo dell\'8: il ciclo non si sfasa)', c.da === '2027-01-09' && c.fase === 'Sera', JSON.stringify(c));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Modifica il giorno, Tabelle, avvisi');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), stile: 'moderno' });
  await p.evaluate(() => { giornoSelezionato = '2026-10-01'; renderCalendario(); });
  await p.click('#btnModificaGiornoSelezionatoV2');
  const e = await p.evaluate(() => { const r = document.getElementById('pannelloTurno').getBoundingClientRect(); return { pieno: !document.getElementById('pannelloTurno').hidden && r.top <= 1 && r.height >= innerHeight - 1, sotto: document.getElementById('sottotitoloModaleTurno').textContent, tipo: document.querySelector('#sceltaTipoGiorno .attivo')?.dataset.tipoGiorno }; });
  ok('"Modifica il giorno" a pagina intera, con il turno in alto (Sera · 19:00 – 01:00)', e.pieno && e.tipo === 'turno' && e.sotto === 'Sera · 19:00 – 01:00', JSON.stringify(e));
  await p.click('[data-modello-giorno="notte"]');
  await p.click('[data-indennita-giorno="campoReperibilita"]');
  await p.click('[data-passo-ore="campoStrOre1"][data-delta="0.5"]');
  await p.click('[data-passo-ore="campoStrOre1"][data-delta="0.5"]');
  await p.click('#bloccoStrPrimo [data-valore="dopo"]');
  await p.click('#btnSalvaTurnoTesta');
  const t = await p.evaluate(() => AppState.turni['2026-10-01']);
  ok('salvato: Notte 01–07, reperibilità, 1 h di straordinario dopo (07–08)', t.oraInizio === '01:00' && t.oraFine === '07:00' && t.modelloId === 'notte' && t.reperibilita && t.straordinarioPrimaInizio === '07:00' && t.straordinarioPrimaFine === '08:00', JSON.stringify(t));
  await p.click('#btnModificaGiornoSelezionatoV2');
  await p.click('[data-tipo-giorno="riposo"]');
  await p.click('#btnSalvaTurno');
  ok('"Riposo" salva il giorno come riposo', await p.evaluate(() => AppState.turni['2026-10-01'].riposo === true));
  await p.click('#btnModificaGiornoSelezionatoV2');
  await p.click('[data-tipo-giorno="assenza"]');
  const idCO = await p.evaluate(() => AppState.assenze.find(a => a.nome === 'Congedo ordinario').id);
  ok('"Assenza": elenco da toccare con quanto resta (Congedo ordinario 30 / 30 gg)', await p.evaluate(id => /30\s*\/ 30 gg/.test(document.querySelector(`[data-assenza-giorno="${id}"]`).innerText), idCO));
  await p.click(`[data-assenza-giorno="${idCO}"]`);
  await p.click('#btnSalvaTurno');
  ok('l\'assenza toccata viene salvata', await p.evaluate(id => AppState.turni['2026-10-01'].assenzaTipo === id && !AppState.turni['2026-10-01'].riposo, idCO));
  ok('l\'avviso sta solo nel Calendario', await p.evaluate(() => !!document.querySelector('#vistaTurni #appAlerts')));
  await p.click('#tabAltro'); await p.click('#settingsTabelle');
  await p.click('#toggleTabelleAvanzate');
  await p.evaluate(() => { const i = document.querySelector('input[data-t="buonoPastoValore"]'); i.value = '8'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  ok('Tabelle: si salvano da sole (buono pasto 8 €)', await p.evaluate(() => JSON.parse(localStorage.getItem('simCedolino_tabelle_v1') || '{}').modifiche.buonoPastoValore === 8 && /Salvato/.test(document.getElementById('statoSalvataggioTabelle').textContent)));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Primo avvio, promemoria del turno, widget, esporta calendario');
{
  // Installazione nuova: niente anagrafica, niente turni → si apre la guida.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Rome' });
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', e => errori.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-09T10:00:00+02:00'));
  await p.goto(URL_APP); await p.waitForFunction(() => typeof renderCalendario === 'function' && document.querySelector('.giorno-cella'));
  ok('installazione nuova: si apre il primo avvio guidato', await p.evaluate(() => !document.getElementById('overlayBenvenuto').hidden));
  await p.selectOption('#benvenutoQualifica', 'Sovrintendente');
  await p.click('#btnBenvenutoAvanti');
  await p.click('[data-benvenuto-pattern="pattern_quinta5"]');
  await p.click('[data-benvenuto-fase="1"]');
  ok('guida: anteprima della settimana che parte da Pom. oggi', await p.evaluate(() => { const s = [...document.querySelectorAll('#benvenutoSettimana span')].map(x => x.textContent); return s.length === 7 && s[0] === 'P' && s[1] === 'M' && document.getElementById('btnBenvenutoAvanti').textContent === 'Crea i turni'; }));
  await p.click('#btnBenvenutoAvanti');
  ok('guida passo 3: "Quanto ti resta?" con congedo (30 proposti), recuperi e riposo compensativo', await p.evaluate(() => !document.querySelector('[data-passo-benvenuto="3"]').hidden && el('benvenutoSaldoCongedo').value === '30' && !!el('benvenutoSaldoRecuperoRiposo') && !!el('benvenutoSaldoRiposoCompensativo')));
  await p.fill('#benvenutoSaldoCongedo', '35');
  await p.click('#btnBenvenutoAvanti');
  ok('guida: saldi di partenza salvati (35 giorni)', await p.evaluate(() => JSON.parse(localStorage.getItem('simCedolino_saldiPartenza_v1') || '{}').congedo === 35));
  ok('guida passo 4: tema e avvisi, promemoria e widget spenti', await p.evaluate(() => !document.querySelector('[data-passo-benvenuto="4"]').hidden && !el('benvenutoPromemoria').checked && !el('benvenutoWidget').checked && document.querySelector('[data-benvenuto-tema="auto"]').classList.contains('attivo')));
  await p.click('#btnBenvenutoAvanti');
  ok('guida passo 5: riepilogo con profilo e giorni inseriti', await p.evaluate(() => /Sovrintendente/.test(el('benvenutoRiepilogo').textContent) && /92 giorni nel calendario/.test(el('benvenutoRiepilogo').textContent) && document.getElementById('btnBenvenutoAvanti').textContent === 'Vai al calendario'));
  await p.click('#btnBenvenutoAvanti');
  const b = await p.evaluate(() => ({ q: AppState.anagrafica.qualifica, oggi: AppState.turni['2026-10-09']?.modelloId, n: Object.keys(AppState.turni).length, chiuso: document.getElementById('overlayBenvenuto').hidden }));
  ok('guida: anagrafica salvata, "Oggi fai: Pom." e 3 mesi di turni', b.q === 'Sovrintendente' && b.oggi === 'pomeriggio' && b.n === 92 && b.chiuso, JSON.stringify(b));
  await p.reload(); await p.waitForFunction(() => document.querySelector('.giorno-cella'));
  ok('la guida non si riapre', await p.evaluate(() => document.getElementById('overlayBenvenuto').hidden));
  // Promemoria del turno e widget: spenti all'inizio.
  const spenti = await p.evaluate(() => ({ prom: impostazioniPromemoriaTurno().attivo, lista: promemoriaTurnoDaProgrammare().length, widget: datiWidget().attivo }));
  ok('promemoria del turno e widget partono spenti', spenti.prom === false && spenti.lista === 0 && spenti.widget === false, JSON.stringify(spenti));
  await p.click('#tabAltro');
  await p.click('#campoPromemoriaTurno');
  const prom = await p.evaluate(() => promemoriaTurnoDaProgrammare()[0]);
  ok('acceso: "Domani: Mattino" la sera prima alle 20:00', prom.title === 'Domani: Mattino' && prom.body === '07:00 – 13:00' && new Date(prom.quando).toISOString() === '2026-10-09T18:00:00.000Z', JSON.stringify(prom));
  await p.click('#campoWidget');
  const w = await p.evaluate(() => datiWidget());
  ok('widget acceso: oggi Pomeriggio 13:00 – 19:00', w.attivo && w.giorni['2026-10-09'].nome === 'Pomeriggio' && w.giorni['2026-10-09'].orario === '13:00 – 19:00', JSON.stringify(w.giorni['2026-10-09']));
  await p.click('#tabTurni'); await p.click('#btnApriEsportaCalendario');
  const ics = await p.evaluate(() => creaIcsTurni(false).testo);
  ok('file .ics: turni con orari di Roma, la Sera finisce il giorno dopo', /BEGIN:VCALENDAR/.test(ics) && /DTSTART;TZID=Europe\/Rome:20261009T130000/.test(ics) && /DTSTART;TZID=Europe\/Rome:20261013T190000\r\nDTEND;TZID=Europe\/Rome:20261014T010000/.test(ics) && !/SUMMARY:Riposo/.test(ics));
  ok('con "Includi riposi": i riposi come giornata intera', await p.evaluate(() => /DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}\r\nSUMMARY:Riposo/.test(creaIcsTurni(true).testo)));
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
  const netti = await p.evaluate(() => ({ righe: [...document.querySelectorAll('[data-stat-corpo="netto"] .stat-v-row b')].map(b => b.innerText), set: euro(generaCedolino(2026, 8).netto), ott: euro(generaCedolino(2026, 9).netto), storico: Object.keys(AppState.storico || {}).length }));
  ok('netto di ogni mese con turni calcolato da solo (senza Genera cedolino)', netti.storico === 0 && netti.righe[8] === netti.set && netti.righe[9] === netti.ott && netti.righe[7] === '—', netti.righe.join(' '));
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
  ok(`tema ${scuro ? 'scuro' : 'chiaro'}: sfondo ${sfondo}`, scuro ? sfondo === 'rgb(41, 45, 53)' : sfondo !== 'rgb(41, 45, 53)');
  ok(`tema ${scuro ? 'scuro' : 'chiaro'}: tutte le schede si aprono senza errori`, !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Scelta del tema (Automatico / Chiaro / Scuro)');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), stile: 'moderno' });
  const sfondo = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.click('#tabAltro');
  ok('pulsanti del tema visibili, "Auto" attivo', await p.evaluate(() => document.querySelector('.scelta-tema [data-tema="auto"]').classList.contains('attivo') && !!document.querySelector('.scelta-tema [data-tema="nero"]').offsetParent));
  await p.click('.scelta-tema [data-tema="grigio"]');
  ok('"Grigio" con il telefono in chiaro: sfondo grigio scuro', await sfondo() === 'rgb(41, 45, 53)');
  await p.reload();
  await p.waitForFunction(() => document.querySelector('.giorno-cella'));
  ok('"Grigio" resta dopo la riapertura', await sfondo() === 'rgb(41, 45, 53)' && await p.evaluate(() => document.documentElement.dataset.tema === 'scuro'));
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.click('#tabAltro');
  await p.click('.scelta-tema [data-tema="chiaro"]');
  ok('"Chiaro" con il telefono in scuro: sfondo chiaro', await sfondo() !== 'rgb(41, 45, 53)');
  await p.click('.scelta-tema [data-tema="auto"]');
  ok('"Auto" segue il telefono (scuro)', await sfondo() === 'rgb(41, 45, 53)' && await p.evaluate(() => !document.documentElement.hasAttribute('data-tema')));
  await p.click('.scelta-tema [data-tema="nero"]');
  ok('"Nero": sfondo quasi nero', await sfondo() === 'rgb(10, 12, 16)');
  await p.click('#tabCalendario');
  ok('nel calendario c\'è il pulsante ☀️ al posto della "i"', await p.evaluate(() => !document.getElementById('btnSimboliCalendario') && document.getElementById('btnTemaVeloce').textContent === '☀️'));
  await p.click('#btnTemaVeloce');
  ok('☀️ passa al chiaro e diventa 🌙', await sfondo() !== 'rgb(10, 12, 16)' && await p.evaluate(() => temaScelto() === 'chiaro' && document.getElementById('btnTemaVeloce').textContent === '🌙'));
  await p.click('#btnTemaVeloce');
  ok('🌙 torna allo scuro scelto prima (Nero)', await sfondo() === 'rgb(10, 12, 16)');
  ok('alba e tramonto a Roma il 9 ottobre: circa 7:15 e 18:40', await p.evaluate(() => { const { alba, tramonto } = albaTramonto(new Date('2026-10-09T12:00:00+02:00')); const m = d => d.getUTCHours() * 60 + d.getUTCMinutes() + 120; return Math.abs(m(alba) - 435) < 15 && Math.abs(m(tramonto) - 1120) < 15; }));
  await p.click('#tabAltro');
  await p.click('.scelta-tema [data-tema="luce"]');
  ok('"Luce" senza sensore (web): alle 10 di mattina è chiaro, la sera scuro', await p.evaluate(() => document.documentElement.dataset.tema === 'chiaro' && statoLuce.fonte === 'sole' && scuroDalSole(new Date('2026-10-09T21:00:00+02:00'))));
  await p.evaluate(() => { statoLuce.fonte = 'sensore'; clearInterval(statoLuce.intervallo); gestisciLux(3); });
  ok('"Luce": al buio non cambia subito', await p.evaluate(() => document.documentElement.dataset.tema === 'chiaro'));
  await p.waitForTimeout(3400);
  ok('"Luce": dopo 3 secondi di buio passa allo scuro', await p.evaluate(() => document.documentElement.dataset.tema === 'scuro'));
  await p.evaluate(() => { gestisciLux(200); gestisciLux(3); });
  await p.waitForTimeout(3400);
  ok('"Luce": un lampo di luce (o il dito sul sensore) non fa scattare il tema', await p.evaluate(() => document.documentElement.dataset.tema === 'scuro'));
  await p.click('.scelta-tema [data-tema="grigio"]');
  ok('lasciando "Luce" il sensore si ferma', await p.evaluate(() => !statoLuce.attivo));
  ok('il vecchio "Scuro" salvato vale come Grigio', await p.evaluate(() => { TurniPSStorage.setItem(CHIAVE_TEMA, 'scuro'); applicaTema(); return temaScelto() === 'grigio' && getComputedStyle(document.body).backgroundColor === 'rgb(41, 45, 53)'; }));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Stampa / Esporta PDF nell\'app Android');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva(), nativo: true, scuro: true });
  await p.click('#tabReport');
  await p.click('#btnGeneraCedolino');
  await p.click('#btnStampaCedolino');
  await p.waitForFunction(() => window.__log.some(x => x[0] === 'stampa'), null, { timeout: 3000 }).catch(() => {});
  const s = await p.evaluate(() => window.__log.find(x => x[0] === 'stampa'));
  ok('si apre la finestra di stampa di Android (non window.print)', !!s && s[1].titolo === 'Cedolino stimato' && s[3]);
  ok('durante la stampa il foglio è chiaro anche col tema scuro', !!s && s[2] === 'chiaro');
  await p.waitForTimeout(500);
  ok('chiusa la stampa, il tema torna come prima', await p.evaluate(() => !document.documentElement.hasAttribute('data-tema')));
  ok('barre di Android in tinta con l\'app (sfondo e icone)', await p.evaluate(() => { scegliTema('nero'); const b = window.__log.filter(x => x[0] === 'barre').pop(); return !!b && b[1].colore === '#0A0C10' && b[1].iconeChiare === true; }));
  ok('in Chiaro le barre diventano chiare con icone scure', await p.evaluate(() => { scegliTema('chiaro'); const b = window.__log.filter(x => x[0] === 'barre').pop(); return b[1].colore === '#ECEFEA' && b[1].iconeChiare === false; }));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Riquadro del giorno e assenze nel menu');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva() });
  await p.evaluate(() => selezionaGiorno('2026-10-09'));
  const r = await p.evaluate(() => ({
    data: document.querySelector('.giorno-v3-data')?.textContent,
    nome: document.querySelector('.giorno-v3-nome')?.textContent,
    orario: document.querySelector('.giorno-v3-orario')?.textContent || '',
    link: document.getElementById('btnCancellaTurniMese').textContent
  }));
  ok('il riquadro dice giorno della settimana e nome del turno', r.data === 'Venerdì 9 ottobre' && !!r.nome && r.nome !== 'Nessun turno', JSON.stringify(r));
  ok('"Cancella i turni" dice il mese visualizzato', r.link === 'Cancella i turni di ottobre…', r.link);
  await p.evaluate(() => { giornoPerPopupV2 = '2026-10-09'; apriSelettoreModelliV2('assenze'); });
  const m = await p.evaluate(() => ({
    righe: document.querySelectorAll('#listaModelliAssenze .riga-assenza-giorno[data-assenza]').length,
    saldo: !!document.querySelector('#listaModelliAssenze .riga-assenza-giorno em small'),
    nonUsate: document.querySelector('#listaModelliAssenze .assenze-menu-non-usate summary')?.textContent || '',
    chiuso: !document.querySelector('#listaModelliAssenze .assenze-menu-non-usate')?.open
  }));
  ok('Assenze nel menu: elenco con quanto resta', m.righe > 3 && m.saldo, JSON.stringify(m));
  ok('voci a zero in "Non usate", chiuso', /^Non usate \(\d+\)$/.test(m.nonUsate) && m.chiuso, JSON.stringify(m));
  const co = await p.evaluate(() => AppState.assenze.find(a => a.nome === 'Congedo ordinario').id);
  await p.click(`#listaModelliAssenze [data-assenza="${co}"]`);
  ok('toccando un\'assenza si applica al giorno', await p.evaluate(id => AppState.turni['2026-10-09'].assenzaTipo === id, co));
  ok('il backup porta con sé promemoria del turno e widget', await p.evaluate(() => { TurniPSStorage.setItem(CHIAVE_PROMEMORIA_TURNO, JSON.stringify({ attivo: true, modo: 'prima', minuti: 30 })); TurniPSStorage.setItem(CHIAVE_WIDGET, '1'); const d = costruisciDatiBackup(); return JSON.parse(d.promemoriaTurno).minuti === 30 && d.widget === '1'; }));
  ok('i colori dei turni sono nel backup gratuito e non ci sono più pulsanti a pagamento', await p.evaluate(() => { AppState.coloriTurni = Object.assign({}, AppState.coloriTurni, { sera: '#123456' }); const d = costruisciDatiBackup(); return d.coloriTurni.sera === '#123456' && !document.getElementById('btnEsportaColoriTurni') && typeof esportaBackupColori === 'undefined'; }));
  ok('al primo avvio il calendario è Moderno e a colori', await p.evaluate(() => { localStorage.removeItem(CHIAVE_STILE_CALENDARIO); localStorage.removeItem(CHIAVE_CALENDARIO_A_COLORI); return calendarioModernoAttivo() && calendarioAColoriAttivo(); }));
  ok('il riquadro mostra l\'assenza', await p.evaluate(() => document.querySelector('.giorno-v3-nome').textContent === 'Congedo ordinario'));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Modificare ed eliminare un turno');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva() });
  await p.evaluate(() => generaTurniDaCiclo({ sequenza: sequenzaDaPatternV2('pattern_quinta5'), dataInizioIso: '2026-10-01', numeroGiorni: 30, fase: 0, patternId: 'pattern_quinta5' }));
  await p.evaluate(() => { apriModificaModelloV2('sera'); el('campoModModelloInizio').value = '18:40'; el('campoModModelloFine').value = '00:15'; salvaModificaModelloV2(); });
  ok('cambiando l\'orario di un turno si chiede se aggiornare i giorni', await p.evaluate(() => !el('overlayAggiornaTurni').hidden && /18:40–00:15/.test(el('testoAggiornaTurni').textContent)));
  await p.evaluate(() => el('btnAggTurniFuturi').click());
  ok('"da oggi in poi": i giorni futuri prendono il nuovo orario, quelli passati no', await p.evaluate(() => AppState.turni['2026-10-11'].oraInizio === '18:40' && AppState.turni['2026-10-01'].oraInizio === '19:00' && AppState.modelliTurno[0].id === 'sera'));
  await p.evaluate(() => apriModificaModelloV2('sera'));
  ok('turno di base: niente "Elimina", c\'è "↺ Orario di base" se l\'orario è cambiato', await p.evaluate(() => el('btnEliminaModello').hidden && !el('btnOrarioBaseModello').hidden));
  await p.evaluate(() => el('btnOrarioBaseModello').click());
  ok('"↺ Orario di base" rimette 19:00–01:00 nei campi', await p.evaluate(() => el('campoModModelloInizio').value === '19:00' && el('campoModModelloFine').value === '01:00' && el('btnOrarioBaseModello').hidden));
  await p.evaluate(() => { document.querySelectorAll('.overlay').forEach(o => o.hidden = true); AppState.modelliTurno.push({ id: 'personalizzato_8', nome: 'Servizio', oraInizio: '09:00', oraFine: '15:00', sigla: 'SV' }); AppState.pattern[0].giorni[1].modelloId = 'personalizzato_8'; apriModificaModelloV2('personalizzato_8'); });
  ok('turno creato da te: "Elimina" c\'è', await p.evaluate(() => !el('btnEliminaModello').hidden));
  await p.evaluate(() => el('btnEliminaModello').click());
  ok('se è usato in una sequenza non si elimina (spiega perché)', await p.evaluate(() => AppState.modelliTurno.some(m => m.id === 'personalizzato_8') && /sequenza/.test(el('testoAvviso').textContent)));
  await p.evaluate(() => { AppState.pattern[0].giorni[1].modelloId = 'pomeriggio'; document.querySelectorAll('.overlay').forEach(o => o.hidden = true); AppState.modelliTurno.push({ id: 'personalizzato_9', nome: 'Scorta', oraInizio: '08:00', oraFine: '14:00', sigla: 'SC' }); AppState.turni['2026-10-02'].modelloId = 'personalizzato_9'; apriModificaModelloV2('personalizzato_9'); el('btnEliminaModello').click(); });
  ok('eliminare un turno chiede conferma e dice che i giorni restano', await p.evaluate(() => AppState.modelliTurno.some(m => m.id === 'personalizzato_9') && /restano/.test(el('testoAvviso').textContent)));
  await p.evaluate(() => el('btnConfermaAvviso').click());
  ok('confermato: il turno sparisce, il giorno resta con il suo orario', await p.evaluate(() => !AppState.modelliTurno.some(m => m.id === 'personalizzato_9') && AppState.turni['2026-10-02'].oraInizio && !AppState.turni['2026-10-02'].modelloId));
  // Situazione rimasta dalle versioni prima: "Sera" eliminato e ricreato con un altro id.
  await p.evaluate(() => {
    AppState.modelliTurno = AppState.modelliTurno.filter(m => m.id !== 'sera');
    AppState.modelliTurno.push({ id: 'personalizzato_1', nome: 'Sera', oraInizio: '18:40', oraFine: '00:15', sigla: 'SE' });
    salvaModelliTurnoStorage(); TurniPSStorage.setItem(CHIAVE_TURNI, JSON.stringify(AppState.turni));
  });
  await p.reload(); await p.waitForFunction(() => document.querySelector('.giorno-cella'));
  ok('"Sera" eliminato e ricreato torna il turno di base: primo in elenco, giorni e sequenza ricollegati', await p.evaluate(() => AppState.modelliTurno[0].id === 'sera' && AppState.modelliTurno[0].oraInizio === '18:40' && !AppState.modelliTurno.some(m => m.id === 'personalizzato_1') && AppState.turni['2026-10-01'].modelloId === 'sera' && AppState.pattern.find(x => x.id === 'pattern_quinta5').giorni[0].modelloId === 'sera'));
  ok('la sequenza genera di nuovo "Sera" e non riposo', await p.evaluate(() => { const s = sequenzaDaPatternV2('pattern_quinta5'); return s[0].tipo === 'personalizzato' && s[0].oraInizio === '18:40'; }));
  ok('nella scheda Turni "Sera" torna tra i turni usati', await p.evaluate(() => { renderModelliTabTurni(); return [...document.querySelectorAll('.tessera-modello strong, .tessera-turno strong, [data-modifica-modello]')].some(x => /Sera/.test(x.textContent)) && typeof turnoUsaModello === 'function' && turnoUsaModello(AppState.turni['2026-10-01'], AppState.modelliTurno.find(m => m.id === 'sera')); }));
  await p.evaluate(() => { document.querySelectorAll('.overlay').forEach(o => o.hidden = true); giornoSelezionato = '2026-10-11'; apriModaleTurno('2026-10-11'); });
  ok('Modifica il giorno con l\'orario del turno: nessuna nota', await p.evaluate(() => el('notaOrarioSoloGiorno').hidden));
  await p.evaluate(() => { el('campoOraFine').value = '02:30'; el('campoOraFine').dispatchEvent(new Event('input', { bubbles: true })); el('campoOraFine').dispatchEvent(new Event('change', { bubbles: true })); aggiornaEditorGiornoV3(); });
  ok('orario diverso: "Orario solo per questo giorno … scheda Turni"', await p.evaluate(() => !el('notaOrarioSoloGiorno').hidden && /solo per questo giorno/.test(el('notaOrarioSoloGiorno').textContent) && /Sera di solito/.test(el('notaOrarioSoloGiorno').textContent)));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Report: lordo, trattenute e netto');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva() });
  await p.evaluate(() => { AppState.turni['2026-10-02'].straordinarioDopoInizio = AppState.turni['2026-10-02'].oraFine; AppState.turni['2026-10-02'].straordinarioDopoFine = '23:00'; salvaTurniStorage(); });
  await p.click('#tabReport');
  const num = t => Number(String(t).replace(/[^0-9,−-]/g, '').replace('−', '-').replace(/\./g, '').replace(',', '.'));
  const hero = await p.evaluate(() => ({ cifra: document.querySelector('.report-hero-cifra').textContent, righe: [...document.querySelectorAll('.report-hero-righe b')].map(b => b.textContent), tag: !!document.querySelector('.report-hero .tag-netto') }));
  const sommaHero = hero.righe.reduce((s, x) => s + num(x), 0);
  ok('riquadro in alto: stipendio + accessorie − tasse = netto, con etichetta "netto"', hero.tag && Math.abs(sommaHero - num(hero.cifra)) < 0.02, JSON.stringify(hero));
  const ced = await p.evaluate(() => ({ lordo: [...document.querySelectorAll('.ced-lordo-v3 .ced-riga-v3 b')].map(b => b.textContent), tratt: [...document.querySelectorAll('.ced-tratt-v3 .ced-riga-v3 b')].map(b => b.textContent), netto: document.querySelector('.ced-cifra-v3').textContent, tag: document.querySelectorAll('#cedolinoRiassuntoV3 .tag-importo').length }));
  const totL = num(ced.lordo[ced.lordo.length - 1]), totT = num(ced.tratt[ced.tratt.length - 1]);
  ok('cedolino sempre in vista: stipendio + accessorie = lordo', ced.tag === 3 && Math.abs(num(ced.lordo[0]) + num(ced.lordo[1]) - totL) < 0.02, JSON.stringify(ced));
  ok('cedolino: le trattenute sommano al totale e lordo − trattenute = netto', Math.abs(ced.tratt.slice(0, -1).reduce((s, x) => s + num(x), 0) - totT) < 0.02 && Math.abs(totL + totT - num(ced.netto)) < 0.02 && totT < 0);
  ok('cedolino: il netto è quello del calcolo', await p.evaluate(() => document.querySelector('.ced-cifra-v3').textContent === euro(generaCedolino(annoCorrente, meseCorrente).netto)));
  const mese = await p.evaluate(() => ({ righe: [...document.querySelectorAll('#meseDettaglioV3 .mese-ind-v3 b')].map(b => b.textContent), str: document.querySelector('.mese-str-v3')?.textContent || '', zeri: !!document.getElementById('btnMeseZeriV3'), ore: document.getElementById('meseTileOre').textContent }));
  ok('Il mese: straordinario lordo → netto con il mese in cui arriva', /lordi.*netti, arrivano a dicembre/.test(mese.str), mese.str);
  ok('Il mese: nessuna indennità a zero in vista', mese.righe.filter(x => !x.startsWith('~')).every(x => num(x) > 0) && mese.zeri, JSON.stringify(mese));
  const nett = await p.evaluate(() => { const na = calcolaNettoAccessorie(annoCorrente, meseCorrente); const righe = [...document.querySelectorAll('#meseDettaglioV3 .mese-ind-v3 .netto-v3')].map(x => x.textContent); return { na, righe }; });
  ok('indennità: ogni voce ha anche il netto, e il netto totale è tra 0 e il lordo', nett.righe.length > 0 && nett.righe.every(t => /^~\d+ €$/.test(t)) && nett.na.netto > 0 && nett.na.netto < nett.na.lordo, JSON.stringify(nett));
  await p.click('#btnMeseZeriV3');
  ok('"Mostra anche le voci a zero" le fa comparire', await p.evaluate(() => [...document.querySelectorAll('#meseDettaglioV3 .mese-ind-v3 b')].some(b => b.textContent.startsWith('0,00'))));
  await p.click('#btnGeneraCedolino');
  ok('"Vedi tutte le voci" apre il cedolino completo', await p.evaluate(() => !document.getElementById('contenitoreCedolino').hidden && /Nascondi/.test(document.getElementById('btnGeneraCedolino').textContent)));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────
sezione('Tabelle: modifiche personali e aggiornamento dal sito');
{
  const { p, ctx, errori } = await apri({ turni: turniDiProva() });
  // Vecchio formato (copia completa con il buono pasto cambiato): diventa "solo le modifiche".
  await p.evaluate(() => { const t = clonaTabelleConSoglie(TABELLE_PREDEFINITE); t.buonoPastoValore = 9; localStorage.setItem('simCedolino_tabelle_v1', JSON.stringify(t)); });
  await p.reload(); await p.waitForFunction(() => document.querySelector('.giorno-cella'));
  const mig = await p.evaluate(() => ({ salv: JSON.parse(localStorage.getItem('simCedolino_tabelle_v1')), bp: AppState.tabelle.buonoPastoValore }));
  ok('tabelle salvate nel vecchio formato: restano solo le modifiche fatte a mano', mig.salv.formato === 2 && JSON.stringify(mig.salv.modifiche) === '{"buonoPastoValore":9}' && mig.bp === 9, JSON.stringify(mig.salv));
  const agenteApp = await p.evaluate(() => AppState.tabelle.stipendiAnnuiAttuale['Agente']);
  const nuovo = await p.evaluate(() => { const t = JSON.parse(JSON.stringify(TABELLE_PREDEFINITE)); t.stipendiAnnuiAttuale['Agente'] = 21000; t.buonoPastoValore = 8; return { formato: 1, versione: '2099.01', aggiornato: '2099-01-10', nota: 'Prova', tabelle: t }; });
  await ctx.unroute('https://micmax-apps.netlify.app/**');
  await ctx.route('https://micmax-apps.netlify.app/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nuovo) }));
  const agg = await p.evaluate(async () => ({ fatto: await aggiornaTabelleDalSito({ forza: true }), agente: AppState.tabelle.stipendiAnnuiAttuale['Agente'], bp: AppState.tabelle.buonoPastoValore, info: applicaTabelleSito() }));
  ok('tabelle dal sito più nuove: i valori ufficiali si aggiornano', agg.fatto === true && agg.agente === 21000 && agenteApp !== 21000 && agg.info.versione === '2099.01', JSON.stringify(agg));
  ok('…e le modifiche fatte a mano restano (buono pasto 9 €)', agg.bp === 9);
  await p.reload(); await p.waitForFunction(() => document.querySelector('.giorno-cella'));
  ok('dopo la riapertura l\'app usa ancora le tabelle del sito', await p.evaluate(() => AppState.tabelle.stipendiAnnuiAttuale['Agente'] === 21000 && applicaTabelleSito().fonte === 'sito'));
  const vecchia = await p.evaluate(async () => { localStorage.setItem('simCedolino_tabelleSitoControllo_v1', '0'); return aggiornaTabelleDalSito({ forza: true }); });
  ok('stessa versione: non cambia niente', vecchia === false);
  await ctx.unroute('https://micmax-apps.netlify.app/**');
  await ctx.route('https://micmax-apps.netlify.app/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ formato: 1, versione: '2999.01', tabelle: { stipendiAnnuiAttuale: { Agente: 'tanti' } } }) }));
  const rotto = await p.evaluate(async () => ({ r: await aggiornaTabelleDalSito({ forza: true }), agente: AppState.tabelle.stipendiAnnuiAttuale['Agente'] }));
  ok('file del sito non valido: le tabelle restano quelle di prima', rotto.r === false && rotto.agente === 21000, JSON.stringify(rotto));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await ctx.close();
}

sezione('Agenda sotto il calendario');
{
  const { p, errori } = await apri({ turni: turniDiProva(), eventi: { '2026-10-12': [{ id: 'evento_1', titolo: 'Visita medica', oraInizio: '10:00', colore: '#2E9E5B' }] } });
  const prima = await p.evaluate(() => ({ nascosta: el('agendaSottoCalendario').hidden, campo: el('campoAgendaSotto').checked, prossimi: !el('prossimiEventiV2').hidden && getComputedStyle(el('prossimiEventiV2')).display !== 'none' }));
  ok('all\'inizio l\'agenda è spenta e restano "Prossimi 7 giorni"', prima.nascosta && !prima.campo && prima.prossimi, JSON.stringify(prima));
  await p.click('#tabAltro');
  await p.evaluate(() => el('campoAgendaSotto').scrollIntoView({ block: 'center' }));
  await p.click('#campoAgendaSotto', { force: true });
  await p.click('#tabCalendario');
  const a = await p.evaluate(() => {
    const righe = [...document.querySelectorAll('.agenda-giorno')];
    return { n: righe.length, primo: righe[0].dataset.agendaGiorno, oggi: righe[0].classList.contains('oggi'), testoPrimo: righe[0].textContent,
      griglia: getComputedStyle(el('calendarioGriglia')).display, mese: el('etichettaMese').textContent, settimana: document.querySelector('.agenda-settimana').textContent,
      riposo: document.querySelector('[data-agenda-giorno="2026-10-10"]').textContent, evento: document.querySelector('[data-agenda-giorno="2026-10-12"] .agenda-evento')?.textContent || '',
      prossimi: getComputedStyle(el('prossimiEventiV2')).display };
  });
  ok('acceso da Altro: 14 giorni da oggi sotto il calendario, che resta visibile', a.n === 14 && a.primo === '2026-10-09' && a.oggi && a.griglia !== 'none' && /Ottobre 2026/.test(a.mese), JSON.stringify(a));
  ok('Agenda: turno con nome e orario, riposo e "Oggi"', /Oggi/.test(a.testoPrimo) && /Notte/.test(a.testoPrimo) && /01:00 – 07:00/.test(a.testoPrimo) && /Riposo/.test(a.riposo), a.testoPrimo);
  ok('Agenda: ore di servizio della settimana (30:00)', /Questa settimana/.test(a.settimana) && /30:00 ore di servizio/.test(a.settimana), a.settimana);
  const om = await p.evaluate(() => { AppState.turni['2026-10-14'] = { data: '2026-10-14', oraInizio: '12:40', oraFine: '19:15', modelloId: 'pomeriggio' }; renderAgenda(); return document.querySelector('[data-agenda-giorno="2026-10-14"] .agenda-ore').textContent; });
  ok('Agenda: ore in ore e minuti (12:40–19:15 = 6:35, non 6,58)', om === '6:35', om);
  const tot = await p.evaluate(() => {
    ['12','13','14','16','17','18'].forEach(g => { const iso = `2026-10-${g}`; AppState.turni[iso] = g === '16' ? { data: iso, oraInizio: '18:40', oraFine: '00:15', modelloId: 'sera' } : { data: iso, oraInizio: '12:40', oraFine: '19:15', modelloId: 'pomeriggio' }; });
    AppState.turni['2026-10-15'] = { data: '2026-10-15', riposo: true };
    renderAgenda(); return document.querySelectorAll('.agenda-settimana')[1].textContent;
  });
  ok('Agenda: il totale della settimana è la somma dei giorni (5 × 6:35 + 5:35 = 38:30)', /38:30 ore di servizio/.test(tot), tot);
  ok('Agenda: eventi sotto il giorno, "Prossimi 7 giorni" nascosto', /10:00/.test(a.evento) && /Visita medica/.test(a.evento) && a.prossimi === 'none', JSON.stringify(a));
  await p.click('#btnAgendaAltri');
  ok('"Mostra altri" aggiunge altri 14 giorni', await p.evaluate(() => document.querySelectorAll('.agenda-giorno').length === 28));
  await p.reload(); await p.waitForFunction(() => document.querySelector('.giorno-cella'));
  ok('dopo la riapertura l\'agenda resta accesa', await p.evaluate(() => !el('agendaSottoCalendario').hidden && el('campoAgendaSotto').checked && document.querySelectorAll('.agenda-giorno').length === 14));
  ok('la scelta finisce nel backup', await p.evaluate(() => JSON.stringify(costruisciDatiBackup()).includes('"agendaSottoCalendario":true')));
  await p.click('[data-agenda-giorno="2026-10-13"] .agenda-corpo');
  const g = await p.evaluate(() => ({ t: el('titoloModaleTurno').textContent, iso: giornoSelezionato }));
  ok('tocco su un giorno: si apre la modifica di quel giorno', g.iso === '2026-10-13' && /13/.test(g.t), JSON.stringify(g));
  await p.click('#btnChiudiTurno');
  await p.click('[data-agenda-giorno="2026-10-12"] .agenda-evento');
  ok('tocco su un evento: si apre la modifica dell\'evento', await p.evaluate(() => !el('overlayEvento').hidden && el('campoEventoTitolo').value === 'Visita medica'));
  await p.evaluate(() => { el('overlayEvento').hidden = true; impostaAgendaSotto(false); });
  ok('spenta di nuovo: sparisce e tornano "Prossimi 7 giorni"', await p.evaluate(() => el('agendaSottoCalendario').hidden && getComputedStyle(el('prossimiEventiV2')).display !== 'none'));
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await p.context().close();
}

sezione('Velocità del calcolo delle ore');
{
  const { p, errori } = await apri({ turni: turniDiProva() });
  // Valori presi dal vecchio conteggio minuto per minuto: il nuovo (a blocchi di un'ora) deve dare gli stessi.
  const attesi = [["2026-10-24","22:00","06:00",{"ordinarie":0,"notturne":2,"festive":0,"domenicali":0,"notturneFestive":7,"serali":0},"notte"],["2026-03-28","23:30","07:15",{"ordinarie":0,"notturne":0.5,"festive":0,"domenicali":1.25,"notturneFestive":5,"serali":0},"notte"],["2026-04-05","18:40","00:15",{"ordinarie":0,"notturne":0,"festive":0,"domenicali":3.33,"notturneFestive":2.25,"serali":3.33},"sera"],["2026-12-24","12:40","19:15",{"ordinarie":6.58,"notturne":0,"festive":0,"domenicali":0,"notturneFestive":0,"serali":1.25},"pomeriggio"]];
  const r = await p.evaluate(attesi => attesi.map(([g, a, b, cat, momento]) => {
    const [hs, ms] = a.split(':').map(Number), [he, me] = b.split(':').map(Number);
    const i = new Date(g + 'T00:00:00'); i.setHours(hs, ms, 0, 0); const f = new Date(g + 'T00:00:00'); f.setHours(he, me, 0, 0); if(f <= i) f.setDate(f.getDate() + 1);
    return JSON.stringify(classificaFinestra(i, f)) === JSON.stringify(cat) && categoriaTurno(a, b, g) === momento;
  }), attesi);
  ok('ore notturne, festive e serali uguali a prima (anche col cambio dell\'ora e a Pasqua)', r.every(Boolean), JSON.stringify(r));
  const ms = await p.evaluate(() => { const s = performance.now(); for(let i = 0; i < 1000; i++) classificaTurno({ data: '2026-10-11', oraInizio: '18:40', oraFine: '00:15' }); return performance.now() - s; });
  ok('1000 turni calcolati in meno di 300 ms', ms < 300, Math.round(ms) + ' ms');
  ok('nessun errore JavaScript', !errori.length, errori.join(' | '));
  await p.context().close();
}

await browser.close();
server.close();
console.log(`\n${superati} controlli superati, ${falliti} falliti`);
process.exit(falliti ? 1 : 0);
