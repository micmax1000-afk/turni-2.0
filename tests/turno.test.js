'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { caricaApp } = require('./helpers/load-app.js');

test('classificaTurno: turno semplice senza straordinario (13:00-19:00, 6 ore)', () => {
  const app = caricaApp();
  const turno = { data: '2026-08-27', oraInizio: '13:00', oraFine: '19:00' };
  const c = app.classificaTurno(turno);
  assert.equal(c.oreTotali, 6);
  assert.equal(app.totaleStraordinario(c), 0);
});

test('classificaTurno + totaleStraordinario: 6h base + 3h straordinario — regressione doppio conteggio', () => {
  // Caso reale segnalato dall'utente: turno 13:00-19:00 (6h) con 3h di straordinario dopo la fine.
  // Bug storico: "Totale giorno" veniva calcolato come oreTotali (già comprensivo dello
  // straordinario, quindi 9) + straordinario (3) = 12, invece di 9.
  const app = caricaApp();
  const turno = {
    data: '2026-08-27', oraInizio: '13:00', oraFine: '19:00',
    straordinarioDopoInizio: '19:00', straordinarioDopoFine: '22:00'
  };
  const c = app.classificaTurno(turno);
  const straordinario = app.totaleStraordinario(c);
  const oreOrdinarie = Math.max(0, Number(c.oreTotali || 0) - straordinario);
  const totaleGiorno = Number(c.oreTotali || 0);

  assert.equal(oreOrdinarie, 6, 'le ore ordinarie devono essere 6, non 9');
  assert.equal(straordinario, 3, 'lo straordinario deve essere 3');
  assert.equal(totaleGiorno, 9, 'il totale giorno deve essere 9 (6+3), non 12 (doppio conteggio)');
});

test('classificaTurno: rientro pomeridiano (turno spezzato) conta come ore ordinarie, non straordinario — regressione', () => {
  // Bug reale segnalato dall'utente: sulla "settimana corta" (mattina + rientro pomeridiano),
  // le ore del rientro finivano nei totali di straordinario invece che in quelle ordinarie,
  // nonostante il rientro sia parte del normale orario contrattuale della giornata.
  const app = caricaApp();
  const turno = { data: '2026-09-02', oraInizio: '08:00', oraFine: '14:00', secondoAttivo: true, secondoOraInizio: '15:00', secondoOraFine: '18:00' };
  const c = app.classificaTurno(turno);
  assert.equal(c.oreTotali, 9, '6h mattina + 3h rientro = 9h totali');
  assert.equal(c.ordinarie, 9, 'tutte le 9 ore devono essere ordinarie');
  assert.equal(app.totaleStraordinario(c), 0, 'il rientro non deve mai generare straordinario');
});

test('classificaTurno: turno notturno che attraversa la mezzanotte', () => {
  const app = caricaApp();
  const turno = { data: '2026-08-27', oraInizio: '19:00', oraFine: '01:00' };
  const c = app.classificaTurno(turno);
  assert.equal(c.oreTotali, 6);
});

test('classificaTurno: giorno di riposo restituisce zero ore', () => {
  const app = caricaApp();
  const c = app.classificaTurno({ data: '2026-08-27', riposo: true });
  assert.equal(c.oreTotali, 0);
});

test('classificaTurno: giorno di assenza restituisce zero ore', () => {
  const app = caricaApp();
  const c = app.classificaTurno({ data: '2026-08-27', assenzaTipo: 'ferie' });
  assert.equal(c.oreTotali, 0);
});

test('classificaTurno: stesso orario di inizio e fine viene interpretato come turno di 24 ore esatte (non genera errore)', () => {
  // Nota tecnica: con la logica attuale (riporto al giorno dopo se l'orario di fine
  // non è successivo a quello di inizio), la durata massima possibile è ESATTAMENTE 24h:
  // non è mai raggiungibile un valore superiore. Il controllo "oltre 24 ore" nel codice
  // è quindi difensivo ma di fatto irraggiungibile con i soli orari inizio/fine di oggi.
  const app = caricaApp();
  const c = app.classificaTurno({ data: '2026-08-27', oraInizio: '08:00', oraFine: '08:00' });
  assert.equal(c.errore, null);
  assert.equal(c.oreTotali, 24);
});

test('calcolaOrarioStraordinarioDaOre: converte "quante ore + prima/dopo" nell\'orario esatto, gestendo anche la mezzanotte', () => {
  const app = caricaApp();
  let r = app.calcolaOrarioStraordinarioDaOre('07:00', '13:00', 2, 'prima');
  assert.equal(r.inizio, '05:00'); assert.equal(r.fine, '07:00');

  r = app.calcolaOrarioStraordinarioDaOre('07:00', '13:00', 3, 'dopo');
  assert.equal(r.inizio, '13:00'); assert.equal(r.fine, '16:00');

  // Turno notturno: lo straordinario "dopo" deve ancorarsi alla vera fine (06:00), non confondersi con l'inizio (22:00).
  r = app.calcolaOrarioStraordinarioDaOre('22:00', '06:00', 2, 'dopo');
  assert.equal(r.inizio, '06:00'); assert.equal(r.fine, '08:00');

  // Avvolgimento all'indietro oltre la mezzanotte.
  r = app.calcolaOrarioStraordinarioDaOre('00:30', '07:00', 1, 'prima');
  assert.equal(r.inizio, '23:30'); assert.equal(r.fine, '00:30');

  // Nessuna ora inserita -> nessun orario calcolato (niente straordinario).
  r = app.calcolaOrarioStraordinarioDaOre('07:00', '13:00', 0, 'prima');
  assert.equal(r.inizio, ''); assert.equal(r.fine, '');

  // Verifica end-to-end: le ore calcolate risultano poi classificate correttamente (pomeriggio = diurno, non notturno).
  const c = app.classificaTurno({ data:'2026-09-05', oraInizio:'07:00', oraFine:'13:00', straordinarioPrimaInizio:'13:00', straordinarioPrimaFine:'16:00' });
  assert.equal(c.strDiurno, 3, 'le 3 ore dalle 13 alle 16 devono classificarsi come straordinario diurno');
  assert.equal(c.strNotturno, 0);
});

test('scomponiOrarioStraordinarioInOre: ricava ore e posizione (prima/dopo) da un orario già salvato', () => {
  const app = caricaApp();
  let r = app.scomponiOrarioStraordinarioInOre('05:00', '07:00', '07:00', '13:00');
  assert.equal(r.ore, 2); assert.equal(r.posizione, 'prima');

  r = app.scomponiOrarioStraordinarioInOre('13:00', '16:00', '07:00', '13:00');
  assert.equal(r.ore, 3); assert.equal(r.posizione, 'dopo');
});

test('calcolaFineAssolutaTurno: calcola correttamente l\'istante di fine, anche a cavallo di mezzanotte', () => {
  // Base per la regressione "prossimo turno mostra un turno già concluso di oggi":
  // verifica che il calcolo dell'istante di fine sia corretto sia per turni nello stesso
  // giorno sia per turni che sconfinano nel giorno successivo (es. 19:00-01:00).
  const app = caricaApp();
  const fineStessoGiorno = app.calcolaFineAssolutaTurno('2026-09-03', '07:00', '13:00');
  assert.equal(fineStessoGiorno.getDate(), 3);
  assert.equal(fineStessoGiorno.getHours(), 13);

  const fineGiornoSuccessivo = app.calcolaFineAssolutaTurno('2026-09-03', '19:00', '01:00');
  assert.equal(fineGiornoSuccessivo.getDate(), 4, 'un turno 19:00-01:00 finisce il giorno dopo');
  assert.equal(fineGiornoSuccessivo.getHours(), 1);
});

test('categoriaTurno: riconosce correttamente mattina/pomeriggio/sera/notte', () => {
  const app = caricaApp();
  assert.equal(app.categoriaTurno('07:00', '13:00', '2026-08-27'), 'mattina');
  assert.equal(app.categoriaTurno('13:00', '19:00', '2026-08-27'), 'pomeriggio');
  assert.equal(app.categoriaTurno('19:00', '01:00', '2026-08-27'), 'sera');
  assert.equal(app.categoriaTurno('00:00', '07:00', '2026-08-27'), 'notte');
});

test('iconaAssenza: assegna un\'icona specifica per ciascun tipo di assenza predefinito', () => {
  const app = caricaApp();
  assert.equal(app.iconaAssenza('Congedo ordinario'), '🏖️');
  // Regressione: "straordinario" contiene la sottostringa "ordinario", quindi un controllo
  // nell'ordine sbagliato lo farebbe finire nel ramo delle ferie invece che in quello dedicato.
  assert.equal(app.iconaAssenza('Congedo straordinario'), '🏠');
  assert.equal(app.iconaAssenza('Riposo compensativo'), '🔄');
  assert.equal(app.iconaAssenza('L104'), '♿');
  assert.equal(app.iconaAssenza('Ore studio'), '📚');
  assert.equal(app.iconaAssenza('Donazione sangue'), '🩸');
});

test('iconaAssenza: una voce personalizzata non riconosciuta usa l\'icona generica, non quella delle ferie', () => {
  const app = caricaApp();
  assert.equal(app.iconaAssenza('Corso di aggiornamento professionale'), '📌');
  assert.equal(app.iconaAssenza(''), '📌');
  assert.equal(app.iconaAssenza(undefined), '📌');
});

test('rilevaSovrapposizioneStraordinario: rileva se lo straordinario "prima" o "dopo" si sovrappone all\'orario del turno', () => {
  const app = caricaApp();
  const sovrapposto1 = { data:'2026-09-05', oraInizio:'07:00', oraFine:'13:00', straordinarioPrimaInizio:'06:00', straordinarioPrimaFine:'08:00' };
  assert.equal(app.rilevaSovrapposizioneStraordinario(sovrapposto1), true);

  const corretto = { data:'2026-09-05', oraInizio:'07:00', oraFine:'13:00', straordinarioPrimaInizio:'05:00', straordinarioPrimaFine:'07:00' };
  assert.equal(app.rilevaSovrapposizioneStraordinario(corretto), false);

  const sovrapposto2 = { data:'2026-09-05', oraInizio:'07:00', oraFine:'13:00', straordinarioDopoInizio:'12:00', straordinarioDopoFine:'15:00' };
  assert.equal(app.rilevaSovrapposizioneStraordinario(sovrapposto2), true);

  const nessuno = { data:'2026-09-05', oraInizio:'07:00', oraFine:'13:00' };
  assert.equal(app.rilevaSovrapposizioneStraordinario(nessuno), false);
});

test('categoriaFiltroCalendario: "Lavorato sul riposo" non fa più ricadere il giorno in "Giorni liberi" — regressione', () => {
  const app = caricaApp();
  assert.equal(app.categoriaFiltroCalendario({ compensazioneRiposo: true }, null), 'extra');
  assert.equal(app.categoriaFiltroCalendario({ cambioTurno: true }, null), 'extra');
  assert.equal(app.categoriaFiltroCalendario({ recuperoFestivoLavorato: true }, null), 'extra');
  assert.equal(app.categoriaFiltroCalendario({}, null), 'vuoto', 'un giorno davvero senza dati deve restare "vuoto"');
});

test('formatOreMinuti: converte correttamente ore decimali in formato h:mm', () => {
  const app = caricaApp();
  assert.equal(app.formatOreMinuti(6), '6:00');
  assert.equal(app.formatOreMinuti(9), '9:00');
  assert.equal(app.formatOreMinuti(6.5), '6:30');
  assert.equal(app.formatOreMinuti(0), '0:00');
});
