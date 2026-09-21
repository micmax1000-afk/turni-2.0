/* Turni & Accessorio PS — Configurazione persistente (Fase 1)
 * Mantiene in un solo punto le chiavi localStorage già utilizzate dall'app.
 * Non modificare i valori senza una migrazione: fanno parte del formato dati.
 */
'use strict';

window.TurniPSConfig = Object.freeze({
  keys: Object.freeze({
    CHIAVE_ANAGRAFICA: 'simCedolino_anagrafica_v1',
    CHIAVE_TURNI: 'simCedolino_turni_v1',
    CHIAVE_TABELLE: 'simCedolino_tabelle_v1',
    CHIAVE_CONGUAGLI: 'simCedolino_conguagli_v1',
    CHIAVE_STORICO: 'simCedolino_storico_v1',
    CHIAVE_ASSENZE: 'simCedolino_assenze_v1',
    CHIAVE_SEQUENZA: 'simCedolino_sequenza_v1',
    CHIAVE_NOTE_GIORNI: 'simCedolino_noteGiorni_v1',
    CHIAVE_SEQUENZA_ANCORA: 'simCedolino_sequenzaAncora_v1',
    CHIAVE_SEQUENZA_ULTIMO_GIORNO: 'simCedolino_sequenzaUltimoGiorno_v1',
    CHIAVE_ULTIMO_BACKUP: 'simCedolino_ultimoBackup_v1',
    CHIAVE_ASPETTATIVA_MIGRATA: 'simCedolino_aspettativaMigrata_v1',
    CHIAVE_DISCLAIMER_MOSTRATO: 'simCedolino_disclaimerMostrato_v1',
    CHIAVE_COLORI_TURNI: 'simCedolino_coloriTurni_v1',
    CHIAVE_REPORT_BLOCCHI: 'simCedolino_reportBlocchi_v1',
    CHIAVE_ULTIMO_MODELLO_USATO: 'simCedolino_ultimoModelloUsato_v1',
    CHIAVE_MODELLI_TURNO: 'simCedolino_modelliTurno_v1',
    CHIAVE_PATTERN_TURNI: 'simCedolino_patternTurni_v1',
    CHIAVE_EVENTI_GIORNO: 'simCedolino_eventiGiorno_v1',
    CHIAVE_INDENNITA_PERSONALIZZATE: 'simCedolino_indennitaPersonalizzate_v1'
  })
});

// Alias globali per compatibilità moduli classic
Object.assign(window, window.TurniPSConfig.keys);

// Google Drive: inserire qui il Client ID OAuth 2.0 dell'app web configurato in Google Cloud.
window.GOOGLE_CLIENT_ID = 'INSERISCI-QUI-IL-TUO-CLIENT-ID.apps.googleusercontent.com';
