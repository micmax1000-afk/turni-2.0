'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { caricaApp } = require('./helpers/load-app.js');

function configuraAssenze(app, assenze){
  app.AppState.assenze = assenze;
  app.AppState.turni = {};
}

test('contaGiorniUsatiAssenzaNelAnno: conta solo i giorni dell\'anno richiesto', () => {
  const app = caricaApp();
  configuraAssenze(app, [{ id: 'ferie1', nome: 'Congedo ordinario', valore: 32, unita: 'gg' }]);
  app.AppState.turni = {
    '2025-06-01': { data: '2025-06-01', assenzaTipo: 'ferie1' },
    '2026-06-01': { data: '2026-06-01', assenzaTipo: 'ferie1' },
    '2026-06-02': { data: '2026-06-02', assenzaTipo: 'ferie1' }
  };
  assert.equal(app.contaGiorniUsatiAssenzaNelAnno('ferie1', 2026), 2);
  assert.equal(app.contaGiorniUsatiAssenzaNelAnno('ferie1', 2025), 1);
});

test('calcolaSaldoCongedoOrdinario: nessun anno precedente con dati → nessun riporto', () => {
  const app = caricaApp();
  configuraAssenze(app, [{ id: 'ferie1', nome: 'Congedo ordinario', valore: 32, unita: 'gg' }]);
  app.AppState.turni = {
    '2026-06-01': { data: '2026-06-01', assenzaTipo: 'ferie1' }
  };
  const saldo = app.calcolaSaldoCongedoOrdinario(2026);
  assert.equal(saldo.riporto, 0);
  assert.equal(saldo.valoreEffettivo, 32);
  assert.equal(saldo.usate, 1);
});

test('calcolaSaldoCongedoOrdinario: le ferie non godute l\'anno prima si riportano sull\'anno successivo', () => {
  const app = caricaApp();
  configuraAssenze(app, [{ id: 'ferie1', nome: 'Congedo ordinario', valore: 30, unita: 'gg' }]);
  // Nel 2025 ne sono state usate solo 10 su 30 disponibili → 20 giorni di riporto sul 2026.
  const turni2025 = {};
  for(let g = 1; g <= 10; g++){
    turni2025[`2025-03-${String(g).padStart(2, '0')}`] = { data: `2025-03-${String(g).padStart(2, '0')}`, assenzaTipo: 'ferie1' };
  }
  app.AppState.turni = turni2025;
  const saldo = app.calcolaSaldoCongedoOrdinario(2026);
  assert.equal(saldo.riporto, 20, 'devono riportarsi le 20 ferie 2025 non godute');
  assert.equal(saldo.valoreEffettivo, 50, '30 dell\'anno corrente + 20 di riporto');
});

test('calcolaSaldoCongedoOrdinario: nessuna voce "Congedo ordinario" configurata → saldo azzerato senza errori', () => {
  const app = caricaApp();
  configuraAssenze(app, [{ id: 'malattia1', nome: 'Malattia', valore: 0, unita: 'gg' }]);
  const saldo = app.calcolaSaldoCongedoOrdinario(2026);
  // Nota: confrontiamo i singoli campi (non l'oggetto intero con deepEqual) perché l'oggetto
  // restituito appartiene alla sandbox vm, con un prototipo Object diverso da quello di questo
  // processo Node — deepStrictEqual fallirebbe per questo dettaglio tecnico anche a valori identici.
  assert.equal(saldo.valoreEffettivo, 0);
  assert.equal(saldo.usate, 0);
  assert.equal(saldo.riporto, 0);
});

test('calcolaOreCompensateAccumulate: somma solo le ore di straordinario convertite in riposo compensativo', () => {
  const app = caricaApp();
  app.AppState.turni = {
    '2026-03-01': { data: '2026-03-01', oraInizio: '07:00', oraFine: '13:00',
      straordinarioDopoInizio: '13:00', straordinarioDopoFine: '15:00', compensaStraordinario: true },
    '2026-03-02': { data: '2026-03-02', oraInizio: '07:00', oraFine: '13:00' } // nessuno straordinario
  };
  assert.equal(app.calcolaOreCompensateAccumulate(), 2);
});

test('calcolaOreDaRecuperareAnno: differenza fra permesso breve preso e già recuperato, mai negativa', () => {
  const app = caricaApp();
  app.AppState.turni = {
    '2026-03-01': { data: '2026-03-01', permessoBreveAttivo: true, permessoBreveOraInizio: '07:00', permessoBreveOraFine: '09:00' }, // 2h prese
    '2026-03-02': { data: '2026-03-02', recuperoPermessoBreveAttivo: true, recuperoPermessoBreveOraInizio: '07:00', recuperoPermessoBreveOraFine: '08:00' } // 1h recuperata
  };
  assert.equal(app.calcolaOreDaRecuperareAnno(2026), 1, 'restano 1h da recuperare (2 prese - 1 recuperata)');

  // Se si recupera più di quanto preso, il saldo non deve mai diventare negativo.
  app.AppState.turni['2026-03-03'] = { data: '2026-03-03', recuperoPermessoBreveAttivo: true, recuperoPermessoBreveOraInizio: '07:00', recuperoPermessoBreveOraFine: '10:00' }; // +3h
  assert.equal(app.calcolaOreDaRecuperareAnno(2026), 0, 'il saldo non può essere negativo anche se si è recuperato più del preso');
});

test('calcolaRiepilogoOreMese: ordine pubblico e servizio esterno selezionati insieme non accumulano due indennità — regressione', () => {
  const app = caricaApp();
  app.AppState.tabelle = app.clonaTabelleConSoglie(app.TurniPSData.TABELLE_PREDEFINITE);
  app.AppState.turni = {
    '2026-09-05': { data:'2026-09-05', oraInizio:'07:00', oraFine:'13:00', servizioEsterno:true, ordinePubblico:true, opSede:'dentro' }
  };
  const r = app.calcolaRiepilogoOreMese(2026, 8);
  assert.equal(r.turniServizioEsternoValidi, 0, 'con OP spuntato insieme, il servizio esterno non deve generare una seconda indennità');
  assert.ok(r.indennitaOPTotale > 0, 'l\'ordine pubblico deve comunque essere pagato');
  // I conteggi informativi (quante volte hai fatto ciascuna cosa) restano entrambi corretti.
  assert.equal(r.servizioEsterno, 1);
  assert.equal(r.ordinePubblico, 1);

  // Controllo di non-regressione: da solo, il servizio esterno continua a funzionare come prima.
  app.AppState.turni = { '2026-09-06': { data:'2026-09-06', oraInizio:'07:00', oraFine:'13:00', servizioEsterno:true } };
  const r2 = app.calcolaRiepilogoOreMese(2026, 8);
  assert.equal(r2.turniServizioEsternoValidi, 1);
});
