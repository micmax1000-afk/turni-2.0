/* Turni & Accessorio PS — Tabelle economiche predefinite
 * Estratto senza modifiche dal motore originale.
 * I valori e i commenti normativi restano invariati.
 */
'use strict';

window.TurniPSData = window.TurniPSData || {};
window.TurniPSData.TABELLE_PREDEFINITE = {
  // Stipendi tabellari annui lordi (12 mensilità) — fonte: D.P.R. 24 marzo 2025, n. 53 (decreto EFFETTIVAMENTE
  // in vigore, recepimento accordi 2022-2024), Art. 2 comma 3, valori dal 1° gennaio 2024. Questo è il decreto
  // che si applica davvero oggi in busta paga — l'ipotesi di accordo 2025-2027 (firmata 15/07/2026) non è
  // ancora stata recepita in un decreto e quindi non è ancora legalmente in vigore.
  stipendiAnnuiAttuale: {
    'Agente': 20576.38, 'Agente Scelto': 21211.75, 'Assistente': 21896.00, 'Assistente Capo': 22775.75,
    'Assistente Capo Coordinatore': 23753.25,
    'Vice Sovrintendente': 22824.63, 'Sovrintendente': 23753.25, 'Sovrintendente Capo': 24290.88,
    'Sovrintendente Capo Coordinatore': 25610.50,
    'Vice Ispettore': 24584.13, 'Ispettore': 25610.50, 'Ispettore Capo': 26099.25,
    'Ispettore Superiore': 26881.25, 'Sostituto Commissario': 28054.25, 'Sostituto Commissario Coordinatore': 28934.00,
    'Vice Commissario': 26734.63, 'Commissario': 28934.00, 'Commissario Capo': 29422.75
  },
  // Tabella PROIETTATA dal 1° gennaio 2027, secondo l'ipotesi di accordo sindacale 2025-2027 firmata 15/07/2026 —
  // NON ancora ufficialmente in vigore: si applicherà solo dopo il recepimento in un decreto del Presidente
  // della Repubblica (come è successo per il D.P.R. 53/2025 sopra, con oltre un anno di ritardo dalla firma).
  // Usala per farti un'idea di cosa cambierà, non come valore certo per oggi.
  stipendiAnnui2027: {
    'Agente': 21840.43, 'Agente Scelto': 22514.84, 'Assistente': 23241.12, 'Assistente Capo': 24174.92,
    'Assistente Capo Coordinatore': 25212.47,
    'Vice Sovrintendente': 24226.79, 'Sovrintendente': 25212.47, 'Sovrintendente Capo': 25783.12,
    'Sovrintendente Capo Coordinatore': 27183.81,
    'Vice Ispettore': 25886.87, 'Ispettore': 27183.81, 'Ispettore Capo': 27702.59,
    'Ispettore Superiore': 28532.63, 'Sostituto Commissario': 29777.69, 'Sostituto Commissario Coordinatore': 30711.48,
    'Vice Commissario': 28376.99, 'Commissario': 30711.48, 'Commissario Capo': 31230.26
  },
  // Indennità pensionabile mensile lorda — fonte: stesso D.P.R. 53/2025, Art. 4, dal 1° gennaio 2024. In vigore oggi.
  indennitaPensionabileAnnuaAttuale: {
    'Agente': 608.39 * 12, 'Agente Scelto': 644.71 * 12, 'Assistente': 694.06 * 12, 'Assistente Capo': 758.49 * 12,
    'Assistente Capo Coordinatore': 758.49 * 12,
    'Vice Sovrintendente': 833.39 * 12, 'Sovrintendente': 837.31 * 12, 'Sovrintendente Capo': 887.23 * 12,
    'Sovrintendente Capo Coordinatore': 887.23 * 12,
    'Vice Ispettore': 863.42 * 12, 'Ispettore': 891.38 * 12, 'Ispettore Capo': 919.95 * 12,
    'Ispettore Superiore': 961.16 * 12, 'Sostituto Commissario': 972.48 * 12, 'Sostituto Commissario Coordinatore': 972.48 * 12,
    'Vice Commissario': 944.43 * 12, 'Commissario': 983.12 * 12, 'Commissario Capo': 993.29 * 12
  },
  // Proiettata dal 1° gennaio 2027 secondo l'ipotesi di accordo 2025-2027 — non ancora in vigore, vedi nota sopra.
  indennitaPensionabileAnnua2027: {
    'Agente': 648.56 * 12, 'Agente Scelto': 687.28 * 12, 'Assistente': 739.89 * 12, 'Assistente Capo': 808.57 * 12,
    'Assistente Capo Coordinatore': 808.57 * 12,
    'Vice Sovrintendente': 888.42 * 12, 'Sovrintendente': 892.60 * 12, 'Sovrintendente Capo': 945.81 * 12,
    'Sovrintendente Capo Coordinatore': 945.81 * 12,
    'Vice Ispettore': 920.43 * 12, 'Ispettore': 950.24 * 12, 'Ispettore Capo': 980.69 * 12,
    'Ispettore Superiore': 1024.63 * 12, 'Sostituto Commissario': 1036.69 * 12, 'Sostituto Commissario Coordinatore': 1036.69 * 12,
    'Vice Commissario': 1006.79 * 12, 'Commissario': 1048.04 * 12, 'Commissario Capo': 1058.88 * 12
  },
  // IIS: azzerata perché già inclusa (conglobata) nello stipendio tabellare del D.P.R. 53/2025 sopra —
  // sommarla di nuovo qui la conterebbe due volte. Confermato confrontando una busta paga reale:
  // Stipendio Tabellare (1.452,95) + IIS Conglobata (526,49) = esattamente il valore di stipendiAnnuiAttuale/12.
  iisMensile: 0,
  // Tariffe orarie straordinario EFFETTIVAMENTE in vigore — fonte: D.P.R. 24 marzo 2025, n. 53, Art. 6, dal 1/1/2024.
  straordinarioOrarioAttuale: {
    'Agente':                             { diurno: 12.03, notturnoOFestivo: 13.62, notturnoFestivo: 15.71 },
    'Agente Scelto':                      { diurno: 12.41, notturnoOFestivo: 14.04, notturnoFestivo: 16.20 },
    'Assistente':                         { diurno: 12.80, notturnoOFestivo: 14.49, notturnoFestivo: 16.71 },
    'Assistente Capo':                    { diurno: 13.32, notturnoOFestivo: 15.07, notturnoFestivo: 17.39 },
    'Assistente Capo Coordinatore':       { diurno: 13.89, notturnoOFestivo: 15.71, notturnoFestivo: 18.12 },
    'Vice Sovrintendente':                { diurno: 13.35, notturnoOFestivo: 15.10, notturnoFestivo: 17.42 },
    'Sovrintendente':                     { diurno: 13.89, notturnoOFestivo: 15.71, notturnoFestivo: 18.12 },
    'Sovrintendente Capo':                { diurno: 14.21, notturnoOFestivo: 16.07, notturnoFestivo: 18.54 },
    'Sovrintendente Capo Coordinatore':   { diurno: 14.97, notturnoOFestivo: 16.93, notturnoFestivo: 19.53 },
    'Vice Ispettore':                     { diurno: 14.26, notturnoOFestivo: 16.12, notturnoFestivo: 18.60 },
    'Ispettore':                          { diurno: 14.97, notturnoOFestivo: 16.93, notturnoFestivo: 19.53 },
    'Ispettore Capo':                     { diurno: 15.26, notturnoOFestivo: 17.26, notturnoFestivo: 19.91 },
    'Ispettore Superiore':                { diurno: 15.72, notturnoOFestivo: 17.78, notturnoFestivo: 20.51 },
    'Sostituto Commissario':              { diurno: 16.41, notturnoOFestivo: 18.56, notturnoFestivo: 21.41 },
    'Sostituto Commissario Coordinatore': { diurno: 16.91, notturnoOFestivo: 19.13, notturnoFestivo: 22.07 },
    'Vice Commissario':                   { diurno: 15.63, notturnoOFestivo: 17.68, notturnoFestivo: 20.40 },
    'Commissario':                        { diurno: 16.91, notturnoOFestivo: 19.13, notturnoFestivo: 22.07 },
    'Commissario Capo':                   { diurno: 17.21, notturnoOFestivo: 19.47, notturnoFestivo: 22.46 }
  },
  // Tariffe PROIETTATE dal 1° gennaio 2027, secondo l'ipotesi di accordo sindacale 2025-2027 firmata 15/07/2026 —
  // NON ancora ufficialmente in vigore (serve un decreto di recepimento, come il D.P.R. 53/2025 sopra).
  straordinarioOrario2027: {
    'Agente':                             { diurno: 12.77, notturnoOFestivo: 14.45, notturnoFestivo: 16.67 },
    'Agente Scelto':                      { diurno: 13.17, notturnoOFestivo: 14.90, notturnoFestivo: 17.19 },
    'Assistente':                         { diurno: 13.59, notturnoOFestivo: 15.37, notturnoFestivo: 17.73 },
    'Assistente Capo':                    { diurno: 14.13, notturnoOFestivo: 15.98, notturnoFestivo: 18.44 },
    'Assistente Capo Coordinatore':       { diurno: 14.74, notturnoOFestivo: 16.67, notturnoFestivo: 19.23 },
    'Vice Sovrintendente':                { diurno: 14.17, notturnoOFestivo: 16.03, notturnoFestivo: 18.50 },
    'Sovrintendente':                     { diurno: 14.74, notturnoOFestivo: 16.67, notturnoFestivo: 19.23 },
    'Sovrintendente Capo':                { diurno: 15.07, notturnoOFestivo: 17.05, notturnoFestivo: 19.67 },
    'Sovrintendente Capo Coordinatore':   { diurno: 15.89, notturnoOFestivo: 17.97, notturnoFestivo: 20.73 },
    'Vice Ispettore':                     { diurno: 15.13, notturnoOFestivo: 17.11, notturnoFestivo: 19.74 },
    'Ispettore':                          { diurno: 15.89, notturnoOFestivo: 17.97, notturnoFestivo: 20.73 },
    'Ispettore Capo':                     { diurno: 16.20, notturnoOFestivo: 18.32, notturnoFestivo: 21.14 },
    'Ispettore Superiore':                { diurno: 16.68, notturnoOFestivo: 18.87, notturnoFestivo: 21.77 },
    'Sostituto Commissario':              { diurno: 17.41, notturnoOFestivo: 19.69, notturnoFestivo: 22.71 },
    'Sostituto Commissario Coordinatore': { diurno: 17.95, notturnoOFestivo: 20.30, notturnoFestivo: 23.42 },
    'Vice Commissario':                   { diurno: 16.59, notturnoOFestivo: 18.76, notturnoFestivo: 21.65 },
    'Commissario':                        { diurno: 17.95, notturnoOFestivo: 20.30, notturnoFestivo: 23.42 },
    'Commissario Capo':                   { diurno: 18.26, notturnoOFestivo: 20.65, notturnoFestivo: 23.82 }
  },
  // Assegno di funzione — differenziato per ruolo (prima era uguale per tutti)
  // fonte: screenshot condiviso dall'utente (calcolatore stipendi online); funzionari non confermati, valore precedente lasciato come indicativo
  assegnoFunzioneAnnuo: {
    truppa: { soglia17: 1448.40, soglia27: 2949.83, soglia32: 3392.30 }, // Agenti e Assistenti
    sovr:   { soglia17: 1800.20, soglia27: 3018.20, soglia32: 3470.98 }, // Sovrintendenti
    isp:    { soglia17: 1829.40, soglia27: 3070.50, soglia32: 3531.03 }, // Ispettori
    funz:   { soglia17: 900,     soglia27: 1800,     soglia32: 3531 }   // Commissari/Funzionari — non confermato, da verificare
  },
  // Indennità presenza notturna e festiva — aggiornate al valore confermato da una busta paga reale
  // (marzo 2026): notturno 4,30€/h, festivo 14,00€/turno. Il valore precedente (SIULP, 4,10/12,00) era
  // probabilmente non aggiornato all'ultimo adeguamento.
  indennitaTurnoNotturnoOraria: 4.30,
  indennitaPresenzaFestivaTurno: 14.00,
  // Presenza festività particolari — fonte: SIULP (https://siulp.it/i-tuoi-diritti/trattamento-economico-accessorio/7/#otto)
  // aggiuntiva rispetto alla presenza festiva generica; spetta per le festività fisse
  // (1/1, 6/1, Lunedì dell'Angelo, 25/4, 1/5, 2/6, 15/8, 1/11, 8/12, 25/12, 26/12), non per le domeniche semplici
  indennitaFestivitaParticolareGiorno: 40.00,
  // Compensazione riposo lavorato — fonte: art.16 c.3 D.P.R. 164/2002, rivalutata dal D.P.R. 57/2022 a 12,00€
  // (indicazione dell'utente, più precisa della stima SIULP usata prima, che era 5,00€)
  // spetta se richiamati in servizio nel giorno di riposo settimanale o in un festivo infrasettimanale
  indennitaCompensazioneRiposoLavorato: 12.00,
  // Cambio turno — fonte: accordo FESI 2025 (SIULP, in pagamento da luglio 2026, aggiornato annualmente per accordo sindacale)
  // il compenso di 610€/anno per il personale dei reparti mobili non è modellato (caso troppo specifico)
  indennitaCambioTurno: 10.00,
  // Produttività collettiva (ex "indennità di valorizzazione funzioni di polizia") — fonte: accordo FESI 2025.
  // Importo per giorno di effettiva presenza in servizio; a differenza delle altre voci FESI qui sopra,
  // questo compenso può variare parecchio da un accordo annuale all'altro: verifica sempre sul cedolino reale.
  indennitaProduttivitaCollettiva: 6.63,
  // Indennità servizi esterni — fonte: SIULP (https://siulp.it/i-tuoi-diritti/trattamento-economico-accessorio/4/#cinque)
  // spetta per turno di durata non inferiore a 3 ore continuative
  indennitaServizioEsternoTurno: 6.00,
  // Ordine pubblico — fonte: SIULP (https://siulp.it/i-tuoi-diritti/trattamento-economico-accessorio/5/#sei)
  // spetta per turno di almeno 4 ore; fuori sede senza pernottamento ridotta del 30%
  indennitaOPInSede: 13.00,
  indennitaOPFuoriSede: 26.00,
  riduzioneOPSenzaPernottamento: 30,
  indennitaControlloTerritorioSeraleFlat: 5.00,
  indennitaControlloTerritorioNotturnoFlat: 10.00,
  reperibilitaGiornaliera: 17.50, // fonte: SIULP (https://siulp.it/i-tuoi-diritti/trattamento-economico-accessorio/11/#dodici)
  // Trattamento di missione — fonte: SIULP (https://siulp.it/i-tuoi-diritti/trattamento-economico-accessorio/2/#tre)
  // indennità oraria di trasferta: piena 4-8h, ridotta al 40% oltre le 8h; nessuna indennità fino a 4h
  indennitaTrasfertaOraria: 0.86,
  indennitaTrasfertaOrariaRidotta: 0.344,
  sindacatoMensile: 8.50,
  aliquotaPrevidenziale: 9.19,
  irpefScaglioni: [ { fino: 28000, aliquota: 23 }, { fino: 50000, aliquota: 33 }, { fino: Infinity, aliquota: 43 } ],
  noTaxAreaAnnua: 8500,
  detrazioneLavoroMensile: 95.00,
  detrazioneConiugeACaricoAnnua: 690.00,
  detrazionePerFiglioOver21Annua: 950.00,
  trattamentoIntegrativoMensile: 100.00,
  sogliaTrattamentoIntegrativoAnnua: 28000,
  sogliaDetassazioneAccessoriAnnua: 800,
  aliquotaDetassazioneAccessori: 15,
  buonoPastoValore: 7.00,
  // Addizionale regionale IRPEF 2026 — aliquote per regione (fonte: delibere regionali).
  // Spostata qui da js/calendar.js per renderla modificabile da Impostazioni → Tabelle ufficiali.
  regioniAddizionale: {
    "Abruzzo": { tipo:'scaglioni', scaglioni:[{fino:28000.0, aliquota:1.67}, {fino:50000.0, aliquota:2.87}, {fino:Infinity, aliquota:3.33}] },
    "Basilicata": { tipo:'unica', valore:1.23 },
    "Calabria": { tipo:'unica', valore:1.73 },
    "Campania": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.73}, {fino:28000.0, aliquota:2.96}, {fino:50000.0, aliquota:3.2}, {fino:Infinity, aliquota:3.33}] },
    "Emilia-Romagna": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.33}, {fino:28000.0, aliquota:1.93}, {fino:50000.0, aliquota:2.78}, {fino:Infinity, aliquota:3.33}] },
    "Friuli Venezia Giulia": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:0.7}, {fino:28000.0, aliquota:1.23}, {fino:50000.0, aliquota:1.23}, {fino:Infinity, aliquota:1.23}] },
    "Lazio": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.73}, {fino:28000.0, aliquota:3.33}, {fino:50000.0, aliquota:3.33}, {fino:Infinity, aliquota:3.33}] },
    "Liguria": { tipo:'scaglioni', scaglioni:[{fino:28000.0, aliquota:1.23}, {fino:50000.0, aliquota:3.18}, {fino:Infinity, aliquota:3.23}] },
    "Lombardia": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.23}, {fino:28000.0, aliquota:1.58}, {fino:50000.0, aliquota:1.72}, {fino:Infinity, aliquota:1.73}] },
    "Marche": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.23}, {fino:28000.0, aliquota:1.53}, {fino:50000.0, aliquota:1.7}, {fino:Infinity, aliquota:1.73}] },
    "Molise": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.73}, {fino:28000.0, aliquota:1.93}, {fino:50000.0, aliquota:3.33}, {fino:Infinity, aliquota:3.33}] },
    "Piemonte": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.62}, {fino:28000.0, aliquota:2.68}, {fino:50000.0, aliquota:3.31}, {fino:Infinity, aliquota:3.33}] },
    "Provincia di Bolzano": { tipo:'scaglioni', scaglioni:[{fino:28000.0, aliquota:1.23}, {fino:50000.0, aliquota:1.23}, {fino:Infinity, aliquota:1.73}] },
    "Provincia di Trento": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.23}, {fino:28000.0, aliquota:1.23}, {fino:50000.0, aliquota:1.23}, {fino:Infinity, aliquota:1.73}] },
    "Puglia": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.33}, {fino:28000.0, aliquota:1.43}, {fino:50000.0, aliquota:1.63}, {fino:Infinity, aliquota:1.85}] },
    "Sardegna": { tipo:'unica', valore:1.23 },
    "Sicilia": { tipo:'unica', valore:1.23 },
    "Toscana": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.42}, {fino:28000.0, aliquota:1.43}, {fino:50000.0, aliquota:3.32}, {fino:Infinity, aliquota:3.33}] },
    "Umbria": { tipo:'scaglioni', scaglioni:[{fino:15000.0, aliquota:1.73}, {fino:28000.0, aliquota:3.02}, {fino:50000.0, aliquota:3.12}, {fino:Infinity, aliquota:3.33}] },
    "Valle d'Aosta": { tipo:'unica', valore:1.23 },
    "Veneto": { tipo:'unica', valore:1.23 }
  }
};
