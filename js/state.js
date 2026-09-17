/* Turni & Accessorio PS — Stato applicativo (Fase 1)
 * Unico contenitore per i dati persistenti caricati dall'app.
 * Le proprietà restano mutabili per mantenere compatibilità con la logica esistente.
 */
'use strict';

window.AppState = window.AppState || {
  anagrafica: null,
  turni: {},
  tabelle: {},
  conguagliPerMese: {},
  storico: {},
  assenze: [],
  indennitaPersonalizzate: [],
  noteGiorni: {},
  sequenzaTurni: [],
  coloriTurni: {}
};

window.AppStateMeta = Object.freeze({
  schemaVersion: 2
});
