'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { caricaApp } = require('./helpers/load-app.js');

test('aggiornaAvvisiApp: con anagrafica pronta ma nessun turno mai inserito, propone l\'azione "Genera turni"', () => {
  const app = caricaApp();
  app.AppState.anagrafica = { qualifica: 'Assistente Capo' };
  app.AppState.turni = {};
  app.AppState.assenze = [];
  const avvisi = app.aggiornaAvvisiApp();
  const invito = avvisi.find(a => a.azione);
  assert.ok(invito, 'deve essere presente un avviso con pulsante d\'azione');
  assert.equal(typeof invito.azione.onClick, 'function');
  assert.match(invito.azione.label, /Genera turni/);
});

test('aggiornaAvvisiApp: senza anagrafica, non propone l\'azione "Genera turni" (prima serve l\'anagrafica)', () => {
  const app = caricaApp();
  app.AppState.anagrafica = null;
  app.AppState.turni = {};
  app.AppState.assenze = [];
  const avvisi = app.aggiornaAvvisiApp();
  const invito = avvisi.find(a => a.azione);
  assert.equal(invito, undefined, 'senza anagrafica non deve proporre di generare turni');
});

test('aggiornaAvvisiApp: con turni già presenti in mesi passati ma nessuno questo mese, torna al messaggio informativo semplice (utente già attivo)', () => {
  const app = caricaApp();
  app.AppState.anagrafica = { qualifica: 'Assistente Capo' };
  app.AppState.turni = { '2020-01-01': { data: '2020-01-01', oraInizio: '07:00', oraFine: '13:00' } };
  app.AppState.assenze = [];
  const avvisi = app.aggiornaAvvisiApp();
  const invito = avvisi.find(a => a.azione);
  assert.equal(invito, undefined, 'un utente che ha già usato l\'app non deve vedere il messaggio di primo avvio');
  const infoSemplice = avvisi.find(a => /Nessun turno registrato nel mese corrente/.test(a.testo));
  assert.ok(infoSemplice, 'deve comunque comparire il normale avviso di mese vuoto');
});

test('aggiornaAvvisiApp: con turni già presenti nel mese corrente, nessun avviso sui turni mancanti', () => {
  const app = caricaApp();
  const oggi = app.dataISO(new Date());
  app.AppState.anagrafica = { qualifica: 'Assistente Capo' };
  app.AppState.turni = { [oggi]: { data: oggi, oraInizio: '07:00', oraFine: '13:00' } };
  app.AppState.assenze = [];
  const avvisi = app.aggiornaAvvisiApp();
  assert.equal(avvisi.find(a => a.azione), undefined);
  assert.equal(avvisi.find(a => /Nessun turno registrato/.test(a.testo)), undefined);
});
