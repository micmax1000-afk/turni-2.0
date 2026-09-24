'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { caricaApp } = require('./helpers/load-app.js');

function configuraTabelleDefault(app){
  app.AppState.tabelle = app.clonaTabelleConSoglie(app.TurniPSData.TABELLE_PREDEFINITE);
}

test('Addizionale regionale: regione con aliquota unica (es. Sicilia)', () => {
  const app = caricaApp();
  configuraTabelleDefault(app);
  const aliquota = app.calcolaAliquotaAddizionaleRegionale('Sicilia', 30000);
  assert.equal(aliquota, 1.23);
});

test('Addizionale regionale: regione a scaglioni, primo scaglione (Lazio, reddito basso)', () => {
  const app = caricaApp();
  configuraTabelleDefault(app);
  const aliquota = app.calcolaAliquotaAddizionaleRegionale('Lazio', 10000);
  assert.equal(aliquota, 1.73);
});

test('Addizionale regionale: regione a scaglioni, ultimo scaglione (Lazio, reddito alto)', () => {
  const app = caricaApp();
  configuraTabelleDefault(app);
  const aliquota = app.calcolaAliquotaAddizionaleRegionale('Lazio', 90000);
  assert.equal(aliquota, 3.33);
});

test('Addizionale regionale: regione inesistente restituisce 0 invece di andare in errore', () => {
  const app = caricaApp();
  configuraTabelleDefault(app);
  const aliquota = app.calcolaAliquotaAddizionaleRegionale('Regione Inesistente', 30000);
  assert.equal(aliquota, 0);
});

test('Addizionale regionale: personalizzazione salvata dall\'utente viene rispettata', () => {
  // Verifica che, avendo reso la tabella modificabile da Impostazioni → Tabelle,
  // il valore effettivamente usato nel calcolo sia quello personalizzato e non il predefinito.
  const app = caricaApp();
  configuraTabelleDefault(app);
  app.AppState.tabelle.regioniAddizionale.Sicilia.valore = 2.5;
  const aliquota = app.calcolaAliquotaAddizionaleRegionale('Sicilia', 30000);
  assert.equal(aliquota, 2.5);
});
