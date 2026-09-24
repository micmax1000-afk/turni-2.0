# Test automatici

Verificano le funzioni di calcolo più delicate dell'app (IRPEF, addizionale regionale,
ore turno/straordinario) usando i **file sorgente reali** dell'app, non copie riscritte
a mano — così un bug nel codice vero si vede anche nei test.

## Come eseguirli

Richiede Node.js (18 o superiore, incluso il runner di test integrato). Dalla cartella
principale del progetto:

```
node --test "tests/*.test.js"
```

(Nota: `node --test tests/` senza il pattern esplicito non funziona in tutte le versioni
di Node — usare sempre la forma con `*.test.js` sopra.)

## Cosa coprono

- `irpef.test.js` — calcolo IRPEF nazionale, incluso il regression test sul bug
  dell'imposta negativa oltre i 50.000€ (risolto).
- `addizionale-regionale.test.js` — aliquote regionali, comprese le personalizzazioni utente.
- `turno.test.js` — ore ordinarie/straordinario/totale giorno, incluso il regression test
  sul doppio conteggio dello straordinario (risolto).
- `utils.test.js` — funzioni di utilità condivise (arrotondamenti, date, formattazione).
- `cedolino.test.js` — calcolo competenze mensili, assegno di funzione, tredicesima,
  produttività collettiva, generazione cedolino completo (lordo/netto), incluso uno
  "stress test" con straordinario intenso per verificare che l'IRPEF non vada mai in negativo.
- `assenze.test.js` — saldo ferie con riporto dall'anno precedente, ore di permesso
  breve da recuperare, ore compensate da straordinario convertito in riposo.
- `onboarding.test.js` — avviso di primo avvio ("Genera turni"): compare solo con
  anagrafica già impostata e nessun turno mai inserito, sparisce per gli utenti già attivi.

## Quando aggiornarli

Se si modifica una delle funzioni di calcolo in `js/calendar.js`, `js/payroll.js` o
`js/utils.js`, rieseguire questi test prima di pubblicare per accorgersi subito di eventuali
regressioni, invece di scoprirle da uno screenshot dell'utente.
