/* FASE 1 — modulo estratto dal precedente script.js. */

function calcolaAliquotaAddizionaleRegionale(regione, redditoAnnuo){
  const tabellaRegioni = (AppState.tabelle && AppState.tabelle.regioniAddizionale)
    || (window.TurniPSData && window.TurniPSData.TABELLE_PREDEFINITE && window.TurniPSData.TABELLE_PREDEFINITE.regioniAddizionale)
    || {};
  const dati = tabellaRegioni[regione];
  if(!dati) return 0;
  if(dati.tipo === 'unica') return dati.valore;
  for(const scaglione of dati.scaglioni){
    if(redditoAnnuo <= scaglione.fino) return scaglione.aliquota;
  }
  return dati.scaglioni[dati.scaglioni.length - 1].aliquota;
}

function calcolaPasqua(anno){
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno);
}

function festivitaFisse(anno){
  return [
    `${anno}-01-01`, `${anno}-01-06`, `${anno}-04-25`, `${anno}-05-01`,
    `${anno}-06-02`, `${anno}-08-15`, `${anno}-11-01`, `${anno}-12-08`,
    `${anno}-12-25`, `${anno}-12-26`
  ];
}

// Buoni pasto di un giorno: di solito 1, a volte 2 (si sceglie in "Modifica il giorno").
// Solo il numero: l'app non calcola più un importo in euro.
function numeroBuoniPasto(t){
  return t && t.buonoPasto ? (Number(t.buoniPastoGiorno) === 2 ? 2 : 1) : 0;
}

function siglaAssenza(nome){
  if(SIGLE_ASSENZE[nome]) return SIGLE_ASSENZE[nome];
  return nome.split(/\s+/).map(p => p[0]).join('').substring(0, 4).toUpperCase() + '.';
}

function categoriaTurno(oraInizio, oraFine, dataStr){
  const [hi, mi] = oraInizio.split(':').map(Number);
  const [hf, mf] = oraFine.split(':').map(Number);
  let inizio = new Date(dataStr + 'T00:00:00'); inizio.setHours(hi, mi, 0, 0);
  let fine = new Date(dataStr + 'T00:00:00'); fine.setHours(hf, mf, 0, 0);
  if(fine <= inizio) fine.setDate(fine.getDate() + 1);

  const minuti = { mattina:0, pomeriggio:0, sera:0, notte:0 };
  // A blocchi di un'ora come in classificaFinestra: stesso risultato, molti meno passaggi.
  let t = inizio.getTime();
  const fineMs = fine.getTime();
  while(t < fineMs){
    const cursore = new Date(t);
    const passo = Math.max(1, Math.min(60 - cursore.getMinutes(), Math.ceil((fineMs - t) / 60000)));
    const h = cursore.getHours();
    if(h >= 6 && h < 12) minuti.mattina += passo;
    else if(h >= 12 && h < 18) minuti.pomeriggio += passo;
    else if(h >= 18) minuti.sera += passo;
    else minuti.notte += passo;
    t += passo * 60000;
  }
  return Object.entries(minuti).sort((a, b) => b[1] - a[1])[0][0];
}

function eFestivoFisso(dataStr){
  if(!dataStr) return false;
  const d = new Date(dataStr + 'T00:00:00');
  if(isNaN(d)) return false;
  const anno = d.getFullYear();
  const pasqua = calcolaPasqua(anno);
  const pasquetta = new Date(pasqua); pasquetta.setDate(pasqua.getDate() + 1);
  return festivitaFisse(anno).includes(dataStr) || dataISO(pasqua) === dataStr || dataISO(pasquetta) === dataStr;
}

function eDomenica(dataStr){
  const d = new Date(dataStr + 'T00:00:00');
  return !isNaN(d) && d.getDay() === 0;
}

function eFestivoOdDomenica(dataStr){ return eDomenica(dataStr) || eFestivoFisso(dataStr); }

function classificaFinestra(inizio, fine){
  const cat = { ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0 };
  if(!(fine > inizio)) return cat;
  // Si contano i minuti a blocchi: dentro la stessa ora tutti i minuti hanno la stessa fascia
  // (stessa ora, stesso giorno), quindi il risultato è identico al conteggio minuto per minuto,
  // ma con una decina di passaggi invece di centinaia (prima rallentava Report e Turni).
  let t = new Date(inizio).getTime();
  const fineMs = fine.getTime();
  while(t < fineMs){
    const cursore = new Date(t);
    const passo = Math.max(1, Math.min(60 - cursore.getMinutes(), Math.ceil((fineMs - t) / 60000)));
    const ora = cursore.getHours();
    const notte = ora >= 22 || ora < 6;
    const iso = dataISO(cursore);
    const domenica = eDomenica(iso);
    const festivo = !domenica && eFestivoFisso(iso);
    if(notte && (domenica || festivo)) cat.notturneFestive += passo;
    else if(domenica) cat.domenicali += passo;
    else if(festivo) cat.festive += passo;
    else if(notte) cat.notturne += passo;
    else cat.ordinarie += passo;
    if(ora >= 18 && ora < 22) cat.serali += passo; // fascia serale, tracciata a parte per il controllo del territorio
    t += passo * 60000;
  }
  for(const k in cat) cat[k] = round2(cat[k] / 60); // minuti → ore
  return cat;
}

// Somma (o sottrae) un numero di ore a un orario "HH:MM", avvolgendo su 24h se necessario.
// direzione: +1 per sommare (es. straordinario "dopo"), -1 per sottrarre (es. "prima").
function sommaOreAOrario(oraStr, ore, direzione){
  const [h, m] = oraStr.split(':').map(Number);
  let minutiTotali = h * 60 + m + direzione * Math.round(Number(ore) * 60);
  minutiTotali = ((minutiTotali % 1440) + 1440) % 1440;
  const hh = Math.floor(minutiTotali / 60), mm = minutiTotali % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// Dati "quante ore" di straordinario e se sono prima o dopo il turno, calcola l'orario preciso
// (dalle/alle), usando come riferimento l'inizio o la fine del turno stesso. Così l'utente inserisce
// solo un numero di ore — il programma continua a sapere l'orario esatto per la tariffa giusta.
function calcolaOrarioStraordinarioDaOre(oraInizioTurno, oraFineTurno, ore, posizione){
  if(!ore || Number(ore) <= 0) return { inizio: '', fine: '' };
  if(posizione === 'dopo'){
    if(!oraFineTurno) return { inizio: '', fine: '' };
    return { inizio: oraFineTurno, fine: sommaOreAOrario(oraFineTurno, ore, +1) };
  }
  if(!oraInizioTurno) return { inizio: '', fine: '' };
  return { inizio: sommaOreAOrario(oraInizioTurno, ore, -1), fine: oraInizioTurno };
}

// Operazione inversa: da un orario dalle/alle già salvato, ricava quante ore sono e se erano
// "prima" o "dopo" il turno — usata per ripopolare il modulo quando riapri un turno esistente.
function scomponiOrarioStraordinarioInOre(oraInizioBlocco, oraFineBlocco, oraInizioTurno, oraFineTurno){
  if(!oraInizioBlocco || !oraFineBlocco) return { ore: '', posizione: 'prima' };
  const differenzaOre = (a, b) => { // ore da a a b, avvolgendo su 24h
    const [ha, ma] = a.split(':').map(Number), [hb, mb] = b.split(':').map(Number);
    let diff = (hb * 60 + mb) - (ha * 60 + ma);
    if(diff <= 0) diff += 1440;
    return round2(diff / 60);
  };
  // "Dopo" se il blocco inizia esattamente dove finisce il turno (o è comunque ancorato lì);
  // altrimenti assumiamo "prima" (il blocco finisce dove inizia il turno) — il caso tipico.
  if(oraFineTurno && oraInizioBlocco === oraFineTurno){
    return { ore: differenzaOre(oraInizioBlocco, oraFineBlocco), posizione: 'dopo' };
  }
  return { ore: differenzaOre(oraInizioBlocco, oraFineBlocco), posizione: 'prima' };
}

function finestraDaOrari(dataBase, oraInizioStr, oraFineStr){
  if(!oraInizioStr || !oraFineStr) return { ore:0, classificazione:{ ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0 } };
  const [hs, ms] = oraInizioStr.split(':').map(Number);
  const [he, me] = oraFineStr.split(':').map(Number);
  let inizio = new Date(dataBase + 'T00:00:00'); inizio.setHours(hs, ms, 0, 0);
  let fine = new Date(dataBase + 'T00:00:00'); fine.setHours(he, me, 0, 0);
  if(fine <= inizio) fine.setDate(fine.getDate() + 1);
  const ore = (fine - inizio) / 3600000;
  if(ore > 24) return { ore:0, classificazione:{ ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0 } };
  return { ore: round2(ore), classificazione: classificaFinestra(inizio, fine) };
}

// Giorno di calendario a cui ancorare una finestra oraria legata al turno (straordinario prima/dopo,
// permesso breve). Gli orari sono salvati senza data: con un turno che passa la mezzanotte (es.
// notte 22-06) uno straordinario "dopo" 06-08 cade il giorno DOPO, e un permesso breve 02-03 pure.
// Prima di questa correzione venivano datati al giorno di inizio del turno: se il giorno dopo era
// domenica o festivo, le ore finivano nella categoria sbagliata (diurne invece che festive).
//   posizione 'dopo' / 'dentro': la finestra inizia dopo l'inizio del turno
//   posizione 'prima': la finestra finisce entro l'inizio del turno
function giornoFinestraTurno(t, oraInizioFinestra, oraFineFinestra, posizione){
  const giorno = t.data;
  if(!giorno || !t.oraInizio || !t.oraFine || !oraInizioFinestra || !oraFineFinestra) return giorno;
  const minuti = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const spostaGiorno = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dataISO(d); };
  const inizioTurno = minuti(t.oraInizio), fineTurno = minuti(t.oraFine);
  const turnoOltreMezzanotte = fineTurno <= inizioTurno;
  if(posizione === 'prima'){
    // Finestra che scavalca la mezzanotte e termina all'inizio del turno (es. 23:00-01:00 prima di
    // un turno che inizia all'01:00): è cominciata la sera precedente.
    const inizioF = minuti(oraInizioFinestra), fineF = minuti(oraFineFinestra);
    return fineF <= inizioF && fineF <= inizioTurno ? spostaGiorno(giorno, -1) : giorno;
  }
  if(turnoOltreMezzanotte && minuti(oraInizioFinestra) < inizioTurno) return spostaGiorno(giorno, 1);
  return giorno;
}

// Restituisce l'intervallo assoluto {inizio, fine} di una coppia orario-inizio/orario-fine,
// gestendo lo stesso attraversamento di mezzanotte usato altrove (fine <= inizio => giorno dopo).
// null se manca uno dei due orari. Usata per rilevare sovrapposizioni fra finestre orarie.
function finestraAssoluta(dataBase, oraInizioStr, oraFineStr){
  if(!oraInizioStr || !oraFineStr) return null;
  const [hs, ms] = oraInizioStr.split(':').map(Number);
  const [he, me] = oraFineStr.split(':').map(Number);
  const inizio = new Date(dataBase + 'T00:00:00'); inizio.setHours(hs, ms, 0, 0);
  const fine = new Date(dataBase + 'T00:00:00'); fine.setHours(he, me, 0, 0);
  if(fine <= inizio) fine.setDate(fine.getDate() + 1);
  return { inizio, fine };
}

function finestreSovrapposte(a, b){
  if(!a || !b) return false;
  return a.inizio < b.fine && b.inizio < a.fine;
}

// Rileva se le finestre di straordinario (prima/dopo il turno) inserite dall'utente si
// sovrappongono all'orario del turno principale — errore di battitura comune che farebbe
// contare due volte le stesse ore (una come turno ordinario, una come straordinario).
function rilevaSovrapposizioneStraordinario(t){
  if(!t || !t.data || !t.oraInizio || !t.oraFine) return false;
  const turno = finestraAssoluta(t.data, t.oraInizio, t.oraFine);
  const prima = finestraAssoluta(giornoFinestraTurno(t, t.straordinarioPrimaInizio, t.straordinarioPrimaFine, 'prima'), t.straordinarioPrimaInizio, t.straordinarioPrimaFine);
  const dopo = finestraAssoluta(giornoFinestraTurno(t, t.straordinarioDopoInizio, t.straordinarioDopoFine, 'dopo'), t.straordinarioDopoInizio, t.straordinarioDopoFine);
  return finestreSovrapposte(turno, prima) || finestreSovrapposte(turno, dopo);
}

function classificaTurno(t){
  const vuoto = {
    oreTotali:0, ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0,
    strDiurno:0, strNotturno:0, strFestivo:0, strNotturnoFestivo:0, oreCompensate:0, orePermessoBreve:0, oreRecuperoPermessoBreve:0, errore:null
  };
  if(!t || t.riposo || t.assenzaTipo) return vuoto;
  if(!t.data || !t.oraInizio || !t.oraFine) return vuoto;

  const [hi, mi] = t.oraInizio.split(':').map(Number);
  const [hf, mf] = t.oraFine.split(':').map(Number);
  let inizio = new Date(t.data + 'T00:00:00'); inizio.setHours(hi, mi, 0, 0);
  let fine = new Date(t.data + 'T00:00:00'); fine.setHours(hf, mf, 0, 0);
  if(fine <= inizio) fine.setDate(fine.getDate() + 1);

  const oreTurno = (fine - inizio) / 3600000;
  if(oreTurno > 24) return { ...vuoto, errore:'Turno superiore a 24 ore: controlla gli orari.' };

  const base = classificaFinestra(inizio, fine);

  // Permesso breve durante il turno: le ore si tolgono dalle ore lavorative (non contano come lavorate/pagate)
  const permessoBreveCalc = t.permessoBreveAttivo ? finestraDaOrari(giornoFinestraTurno(t, t.permessoBreveOraInizio, t.permessoBreveOraFine, 'dentro'), t.permessoBreveOraInizio, t.permessoBreveOraFine) : { ore:0, classificazione:{ ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0 } };
  const fpb = permessoBreveCalc.classificazione;
  const baseNetta = {
    ordinarie: round2(Math.max(0, base.ordinarie - fpb.ordinarie)),
    notturne: round2(Math.max(0, base.notturne - fpb.notturne)),
    festive: round2(Math.max(0, base.festive - fpb.festive)),
    domenicali: round2(Math.max(0, base.domenicali - fpb.domenicali)),
    notturneFestive: round2(Math.max(0, base.notturneFestive - fpb.notturneFestive)),
    serali: round2(Math.max(0, base.serali - fpb.serali))
  };
  const oreTurnoNette = round2(Math.max(0, oreTurno - permessoBreveCalc.ore));

  // Recupero permesso breve: finestra indipendente le cui ore, al contrario del permesso breve,
  // si SOMMANO alle ore lavorate pagate normali (non sono straordinario, sono ore ordinarie recuperate).
  const recuperoPBCalc = t.recuperoPermessoBreveAttivo ? finestraDaOrari(t.data, t.recuperoPermessoBreveOraInizio, t.recuperoPermessoBreveOraFine) : { ore:0, classificazione:{ ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0 } };
  const frpb = recuperoPBCalc.classificazione;

  // Secondo segmento (rientro/turno spezzato con pausa): orario proprio, non contiguo al turno principale.
  // È parte del normale orario contrattuale della giornata (es. mattina + rientro pomeridiano nella
  // "settimana corta"), NON straordinario: le sue ore si sommano quindi alle ore ordinarie, esattamente
  // come il recupero permesso breve sopra — non vanno mai nei totali di straordinario più sotto.
  const secondoCalc = t.secondoAttivo ? finestraDaOrari(t.data, t.secondoOraInizio, t.secondoOraFine) : { ore:0, classificazione:{ ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0 } };
  const finestraSecondo = secondoCalc.classificazione, oreSecondo = secondoCalc.ore;

  baseNetta.ordinarie = round2(baseNetta.ordinarie + frpb.ordinarie + finestraSecondo.ordinarie);
  baseNetta.notturne = round2(baseNetta.notturne + frpb.notturne + finestraSecondo.notturne);
  baseNetta.festive = round2(baseNetta.festive + frpb.festive + finestraSecondo.festive);
  baseNetta.domenicali = round2(baseNetta.domenicali + frpb.domenicali + finestraSecondo.domenicali);
  baseNetta.notturneFestive = round2(baseNetta.notturneFestive + frpb.notturneFestive + finestraSecondo.notturneFestive);
  baseNetta.serali = round2(baseNetta.serali + frpb.serali + finestraSecondo.serali);

  // Straordinario prima/dopo: finestre orarie indipendenti (dalle-alle), veri prolungamenti extra
  // del turno (non contrattuali), a differenza del rientro sopra.
  const primaCalc = finestraDaOrari(giornoFinestraTurno(t, t.straordinarioPrimaInizio, t.straordinarioPrimaFine, 'prima'), t.straordinarioPrimaInizio, t.straordinarioPrimaFine);
  const dopoCalc = finestraDaOrari(giornoFinestraTurno(t, t.straordinarioDopoInizio, t.straordinarioDopoFine, 'dopo'), t.straordinarioDopoInizio, t.straordinarioDopoFine);
  const finestraPrima = primaCalc.classificazione, finestraDopo = dopoCalc.classificazione;
  const strPrimaOre = primaCalc.ore, strDopoOre = dopoCalc.ore;

  const strDiurno = round2(finestraPrima.ordinarie + finestraDopo.ordinarie);
  const strNotturno = round2(finestraPrima.notturne + finestraDopo.notturne);
  const strFestivo = round2(finestraPrima.festive + finestraPrima.domenicali + finestraDopo.festive + finestraDopo.domenicali);
  const strNotturnoFestivo = round2(finestraPrima.notturneFestive + finestraDopo.notturneFestive);

  // Se lo straordinario del giorno è convertito in riposo compensativo, non entra nel calcolo della paga:
  // le ore restano tracciate a parte (oreCompensate) invece di alimentare le categorie retribuite.
  const oreStraordinarioLavorate = round2(strDiurno + strNotturno + strFestivo + strNotturnoFestivo);
  const compensato = !!t.compensaStraordinario;

  return {
    oreTotali: round2(oreTurnoNette + strPrimaOre + strDopoOre + oreSecondo),
    ordinarie: baseNetta.ordinarie, notturne: baseNetta.notturne, festive: baseNetta.festive,
    domenicali: baseNetta.domenicali, notturneFestive: baseNetta.notturneFestive, serali: baseNetta.serali,
    strDiurno: compensato ? 0 : strDiurno,
    strNotturno: compensato ? 0 : strNotturno,
    strFestivo: compensato ? 0 : strFestivo,
    strNotturnoFestivo: compensato ? 0 : strNotturnoFestivo,
    oreCompensate: compensato ? oreStraordinarioLavorate : 0,
    orePermessoBreve: permessoBreveCalc.ore,
    oreRecuperoPermessoBreve: recuperoPBCalc.ore,
    errore: null
  };
}

function calcolaIndennitaMissioneOre(ore){
  if(ore <= 4) return 0;
  if(ore <= 8) return round2(ore * AppState.tabelle.indennitaTrasfertaOraria);
  return round2(ore * AppState.tabelle.indennitaTrasfertaOrariaRidotta); // oltre 8h: tariffa ridotta al 40%
}

function calcolaRiepilogoOreMese(anno, mese){
  const tot = { ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, strDiurno:0, strNotturno:0, strFestivo:0, strNotturnoFestivo:0 };
  let riposi = 0, reperibilita = 0, missioni = 0, servizioEsterno = 0, ordinePubblico = 0, buoniPasto = 0, indennitaOPTotale = 0, oreCompensateTotale = 0;
  let giorniControlloTerritorioSerali = 0, giorniControlloTerritorioNotturni = 0, indennitaMissioniTotale = 0, turniServizioEsternoValidi = 0, turniFestiviLavorati = 0, turniFestivitaParticolare = 0, turniCompensazioneRiposo = 0, turniCambioTurno = 0, giorniPresenzaEffettiva = 0;
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  for(let g = 1; g <= giorniNelMese; g++){
    const iso = dataISO(new Date(anno, mese, g));
    const t = AppState.turni[iso];
    if(!t) continue;
    if(t.riposo){ riposi++; continue; }
    // Un giorno con un'assenza selezionata (es. Congedo ordinario) non genera nessuna indennità accessoria,
    // anche se sono rimaste spuntate delle voci da quando il giorno era un turno lavorato normale
    // (es. inserito prima con la sequenza automatica, poi convertito in assenza).
    if(t.assenzaTipo) continue;
    const c = classificaTurno(t);
    for(const k of Object.keys(tot)) tot[k] += c[k] || 0;
    oreCompensateTotale += c.oreCompensate || 0;
    if(t.reperibilita) reperibilita++;
    if(t.missione){
      missioni++;
      const oreMissione = Number(t.durataMissioneOre) || c.oreTotali || 0;
      indennitaMissioniTotale += calcolaIndennitaMissioneOre(oreMissione);
    }
    if(t.servizioEsterno){
      servizioEsterno++;
      // Ordine pubblico e servizio esterno si possono selezionare insieme sullo stesso turno,
      // ma non devono generare due indennità per lo stesso servizio: se sono spuntati entrambi,
      // paghiamo solo l'ordine pubblico (condizioni più stringenti: minimo 4h contro le 3h qui).
      if(!t.ordinePubblico && (c.oreTotali || 0) >= 3) turniServizioEsternoValidi++;
    }
    if(t.ordinePubblico){
      ordinePubblico++;
      if((c.oreTotali || 0) >= 4){
        let importoOP = t.opSede === 'fuori' ? AppState.tabelle.indennitaOPFuoriSede : AppState.tabelle.indennitaOPInSede;
        if(t.opSede === 'fuori' && t.opPernottamento === false){
          importoOP = round2(importoOP * (1 - AppState.tabelle.riduzioneOPSenzaPernottamento / 100));
        }
        indennitaOPTotale += importoOP;
      }
    }
    buoniPasto += numeroBuoniPasto(t);
    if(t.compensazioneRiposo) turniCompensazioneRiposo++;
    if(t.cambioTurno) turniCambioTurno++;
    if(t.oraInizio && t.oraFine && !t.assenzaTipo) giorniPresenzaEffettiva++;
    if((c.festive || 0) + (c.domenicali || 0) + (c.notturneFestive || 0) > 0) turniFestiviLavorati++;
    if(eFestivoFisso(t.data) && (c.oreTotali || 0) > 0) turniFestivitaParticolare++;
    // Indennità controllo territorio: serve almeno 3h continuative nella fascia, e NON è cumulabile con l'ordine pubblico
    // (fonte: normativa citata dall'utente — D.Lgs./contratto recepito con D.P.C.M. 2022 n.57, in vigore dal 31/12/2021)
    if(t.controlloTerritorio && !t.ordinePubblico){
      const oreSerali = c.serali || 0, oreNotturne = c.notturne || 0;
      if(oreSerali < 3 && oreNotturne < 3){ /* meno di 3h continuative in entrambe le fasce: nessuna indennità */ }
      else if(oreNotturne > oreSerali) giorniControlloTerritorioNotturni++;
      else giorniControlloTerritorioSerali++; // fascia serale prevalente, o parità
    }
  }
  return { tot, riposi, reperibilita, missioni, servizioEsterno, ordinePubblico, buoniPasto, turniServizioEsternoValidi, turniFestiviLavorati, turniFestivitaParticolare, turniCompensazioneRiposo, turniCambioTurno, giorniPresenzaEffettiva, oreCompensateTotale: round2(oreCompensateTotale),
    giorniControlloTerritorioSerali, giorniControlloTerritorioNotturni, indennitaMissioniTotale: round2(indennitaMissioniTotale),
    indennitaOPTotale: round2(indennitaOPTotale) };
}

function aggiornaRiepilogoMensile(){
  const { tot, riposi, reperibilita, missioni, servizioEsterno, ordinePubblico, buoniPasto, giorniControlloTerritorioSerali, giorniControlloTerritorioNotturni, oreCompensateTotale } = calcolaRiepilogoOreMese(annoCorrente, meseCorrente);

  el('rOrdinarie').textContent = round2(tot.ordinarie).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rNotturne').textContent = round2(tot.notturne).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rFestive').textContent = round2(tot.festive).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rDomenicali').textContent = round2(tot.domenicali).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rNotturneFestive').textContent = round2(tot.notturneFestive).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rStrDiurno').textContent = round2(tot.strDiurno).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rStrNotturno').textContent = round2(tot.strNotturno).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rStrFestivo').textContent = round2(tot.strFestivo).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('rStrNotturnoFestivo').textContent = round2(tot.strNotturnoFestivo).toLocaleString('it-IT', {minimumFractionDigits:2});
  const strTotaleBox = el('rStrTotale');
  if(strTotaleBox) strTotaleBox.textContent = round2(tot.strDiurno + tot.strNotturno + tot.strFestivo + tot.strNotturnoFestivo).toLocaleString('it-IT', {minimumFractionDigits:2});
  const strNettoBox = el('rStrNetto');
  if(strNettoBox){
    try{
      const effetto = calcolaEffettoNettoStraordinario(annoCorrente, meseCorrente);
      strNettoBox.textContent = effetto.lordo > 0 ? `+${effetto.netto.toLocaleString('it-IT', {minimumFractionDigits:2})} €` : '—';
    }catch(e){ strNettoBox.textContent = '—'; }
  }
  el('rRiposi').textContent = riposi;
  el('rReperibilita').textContent = reperibilita;
  el('rMissioni').textContent = missioni;
  el('rServizioEsterno').textContent = servizioEsterno;
  el('rOrdinePubblico').textContent = ordinePubblico;
  el('rControlloTerritorio').textContent = `Serale ${giorniControlloTerritorioSerali} · Notturno ${giorniControlloTerritorioNotturni}`;
  el('rBuoniPasto').textContent = buoniPasto;
  el('rOreCompensate').textContent = round2(oreCompensateTotale).toLocaleString('it-IT', {minimumFractionDigits:2});
}

let filtroCalendario = 'tutti';

function categoriaFiltroCalendario(t, categoria){
  if(!t) return 'vuoto';
  if(t.assenzaTipo) return 'assenze';
  if(t.riposo) return 'riposi';
  const extra = !!(t.missione || t.servizioEsterno || t.reperibilita || t.ordinePubblico || t.controlloTerritorio || t.buonoPasto || t.aggiornamentoProfessionale || t.addestramentoTiro || t.servizioSvolto || t.straordinarioPrimaInizio || t.straordinarioDopoInizio || t.secondoAttivo || t.compensazioneRiposo || t.cambioTurno || t.recuperoFestivoLavorato);
  if(extra) return 'extra';
  if(categoria) return 'turni';
  return 'vuoto';
}

function aggiornaFiltriCalendario(){
  document.querySelectorAll('#calendarioFiltri .filtro-calendario').forEach(btn => {
    const attivo = btn.dataset.filtro === filtroCalendario;
    btn.classList.toggle('attivo', attivo);
    btn.setAttribute('aria-pressed', attivo ? 'true' : 'false');
  });
}

function impostaFiltroCalendario(filtro){
  filtroCalendario = filtro || 'tutti';
  const select = el('filtroCalendarioSelect');
  if(select) select.value = filtroCalendario;
  aggiornaFiltriCalendario();
  document.querySelectorAll('#calendarioGriglia .giorno-cella:not(.vuota):not(.fuori-mese)').forEach(cella => {
    const tipo = cella.dataset.filtro || 'vuoto';
    const visibile = filtroCalendario === 'tutti' || tipo === filtroCalendario || (filtroCalendario === 'turni' && tipo === 'extra');
    cella.classList.toggle('filtro-nascosto', !visibile);
    cella.setAttribute('aria-hidden', visibile ? 'false' : 'true');
  });
}


function aggiornaRiepilogoTurniV45(){
  const mese=el('riepilogoTurniV45Mese');
  if(!mese) return;
  mese.textContent=`${NOMI_MESI[meseCorrente]} ${annoCorrente}`;
  let lavoro=0,riposi=0,assenze=0,extra=0;
  const giorniNelMese=new Date(annoCorrente,meseCorrente+1,0).getDate();
  for(let g=1;g<=giorniNelMese;g++){
    const iso=dataISO(new Date(annoCorrente,meseCorrente,g)), t=AppState.turni[iso];
    if(!t) continue;
    if(t.assenzaTipo){assenze++;continue}
    if(t.riposo){riposi++;continue}
    if(t.oraInizio&&t.oraFine) lavoro++;
    if(t.missione||t.servizioEsterno||t.reperibilita||t.ordinePubblico||t.controlloTerritorio||t.buonoPasto||t.aggiornamentoProfessionale||t.addestramentoTiro||t.straordinarioPrimaInizio||t.straordinarioDopoInizio||t.secondoAttivo) extra++;
  }
  el('v45RtLavoro').textContent=lavoro; el('v45RtRiposi').textContent=riposi; el('v45RtAssenze').textContent=assenze;
  const elExtra=el('v45RtExtra'); if(elExtra) elExtra.textContent=extra;

  // Dati aggiuntivi per lo straordinario totale e il pannello espanso (calcolati una sola volta, riutilizzando la stessa fonte del cedolino)
  const r = calcolaRiepilogoOreMese(annoCorrente, meseCorrente);
  const straordinarioTotale = (r.tot.strDiurno||0) + (r.tot.strNotturno||0) + (r.tot.strFestivo||0) + (r.tot.strNotturnoFestivo||0);
  const elStr=el('v45RtStraordinario'); if(elStr) elStr.textContent=formatOreMinuti(straordinarioTotale);
  const setTxt=(id,val)=>{ const n=el(id); if(n) n.textContent=val; };
  setTxt('v45RtMissioni', r.missioni);
  setTxt('v45RtServizioEsterno', r.servizioEsterno);
  setTxt('v45RtReperibilita', r.reperibilita);
  setTxt('v45RtOrdinePubblico', r.ordinePubblico);
  setTxt('v45RtBuoniPasto', r.buoniPasto);
  setTxt('v45RtOreCompensate', formatOreMinuti(r.oreCompensateTotale));
}

function inizializzaToggleRiepilogoV45(){
  const toggle = el('riepilogoTurniV45Toggle');
  const pannello = el('riepilogoTurniV45Espanso');
  if(!toggle || !pannello) return;
  toggle.addEventListener('click', () => {
    const aperto = !pannello.hidden;
    pannello.hidden = aperto;
    toggle.setAttribute('aria-expanded', aperto ? 'false' : 'true');
    toggle.classList.toggle('aperto', !aperto);
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { inizializzaToggleRiepilogoV45(); });
else { inizializzaToggleRiepilogoV45(); }

function aggiornaProssimoTurno(){
  const widget = el('prossimoTurnoWidget');
  if(!widget) return;
  const adesso = new Date();
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const isoOggi = dataISO(oggi);
  // Cerchiamo, tra tutti i turni salvati, il primo giorno di lavoro effettivo (oraInizio/oraFine)
  // il cui orario di FINE non sia già passato — non basta guardare la data: un turno di oggi già
  // concluso (es. 07:00-13:00 controllato alle 20:00) non è più "il prossimo", è già trascorso.
  const chiaviFuture = Object.keys(AppState.turni)
    .filter(iso => {
      const t = AppState.turni[iso];
      if(iso < isoOggi || !t || !t.oraInizio || !t.oraFine || t.riposo || t.assenzaTipo) return false;
      if(iso > isoOggi) return true; // giorno futuro: nessun controllo sull'orario necessario
      // iso === isoOggi: verifichiamo che l'orario di fine (gestendo anche i turni a cavallo di
      // mezzanotte, es. 19:00-01:00) non sia già passato rispetto ad adesso.
      const fine = calcolaFineAssolutaTurno(iso, t.oraInizio, t.oraFine);
      return fine > adesso;
    })
    .sort();
  // Rispettiamo la scelta dell'utente in "Personalizza Report": se ha nascosto questo blocco,
  // non lo forziamo di nuovo visibile solo perché è stato trovato un turno da mostrare.
  if(AppState.reportBlocchi && AppState.reportBlocchi.prossimoTurno === false) return;
  widget.hidden = false;
  if(!chiaviFuture.length){
    el('prossimoTurnoIcona').textContent = 'ℹ️';
    el('prossimoTurnoLabel').textContent = 'Nessun turno programmato';
    el('prossimoTurnoOrario').textContent = 'Genera o continua la sequenza dei turni per vederlo qui';
    const pillVuoto = el('prossimoTurnoQuando'); pillVuoto.textContent = ''; pillVuoto.hidden = true;
    return;
  }
  const iso = chiaviFuture[0];
  const t = AppState.turni[iso];
  const categoria = categoriaTurno(t.oraInizio, t.oraFine, t.data);
  const d = new Date(iso + 'T00:00:00');
  const diffGiorni = Math.round((d - oggi) / 86400000);
  const quando = diffGiorni === 0 ? 'oggi' : diffGiorni === 1 ? 'domani' : `tra ${diffGiorni} giorni`;
  const nomeCategoria = categoria === 'notte' ? 'Notte' : categoria === 'pomeriggio' ? 'Pomeriggio' : categoria === 'sera' ? 'Sera' : 'Mattina';
  el('prossimoTurnoIcona').innerHTML = svgIconaMomento(categoria);
  el('prossimoTurnoLabel').textContent = `${nomeCategoria} — ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  el('prossimoTurnoOrario').textContent = `${t.oraInizio} → ${t.oraFine}`;
  const pillQuando = el('prossimoTurnoQuando'); pillQuando.hidden = false; pillQuando.textContent = quando;
}

// Calcola l'istante assoluto di fine di un turno dato (data + orari), gestendo il caso in cui
// il turno attraversi la mezzanotte (fine <= inizio => la fine cade il giorno successivo).
// Stessa logica già usata in classificaTurno, isolata qui per essere riusabile.
function calcolaFineAssolutaTurno(iso, oraInizio, oraFine){
  const [hi, mi] = oraInizio.split(':').map(Number);
  const [hf, mf] = oraFine.split(':').map(Number);
  const inizio = new Date(iso + 'T00:00:00'); inizio.setHours(hi, mi, 0, 0);
  const fine = new Date(iso + 'T00:00:00'); fine.setHours(hf, mf, 0, 0);
  if(fine <= inizio) fine.setDate(fine.getDate() + 1);
  return fine;
}

function renderCalendario(){
  el('etichettaMese').textContent = `${NOMI_MESI[meseCorrente]} ${annoCorrente}`;
  const linkCancellaMese = el('btnCancellaTurniMese');
  if(linkCancellaMese) linkCancellaMese.textContent = `Cancella i turni di ${NOMI_MESI[meseCorrente].toLowerCase()}…`;
  el('campoConguagliMese').value = AppState.conguagliPerMese[chiaveMese(annoCorrente, meseCorrente)] || 0;
  const griglia = el('calendarioGriglia');
  griglia.innerHTML = '';

  const isoOggi = dataISO(new Date());
  const primoGiorno = new Date(annoCorrente, meseCorrente, 1);
  const giorniNelMese = new Date(annoCorrente, meseCorrente + 1, 0).getDate();
  const offset = (primoGiorno.getDay() + 6) % 7;

  // Se il mese cambia, manteniamo una selezione valida e prevedibile.
  const prefissoMese = `${annoCorrente}-${String(meseCorrente + 1).padStart(2,'0')}`;
  if(!giornoSelezionato || giornoSelezionato.slice(0,7) !== prefissoMese){
    giornoSelezionato = isoOggi.slice(0,7) === prefissoMese
      ? isoOggi
      : dataISO(new Date(annoCorrente, meseCorrente, 1));
  }

  // Costruisce la casella di un giorno. Usata per i giorni del mese e, sbiaditi e non toccabili,
  // per quelli del mese prima e dopo che riempiono la prima e l'ultima settimana.
  const costruisciCella = (d) => {
    const g = d.getDate(), meseCella = d.getMonth(), annoCella = d.getFullYear();
    const iso = dataISO(d);
    const t = AppState.turni[iso];
    const sabato = d.getDay() === 6;
    const domenica = d.getDay() === 0;
    const festivo = eFestivoFisso(iso);
    const cella = document.createElement('button');
    cella.type = 'button';
    let classi = 'giorno-cella';
    let categoria = null;

    if(sabato) classi += ' sabato';
    if(domenica) classi += ' domenica';
    if(festivo || domenica) classi += ' festivo';

    if(t && t.riposo){
      classi += ' tipo-riposo riposo-giorno';
      categoria = 'riposo';
    } else if(t && t.assenzaTipo){
      classi += ' tipo-assenza';
      categoria = 'assenza';
    } else if(t && t.oraInizio && t.oraFine){
      categoria = categoriaTurno(t.oraInizio, t.oraFine, t.data);
      // Ufficio/Aggiornamento professionale/Addestramento tiro hanno lo stesso orario di
      // Mattina: senza questo, sarebbero indistinguibili anche nel colore, non solo nel nome.
      const categorieProprie = ['ufficio', 'aggiornamentoProfessionale', 'addestramentoTiro'];
      if(t.modelloId && categorieProprie.includes(t.modelloId)) categoria = t.modelloId;
      classi += ' ha-turno tipo-' + categoria;
    }

    // Il colore di sfondo viene scritto qui direttamente dal JS (non lasciato alla sola cascata
    // CSS delle classi "tipo-X"): su alcune WebView Android le regole CSS per colore di sfondo
    // si sono dimostrate inaffidabili nella pratica (nonostante risultassero corrette calcolando
    // la cascata a mano) — uno stile scritto in riga qui ha sempre l'ultima parola, senza
    // eccezioni, e risolve il problema alla radice invece di rincorrere l'ennesima regola CSS
    // dimenticata da qualche versione precedente.
    // Stile moderno: la casella resta chiara (il colore va solo nell'etichetta del turno, sotto).
    const moderno = typeof calendarioModernoAttivo === 'function' && calendarioModernoAttivo();
    let coloreTurno = '';
    // v3.8.10: ogni assenza può avere il suo colore (scelto nella sua scheda in Assenze); senza, il grigio.
    const coloreAssenzaScelto = t && t.assenzaTipo ? ((AppState.assenze || []).find(a => a.id === t.assenzaTipo) || {}).coloreCalendario || '' : '';
    if(calendarioAColoriAttivo() && coloreAssenzaScelto) coloreTurno = coloreAssenzaScelto;
    else if(calendarioAColoriAttivo()){
      const modelloColoreCustomM = modelloColoreGiorno(t, categoria);
      coloreTurno = modelloColoreCustomM && modelloColoreCustomM.colore ? modelloColoreCustomM.colore : (categoria ? coloreCategoria(categoria) : '');
    }
    if(moderno){
      cella.style.background = '';
    } else if(calendarioAColoriAttivo()){
      const modelloColoreCustom = modelloColoreGiorno(t, categoria);
      if(coloreAssenzaScelto) cella.style.background = coloreAssenzaScelto;
      else if(modelloColoreCustom && modelloColoreCustom.colore) cella.style.background = modelloColoreCustom.colore;
      else if(categoria) cella.style.background = coloreCategoria(categoria);
      else cella.style.background = '';
      // v3.8.15: su un colore scuro (es. nero, blu notte) numero e sigla diventano chiari, per leggerli.
      const sfondo = coloreAssenzaScelto || (modelloColoreCustom && modelloColoreCustom.colore) || (categoria ? coloreCategoria(categoria) : '');
      if(sfondo && typeof testoSuColore === 'function' && testoSuColore(sfondo) === '#FFFFFF') classi += ' cella-scura';
    } else {
      // Non basta "non scrivere nulla": le classi tipo-X hanno ancora la loro regola CSS di
      // sfondo colorato (serve quando i colori sono accesi), quindi senza un bianco scritto qui
      // in riga esplicitamente quella regola resterebbe comunque visibile. Il bianco deve vincere
      // allo stesso modo con cui il colore vince quando è acceso.
      cella.style.background = 'var(--pannello, #FFFFFF)'; // bianco, o grigio scuro col tema scuro
    }

    if(t && t.generatoAutomaticamente) classi += ' auto-generato';
    if(iso === isoOggi) classi += ' oggi';
    if(iso === giornoSelezionato) classi += ' selezionata';

    const voceAssenza = t && t.assenzaTipo
      ? AppState.assenze.find(a => a.id === t.assenzaTipo)
      : null;

    // Se sappiamo quale modello è stato scelto (turno applicato dal popup "+Turno"), mostriamo
    // il SUO nome/sigla — non solo la categoria oraria generica: due turni con lo stesso orario
    // (es. "Ufficio" e "Mattina", entrambi 08:00-14:00) altrimenti sarebbero indistinguibili.
    const modelloUsato = (t && t.modelloId) ? (AppState.modelliTurno || []).find(m => m.id === t.modelloId) : null;

    const nomeCategoria = categoria === 'assenza'
      ? 'Assenza'
      : categoria === 'riposo'
        ? 'Riposo'
        : modelloUsato ? modelloUsato.nome
        : categoria ? (INIZIALE_CATEGORIA[categoria] || categoria) : 'Libero';

    // Codice breve per la cella: il nome completo resta disponibile in aria-label/title.
    const codiceCategoria = categoria === 'assenza' ? 'A'
      : categoria === 'riposo' ? 'R'
      : modelloUsato ? (modelloUsato.sigla || modelloUsato.nome.slice(0,2).toUpperCase())
      : categoria ? (CODICE_CATEGORIA[categoria] || INIZIALE_CATEGORIA[categoria] || categoria) : '—';

    // A calendario senza colori, le 5 fasce di base usano una sigla a una sola lettera
    // (S/P/M/N/R) invece del nome — più leggibile su uno sfondo bianco uniforme, dove il colore
    // non fa più da scorciatoia visiva. Gli altri turni (Ufficio, personalizzati...) restano
    // invariati, seguono comunque la loro sigla già impostata.
    // I turni creati dall'utente (id "personalizzato_...") usano la propria sigla, al massimo di
    // due lettere: cadendo in una delle cinque fasce orarie avrebbero altrimenti la stessa lettera
    // singola di un turno normale (es. "Partita" a metà pomeriggio diventerebbe una "P" qualsiasi).
    const modelloPersonalizzato = !!(modelloUsato && String(modelloUsato.id).startsWith('personalizzato_'));
    const siglaPersonalizzata = categoria !== 'assenza' && modelloPersonalizzato
      ? String(modelloUsato.sigla || modelloUsato.nome.slice(0,2)).toUpperCase().slice(0,2)
      : '';
    const siglaSingolaUsata = categoria !== 'assenza' && !modelloPersonalizzato && categoria && SIGLA_SINGOLA_CATEGORIA[categoria];
    const siglaGrande = !!(siglaSingolaUsata || siglaPersonalizzata);
    let etichetta = categoria === 'assenza'
      ? siglaAssenza(voceAssenza ? voceAssenza.nome : 'Assenza')
      : siglaPersonalizzata
      ? siglaPersonalizzata
      : siglaSingolaUsata
      ? SIGLA_SINGOLA_CATEGORIA[categoria]
      // Nomi brevi (Sera, Mattina, Ufficio...) entrano nella cella per intero; quelli da 9
      // caratteri in su ("Pomeriggio" compreso — esattamente al limite, prima gli sfuggiva) userebbero
      // troppo spazio, quindi per questi mostriamo la sigla — il nome completo resta comunque
      // nel titolo al passaggio.
      : modelloUsato ? (modelloUsato.nome.length >= 9 ? (modelloUsato.sigla || modelloUsato.nome.slice(0,2).toUpperCase()) : modelloUsato.nome)
      : categoria && INIZIALE_CATEGORIA[categoria] && INIZIALE_CATEGORIA[categoria].length >= 9
        ? ((AppState.modelliTurno || []).find(m => m.id === categoria)?.sigla || CODICE_CATEGORIA[categoria] || INIZIALE_CATEGORIA[categoria])
        : categoria ? INIZIALE_CATEGORIA[categoria] : '';

    if(t && t.aggiornamentoProfessionale) etichetta = 'AGG';
    else if(t && t.addestramentoTiro) etichetta = 'TIRI';
    // v3.8.8: "Lavorato sul riposo" e "Lavorato in festivo" sono indennità, non turni: la casella
    // mostra il turno svolto (es. Matt.); la sigla resta solo se il giorno non ha un turno.
    else if(t && t.compensazioneRiposo && !etichetta) etichetta = 'LR';
    else if(t && t.recuperoFestivoLavorato && !etichetta) etichetta = 'LF';

    const ore = t && !t.riposo && !t.assenzaTipo && t.oraInizio && t.oraFine
      ? classificaTurno(t).oreTotali
      : 0;

    const haStraordinario = !!(t && (
      (t.straordinarioPrimaInizio && t.straordinarioPrimaFine) ||
      (t.straordinarioDopoInizio && t.straordinarioDopoFine) ||
      (t.secondoAttivo && t.secondoOraInizio && t.secondoOraFine)
    ));
    const haMissione = !!(t && t.missione);
    const haAssenza = !!(t && t.assenzaTipo);
    const haServizioEsterno = !!(t && t.servizioEsterno);
    const haReperibilita = !!(t && t.reperibilita);
    const haOP = !!(t && t.ordinePubblico);

    if(haStraordinario) classi += ' ha-straordinario';
    if(haMissione) classi += ' ha-missione';
    if(haAssenza) classi += ' ha-assenza';
    if(haServizioEsterno) classi += ' ha-servizio-esterno';
    if(haReperibilita) classi += ' ha-reperibilita';
    if(haOP) classi += ' ha-op';

    // v2.96: niente simboli delle indennità nelle caselle (non ci stavano): si vedono toccando il giorno.
    const badgeVisibili = haAssenza ? ['<span class="giorno-badge badge-assenza" title="Assenza" aria-label="Assenza">A</span>'] : [];

    const orario = t && t.oraInizio && t.oraFine && !t.riposo && !t.assenzaTipo
      ? `<span class="giorno-orario">${escapeHtml(t.oraInizio)}–${escapeHtml(t.oraFine)}</span>`
      : '';
    const oreLabel = ore > 0 ? `<span class="giorno-ore">${String(ore).replace('.',',')}h</span>` : '';
    const tipoLabel = categoria === 'assenza'
      ? siglaAssenza(voceAssenza ? voceAssenza.nome : 'Assenza')
      : etichetta || 'Libero';

    cella.className = classi;
    cella.dataset.data = iso;
    cella.dataset.filtro = categoriaFiltroCalendario(t, categoria);
    cella.setAttribute('aria-label', `${g} ${NOMI_MESI[meseCella]} ${annoCella}: ${nomeCategoria}${orario ? ', ' + t.oraInizio + '–' + t.oraFine : ''}${haStraordinario ? ', straordinario' : ''}${haMissione ? ', missione' : ''}${haAssenza ? ', assenza' : ''}`);
    cella.title = `${g} ${NOMI_MESI[meseCella]} — ${nomeCategoria}${haStraordinario ? ' · Straordinario' : ''}${haMissione ? ' · Missione' : ''}`;

    // Eventi del giorno: il titolo del primo in una striscia in fondo alla casella, "+N" se sono di più.
    const eventiCella = typeof eventiDelGiorno === 'function' ? eventiDelGiorno(iso) : (AppState.eventiGiorno[iso] || []).map(ev => ({ ev }));
    const strisciaEvento = eventiCella.length
      ? `<span class="giorno-evento-titolo"${coloreEventoStile(eventiCella[0].ev)} title="${escapeHtml(eventiCella.map(x => x.ev.titolo || 'Evento').join(' · '))}"><span class="giorno-evento-testo">${escapeHtml(eventiCella[0].ev.titolo || 'Evento')}</span>${eventiCella.length > 1 ? `<b>+${eventiCella.length - 1}</b>` : ''}</span>`
      : '';

    if(moderno){
      // Nome per esteso dove ci sta (Sera, Notte, Mattina...), sigla per i nomi lunghi.
      let nomeEtichetta = categoria === 'assenza' ? tipoLabel
        : (t && (t.aggiornamentoProfessionale || t.addestramentoTiro || ((t.compensazioneRiposo || t.recuperoFestivoLavorato) && !categoria))) ? etichetta
        // Turni di base: nomi brevi fissi, che entrano sempre nella casella.
        : NOME_BREVE_CATEGORIA[categoria] && (!modelloUsato || NOME_BREVE_CATEGORIA[modelloUsato.id]) ? NOME_BREVE_CATEGORIA[categoria]
        : nomeCategoria;
      if(nomeEtichetta.length > 8) nomeEtichetta = modelloUsato && modelloUsato.sigla ? modelloUsato.sigla : nomeEtichetta.slice(0, 6) + '.';
      // v2.91.1: colore esatto scelto dall'utente (niente scurimento).
      // Il testo (chiaro/scuro) è calcolato automaticamente da testoSuColore per restare leggibile.
      const sfondoBadge = coloreTurno || '#C9CED6';
      const etichettaTurno = t && categoria
        ? `<span class="mod-turno"><b style="background:${escapeHtml(sfondoBadge)};color:${testoSuColore(sfondoBadge)}">${escapeHtml(nomeEtichetta)}</b></span>`
        : '';
      // v3.8.2: un pallino per evento (al massimo 3), del colore dell'evento; il nome si legge toccando il giorno.
      const rigaEvento = eventiCella.length
        ? `<span class="mod-eventi" title="${escapeHtml(eventiCella.map(x => x.ev.titolo || 'Evento').join(' · '))}">${eventiCella.slice(0, 3).map(x => `<i class="mod-evento"${coloreEventoStile(x.ev)}></i>`).join('')}</span>`
        : '';
      // v3.8.30: lo straordinario si vede già dal mese, con le ore (es. "+2h") sotto il turno.
      const minStr = typeof minutiStraordinario === 'function' ? minutiStraordinario(t) : 0;
      const oreStr = minStr ? String(Math.round(minStr / 6) / 10).replace('.', ',') : '';
      const segnoStr = minStr ? `<span class="mod-straord" title="Straordinario ${oreStr} ore">+${oreStr}h</span>` : '';
      cella.innerHTML = `
        <span class="mod-numero">${g}</span>
        ${etichettaTurno}
        ${segnoStr}
        ${rigaEvento}
      `;
      cella.addEventListener('click', () => gestisciTocchGiornoV2(iso));
      return cella;
    }

    cella.innerHTML = `
      <span class="giorno-topline">
        <span class="giorno-numero">${g}</span>
        <span class="giorno-badge-list">${badgeVisibili.join('')}</span>
      </span>
      <span class="giorno-turno-badge" style="background:transparent" title="${escapeHtml(nomeCategoria)}"><span class="giorno-turno-codice">${escapeHtml(codiceCategoria)}</span><span class="giorno-turno-nome"${siglaGrande ? ' data-sigla-singola="1"' : ''}>${escapeHtml(tipoLabel)}</span></span>
      ${orario || oreLabel ? `<span class="giorno-meta">${orario}${oreLabel}</span>` : '<span class="giorno-meta giorno-meta-vuoto">—</span>'}
      ${strisciaEvento}
    `;

    // Una regola CSS con !important altrove tiene questo testo fisso e piccolo (pensata per nomi
    // come "Sera"/"Mattina") — per la sigla a una sola lettera lo ingrandiamo qui, scrivendo
    // anche noi in !important dal JS: è l'unico modo di vincere con certezza su un'altra regola
    // già !important, invece di sperare che la cascata CSS la scavalchi da sola.
    if(siglaGrande){
      const nodoSigla = cella.querySelector('[data-sigla-singola]');
      if(nodoSigla){
        nodoSigla.style.setProperty('font-size', '1.2rem', 'important');
        nodoSigla.style.setProperty('font-weight', '900', 'important');
      }
    }

    cella.addEventListener('click', () => gestisciTocchGiornoV2(iso));
    return cella;
  };

  // Giorni del mese prima e del mese dopo: sbiaditi; v3.8.10: toccandoli si va a quel mese con il giorno
  // già selezionato, così si possono vedere e modificare come gli altri.
  const cellaFuoriMese = (d) => {
    const cella = costruisciCella(d);
    const copia = cella.cloneNode(true); // la copia non porta con sé il tocco: lo aggiungiamo sotto
    const iso = dataISO(d);
    copia.classList.add('fuori-mese');
    copia.classList.remove('oggi', 'selezionata');
    delete copia.dataset.data;
    delete copia.dataset.filtro;
    copia.dataset.vaiGiorno = iso;
    copia.setAttribute('aria-label', `Vai a ${d.getDate()} ${NOMI_MESI[d.getMonth()]} ${d.getFullYear()}`);
    copia.title = `Vai a ${NOMI_MESI[d.getMonth()].toLowerCase()}`;
    copia.addEventListener('click', () => {
      meseCorrente = d.getMonth(); annoCorrente = d.getFullYear();
      renderCalendario();
      gestisciTocchGiornoV2(iso);
    });
    return copia;
  };
  for(let i = offset; i > 0; i--) griglia.appendChild(cellaFuoriMese(new Date(annoCorrente, meseCorrente, 1 - i)));
  for(let g = 1; g <= giorniNelMese; g++) griglia.appendChild(costruisciCella(new Date(annoCorrente, meseCorrente, g)));
  const finali = (7 - (offset + giorniNelMese) % 7) % 7;
  for(let i = 1; i <= finali; i++) griglia.appendChild(cellaFuoriMese(new Date(annoCorrente, meseCorrente, giorniNelMese + i)));

  aggiornaFiltriCalendario();
  impostaFiltroCalendario(filtroCalendario);
  aggiornaDettaglioGiorno();
  aggiornaRiepilogoMensile();
  aggiornaRiepilogoTurniV45();
  aggiornaProssimoTurno();
  if(typeof aggiornaDashboard === 'function') aggiornaDashboard();
  if(typeof aggiornaRiepilogoVisualeMese === 'function') aggiornaRiepilogoVisualeMese();
  if(typeof aggiornaRiepilogoGiornoSelezionatoV2 === 'function') aggiornaRiepilogoGiornoSelezionatoV2();
  if(typeof renderProssimiEventiV2 === 'function') renderProssimiEventiV2();
  if(typeof aggiornaVistaCalendario === 'function') aggiornaVistaCalendario();
  if(typeof renderReportHero === 'function') renderReportHero();
}

function selezionaGiorno(iso){
  giornoSelezionato = iso;
  // aggiorna solo le classi di selezione, senza ricostruire l'intera griglia
  document.querySelectorAll('#calendarioGriglia .giorno-cella').forEach(c => c.classList.remove('selezionata'));
  const cellaTrovata = document.querySelector(`#calendarioGriglia .giorno-cella[data-data="${iso}"]`);
  if(cellaTrovata) cellaTrovata.classList.add('selezionata');
  aggiornaDettaglioGiorno();
  if(typeof aggiornaRiepilogoGiornoSelezionatoV2 === 'function') aggiornaRiepilogoGiornoSelezionatoV2();
}

function formatOreMinuti(valore){
  const n = Number(valore || 0);
  if(!Number.isFinite(n) || n <= 0) return '0:00';
  const ore = Math.floor(n);
  const minuti = Math.round((n - ore) * 60);
  if(minuti === 60) return `${ore + 1}:00`;
  return `${ore}:${String(minuti).padStart(2,'0')}`;
}

function totaleStraordinario(c){
  return Number(c?.strDiurno || 0) + Number(c?.strNotturno || 0) + Number(c?.strFestivo || 0) + Number(c?.strNotturnoFestivo || 0);
}

// V64 — Versione ridotta al minimo necessario: nella nuova interfaccia il "dettaglio del
// giorno" (l'anteprima sotto il calendario) non è più mostrato — si tocca il giorno e si apre
// direttamente il pannello di modifica (apriModaleTurno). Questa funzione resta solo per
// popolare Nota del giorno e Servizio svolto quando si seleziona un giorno, che è l'unica
// parte ancora davvero usata; il resto (badge, indicatori, pillole) è stato rimosso perché
// scriveva in elementi ormai sempre nascosti, senza alcun effetto visibile per l'utente.
function aggiornaDettaglioGiorno(){
  if(!giornoSelezionato) return;
  const t = AppState.turni[giornoSelezionato];
  const campoServizio = el('campoServizioSvolto');
  if(campoServizio) campoServizio.value = (t && t.servizioSvolto) || '';
}

const MODELLI_TURNO = {
  mattina:     { oraInizio:'07:00', oraFine:'13:00', etichetta:'Mattina (07:00–13:00)' },
  pomeriggio:  { oraInizio:'13:00', oraFine:'19:00', etichetta:'Pomeriggio (13:00–19:00)' },
  sera24:      { oraInizio:'19:00', oraFine:'00:00', etichetta:'Sera (19:00–24:00)' },
  sera01:      { oraInizio:'19:00', oraFine:'01:00', etichetta:'Sera (19:00–01:00)' },
  notte00:     { oraInizio:'00:00', oraFine:'07:00', etichetta:'Notte (00:00–07:00)' },
  notte01:     { oraInizio:'01:00', oraFine:'07:00', etichetta:'Notte (01:00–07:00)' },
  mattutino:   { oraInizio:'08:00', oraFine:'14:00', etichetta:'Turno 08:00–14:00' },
  pomeridiano: { oraInizio:'14:00', oraFine:'20:00', etichetta:'Turno 14:00–20:00' }
};

// ── Simboli delle indennità (icone disegnate, uguali su tutti i telefoni) ──
// Usati nel menu "Cosa vuoi aggiungere?", nel riquadro del giorno, nell'agenda e in Modifica il giorno.
const DISEGNI_INDENNITA = {
  straordinario: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  missione: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  servizioEsterno: '<path d="M3 17v-4l2.5-6h13L21 13v4z"/><path d="M3 13h18"/><circle cx="7.5" cy="17" r="1.8" fill="currentColor"/><circle cx="16.5" cy="17" r="1.8" fill="currentColor"/>',
  ordinePubblico: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  reperibilita: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  controlloTerritorio: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  buonoPasto: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2 0-3.5 3-3.5 8H17"/>',
  cambioTurno: '<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>',
  compensazioneRiposo: '<circle cx="12" cy="12" r="9"/><path d="M10 16.5v-9h2.8a2.6 2.6 0 0 1 0 5.2H10M12.6 12.7l2.6 3.8"/>',
  recuperoFestivoLavorato: '<circle cx="12" cy="12" r="9"/><path d="M10.2 16.5v-9h4.6M10.2 11.8h3.8"/>',
  servizioSvolto: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>'
};
const ELENCO_INDENNITA = [
  { chiave:'straordinario', nome:'Straordinario' },
  { chiave:'missione', nome:'Missione' },
  { chiave:'ordinePubblico', nome:'Ordine pubblico' },
  { chiave:'servizioEsterno', nome:'Servizio esterno' },
  { chiave:'buonoPasto', nome:'Buono pasto' },
  { chiave:'reperibilita', nome:'Reperibilità' },
  { chiave:'controlloTerritorio', nome:'Controllo territorio' },
  { chiave:'cambioTurno', nome:'Cambio turno' },
  { chiave:'compensazioneRiposo', nome:'Lavorato sul riposo' },
  { chiave:'recuperoFestivoLavorato', nome:'Lavorato in festivo' },
  { chiave:'servizioSvolto', nome:'Nota servizio' }
];
// Colori che si possono dare a un evento (il primo è quello di partenza).
const COLORI_EVENTO = ['#2E7DD7', '#2E9E5B', '#E08A00', '#D64545', '#8E44AD', '#00838F', '#6D4C41', '#546E7A'];
function coloreEvento(ev){ return ev && COLORI_EVENTO.includes(ev.colore) ? ev.colore : COLORI_EVENTO[0]; }
function coloreEventoStile(ev){ return ` style="background:${coloreEvento(ev)}"`; }
function iconaIndennita(chiave, classe){
  const d = DISEGNI_INDENNITA[chiave];
  return d ? `<svg class="icona-indennita${classe ? ' ' + classe : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>` : '';
}

const NOME_BREVE_CATEGORIA = { mattina:'Matt.', pomeriggio:'Pom.', sera:'Sera', notte:'Notte', riposo:'Riposo' };
const INIZIALE_CATEGORIA = { mattina:'Mattina', pomeriggio:'Pomeriggio', sera:'Sera', notte:'Notte', riposo:'Riposo' };
const CODICE_CATEGORIA = { mattina:'M', pomeriggio:'P', sera:'S', notte:'N', riposo:'R' };
const ICONA_CATEGORIA = { mattina:'☀️', pomeriggio:'🌤️', sera:'🌇', notte:'🌙', riposo:'💤', assenza:'🏖️' };

// Icone illustrate "a cartolina" per i 4 momenti della giornata (mattina/pomeriggio/sera/notte),
// nello stile richiesto: quadrato arrotondato, cielo colorato, sole/luna, collinette e un albero.
// Usabili solo dove il markup consente HTML (innerHTML) — un <select><option> nativo può
// contenere solo testo semplice per limite del browser, quindi lì restano le emoji di ICONA_CATEGORIA.
function svgIconaMomento(categoria){
  const varianti = {
    mattina:    { bg:'#BFE3F5', cielo:'#FDEFC7', astro:'#FFD966' },
    pomeriggio: { bg:'#FCE38A', cielo:'#FCE38A', astro:'#FFF275' },
    sera:       { bg:'#F6C9D8', cielo:'#F3A6C0', astro:'#FF8A65' },
    notte:      { bg:'#7A5FBF', cielo:'#5B45A0', astro:'#EDE4B0' }
  };
  const v = varianti[categoria] || varianti.mattina;
  const isNotte = categoria === 'notte';
  const astro = isNotte
    ? `<circle cx="66" cy="28" r="13" fill="${v.astro}"/><circle cx="61" cy="24" r="11" fill="${v.bg}"/>`
    : `<circle cx="50" cy="30" r="15" fill="${v.astro}"/>`;
  return `<svg viewBox="0 0 100 100" width="26" height="26" aria-hidden="true" style="display:block;border-radius:22%;overflow:hidden;flex-shrink:0">
    <rect width="100" height="100" fill="${v.bg}"/>
    <rect width="100" height="62" fill="${v.cielo}"/>
    ${astro}
    <path d="M0,70 Q25,52 50,70 T100,68 V100 H0 Z" fill="#3E7A46"/>
    <path d="M0,80 Q25,62 55,80 T100,76 V100 H0 Z" fill="#57A15F"/>
    <circle cx="33" cy="56" r="9" fill="#2F6B3A"/>
    <rect x="30" y="61" width="6" height="12" fill="#6B4A2E"/>
  </svg>`;
}

// Icona specifica per tipo di assenza, riconosciuta dal nome (case-insensitive, per parola chiave)
// così funziona anche con piccole varianti di formulazione. Le voci personalizzate non riconosciute
// ricadono su un'icona generica (📌) invece del generico ombrellone, pensato solo per le ferie.
function iconaAssenza(nome){
  const n = (nome || '').toLowerCase();
  if(n.includes('straordinario')) return '🏠';
  if(n.includes('ordinario') || n.includes('ferie')) return '🏖️';
  if(n.includes('riposo') || n.includes('recupero')) return '🔄';
  if(n.includes('aspettativa')) return '⏸️';
  if(n.includes('maternità') || n.includes('maternita') || n.includes('paternità') || n.includes('paternita')) return '👶';
  if(n.includes('parentale')) return '🧸';
  if(n.includes('l104') || n.includes('legge 104') || n.includes('104')) return '♿';
  if(n.includes('donazione') || n.includes('sangue')) return '🩸';
  if(n.includes('studio')) return '📚';
  if(n.includes('permesso breve') || n.includes('breve')) return '⏱️';
  if(n.includes('sindacale') || n.includes('sindacat')) return '🤝';
  return '📌';
}

const SIGLE_ASSENZE = {
  'Congedo ordinario': 'C.O.',
  'Congedo straordinario': 'C.S.',
  'Riposo legge': 'P.L.',
  'Riposo settimanale': 'R.S.',
  'Riposo festivo': 'R.F.',
  'Recupero riposo': 'R.R.',
  'Riposo compensativo': 'R.C.',
  'Aspettativa': 'Asp.',
  'Maternità/Paternità': 'Mat.P.',
  'Congedo parentale': 'C.Par.',
  'L104': 'L104',
  'Donazione sangue': 'D.San',
  'Ore studio': 'Stud',
  'Permesso breve': 'P.Bre',
  'Permesso sindacale': 'P.Sin',
  'Permesso lutto/grave infermità familiare': 'P.Lu.'
};

const NOMI_MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const NOMI_GIORNI = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];

function inizializzaFiltriCalendario(){
  document.querySelectorAll('#calendarioFiltri .filtro-calendario').forEach(btn => {
    btn.addEventListener('click', () => impostaFiltroCalendario(btn.dataset.filtro));
  });
  aggiornaFiltriCalendario();
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizializzaFiltriCalendario);
else inizializzaFiltriCalendario();

/* V46_TOTAL_DAY_FIX
   Regola ufficiale:
   - ore lavoro = sole ore ordinarie
   - straordinario = ore aggiuntive
   - totale giorno = ore lavoro + straordinario
   Esempio: 6:00 + 3:00 = 9:00.
   Le durate attraversando la mezzanotte vengono normalizzate.
*/
(function () {
  function toMinutes(v) {
    if (typeof v === "number" && isFinite(v)) return Math.round(v * 60);
    const s = String(v == null ? "" : v).trim().replace(",", ".");
    if (!s) return 0;
    const hm = s.match(/^(\d{1,3})\s*[:.]\s*(\d{1,2})$/);
    if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
    const n = Number(s);
    return isFinite(n) ? Math.round(n * 60) : 0;
  }

  function fmt(m) {
    m = Math.max(0, Math.round(m || 0));
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  }

  window.calcolaTotaleGiornoV46 = function (oreLavoro, straordinario) {
    return fmt(toMinutes(oreLavoro) + toMinutes(straordinario));
  };

  window.calcolaDurataTurnoV46 = function (inizio, fine) {
    let d = toMinutes(fine) - toMinutes(inizio);
    if (d < 0) d += 1440;
    return fmt(d);
  };

  window.aggiornaTotaleGiornoV46 = function (root) {
    root = root || document;
    const ordinary = root.querySelector(
      "#oreLavoro,#ore-lavoro,[name='oreLavoro'],[name='ore_lavoro'],[data-field='oreLavoro']"
    );
    const overtime = root.querySelector(
      "#straordinario,#oreStraordinario,[name='straordinario'],[name='oreStraordinario'],[data-field='straordinario']"
    );
    const total = root.querySelector(
      "#totaleGiorno,#totale-giorno,[name='totaleGiorno'],[data-field='totaleGiorno']"
    );
    if (!ordinary || !overtime || !total) return;
    const value = window.calcolaTotaleGiornoV46(ordinary.value, overtime.value);
    if ("value" in total) total.value = value;
    total.textContent = value;
  };
})();

// ── Agenda sotto il calendario: i prossimi giorni in elenco, sotto la griglia del mese ──
// Mostra solo dati già salvati (turni, assenze, indennità, eventi): non calcola niente di nuovo.
// Si accende da Altro → "Agenda sotto il calendario" (all'inizio è spenta); quando è accesa
// prende il posto di "Prossimi 7 giorni", che mostrerebbe gli stessi eventi una seconda volta.
const CHIAVE_AGENDA_SOTTO = 'simCedolino_agendaSottoCalendario_v1';
const GIORNI_AGENDA_PASSO = 14;
const GIORNI_SETTIMANA_BREVI = ['dom','lun','mar','mer','gio','ven','sab'];
let giorniAgenda = GIORNI_AGENDA_PASSO;

function agendaSottoAttiva(){
  try{ return TurniPSStorage.getItem(CHIAVE_AGENDA_SOTTO) === '1'; }catch(e){ return false; }
}
function impostaAgendaSotto(attiva){
  try{ TurniPSStorage.setItem(CHIAVE_AGENDA_SOTTO, attiva ? '1' : '0'); }catch(e){}
  giorniAgenda = GIORNI_AGENDA_PASSO;
  aggiornaVistaCalendario();
}
function aggiornaVistaCalendario(){
  const sez = document.querySelector('.scheda-calendario-v2');
  const box = el('agendaSottoCalendario');
  if(!sez || !box) return;
  const attiva = agendaSottoAttiva();
  sez.classList.toggle('con-agenda', attiva);
  box.hidden = !attiva;
  const campo = el('campoAgendaSotto');
  if(campo) campo.checked = attiva;
  if(attiva) renderAgenda();
  applicaVistaCalendario();
}

// ── v3.8.10: viste del calendario (Giorno · Settimana · Mese · Agenda), scelte dal pulsantino in alto ──
const CHIAVE_VISTA_CALENDARIO = 'simCedolino_vistaCalendario_v1';
const NOMI_VISTA_CALENDARIO = { giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese', anno: 'Anno', diario: 'Diario', agenda: 'Agenda' };
function vistaCalendario(){
  if(agendaSottoAttiva()) return 'agenda';
  let v = null; try{ v = TurniPSStorage.getItem(CHIAVE_VISTA_CALENDARIO); }catch(e){}
  // v3.8.30: la vista Settimana è confluita nel Diario (chi l'aveva scelta ritrova il Diario).
  if(v === 'settimana') v = 'diario';
  return v === 'giorno' || v === 'anno' || v === 'diario' ? v : 'mese';
}
function impostaVistaCalendario(v){
  try{ TurniPSStorage.setItem(CHIAVE_VISTA_CALENDARIO, v === 'agenda' ? 'mese' : v); }catch(e){}
  if(!giornoSelezionato) giornoSelezionato = dataISO(new Date());
  if(v !== 'agenda'){ const d = dataDaIso(giornoSelezionato); meseCorrente = d.getMonth(); annoCorrente = d.getFullYear(); }
  el('menuVistaCalendario').hidden = true;
  if(v === 'agenda' && typeof riportaAgendaAOggi === 'function') riportaAgendaAOggi();
  impostaAgendaSotto(v === 'agenda'); // ridisegna anche la vista
  renderCalendario();
  window.scrollTo(0, 0);
}
function lunediDi(iso){ const d = dataDaIso(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7, 12); }
function giornoPiu(iso, n){ const d = dataDaIso(iso); return dataISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)); }
// Frecce ‹ ›: nella vista Giorno si va di un giorno, nella Settimana di una settimana.
function spostaVistaCalendario(dir){
  const v = vistaCalendario();
  if(v === 'anno'){ annoCorrente += dir; renderCalendario(); return true; }
  if(v !== 'giorno' && v !== 'settimana' && v !== 'diario') return false;
  giornoSelezionato = giornoPiu(giornoSelezionato || dataISO(new Date()), dir * (v === 'giorno' ? 1 : 7));
  if(v === 'diario') paginaDaGirareDiario = dir;
  const d = dataDaIso(giornoSelezionato); meseCorrente = d.getMonth(); annoCorrente = d.getFullYear();
  renderCalendario();
  return true;
}
function coloreGiornoVista(t){
  if(!t) return '';
  if(t.assenzaTipo){ const v = (AppState.assenze || []).find(a => a.id === t.assenzaTipo); return (v && v.coloreCalendario) || coloreCategoria('assenza'); }
  const cat = t.riposo ? 'riposo' : (t.oraInizio && t.oraFine ? categoriaTurno(t.oraInizio, t.oraFine, t.data) : 'mattina');
  const m = modelloColoreGiorno(t, cat);
  return (m && m.colore) || coloreCategoria(cat);
}
// v3.8.31: il turno da cui un giorno prende il colore. Se gli orari del giorno sono stati cambiati a mano
// e non corrispondono più a un turno salvato, vale il colore del turno base della stessa fascia
// (es. orari di mattina → colore del turno «Mattino»), non il colore di serie della fascia.
function modelloColoreGiorno(t, categoria){
  if(!t) return null;
  const modelli = AppState.modelliTurno || [];
  if(t.riposo) return modelli.find(m => m.riposo) || null;
  const proprio = t.modelloId ? modelli.find(m => m.id === t.modelloId) : null;
  if(proprio && proprio.colore) return proprio;
  const base = categoria ? modelli.find(m => m.id === categoria && m.colore) : null;
  return base || proprio || null;
}
function nomeGiornoVista(t){
  if(!t) return '';
  if(t.assenzaTipo){ const v = (AppState.assenze || []).find(a => a.id === t.assenzaTipo); return v ? v.nome : 'Assenza'; }
  if(t.riposo) return 'Riposo';
  // v3.8.31: orari cambiati a mano → il nome del turno base della stessa fascia (es. «Mattino»), non «Turno».
  const m = (AppState.modelliTurno || []).find(x => x.id === t.modelloId)
    || (t.oraInizio && t.oraFine ? (AppState.modelliTurno || []).find(x => x.id === categoriaTurno(t.oraInizio, t.oraFine, t.data)) : null);
  return m ? m.nome : (t.oraInizio ? 'Turno' : '');
}
function applicaVistaCalendario(){
  const v = vistaCalendario();
  const sez = document.querySelector('.scheda-calendario-v2');
  if(!sez || !el('vistaGiornoCal')) return;
  sez.dataset.vista = v;
  el('etichettaVistaCalendario').textContent = v === 'settimana' ? 'Sett.' : NOMI_VISTA_CALENDARIO[v];
  document.querySelectorAll('[data-vista-calendario]').forEach(b => b.classList.toggle('attivo', b.dataset.vistaCalendario === v));
  el('vistaGiornoCal').hidden = v !== 'giorno';
  el('vistaSettimanaCal').hidden = v !== 'settimana';
  if(el('vistaAnnoCal')) el('vistaAnnoCal').hidden = v !== 'anno';
  if(el('vistaDiarioCal')) el('vistaDiarioCal').hidden = v !== 'diario';
  const iso = giornoSelezionato || dataISO(new Date());
  const d = dataDaIso(iso);
  if(v === 'giorno'){
    el('etichettaMese').textContent = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
    renderVistaGiorno(iso);
  } else if(v === 'settimana'){
    const lun = lunediDi(iso), dom = dataDaIso(giornoPiu(dataISO(lun), 6));
    const mm = x => x.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
    el('etichettaMese').textContent = lun.getMonth() === dom.getMonth() ? `${lun.getDate()}–${dom.getDate()} ${mm(dom)}` : `${lun.getDate()} ${mm(lun)}–${dom.getDate()} ${mm(dom)}`;
    renderVistaSettimana(iso);
  } else if(v === 'diario'){
    const lun = lunediDi(iso);
    el('etichettaMese').textContent = `${NOMI_MESI[lun.getMonth()]} ${lun.getFullYear()}`;
    renderVistaDiario(iso);
  } else if(v === 'anno'){
    el('etichettaMese').textContent = String(annoCorrente);
    renderVistaAnno(annoCorrente);
  } else if(v === 'agenda'){
    el('etichettaMese').textContent = 'Agenda';
  }
}
const ALTEZZA_ORA_VISTA = 30;
function renderVistaGiorno(iso){
  const host = el('vistaGiornoCal');
  const H = ALTEZZA_ORA_VISTA, lun = lunediDi(iso), oggiIso = dataISO(new Date());
  const nomi = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const striscia = nomi.map((n, i) => { const g = giornoPiu(dataISO(lun), i); const dd = dataDaIso(g);
    return `<button type="button" class="vg-giorno${g === iso ? ' attivo' : ''}${g === oggiIso ? ' oggi' : ''}" data-vista-giorno="${g}">${n}<b>${dd.getDate()}</b></button>`; }).join('');
  const blocchi = (typeof turniNellaGiornata === 'function' ? turniNellaGiornata(iso) : []).map(b => {
    const top = b.da / 60 * H, alto = Math.max(22, (Math.min(b.a, 1440) - b.da) / 60 * H - 3);
    return `<button type="button" class="vg-blocco vg-turno" data-vista-turno="${b.daIeri ? giornoPiu(iso, -1) : iso}" style="top:${top}px;height:${alto}px;background:${escapeHtml(b.colore || '#C9CED6')}"><b>${escapeHtml(b.nome || 'Turno')}</b><small>${escapeHtml(b.orario || '')}</small></button>`; }).join('');
  const t = AppState.turni[iso];
  const tutto = [];
  if(t && (t.riposo || t.assenzaTipo)) tutto.push(`<span style="background:${coloreGiornoVista(t)}">${escapeHtml(nomeGiornoVista(t))}</span>`);
  let eventi = '';
  (typeof eventiDelGiorno === 'function' ? eventiDelGiorno(iso) : []).forEach(({ ev, isoOrigine }) => {
    if(ev.tuttoIlGiorno || !ev.oraInizio){ tutto.push(`<span class="vg-ev-tutto" style="background:${coloreEvento(ev)}">${escapeHtml(ev.titolo || 'Evento')}</span>`); return; }
    const r = intervalloOrari(ev.oraInizio, ev.oraFine || ev.oraInizio) || { da: minutiDaOrario(ev.oraInizio), a: minutiDaOrario(ev.oraInizio) + 60 };
    const fine = r.a > r.da ? r.a : r.da + 60;
    eventi += `<button type="button" class="vg-blocco vg-evento" data-evento-id="${escapeHtml(ev.id)}" data-evento-iso="${escapeHtml(isoOrigine || iso)}" style="top:${r.da / 60 * H}px;height:${Math.max(22, (Math.min(fine, 1440) - r.da) / 60 * H - 3)}px;background:${coloreEvento(ev)}"><b>${escapeHtml(ev.titolo || 'Evento')}</b><small>${escapeHtml(ev.oraInizio)}</small></button>`;
  });
  const ore = [...Array(24)].map((_, h) => `<div class="vg-ora" style="top:${h * H}px"><span>${String(h).padStart(2, '0')}:00</span></div>`).join('');
  const adesso = new Date();
  const linea = iso === oggiIso ? `<div class="vg-adesso" style="top:${(adesso.getHours() * 60 + adesso.getMinutes()) / 60 * H}px"></div>` : '';
  const chipG = chipDettagliGiorno(t).join(''), notaG = notaServizioHtml(t);
  const dett = chipG || notaG ? `<div class="vg-dett">${chipG ? `<span class="vs-chip">${chipG}</span>` : ''}${notaG}</div>` : '';
  host.innerHTML = `<div class="vg-striscia">${striscia}</div>${dett}${tutto.length ? `<div class="vg-tutto">${tutto.join('')}</div>` : ''}<div class="vg-scorri" id="vgScorri"><div class="vg-ore" style="height:${24 * H}px">${ore}${blocchi}${eventi}${linea}</div></div>`;
  // Si parte dal turno (o dalle 7), un'ora prima.
  const primo = (typeof turniNellaGiornata === 'function' ? turniNellaGiornata(iso) : []).filter(b => !b.daIeri)[0];
  el('vgScorri').scrollTop = Math.max(0, ((primo ? primo.da : 7 * 60) / 60 - 1) * H);
}
// v3.8.13: i dettagli di un giorno di servizio (indennità, straordinario con le ore, nota del servizio),
// uguali in Settimana e in Agenda. Icone a linea, come nel riquadro del giorno.
function chipDettagliGiorno(t){
  if(!t || !t.oraInizio || !t.oraFine || t.riposo || t.assenzaTipo) return [];
  const pezzi = [];
  if(typeof classificaTurno === 'function' && typeof totaleStraordinario === 'function'){
    const oreStr = totaleStraordinario(classificaTurno(t));
    if(oreStr > 0) pezzi.push(`<span class="chip-dett chip-dett-str">${iconaIndennita('straordinario')}Straord. ${formatOreMinuti(oreStr)}</span>`);
  }
  const festivo = typeof lavoratoInFestivo === 'function' ? lavoratoInFestivo(t) : !!t.recuperoFestivoLavorato;
  ELENCO_INDENNITA.forEach(x => {
    if(x.chiave === 'straordinario' || x.chiave === 'servizioSvolto') return;
    const attiva = x.chiave === 'recuperoFestivoLavorato' ? festivo : !!t[x.chiave];
    if(attiva) pezzi.push(`<span class="chip-dett">${iconaIndennita(x.chiave)}${escapeHtml(x.chiave === 'buonoPasto' && numeroBuoniPasto(t) === 2 ? '2 buoni pasto' : x.nome)}</span>`);
  });
  return pezzi;
}
function straordinarioGiorno(t){
  if(!t || !t.oraInizio || !t.oraFine || t.riposo || t.assenzaTipo || typeof classificaTurno !== 'function') return 0;
  return Number(totaleStraordinario(classificaTurno(t)) || 0);
}
// "6:00" oppure "6:00" con sotto "+2:00" quando c'è straordinario (le ore totali lo comprendono).
function oreConStraordinarioHtml(t, classe){
  const tot = oreServizioGiorno(t);
  if(!tot) return '';
  const str = straordinarioGiorno(t);
  return str > 0 ? `<span class="${classe}">${formatOreMinuti(tot - str)}<small class="ore-str">+${formatOreMinuti(str)}</small></span>` : `<span class="${classe}">${formatOreMinuti(tot)}</span>`;
}
function totaleSettimanaHtml(tot, str){
  return `<b>${formatOreMinuti(tot)}</b>${str > 0 ? `<small class="ore-str"> · di cui straord. ${formatOreMinuti(str)}</small>` : ''}`;
}
function notaServizioHtml(t){
  const testo = t && !t.riposo && !t.assenzaTipo && String(t.servizioSvolto || '').trim();
  return testo ? `<span class="nota-servizio-dett">${iconaIndennita('servizioSvolto')}${escapeHtml(testo)}</span>` : '';
}
function renderVistaSettimana(iso){
  const host = el('vistaSettimanaCal');
  const lun = lunediDi(iso), oggiIso = dataISO(new Date());
  const nomi = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  let tot = 0, totStr = 0;
  const righe = nomi.map((n, i) => {
    const g = giornoPiu(dataISO(lun), i), dd = dataDaIso(g), t = AppState.turni[g];
    tot += oreServizioGiorno(t); totStr += straordinarioGiorno(t);
    const nome = nomeGiornoVista(t);
    const festa = typeof nomeFestivita === 'function' ? nomeFestivita(g) : '';
    const chip = chipDettagliGiorno(t).join('');
    const nota = notaServizioHtml(t);
    const ev = (typeof eventiDelGiorno === 'function' ? eventiDelGiorno(g) : []).map(({ ev, isoOrigine }) => `<span class="vs-ev" data-evento-giorno="${g}" data-evento-id="${escapeHtml(ev.id)}" data-evento-iso="${escapeHtml(isoOrigine || g)}"><i style="background:${coloreEvento(ev)}"></i>${ev.tuttoIlGiorno ? '' : escapeHtml(ev.oraInizio || '') + ' '}${escapeHtml(ev.titolo || 'Evento')}</span>`).join('');
    return `<button type="button" class="vs-riga${g === iso ? ' attivo' : ''}${g === oggiIso ? ' oggi' : ''}${typeof eFestivoOdDomenica === 'function' && eFestivoOdDomenica(g) ? ' festivo' : ''}" data-vista-giorno="${g}">`
      + `<span class="vs-data"><small>${n}</small><b>${dd.getDate()}</b></span>`
      + `<span class="vs-corpo"><span class="vs-testa">${nome ? `<b style="background:${coloreGiornoVista(t)};color:${testoSuColore(coloreGiornoVista(t))}">${escapeHtml(nome)}</b>` : '<em>—</em>'}${t && t.oraInizio && t.oraFine && !t.riposo && !t.assenzaTipo ? `<span class="vs-orario">${escapeHtml(t.oraInizio)}–${escapeHtml(t.oraFine)}</span>` : ''}${festa ? `<span class="vs-festa">${escapeHtml(festa)}</span>` : ''}</span>`
      + `${chip ? `<span class="vs-chip">${chip}</span>` : ''}${nota}${typeof righeUtilitaGiorno === 'function' ? righeUtilitaGiorno(g) : ''}${ev}</span>`
      + `${oreConStraordinarioHtml(t, 'vs-ore') || '<span class="vs-ore"></span>'}</button>`;
  }).join('');
  host.innerHTML = `<div class="vs-lista">${righe}</div><div class="vs-totale"><span>Ore della settimana</span><span>${totaleSettimanaHtml(tot, totStr)}</span></div>`;
}
// v3.8.15: il titolo ("Novembre 2026", "26 ott–1 nov") si rimpicciolisce quanto basta per starci
// intero, anche con i caratteri grandi del telefono, invece di essere tagliato con "…".
function adattaTitoloCalendario(){
  const t = el('etichettaMese');
  if(!t) return;
  t.style.fontSize = '';
  let px = parseFloat(getComputedStyle(t).fontSize) || 18, giri = 0;
  const minimo = t.textContent === t.dataset.corto ? 11 : 14;
  while(t.scrollWidth > t.clientWidth + 1 && px > minimo && giri++ < 20){ px -= 1; t.style.fontSize = px + 'px'; }
  // Telefoni stretti: se anche piccolo non ci sta, il mese si accorcia ("Ottobre 2026" → "Ott 2026").
  if(t.scrollWidth > t.clientWidth + 1 && t.textContent !== t.dataset.corto){
    const corto = t.textContent.replace(/^([A-Za-zÀ-ÿ]{3})[A-Za-zÀ-ÿ]+/, '$1');
    if(corto !== t.textContent){ t.dataset.corto = corto; t.textContent = corto; }
  }
}
function inizializzaVisteCalendario(){
  const menu = el('menuVistaCalendario');
  if(!menu) return;
  if(el('etichettaMese') && window.MutationObserver){
    new MutationObserver(() => requestAnimationFrame(adattaTitoloCalendario)).observe(el('etichettaMese'), { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', () => requestAnimationFrame(adattaTitoloCalendario));
    // anche quando cambia la grandezza dei caratteri con l'app aperta
    if(window.ResizeObserver){ const testa = el('etichettaMese').closest('.calendario-header-v2'); let w0 = 0; new ResizeObserver(() => { const w = el('etichettaMese').clientWidth; if(w !== w0){ w0 = w; requestAnimationFrame(adattaTitoloCalendario); } }).observe(testa || el('etichettaMese')); }
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(adattaTitoloCalendario));
    requestAnimationFrame(adattaTitoloCalendario);
  }
  on('btnVistaCalendario', 'click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; el('btnVistaCalendario').setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', e => {
    if(!menu.hidden && !e.target.closest('#menuVistaCalendario')) menu.hidden = true;
    const scelta = e.target.closest('[data-vista-calendario]');
    if(scelta){ impostaVistaCalendario(scelta.dataset.vistaCalendario); return; }
    const evS = e.target.closest('.vs-ev[data-evento-id]');
    if(evS && typeof apriEventoDaProssimi === 'function'){ apriEventoDaProssimi(evS); return; }
    const g = e.target.closest('[data-vista-giorno]');
    if(g){ selezionaGiorno(g.dataset.vistaGiorno); const d = dataDaIso(g.dataset.vistaGiorno); meseCorrente = d.getMonth(); annoCorrente = d.getFullYear(); applicaVistaCalendario(); return; }
    const tu = e.target.closest('[data-vista-turno]');
    if(tu){ apriModaleTurno(tu.dataset.vistaTurno); return; }
    const ev = e.target.closest('.vg-evento[data-evento-id]');
    if(ev && typeof apriModificaEventoV2 === 'function') apriModificaEventoV2(ev.dataset.eventoId, ev.dataset.eventoIso);
  });
}
// Ore e minuti (6:35), come nel riquadro del giorno: "6,58 h" si leggerebbe come 6 ore e 58 minuti.
function oreAgenda(n){ return formatOreMinuti(n); }
function meseBreveAgenda(d){ return d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''); }
function oreServizioGiorno(t){
  return t && t.oraInizio && t.oraFine && !t.riposo && !t.assenzaTipo ? Number(classificaTurno(t).oreTotali || 0) : 0;
}
function intestazioneSettimanaAgenda(lun, questa){
  const dom = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 6, 12);
  // Si sommano i minuti di ogni giorno (come sono scritti sotto), non le ore con i decimali
  // arrotondati: sei turni da 6:35 devono fare 39:30, non 39:29.
  let minuti = 0, minStr = 0;
  for(let k = 0; k < 7; k++){ const tk = AppState.turni[dataISO(new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + k, 12))]; minuti += Math.round(oreServizioGiorno(tk) * 60); minStr += Math.round(straordinarioGiorno(tk) * 60); }
  const ore = minuti / 60;
  const periodo = questa ? 'Questa settimana'
    : lun.getMonth() === dom.getMonth() ? `${lun.getDate()}–${dom.getDate()} ${meseBreveAgenda(dom)}`
    : `${lun.getDate()} ${meseBreveAgenda(lun)} – ${dom.getDate()} ${meseBreveAgenda(dom)}`;
  return `<div class="agenda-settimana"><span>${periodo}</span>${ore > 0 ? `<b>${oreAgenda(ore)} ore${minStr ? ` <small class="ore-str">· straord. ${oreAgenda(minStr / 60)}</small>` : ' di servizio'}</b>` : ''}</div>`;
}
function corpoGiornoAgenda(iso, t){
  // v3.8.13: riposo e assenze come nella Settimana: il nome nel suo colore, senza emoji.
  if(t && (t.riposo || t.assenzaTipo)){
    const col = coloreGiornoVista(t);
    let nome = nomeGiornoVista(t);
    if(t.assenzaTipo){ const voce = AppState.assenze.find(a => a.id === t.assenzaTipo); if(voce) nome = voce.nome; }
    return `<span class="agenda-semplice agenda-chip-giorno"><b style="background:${col};color:${testoSuColore(col)}">${escapeHtml(nome)}</b></span>`;
  }
  if(!(t && t.oraInizio && t.oraFine)) return '<span class="agenda-semplice agenda-libero">Nessun turno</span>';
  const categoria = categoriaTurno(t.oraInizio, t.oraFine, iso);
  const modello = t.modelloId ? (AppState.modelliTurno || []).find(m => m.id === t.modelloId) : null;
  // Come nel calendario: Ufficio, Aggiornamento e Tiro hanno un colore proprio anche se l'orario è di mattina.
  const categoriaColore = ['ufficio', 'aggiornamentoProfessionale', 'addestramentoTiro'].includes(t.modelloId) ? t.modelloId : categoria;
  const colore = (modello && modello.colore) || coloreCategoria(categoriaColore);
  const nome = modello ? modello.nome : (INIZIALE_CATEGORIA[categoria] || 'Turno');
  const chip = chipDettagliGiorno(t).join('');
  const nota = notaServizioHtml(t);
  return `<span class="agenda-turno" style="--colore-turno:${escapeHtml(colore)}">`
    + `<span class="agenda-turno-testo"><b>${escapeHtml(nome)}</b><small>${escapeHtml(t.oraInizio)} – ${escapeHtml(t.oraFine)}</small>`
    + `${chip ? `<span class="agenda-indennita">${chip}</span>` : ''}${nota}</span>`
    + `${oreConStraordinarioHtml(t, 'agenda-ore')}</span>`;
}
// ── v3.8.16: Agenda come una vera agenda ──
// Giorni prima e dopo (si caricano da soli scorrendo), ＋ su ogni giorno per un nuovo evento,
// filtro Tutto · Eventi · Turni, ricerca negli eventi e nei servizi svolti, eventi con fine, luogo e promemoria.
let agendaDa = null, filtroAgenda = 'tutto', cercaAgenda = '', osservatoreAgenda = null;
function inizioAgenda(){ if(!agendaDa) agendaDa = dataISO(new Date()); return agendaDa; }
function riportaAgendaAOggi(){ agendaDa = dataISO(new Date()); giorniAgenda = GIORNI_AGENDA_PASSO; cercaAgenda = ''; const c = el('campoCercaAgenda'); if(c) c.value = ''; }
function iconaLineaAgenda(nome){ return typeof svgLinea === 'function' ? svgLinea(nome, 'agenda-ic') : ''; }
function rigaEventoAgenda(iso, ev, isoOrigine){
  const quando = ev.tuttoIlGiorno ? 'Tutto il giorno' : `${escapeHtml(ev.oraInizio || '')}${ev.oraFine ? '–' + escapeHtml(ev.oraFine) : ''}`;
  const extra = [
    ev.luogo ? `<span class="agenda-ev-luogo">${iconaLineaAgenda('puntina')}${escapeHtml(ev.luogo)}</span>` : '',
    (ev.promemoria && ev.promemoria.length) || ev.ricordami ? `<span title="Con promemoria">${iconaLineaAgenda('campana')}</span>` : '',
    ev.ripeti ? `<span title="Si ripete">${iconaLineaAgenda('giro')}</span>` : ''
  ].join('');
  return `<button type="button" class="agenda-evento" data-evento-giorno="${iso}" data-evento-id="${escapeHtml(ev.id)}" data-evento-iso="${escapeHtml(isoOrigine || iso)}">`
    + `<i style="background:${coloreEvento(ev)}" aria-hidden="true"></i><em>${quando}</em>`
    + `<span class="agenda-ev-testo"><b>${escapeHtml(ev.titolo || 'Senza titolo')}</b>${extra ? `<small>${extra}</small>` : ''}</span></button>`;
}
function barraAgendaHtml(){
  const lente = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
  return `<div class="agenda-barra"><div class="agenda-filtri" role="tablist" aria-label="Cosa mostrare">`
    + ['tutto', 'eventi', 'turni'].map(f => `<button type="button" role="tab" data-filtro-agenda="${f}">${f === 'tutto' ? 'Tutto' : f === 'eventi' ? 'Eventi' : 'Turni'}</button>`).join('')
    + `</div><button type="button" class="agenda-cerca-btn" data-agenda-cerca aria-label="Cerca">${lente}</button></div>`
    + `<div class="agenda-cerca" id="boxCercaAgenda" hidden><input type="search" id="campoCercaAgenda" placeholder="Cerca o chiedi: visita, quante notti a ottobre…" autocomplete="off" enterkeyhint="search"><button type="button" class="agenda-cerca-mic" data-agenda-voce aria-label="Chiedi a voce"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button><div class="cerca-suggerimenti" id="cercaSuggerimenti"></div></div>`
    + `<div id="agendaElenco"></div>`;
}
function risultatiCercaAgenda(q){
  // Una domanda ("quante notti a ottobre?", "il 15 agosto che turno ho fatto?"): prima la risposta.
  if(typeof eDomandaVoce === 'function' && eDomandaVoce(q)){
    const r = rispondiDomandaVoce(q);
    if(r) return htmlRispostaCerca(r);
  }
  const parole = (typeof normalizzaVoce === 'function' ? normalizzaVoce(q) : q.toLowerCase()).split(' ').filter(Boolean);
  const norm = t => typeof normalizzaVoce === 'function' ? normalizzaVoce(t) : String(t || '').toLowerCase();
  const va = testo => { const n = norm(testo); return parole.every(w => n.includes(w)); };
  const trovati = [];
  Object.keys(AppState.eventiGiorno || {}).forEach(iso => (AppState.eventiGiorno[iso] || []).forEach(ev => {
    if(va(`${ev.titolo || ''} ${ev.luogo || ''} ${ev.note || ''}`)) trovati.push({ iso, html: rigaEventoAgenda(iso, ev, iso) });
  }));
  Object.keys(AppState.turni || {}).forEach(iso => {
    const t = AppState.turni[iso];
    if(t && t.servizioSvolto && va(t.servizioSvolto)) trovati.push({ iso, html: `<button type="button" class="agenda-evento agenda-risultato-servizio" data-agenda-giorno="${iso}">${iconaLineaAgenda('matita')}<em>${escapeHtml(nomeGiornoVista(t) || 'Turno')}</em><span class="agenda-ev-testo"><b>${escapeHtml(t.servizioSvolto)}</b><small>Servizio svolto</small></span></button>` });
  });
  if(typeof risultatiUtilitaPerCerca === 'function') trovati.push(...risultatiUtilitaPerCerca(va));
  const oggiIso = dataISO(new Date());
  const futuri = trovati.filter(x => x.iso >= oggiIso).sort((a, b) => a.iso.localeCompare(b.iso));
  const passati = trovati.filter(x => x.iso < oggiIso).sort((a, b) => b.iso.localeCompare(a.iso));
  const riga = x => { const d = dataDaIso(x.iso); return `<div class="agenda-giorno${eFestivoOdDomenica(x.iso) ? ' festivo' : ''}"><div class="agenda-data"><small>${GIORNI_SETTIMANA_BREVI[d.getDay()]}</small><b>${d.getDate()}</b><small>${meseBreveAgenda(d)}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}</small></div><div class="agenda-righe">${x.html}</div></div>`; };
  if(!trovati.length && typeof suggerimentiDomanda === 'function' && suggerimentiDomanda(q).length) return ''; // stai ancora scrivendo: bastano i suggerimenti
  if(!trovati.length) return `<p class="agenda-vuota">Nessun evento, servizio svolto, nota o scadenza con «${escapeHtml(q)}».</p>`;
  return (futuri.length ? `<div class="agenda-settimana"><span>In arrivo</span><b>${futuri.length}</b></div>${futuri.map(riga).join('')}` : '')
    + (passati.length ? `<div class="agenda-settimana"><span>Passati</span><b>${passati.length}</b></div>${passati.map(riga).join('')}` : '');
}
function renderAgenda(){
  const host = el('agendaCalendario');
  if(!host) return;
  if(!el('agendaElenco')) host.innerHTML = barraAgendaHtml();
  host.querySelectorAll('[data-filtro-agenda]').forEach(b => { const on = b.dataset.filtroAgenda === filtroAgenda; b.classList.toggle('attivo', on); b.setAttribute('aria-selected', String(on)); });
  const elenco = el('agendaElenco');
  if(cercaAgenda.trim()){ elenco.innerHTML = risultatiCercaAgenda(cercaAgenda.trim()); return; }
  const oggiIso = dataISO(new Date()), domaniIso = giornoPiu(oggiIso, 1), ieriIso = giornoPiu(oggiIso, -1);
  const primo = dataDaIso(inizioAgenda());
  let html = `<button type="button" class="agenda-precedenti" id="btnAgendaPrecedenti">${iconaLineaAgenda('calendario')}Mostra i ${GIORNI_AGENDA_PASSO} giorni prima</button>`;
  let lunedi = null, mostrati = 0;
  for(let i = 0; i < giorniAgenda; i++){
    const d = new Date(primo.getFullYear(), primo.getMonth(), primo.getDate() + i, 12);
    const iso = dataISO(d);
    const t = AppState.turni[iso];
    const eventi = (typeof eventiDelGiorno === 'function' ? eventiDelGiorno(iso) : [])
      .slice().sort((a, b) => (a.ev.tuttoIlGiorno ? '' : a.ev.oraInizio || '').localeCompare(b.ev.tuttoIlGiorno ? '' : b.ev.oraInizio || ''));
    if(filtroAgenda === 'eventi' && !eventi.length && !(typeof righeUtilitaGiorno === 'function' && righeUtilitaGiorno(iso))) continue;
    const lun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7, 12);
    if(dataISO(lun) !== lunedi){ lunedi = dataISO(lun); html += intestazioneSettimanaAgenda(lun, iso <= oggiIso && oggiIso <= giornoPiu(lunedi, 6)); }
    const righeEventi = filtroAgenda === 'turni' ? '' : eventi.map(({ ev, isoOrigine }) => rigaEventoAgenda(iso, ev, isoOrigine)).join('');
    const festa = typeof nomeFestivita === 'function' ? nomeFestivita(iso) : '';
    const parole = [iso === oggiIso ? 'Oggi' : iso === domaniIso ? 'Domani' : iso === ieriIso ? 'Ieri' : '', festa ? `<em>${escapeHtml(festa)}</em>` : ''].filter(Boolean).join(' · ');
    const quando = parole ? `<span class="agenda-quando">${parole}</span>` : '';
    const classi = 'agenda-giorno' + (iso === oggiIso ? ' oggi' : '') + (iso < oggiIso ? ' passato' : '') + (eFestivoOdDomenica(iso) ? ' festivo' : '');
    const corpo = filtroAgenda === 'eventi' ? '' : `<button type="button" class="agenda-corpo" aria-label="${d.getDate()} ${NOMI_MESI[d.getMonth()]}: apri il giorno">${corpoGiornoAgenda(iso, t)}</button>`;
    html += `<div class="${classi}" data-agenda-giorno="${iso}">`
      + `<div class="agenda-data"><small>${GIORNI_SETTIMANA_BREVI[d.getDay()]}</small><b>${d.getDate()}</b>`
      + `<button type="button" class="agenda-piu" data-agenda-nuovo="${iso}" aria-label="Nuovo evento il ${d.getDate()} ${NOMI_MESI[d.getMonth()]}">＋</button></div>`
      + `<div class="agenda-righe">${quando}${corpo}${filtroAgenda === 'turni' || typeof righeUtilitaGiorno !== 'function' ? '' : righeUtilitaGiorno(iso)}${righeEventi}</div></div>`;
    mostrati++;
  }
  if(!mostrati) html += `<p class="agenda-vuota">Nessun evento in questi giorni.</p>`;
  html += `<button type="button" class="btn-secondario agenda-altri" id="btnAgendaAltri">Mostra altri ${GIORNI_AGENDA_PASSO} giorni</button>`;
  elenco.innerHTML = html;
  // In fondo i giorni dopo arrivano da soli, scorrendo (come in un'agenda vera); il tasto resta per sicurezza.
  if(window.IntersectionObserver){
    if(osservatoreAgenda) osservatoreAgenda.disconnect();
    osservatoreAgenda = new IntersectionObserver(voci => {
      if(voci.some(v => v.isIntersecting) && giorniAgenda < 400 && vistaCalendario() === 'agenda'){ giorniAgenda += GIORNI_AGENDA_PASSO; renderAgenda(); }
    }, { rootMargin: '200px' });
    const altri = el('btnAgendaAltri'); if(altri) osservatoreAgenda.observe(altri);
  }
}
function clicAgenda(e){
  const filtro = e.target.closest('[data-filtro-agenda]');
  if(filtro){ filtroAgenda = filtro.dataset.filtroAgenda; renderAgenda(); return; }
  if(e.target.closest('[data-agenda-cerca]')){
    const box = el('boxCercaAgenda'); box.hidden = !box.hidden;
    if(!box.hidden){ el('campoCercaAgenda').focus(); aggiornaSuggerimentiCerca(); } else chiudiCercaCal();
    return;
  }
  if(e.target.closest('[data-agenda-voce]')){ if(typeof apriDettaVoce === 'function') apriDettaVoce(); return; }
  const sugg = e.target.closest('[data-suggerimento]');
  if(sugg){ const c = el('campoCercaAgenda'); c.value = sugg.dataset.suggerimento; cercaAgenda = c.value; renderAgenda(); aggiornaSuggerimentiCerca(); return; }
  const giornoRisposta = e.target.closest('[data-cerca-giorno]');
  if(giornoRisposta){ const iso = giornoRisposta.dataset.cercaGiorno; chiudiCercaCal(); if(typeof vaiAlGiornoVoce === 'function') vaiAlGiornoVoce(iso); return; }
  const vaiRisposta = e.target.closest('[data-cerca-vai]');
  if(vaiRisposta){ const v = vaiRisposta.dataset.cercaVai; chiudiCercaCal(); if(v === 'assenze') mostraScheda('assenze'); else apriUtilita(v); return; }
  const nuovo = e.target.closest('[data-agenda-nuovo]');
  if(nuovo){
    const iso = nuovo.dataset.agendaNuovo, d = dataDaIso(iso);
    meseCorrente = d.getMonth(); annoCorrente = d.getFullYear(); giornoSelezionato = iso;
    if(typeof apriModificaEventoV2 === 'function') apriModificaEventoV2(null);
    return;
  }
  const evento = e.target.closest('[data-evento-id]');
  if(evento){ apriEventoDaProssimi(evento); return; }
  if(e.target.closest('#btnAgendaAltri')){ giorniAgenda += GIORNI_AGENDA_PASSO; renderAgenda(); return; }
  if(e.target.closest('#btnAgendaPrecedenti')){
    const h0 = document.documentElement.scrollHeight;
    agendaDa = giornoPiu(inizioAgenda(), -GIORNI_AGENDA_PASSO); giorniAgenda += GIORNI_AGENDA_PASSO;
    renderAgenda();
    window.scrollBy(0, document.documentElement.scrollHeight - h0);
    return;
  }
  const riga = e.target.closest('[data-agenda-giorno]');
  if(!riga || !e.target.closest('.agenda-corpo, .agenda-risultato-servizio')) return;
  const iso = riga.dataset.agendaGiorno;
  const d = dataDaIso(iso);
  meseCorrente = d.getMonth();
  annoCorrente = d.getFullYear();
  giornoSelezionato = iso;
  renderCalendario();
  apriModaleTurno(iso);
}
function inizializzaCercaAgenda(){
  document.addEventListener('input', e => { if(e.target && e.target.id === 'campoCercaAgenda'){ cercaAgenda = e.target.value; renderAgenda(); aggiornaSuggerimentiCerca(); } });
}


// v3.8.12: il nome della festa (come in Google Calendar), per i giorni festivi riconosciuti dall'app.
const NOMI_FESTE_FISSE = { '01-01': 'Capodanno', '01-06': 'Epifania', '04-25': 'Festa della Liberazione', '05-01': 'Festa del Lavoro', '06-02': 'Festa della Repubblica', '08-15': 'Ferragosto', '11-01': 'Ognissanti', '12-08': 'Immacolata Concezione', '12-25': 'Natale', '12-26': 'Santo Stefano' };
function nomeFestivita(iso){
  if(!iso) return '';
  if(NOMI_FESTE_FISSE[iso.slice(5)]) return NOMI_FESTE_FISSE[iso.slice(5)];
  const pasqua = calcolaPasqua(Number(iso.slice(0, 4)));
  if(dataISO(pasqua) === iso) return 'Pasqua';
  const lun = new Date(pasqua); lun.setDate(pasqua.getDate() + 1);
  return dataISO(lun) === iso ? "Lunedì dell'Angelo" : '';
}

// v3.8.12: "Condividi il mese": un'immagine del mese con i turni, da mandare su WhatsApp.
function etichettaBreveGiorno(t){
  if(!t) return '';
  if(t.assenzaTipo){ const v = (AppState.assenze || []).find(a => a.id === t.assenzaTipo); return siglaAssenza(v ? v.nome : 'Assenza'); }
  if(t.riposo) return 'Riposo';
  const m = (AppState.modelliTurno || []).find(x => x.id === t.modelloId);
  if(m && typeof NOME_BREVE_CATEGORIA !== 'undefined' && NOME_BREVE_CATEGORIA[m.id]) return NOME_BREVE_CATEGORIA[m.id];
  const n = m ? m.nome : (t.oraInizio ? 'Turno' : '');
  return n.length <= 6 ? n : (m && m.sigla ? m.sigla : n.slice(0, 5) + '.');
}
function disegnaImmagineMese(){
  const primo0 = new Date(annoCorrente, meseCorrente, 1), righe = Math.ceil(((primo0.getDay() + 6) % 7 + new Date(annoCorrente, meseCorrente + 1, 0).getDate()) / 7);
  const W = 1080, cella = W / 7, testa = 190, H = testa + 70 + righe * 150 + 70;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const font = (peso, px) => `${peso} ${px}px "IBM Plex Sans", system-ui, sans-serif`;
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1B2440'; g.font = font(700, 64); g.textAlign = 'left';
  g.fillText(`${NOMI_MESI[meseCorrente]} ${annoCorrente}`, 48, 110);
  g.fillStyle = '#6B7280'; g.font = font(500, 30);
  g.fillText('I miei turni', 48, 156);
  const giorni = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
  g.font = font(700, 26); g.textAlign = 'center';
  giorni.forEach((n, i) => { g.fillStyle = i >= 5 ? '#C62828' : '#4B5563'; g.fillText(n, cella * i + cella / 2, testa + 40); });
  const primo = new Date(annoCorrente, meseCorrente, 1), offset = (primo.getDay() + 6) % 7;
  const nGiorni = new Date(annoCorrente, meseCorrente + 1, 0).getDate();
  for(let gg = 1; gg <= nGiorni; gg++){
    const pos = offset + gg - 1, r = Math.floor(pos / 7), c = pos % 7;
    const x = cella * c, y = testa + 70 + r * 150;
    const iso = dataISO(new Date(annoCorrente, meseCorrente, gg));
    g.strokeStyle = '#E5E7EB'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + cella - 6, y); g.stroke();
    g.fillStyle = eFestivoOdDomenica(iso) ? '#C62828' : '#1B2440'; g.font = font(700, 40);
    g.fillText(String(gg), x + cella / 2, y + 52);
    const t = AppState.turni[iso], et = etichettaBreveGiorno(t);
    if(et){
      const col = coloreGiornoVista(t) || '#C9CED6';
      g.fillStyle = col;
      const pw = cella - 20, ph = 46, px = x + 10, py = y + 72;
      g.beginPath(); if(g.roundRect) g.roundRect(px, py, pw, ph, 12); else g.rect(px, py, pw, ph); g.fill();
      g.fillStyle = testoSuColore(col); g.font = font(700, 26);
      g.fillText(et, x + cella / 2, py + 32);
    }
  }
  g.fillStyle = '#9CA3AF'; g.font = font(500, 24); g.textAlign = 'right';
  g.fillText('Turni & Accessorio PS', W - 40, H - 30);
  return cv;
}
async function condividiMese(){
  el('menuVistaCalendario').hidden = true;
  const cv = disegnaImmagineMese();
  const nome = `turni-${annoCorrente}-${String(meseCorrente + 1).padStart(2, '0')}.png`;
  const dataUrl = cv.toDataURL('image/png');
  const C = window.Capacitor;
  if(C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Filesystem && C.Plugins.Share){
    try{
      await C.Plugins.Filesystem.writeFile({ path: nome, data: dataUrl.split(',')[1], directory: 'CACHE' });
      const ris = await C.Plugins.Filesystem.getUri({ path: nome, directory: 'CACHE' });
      await C.Plugins.Share.share({ title: `Turni di ${NOMI_MESI[meseCorrente].toLowerCase()}`, url: ris.uri, dialogTitle: 'Condividi il mese' });
      return;
    }catch(e){ console.warn('Condivisione nativa non riuscita:', e); }
  }
  try{
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], nome, { type: 'image/png' });
    if(navigator.canShare && navigator.canShare({ files: [file] })){ await navigator.share({ files: [file], title: nome }); return; }
  }catch(e){}
  const a = document.createElement('a'); a.href = dataUrl; a.download = nome; a.click();
}

// ── Lente del calendario: una sola ricerca (eventi, servizi, note, veicolo, scadenze) che risponde anche alle domande ──
let vistaPrimaCerca = null;
function apriCercaCal(){
  vistaPrimaCerca = vistaCalendario() === 'agenda' ? null : vistaCalendario();
  impostaVistaCalendario('agenda');
  const box = el('boxCercaAgenda'); if(!box) return;
  box.hidden = false; window.scrollTo(0, 0); aggiornaSuggerimentiCerca();
  setTimeout(() => { const c = el('campoCercaAgenda'); if(c) c.focus(); }, 50);
}
function chiudiCercaCal(){
  cercaAgenda = ''; const c = el('campoCercaAgenda'); if(c) c.value = '';
  const box = el('boxCercaAgenda'); if(box) box.hidden = true;
  if(vistaPrimaCerca){ const v = vistaPrimaCerca; vistaPrimaCerca = null; impostaVistaCalendario(v); } else renderAgenda();
}
function htmlRispostaCerca(r){
  const righe = r.righe.map(x => { const d = dataDaIso(x.iso); return `<button type="button" class="voce-riga voce-riga-risposta" data-cerca-giorno="${x.iso}"><div class="voce-data"><small>${GIORNI_SETTIMANA_BREVI[d.getDay()]}</small><b>${d.getDate()}</b><small>${NOMI_MESI[d.getMonth()].slice(0, 3).toLowerCase()}</small></div><div class="voce-testo"><div>${x.html}</div>${x.sotto ? `<small>${x.sotto}</small>` : ''}</div><i aria-hidden="true">›</i></button>`; }).join('');
  return `<div class="cerca-risposta"><small>Risposta</small><b>${escapeHtml(r.titolo)}</b>${r.sotto ? `<span>${escapeHtml(r.sotto)}</span>` : ''}${r.vai ? `<button type="button" class="btn-testo-evento" data-cerca-vai="${r.vai}">Apri ›</button>` : ''}</div>${righe ? `<div class="voce-righe cerca-righe">${righe}</div>` : ''}`;
}
document.addEventListener('click', e => { if(e.target.closest && e.target.closest('#btnCercaCal')) apriCercaCal(); });

// Suggerimenti sotto la casella: domande pronte che completano quello che stai scrivendo (al massimo 4).
function aggiornaSuggerimentiCerca(){
  const box = el('cercaSuggerimenti'), c = el('campoCercaAgenda');
  if(!box || !c || typeof suggerimentiDomanda !== 'function') return;
  const lista = suggerimentiDomanda(c.value);
  box.innerHTML = lista.map(f => `<button type="button" class="cerca-sugg" data-suggerimento="${escapeHtml(f)}">${escapeHtml(f.charAt(0).toUpperCase() + f.slice(1))}</button>`).join('');
  box.hidden = !lista.length;
}

// ── v3.8.27: vista Anno (12 mesi piccoli, colorati per turno) e maniglia per cambiare vista col dito ──
function renderVistaAnno(anno){
  const host = el('vistaAnnoCal'); if(!host) return;
  const oggiIso = dataISO(new Date());
  let html = '<div class="anno-griglia">';
  for(let m = 0; m < 12; m++){
    const primo = new Date(anno, m, 1, 12), giorni = new Date(anno, m + 1, 0).getDate();
    const vuoti = (primo.getDay() + 6) % 7;
    const corrente = anno === new Date().getFullYear() && m === new Date().getMonth();
    html += `<button type="button" class="anno-mese${corrente ? ' corrente' : ''}" data-anno-mese="${m}"><b>${NOMI_MESI[m].slice(0, 3)}</b><span class="anno-giorni">`
      + ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => `<i>${x}</i>`).join('') + '<em></em>'.repeat(vuoti);
    for(let g = 1; g <= giorni; g++){
      const iso = `${anno}-${String(m + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
      const t = AppState.turni[iso], col = coloreGiornoVista(t);
      const cls = (iso === oggiIso ? ' oggi' : '') + (t && t.assenzaTipo ? ' assenza' : '') + (eFestivoOdDomenica(iso) ? ' festivo' : '');
      html += `<em class="${cls.trim()}"${col ? ` style="background:${col}"` : ''}>${g}</em>`;
    }
    html += '</span></button>';
  }
  html += '</div>';
  // Riassunto dell'anno: le assenze segnate (ferie e altro), utile per programmare.
  const ass = {};
  Object.entries(AppState.turni).forEach(([iso, t]) => { if(t && t.assenzaTipo && iso.startsWith(anno + '-')){ const v = (AppState.assenze || []).find(a => a.id === t.assenzaTipo); const n = v ? v.nome : 'Assenza'; ass[n] = (ass[n] || 0) + 1; } });
  const voci = Object.entries(ass).sort((a, b) => b[1] - a[1]);
  if(voci.length) html += `<p class="anno-riassunto">${voci.map(([n, k]) => `<span>${escapeHtml(n)} <b>${k}</b></span>`).join('')}</p>`;
  host.innerHTML = html;
}
document.addEventListener('click', e => {
  const m = e.target.closest && e.target.closest('[data-anno-mese]');
  if(!m) return;
  const mm = Number(m.dataset.annoMese), oggi = new Date();
  giornoSelezionato = annoCorrente === oggi.getFullYear() && mm === oggi.getMonth() ? dataISO(oggi) : dataISO(new Date(annoCorrente, mm, 1, 12));
  impostaVistaCalendario('mese');
});
// Maniglia sotto il calendario: trascina in su per stringere (Anno → Mese → Settimana), in giù per allargare.
const ORDINE_VISTE_MANIGLIA = ['diario', 'mese', 'anno'];
function cambiaVistaConManiglia(dir){
  let v = vistaCalendario(); if(v === 'giorno') v = 'diario'; if(v === 'agenda') return;
  const i = ORDINE_VISTE_MANIGLIA.indexOf(v), j = Math.max(0, Math.min(ORDINE_VISTE_MANIGLIA.length - 1, i + dir));
  if(j !== i) impostaVistaCalendario(ORDINE_VISTE_MANIGLIA[j]);
}
(function(){
  // v3.8.31: dopo un trascinamento non conta anche il tocco (prima la vista cambiava due volte).
  let y0 = null, ultimoTrascinamento = 0;
  document.addEventListener('touchstart', e => { if(e.target.closest && e.target.closest('#manigliaVista') && e.touches.length === 1) y0 = e.touches[0].clientY; else y0 = null; }, { passive: true });
  document.addEventListener('touchend', e => { if(y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; if(Math.abs(dy) >= 25){ ultimoTrascinamento = Date.now(); cambiaVistaConManiglia(dy > 0 ? 1 : -1); } }, { passive: true });
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('#manigliaVista') && y0 === null && Date.now() - ultimoTrascinamento > 600) cambiaVistaConManiglia(vistaCalendario() === 'diario' || vistaCalendario() === 'giorno' ? 1 : -1); });
})();

// ── v3.8.28: vista Diario — la settimana come un'agenda di carta: due pagine, spirale, righe ──
function settimanaDellAnno(d){
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const g = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - g);
  const inizio = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - inizio) / 86400000 + 1) / 7);
}
function paginaGiornoDiario(iso, mezza){
  const d = dataDaIso(iso), t = AppState.turni[iso], oggi = iso === dataISO(new Date());
  const nomi = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const righe = [];
  if(t && (t.riposo || t.assenzaTipo || t.oraInizio)){
    const col = coloreGiornoVista(t);
    righe.push(`<span class="diario-turno"><b style="background:${col};color:${testoSuColore(col)}">${escapeHtml(nomeGiornoVista(t))}</b>${t.oraInizio && !t.riposo && !t.assenzaTipo ? ` <i class="diario-turno-ora">${t.oraInizio}–${t.oraFine}</i>` : ''}</span>`);
    if(t.secondoAttivo && t.secondoOraInizio && t.secondoOraFine && !t.riposo && !t.assenzaTipo) righe.push(`<span class="diario-ora">${t.secondoOraInizio}–${t.secondoOraFine}</span> rientro`);
    if(t.straordinarioDopoInizio && t.straordinarioDopoFine) righe.push(`<span class="diario-ora">${t.straordinarioDopoInizio}–${t.straordinarioDopoFine}</span> straordinario`);
    if(t.straordinarioPrimaInizio && t.straordinarioPrimaFine) righe.push(`<span class="diario-ora">${t.straordinarioPrimaInizio}–${t.straordinarioPrimaFine}</span> straordinario`);
    if(t.servizioSvolto) righe.push(`✎ ${escapeHtml(t.servizioSvolto)}`);
  }
  try{ eventiDelGiorno(iso).forEach(({ ev }) => righe.push(`${ev.tuttoIlGiorno || !ev.oraInizio ? '' : `<span class="diario-ora">${ev.oraInizio}</span> `}${escapeHtml(ev.titolo || 'Evento')}`)); }catch(e){}
  try{
    U.note.filter(n => n.giorno === iso).forEach(n => righe.push(`☐ ${escapeHtml(n.titolo || n.testo.slice(0, 40))}`));
    U.uscite.filter(u => u.giorno === iso).forEach(u => { const mz = mezzoDi(u.mezzoId); righe.push(`🚓 ${escapeHtml(mz ? mz.sigla : 'Veicolo')}${kmPercorsi(u) !== null ? ' · ' + numeroIt0(kmPercorsi(u)) + ' km' : ''}`); });
    U.scadenze.filter(x => x.data === iso).forEach(x => righe.push(`<mark>⏰ ${escapeHtml(x.nome)}</mark>`));
  }catch(e){}
  const festa = typeof nomeFestivita === 'function' ? nomeFestivita(iso) : '';
  return `<button type="button" class="diario-giorno${mezza ? ' mezza' : ''}${oggi ? ' oggi' : ''}${eFestivoOdDomenica(iso) ? ' festivo' : ''}" data-diario-giorno="${iso}">`
    + `<span class="diario-testa">${nomi[d.getDay()]} <b>${d.getDate()}</b>${festa ? `<small>${escapeHtml(festa)}</small>` : ''}</span>`
    + `<span class="diario-righe">${righe.map(r => `<span>${r}</span>`).join('')}</span></button>`;
}
let paginaDaGirareDiario = 0;
function renderVistaDiario(iso){
  const host = el('vistaDiarioCal'); if(!host) return;
  const lun = dataISO(lunediDi(iso)), g = n => giornoPiu(lun, n);
  host.innerHTML = `<div class="diario-libro">`
    + `<div class="diario-pagina sx">${paginaGiornoDiario(g(0))}${paginaGiornoDiario(g(1))}${paginaGiornoDiario(g(2))}${paginaGiornoDiario(g(3))}</div>`
    + `<div class="diario-spirale" aria-hidden="true"></div>`
    + `<div class="diario-pagina dx">${paginaGiornoDiario(g(4))}${paginaGiornoDiario(g(5))}${paginaGiornoDiario(g(6))}`
    + `<div class="diario-giorno diario-note"><span class="diario-testa">Note della settimana</span><textarea class="diario-note-testo" data-diario-note="${lun}" placeholder="Scrivi qui…" maxlength="600">${escapeHtml(((typeof U !== 'undefined' && U.noteSettimana) || {})[lun] || '')}</textarea></div></div>`
    + `</div><p class="diario-sett">Settimana ${settimanaDellAnno(dataDaIso(lun))}</p>`;
  if(paginaDaGirareDiario){ voltaPaginaDiario(paginaDaGirareDiario); paginaDaGirareDiario = 0; }
}
function voltaPaginaDiario(dir){
  const libro = document.querySelector('.diario-libro'); if(!libro) return;
  const c = dir > 0 ? 'volta-avanti' : 'volta-indietro';
  libro.classList.remove('volta-avanti', 'volta-indietro'); void libro.offsetWidth; libro.classList.add(c);
}
document.addEventListener('click', e => {
  const g = e.target.closest && e.target.closest('[data-diario-giorno]');
  if(!g) return;
  const iso = g.dataset.diarioGiorno, d = dataDaIso(iso);
  meseCorrente = d.getMonth(); annoCorrente = d.getFullYear(); giornoSelezionato = iso;
  if(typeof apriModaleTurno === 'function') apriModaleTurno(iso);
});

// Note della settimana (Diario): si salvano quando esci dal riquadro; restano sul telefono e nel backup.
document.addEventListener('change', e => {
  const t = e.target.closest && e.target.closest('[data-diario-note]');
  if(!t || typeof U === 'undefined') return;
  U.noteSettimana = U.noteSettimana || {};
  const v = t.value.trim();
  if(v) U.noteSettimana[t.dataset.diarioNote] = v; else delete U.noteSettimana[t.dataset.diarioNote];
  salvaUtilita();
});
