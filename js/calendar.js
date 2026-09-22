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
  let cursore = new Date(inizio);
  while(cursore < fine){
    const h = cursore.getHours();
    if(h >= 6 && h < 12) minuti.mattina++;
    else if(h >= 12 && h < 18) minuti.pomeriggio++;
    else if(h >= 18) minuti.sera++;
    else minuti.notte++;
    cursore = new Date(cursore.getTime() + 60000);
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
  let cursore = new Date(inizio);
  while(cursore < fine){
    const ora = cursore.getHours();
    const notte = ora >= 22 || ora < 6;
    const iso = dataISO(cursore);
    const domenica = eDomenica(iso);
    const festivo = !domenica && eFestivoFisso(iso);
    if(notte && (domenica || festivo)) cat.notturneFestive++;
    else if(domenica) cat.domenicali++;
    else if(festivo) cat.festive++;
    else if(notte) cat.notturne++;
    else cat.ordinarie++;
    if(ora >= 18 && ora < 22) cat.serali++; // fascia serale, tracciata a parte per il controllo del territorio
    cursore = new Date(cursore.getTime() + 60000); // passo di 1 minuto
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
  const prima = finestraAssoluta(t.data, t.straordinarioPrimaInizio, t.straordinarioPrimaFine);
  const dopo = finestraAssoluta(t.data, t.straordinarioDopoInizio, t.straordinarioDopoFine);
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
  const permessoBreveCalc = t.permessoBreveAttivo ? finestraDaOrari(t.data, t.permessoBreveOraInizio, t.permessoBreveOraFine) : { ore:0, classificazione:{ ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, serali:0 } };
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
  const primaCalc = finestraDaOrari(t.data, t.straordinarioPrimaInizio, t.straordinarioPrimaFine);
  const dopoCalc = finestraDaOrari(t.data, t.straordinarioDopoInizio, t.straordinarioDopoFine);
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
    if(t.buonoPasto) buoniPasto++;
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
  el('rRiposi').textContent = riposi;
  el('rReperibilita').textContent = reperibilita;
  el('rMissioni').textContent = missioni;
  el('rServizioEsterno').textContent = servizioEsterno;
  el('rOrdinePubblico').textContent = ordinePubblico;
  el('rControlloTerritorio').textContent = `${giorniControlloTerritorioSerali} serale · ${giorniControlloTerritorioNotturni} notturno`;
  el('rBuoniPasto').textContent = `${buoniPasto} (${euro(round2(buoniPasto * AppState.tabelle.buonoPastoValore))})`;
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
  document.querySelectorAll('#calendarioGriglia .giorno-cella:not(.vuota)').forEach(cella => {
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

  for(let i = 0; i < offset; i++){
    const vuota = document.createElement('div');
    vuota.className = 'giorno-cella vuota';
    vuota.setAttribute('aria-hidden','true');
    griglia.appendChild(vuota);
  }

  for(let g = 1; g <= giorniNelMese; g++){
    const d = new Date(annoCorrente, meseCorrente, g);
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
      classi += ' ha-turno tipo-' + categoria;
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

    let etichetta = categoria === 'assenza'
      ? siglaAssenza(voceAssenza ? voceAssenza.nome : 'Assenza')
      : modelloUsato ? modelloUsato.nome
      : categoria ? INIZIALE_CATEGORIA[categoria] : '';

    if(t && t.aggiornamentoProfessionale) etichetta = 'AGG';
    else if(t && t.addestramentoTiro) etichetta = 'TIRI';

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
    const haControllo = !!(t && t.controlloTerritorio);
    const haBuono = !!(t && t.buonoPasto);
    const haNota = !!(t && t.servizioSvolto);

    if(haStraordinario) classi += ' ha-straordinario';
    if(haMissione) classi += ' ha-missione';
    if(haAssenza) classi += ' ha-assenza';
    if(haServizioEsterno) classi += ' ha-servizio-esterno';
    if(haReperibilita) classi += ' ha-reperibilita';
    if(haOP) classi += ' ha-op';

    const badge = [];
    if(haStraordinario) badge.push('<span class="giorno-badge badge-straordinario" title="Straordinario" aria-label="Straordinario">⏱</span>');
    if(haMissione) badge.push('<span class="giorno-badge badge-missione" title="Missione" aria-label="Missione">◆</span>');
    if(haAssenza) badge.push('<span class="giorno-badge badge-assenza" title="Assenza" aria-label="Assenza">A</span>');
    if(haServizioEsterno) badge.push('<span class="giorno-badge badge-esterno" title="Servizio esterno" aria-label="Servizio esterno">◆</span>');
    if(haOP) badge.push('<span class="giorno-badge badge-op" title="Ordine pubblico" aria-label="Ordine pubblico">OP</span>');
    if(haReperibilita) badge.push('<span class="giorno-badge badge-reperibilita" title="Reperibilità" aria-label="Reperibilità">★</span>');
    if(haControllo) badge.push('<span class="giorno-badge badge-controllo" title="Controllo territorio" aria-label="Controllo territorio">CT</span>');
    if(haBuono) badge.push('<span class="giorno-badge badge-buono" title="Buono pasto" aria-label="Buono pasto">€</span>');
    if(haNota) badge.push('<span class="giorno-badge badge-nota" title="Nota servizio" aria-label="Nota servizio">✎</span>');

    // Su mobile mostriamo solo i primi 3 indicatori e un contatore +N.
    const badgeVisibili = badge.slice(0, 3);
    if(badge.length > 3){
      badgeVisibili.push(`<span class="giorno-badge badge-more" title="Altri ${badge.length - 3} indicatori">+${badge.length - 3}</span>`);
    }

    const orario = t && t.oraInizio && t.oraFine && !t.riposo && !t.assenzaTipo
      ? `<span class="giorno-orario">${escapeHtml(t.oraInizio)}–${escapeHtml(t.oraFine)}</span>`
      : '';
    const oreLabel = ore > 0 ? `<span class="giorno-ore">${String(ore).replace('.',',')}h</span>` : '';
    const tipoLabel = categoria === 'assenza'
      ? escapeHtml(voceAssenza ? voceAssenza.nome : 'Assenza')
      : categoria === 'riposo'
        ? 'Riposo'
        : etichetta || 'Libero';

    cella.className = classi;
    cella.dataset.data = iso;
    cella.dataset.filtro = categoriaFiltroCalendario(t, categoria);
    cella.setAttribute('aria-label', `${g} ${NOMI_MESI[meseCorrente]} ${annoCorrente}: ${nomeCategoria}${orario ? ', ' + t.oraInizio + '–' + t.oraFine : ''}${haStraordinario ? ', straordinario' : ''}${haMissione ? ', missione' : ''}${haAssenza ? ', assenza' : ''}`);
    cella.title = `${g} ${NOMI_MESI[meseCorrente]} — ${nomeCategoria}${haStraordinario ? ' · Straordinario' : ''}${haMissione ? ' · Missione' : ''}`;

    cella.innerHTML = `
      <span class="giorno-topline">
        <span class="giorno-numero">${g}</span>
        ${(AppState.eventiGiorno[iso] || []).length ? '<span class="giorno-pallino-evento" title="Hai un evento questo giorno" aria-hidden="true">●</span>' : ''}
        <span class="giorno-badge-list">${badgeVisibili.join('')}</span>
      </span>
      <span class="giorno-turno-badge" title="${escapeHtml(nomeCategoria)}"><span class="giorno-turno-codice">${escapeHtml(codiceCategoria)}</span><span class="giorno-turno-nome">${escapeHtml(tipoLabel)}</span></span>
      ${orario || oreLabel ? `<span class="giorno-meta">${orario}${oreLabel}</span>` : '<span class="giorno-meta giorno-meta-vuoto">—</span>'}
    `;

    cella.addEventListener('click', () => gestisciTocchGiornoV2(iso));
    griglia.appendChild(cella);
  }

  aggiornaFiltriCalendario();
  impostaFiltroCalendario(filtroCalendario);
  aggiornaDettaglioGiorno();
  aggiornaRiepilogoMensile();
  aggiornaRiepilogoTurniV45();
  aggiornaProssimoTurno();
  if(typeof aggiornaDashboard === 'function') aggiornaDashboard();
  if(typeof aggiornaRiepilogoVisualeMese === 'function') aggiornaRiepilogoVisualeMese();
  if(typeof aggiornaRiepilogoGiornoSelezionatoV2 === 'function') aggiornaRiepilogoGiornoSelezionatoV2();
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
