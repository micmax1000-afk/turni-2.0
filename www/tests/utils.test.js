'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { caricaApp } = require('./helpers/load-app.js');

test('round2: arrotonda correttamente a 2 decimali', () => {
  const app = caricaApp();
  assert.equal(app.round2(1.004), 1);
  assert.equal(app.round2(6), 6);
  assert.equal(app.round2(6.129), 6.13);
});

test('dataISO: formatta una data in AAAA-MM-GG con zero-padding', () => {
  const app = caricaApp();
  assert.equal(app.dataISO(new Date(2026, 0, 5)), '2026-01-05'); // gennaio = mese 0
  assert.equal(app.dataISO(new Date(2026, 11, 31)), '2026-12-31');
});

test('ripristinaSoglieInfinite: converte i "fino: null" annidati in Infinity, a qualsiasi profondità', () => {
  const app = caricaApp();
  const oggetto = {
    irpefScaglioni: [{ fino: 28000, aliquota: 23 }, { fino: null, aliquota: 43 }],
    regioniAddizionale: {
      Lazio: { tipo: 'scaglioni', scaglioni: [{ fino: 15000, aliquota: 1 }, { fino: null, aliquota: 3 }] }
    }
  };
  app.ripristinaSoglieInfinite(oggetto);
  assert.equal(oggetto.irpefScaglioni[1].fino, Infinity);
  assert.equal(oggetto.regioniAddizionale.Lazio.scaglioni[1].fino, Infinity);
  // Non deve toccare valori "fino" legittimamente numerici.
  assert.equal(oggetto.irpefScaglioni[0].fino, 28000);
});

test('clonaTabelleConSoglie: produce una copia indipendente (non condivide riferimenti con la fonte)', () => {
  const app = caricaApp();
  const fonte = { irpefScaglioni: [{ fino: 28000, aliquota: 23 }, { fino: Infinity, aliquota: 43 }] };
  const clone = app.clonaTabelleConSoglie(fonte);
  clone.irpefScaglioni[0].aliquota = 999;
  assert.equal(fonte.irpefScaglioni[0].aliquota, 23, 'la fonte originale non deve essere modificata dal clone');
  assert.equal(clone.irpefScaglioni[1].fino, Infinity, 'la soglia infinita deve sopravvivere al clone');
});

test('euro: formatta un numero con virgola decimale italiana e simbolo €', () => {
  const app = caricaApp();
  // Il separatore delle migliaia dipende dai dati ICU del motore JS in uso (può variare fra
  // Node, Chrome desktop e la WebView Android): qui verifichiamo solo la parte stabile e
  // rilevante per l'app — due decimali, virgola come separatore decimale, simbolo euro.
  const risultato = app.euro(1234.5);
  assert.match(risultato, /1\.?234,50\s?€/);
  assert.equal(app.euro(0), '0,00 €');
  assert.match(app.euro(NaN), /0,00\s?€/, 'un valore non numerico non deve mai propagare NaN nell\'interfaccia');
});
