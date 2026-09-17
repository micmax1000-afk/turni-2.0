'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { caricaApp } = require('./helpers/load-app.js');

function configuraTabelleDefault(app){
  app.AppState.tabelle = app.clonaTabelleConSoglie(app.TurniPSData.TABELLE_PREDEFINITE);
}

test('IRPEF: reddito sotto la no-tax area è zero', () => {
  const app = caricaApp();
  configuraTabelleDefault(app);
  assert.equal(app.calcolaIRPEFAnnua(5000), 0);
});

test('IRPEF: reddito nel primo scaglione (23%)', () => {
  const app = caricaApp();
  configuraTabelleDefault(app);
  // 20.000€ imponibile, no-tax area 8.500€ non è una "franchigia" applicata qui:
  // calcolaIRPEFAnnua calcola l'imposta sull'intero imponibile passato, per scaglioni.
  const imposta = app.calcolaIRPEFAnnua(20000);
  assert.equal(imposta, 20000 * 0.23);
});

test('IRPEF: reddito a cavallo tra 1° e 2° scaglione (28.000€)', () => {
  const app = caricaApp();
  configuraTabelleDefault(app);
  const imposta = app.calcolaIRPEFAnnua(45000);
  const atteso = 28000 * 0.23 + (45000 - 28000) * 0.33;
  assert.ok(Math.abs(imposta - atteso) < 0.01, `atteso ~${atteso}, ottenuto ${imposta}`);
});

test('IRPEF: reddito OLTRE i 50.000€ — regressione bug imposta negativa', () => {
  // Bug storico: ogni volta che le tabelle passano per JSON.stringify (caricamento, reset),
  // "fino: Infinity" dell'ultimo scaglione diventava "null". Math.min(reddito, null) valeva 0,
  // rendendo la quota dell'ultimo scaglione negativa e l'IRPEF totale negativa.
  const app = caricaApp();
  configuraTabelleDefault(app);
  const imposta = app.calcolaIRPEFAnnua(60000);
  const atteso = 28000 * 0.23 + (50000 - 28000) * 0.33 + (60000 - 50000) * 0.43;
  assert.ok(imposta > 0, `l'IRPEF su 60.000€ non deve mai essere negativa (ottenuto ${imposta})`);
  assert.ok(Math.abs(imposta - atteso) < 0.01, `atteso ~${atteso}, ottenuto ${imposta}`);
});

test('IRPEF: la soglia infinita resta Infinity anche dopo un "Ripristina tutto" (round-trip JSON)', () => {
  const app = caricaApp();
  // Simula esattamente cosa succede quando l'utente preme "Ripristina tutto" in Impostazioni → Tabelle.
  app.AppState.tabelle = app.clonaTabelleConSoglie(app.TurniPSData.TABELLE_PREDEFINITE);
  const ultimoScaglione = app.AppState.tabelle.irpefScaglioni[app.AppState.tabelle.irpefScaglioni.length - 1];
  assert.equal(ultimoScaglione.fino, Infinity);
});

test('IRPEF: la soglia infinita viene ripristinata anche da dati salvati in precedenza (corrotti da versioni più vecchie)', () => {
  const app = caricaApp();
  // Simula un utente che ha già usato l'app prima del fix: nel suo storage locale
  // l'ultimo "fino" è rimasto null da una sessione precedente.
  const salvatoCorrotto = {
    irpefScaglioni: [ { fino: 28000, aliquota: 23 }, { fino: 50000, aliquota: 33 }, { fino: null, aliquota: 43 } ]
  };
  app.localStorage.setItem(app.CHIAVE_TABELLE, JSON.stringify(salvatoCorrotto));
  app.AppState.tabelle = app.caricaTabelle();
  const ultimoScaglione = app.AppState.tabelle.irpefScaglioni[app.AppState.tabelle.irpefScaglioni.length - 1];
  assert.equal(ultimoScaglione.fino, Infinity);
  assert.ok(app.calcolaIRPEFAnnua(60000) > 0);
});
