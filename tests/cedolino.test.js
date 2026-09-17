'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { caricaApp } = require('./helpers/load-app.js');

function configuraAppBase(app, overrideAnagrafica){
  app.AppState.tabelle = app.clonaTabelleConSoglie(app.TurniPSData.TABELLE_PREDEFINITE);
  app.AppState.anagrafica = Object.assign({
    qualifica: 'Assistente Capo',
    anni: 10,
    regione: 'Lazio',
    coniugeACarico: 'no',
    figliOver21: 0,
    sindacato: false,
    addComunale: 0
  }, overrideAnagrafica || {});
  app.AppState.turni = {};
  app.AppState.conguagliPerMese = {};
}

/** Popola un mese intero con un turno di lavoro semplice ripetuto tutti i giorni (nessuna assenza/riposo). */
function popolaMeseConTurnoSemplice(app, anno, mese, oraInizio, oraFine){
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  for(let g = 1; g <= giorniNelMese; g++){
    const iso = app.dataISO(new Date(anno, mese, g));
    app.AppState.turni[iso] = { data: iso, oraInizio, oraFine };
  }
}

test('calcolaAssegnoFunzioneMensile: zero se gli anni di servizio non raggiungono la prima soglia (17)', () => {
  const app = caricaApp();
  configuraAppBase(app, { anni: 10 });
  assert.equal(app.calcolaAssegnoFunzioneMensile(), 0);
});

test('calcolaAssegnoFunzioneMensile: automatico al superamento della soglia di anni, senza bisogno di attivarlo manualmente (ruolo truppa)', () => {
  const app = caricaApp();
  configuraAppBase(app, { anni: 10 });
  assert.equal(app.calcolaAssegnoFunzioneMensile(), 0, '10 anni non raggiunge nessuna soglia (minima 17)');

  configuraAppBase(app, { anni: 20 });
  assert.equal(app.calcolaAssegnoFunzioneMensile(), app.round2(1448.40 / 12));

  configuraAppBase(app, { anni: 30 });
  assert.equal(app.calcolaAssegnoFunzioneMensile(), app.round2(2949.83 / 12));

  configuraAppBase(app, { anni: 35 });
  assert.equal(app.calcolaAssegnoFunzioneMensile(), app.round2(3392.30 / 12));
});

test('calcolaProduttivitaCollettivaAnnua: zero se non ci sono giorni di presenza effettiva nell\'anno', () => {
  const app = caricaApp();
  configuraAppBase(app);
  assert.equal(app.calcolaProduttivitaCollettivaAnnua(2025), 0);
});

test('calcolaCompetenze: le voci fisse e accessorie sommano correttamente al totale lordo', () => {
  const app = caricaApp();
  configuraAppBase(app);
  popolaMeseConTurnoSemplice(app, 2026, 2, '07:00', '13:00'); // marzo 2026, turni mattina, nessun extra

  const comp = app.calcolaCompetenze(2026, 2); // mese indice 2 = marzo, niente tredicesima/produttività
  const sommaFisse = app.round2(Object.values(comp.fisse).reduce((a, b) => a + b, 0));
  const sommaAccessorie = app.round2(Object.values(comp.accessorie).reduce((a, b) => a + b, 0));

  assert.equal(comp.totaleFisse, sommaFisse);
  assert.equal(comp.totaleAccessorie, sommaAccessorie);
  assert.equal(comp.totaleLordo, app.round2(comp.totaleFisse + comp.totaleAccessorie));
  assert.ok(comp.totaleLordo > 0, 'con turni ordinari lavorati il lordo deve essere positivo');
});

test('calcolaCompetenze: la tredicesima compare SOLO nel cedolino di dicembre', () => {
  const app = caricaApp();
  configuraAppBase(app);
  popolaMeseConTurnoSemplice(app, 2026, 2, '07:00', '13:00');  // marzo
  popolaMeseConTurnoSemplice(app, 2026, 11, '07:00', '13:00'); // dicembre

  const marzo = app.calcolaCompetenze(2026, 2);
  const dicembre = app.calcolaCompetenze(2026, 11);

  assert.equal(marzo.fisse.tredicesima, undefined, 'a marzo non deve comparire la voce tredicesima');
  assert.ok(dicembre.fisse.tredicesima > 0, 'a dicembre la tredicesima deve essere presente e positiva');
  assert.equal(dicembre.fisse.tredicesima, app.round2(dicembre.fisse.stipendioTabellare + dicembre.fisse.iis));
});

test('calcolaCompetenze: la produttività collettiva compare SOLO nel cedolino di luglio, calcolata sull\'anno precedente', () => {
  const app = caricaApp();
  configuraAppBase(app);
  popolaMeseConTurnoSemplice(app, 2025, 5, '07:00', '13:00'); // giugno 2025: presenza nell'anno di riferimento (2025)
  popolaMeseConTurnoSemplice(app, 2026, 6, '07:00', '13:00'); // luglio 2026: mese in cui viene liquidata

  const luglio = app.calcolaCompetenze(2026, 6);
  const giugno = app.calcolaCompetenze(2026, 5);

  assert.ok(luglio.accessorie.indProduttivitaCollettiva > 0, 'a luglio, con presenze nel 2025, la produttività deve essere > 0');
  assert.equal(giugno.accessorie.indProduttivitaCollettiva, 0, 'negli altri mesi la produttività collettiva deve essere zero');
});

test('generaCedolino: trattenuta sindacale attiva solo con iscrizione "si", zero con "no", retrocompatibile con vecchio testo libero', () => {
  // Regressione: il campo era un tempo testo libero (es. "SIULP"). Passando a un selettore Sì/No,
  // un controllo troppo rigido (=== 'si') avrebbe potuto trattare 'no' come stringa "truthy" e
  // detrarre comunque la quota, oppure perdere il dato di chi aveva già scritto un nome sindacale.
  const app = caricaApp();
  configuraAppBase(app, { sindacato: 'no' });
  popolaMeseConTurnoSemplice(app, 2026, 2, '07:00', '13:00');
  assert.equal(app.generaCedolino(2026, 2).sindacato, 0);

  app.AppState.anagrafica.sindacato = 'si';
  assert.equal(app.generaCedolino(2026, 2).sindacato, app.AppState.tabelle.sindacatoMensile);

  app.AppState.anagrafica.sindacato = 'SIULP'; // vecchio dato testuale pre-esistente
  assert.equal(app.generaCedolino(2026, 2).sindacato, app.AppState.tabelle.sindacatoMensile, 'un vecchio nome sindacale salvato deve continuare a contare come iscritto');
});

test('calcolaCompetenze: indennità personalizzata fissa al mese si somma al lordo (es. Vacanza contrattuale)', () => {
  const app = caricaApp();
  configuraAppBase(app);
  popolaMeseConTurnoSemplice(app, 2026, 2, '07:00', '13:00');
  app.AppState.indennitaPersonalizzate = [
    { id: 'x1', nome: 'Vacanza contrattuale', valore: 25, unita: 'mese' }
  ];
  const senzaExtra = (() => {
    app.AppState.indennitaPersonalizzate = [];
    return app.calcolaCompetenze(2026, 2).totaleLordo;
  })();
  app.AppState.indennitaPersonalizzate = [{ id: 'x1', nome: 'Vacanza contrattuale', valore: 25, unita: 'mese' }];
  const conExtra = app.calcolaCompetenze(2026, 2);
  assert.equal(conExtra.totaleLordo, app.round2(senzaExtra + 25));
  assert.equal(conExtra.personalizzate.length, 1);
  assert.equal(conExtra.personalizzate[0].nome, 'Vacanza contrattuale');
  assert.equal(conExtra.personalizzate[0].importo, 25);
});

test('calcolaCompetenze: indennità personalizzata "per turno lavorato" si moltiplica per i giorni di presenza effettiva', () => {
  const app = caricaApp();
  configuraAppBase(app);
  // Marzo 2026 ha 31 giorni: turno tutti i giorni => 31 giorni di presenza effettiva.
  popolaMeseConTurnoSemplice(app, 2026, 2, '07:00', '13:00');
  app.AppState.indennitaPersonalizzate = [{ id: 'x2', nome: 'Extra turno', valore: 2, unita: 'turno' }];
  const comp = app.calcolaCompetenze(2026, 2);
  assert.equal(comp.personalizzate[0].importo, app.round2(2 * 31));
});

test('calcolaCompetenze: nessuna indennità personalizzata configurata non altera il calcolo esistente', () => {
  const app = caricaApp();
  configuraAppBase(app);
  popolaMeseConTurnoSemplice(app, 2026, 2, '07:00', '13:00');
  app.AppState.indennitaPersonalizzate = [];
  const comp = app.calcolaCompetenze(2026, 2);
  assert.deepEqual(comp.personalizzate, []);
});

test('generaCedolino: il netto è sempre inferiore al lordo quando ci sono trattenute', () => {  const app = caricaApp();
  configuraAppBase(app);
  popolaMeseConTurnoSemplice(app, 2026, 2, '07:00', '13:00');
  const c = app.generaCedolino(2026, 2);
  assert.ok(c.netto < c.comp.totaleLordo, 'il netto deve essere inferiore al lordo (contributi + IRPEF)');
  assert.ok(c.netto > 0, 'il netto non deve mai essere negativo in uno scenario di stipendio normale');
});

test('generaCedolino: reddito elevato (molto straordinario) non produce mai un netto assurdo — regressione bug IRPEF', () => {
  // Scenario "stress test": turni con straordinario tutti i giorni per un anno intero, per spingere
  // il reddito annuo stimato ben oltre i 50.000€ e verificare che l'IRPEF (quindi il netto) resti sensata.
  const app = caricaApp();
  configuraAppBase(app, { qualifica: 'Commissario Capo', anni: 30 });
  const giorniNelMese = new Date(2026, 2 + 1, 0).getDate();
  for(let g = 1; g <= giorniNelMese; g++){
    const iso = app.dataISO(new Date(2026, 2, g));
    app.AppState.turni[iso] = {
      data: iso, oraInizio: '07:00', oraFine: '19:00', // 12h
      straordinarioDopoInizio: '19:00', straordinarioDopoFine: '23:00' // +4h straordinario
    };
  }
  const c = app.generaCedolino(2026, 2);
  assert.ok(c.irpefTotale > 0, 'l\'IRPEF non deve mai essere negativa, nemmeno con redditi molto alti');
  assert.ok(c.netto > 0 && c.netto < c.comp.totaleLordo, `netto (${c.netto}) deve restare fra 0 e il lordo (${c.comp.totaleLordo})`);
});
