/* FASE 1 — modulo estratto dal precedente script.js. */

function calcolaAssegnoFunzioneMensile(){
  // Spetta automaticamente a tutti al superamento della soglia di anni, senza condizioni
  // aggiuntive: nessun interruttore manuale da attivare in Anagrafica.
  if(!AppState.anagrafica) return 0;
  const anni = Number(AppState.anagrafica.anni) || 0;
  const cat = (MAPPA_GRADI[AppState.anagrafica.qualifica] || { cat:'truppa' }).cat;
  const s = AppState.tabelle.assegnoFunzioneAnnuo[cat] || AppState.tabelle.assegnoFunzioneAnnuo.truppa;
  let annuo = 0;
  if(anni >= 32) annuo = s.soglia32;
  else if(anni >= 27) annuo = s.soglia27;
  else if(anni >= 17) annuo = s.soglia17;
  return round2(annuo / 12);
}

function calcolaProduttivitaCollettivaAnnua(annoDiRiferimento){
  let giorniTotali = 0;
  for(let m = 0; m < 12; m++){
    giorniTotali += calcolaRiepilogoOreMese(annoDiRiferimento, m).giorniPresenzaEffettiva;
  }
  return round2(giorniTotali * AppState.tabelle.indennitaProduttivitaCollettiva);
}

function calcolaCambioTurnoAnnuo(annoDiRiferimento){
  let occorrenze = 0;
  for(let m = 0; m < 12; m++) occorrenze += calcolaRiepilogoOreMese(annoDiRiferimento, m).turniCambioTurno || 0;
  return round2(occorrenze * AppState.tabelle.indennitaCambioTurno);
}

function calcolaCompetenze(anno, mese){
  const { tot, reperibilita, turniServizioEsternoValidi, turniFestiviLavorati, turniFestivitaParticolare, turniCompensazioneRiposo, turniCambioTurno, giorniPresenzaEffettiva, giorniControlloTerritorioSerali, giorniControlloTerritorioNotturni, indennitaMissioniTotale, indennitaOPTotale } = calcolaRiepilogoOreMese(anno, mese);
  const qualifica = AppState.anagrafica ? AppState.anagrafica.qualifica : 'Agente';
  const tabellaStraordinario = anno >= 2027 ? AppState.tabelle.straordinarioOrario2027 : AppState.tabelle.straordinarioOrarioAttuale;
  const tariffe = tabellaStraordinario[qualifica] || tabellaStraordinario['Agente'];

  const tabellaStipendio = anno >= 2027 ? AppState.tabelle.stipendiAnnui2027 : AppState.tabelle.stipendiAnnuiAttuale;
  const tabellaIndennitaPensionabile = anno >= 2027 ? AppState.tabelle.indennitaPensionabileAnnua2027 : AppState.tabelle.indennitaPensionabileAnnuaAttuale;

  const stipendioTabellare = round2((tabellaStipendio[qualifica] || 0) / 12);
  const iis = round2(AppState.tabelle.iisMensile);
  const indennitaPensionabile = round2((tabellaIndennitaPensionabile[qualifica] || 0) / 12);
  const assegnoFunzione = calcolaAssegnoFunzioneMensile();

  const strDiurno = round2(tot.strDiurno * tariffe.diurno);
  const strNotturno = round2(tot.strNotturno * tariffe.notturnoOFestivo);
  const strFestivo = round2(tot.strFestivo * tariffe.notturnoOFestivo);
  const strNotturnoFestivo = round2(tot.strNotturnoFestivo * tariffe.notturnoFestivo);

  const indTurnoNotturno = round2(tot.notturne * AppState.tabelle.indennitaTurnoNotturnoOraria);
  const indFestiva = round2(turniFestiviLavorati * AppState.tabelle.indennitaPresenzaFestivaTurno);
  const indFestivitaParticolare = round2(turniFestivitaParticolare * AppState.tabelle.indennitaFestivitaParticolareGiorno);
  const indCompensazioneRiposo = round2(turniCompensazioneRiposo * AppState.tabelle.indennitaCompensazioneRiposoLavorato);
  // Cambio turno: come la produttività, si liquida a luglio per tutto l'anno precedente (cedolino: "dal 01/2025 al 12/2025").
  const indCambioTurno = mese === 6 ? calcolaCambioTurnoAnnuo(anno - 1) : 0;
  // Produttività collettiva: NON è una voce mensile. Viene liquidata in un'unica soluzione nel cedolino di luglio,
  // calcolata sui giorni di presenza effettiva dell'intero anno solare precedente (gennaio-dicembre).
  const indProduttivitaCollettiva = mese === 6 ? calcolaProduttivitaCollettivaAnnua(anno - 1) : 0;
  const indOP = indennitaOPTotale;
  const indServizioEsterno = round2(turniServizioEsternoValidi * AppState.tabelle.indennitaServizioEsternoTurno);
  const indControlloTerritorio = round2(
    giorniControlloTerritorioSerali * AppState.tabelle.indennitaControlloTerritorioSeraleFlat +
    giorniControlloTerritorioNotturni * AppState.tabelle.indennitaControlloTerritorioNotturnoFlat
  );
  const indReperibilita = round2(reperibilita * AppState.tabelle.reperibilitaGiornaliera);
  const indMissioni = indennitaMissioniTotale;

  // Tredicesima: erogata a dicembre (mese indice 11), pari a una mensilità di tutte le voci fisse:
  // stipendio, IIS, indennità pensionabile, assegno funzionale e vacanza contrattuale (cedolino dic. 2025: 2.904,25 €).
  const vacanzaContrattuale = round2((AppState.indennitaPersonalizzate || []).filter(ip => ip.unita !== 'turno' && /vacanza contrattuale/i.test(ip.nome || '')).reduce((s, ip) => s + (Number(ip.valore) || 0), 0));
  const tredicesima = mese === 11 ? round2(stipendioTabellare + iis + indennitaPensionabile + assegnoFunzione + vacanzaContrattuale) : 0;

  const fisse = tredicesima > 0
    ? { stipendioTabellare, iis, indennitaPensionabile, assegnoFunzione, tredicesima }
    : { stipendioTabellare, iis, indennitaPensionabile, assegnoFunzione };
  const totaleFisse = round2(Object.values(fisse).reduce((a,b) => a+b, 0));

  const accessorie = { strDiurno, strNotturno, strFestivo, strNotturnoFestivo, indTurnoNotturno, indFestiva, indFestivitaParticolare, indOP, indServizioEsterno, indControlloTerritorio, indReperibilita, indMissioni, indCompensazioneRiposo, indCambioTurno, indProduttivitaCollettiva };
  const totaleAccessorieFisse = round2(Object.values(accessorie).reduce((a,b) => a+b, 0));

  // Indennità personalizzate (es. "Vacanza contrattuale" o altre voci non coperte dalle tabelle
  // ufficiali): l'utente le definisce liberamente in Impostazioni → Tabelle con un importo fisso
  // al mese, oppure moltiplicato per i giorni di presenza effettiva lavorati nel mese.
  const personalizzate = (AppState.indennitaPersonalizzate || []).map(ip => ({
    nome: ip.nome,
    unita: ip.unita,
    importo: ip.unita === 'turno' ? round2((Number(ip.valore) || 0) * giorniPresenzaEffettiva) : round2(Number(ip.valore) || 0)
  }));
  const totalePersonalizzate = round2(personalizzate.reduce((a, p) => a + p.importo, 0));
  const totaleAccessorie = round2(totaleAccessorieFisse + totalePersonalizzate);

  return { qualifica, fisse, totaleFisse, accessorie, personalizzate, totalePersonalizzate, totaleAccessorie, totaleLordo: round2(totaleFisse + totaleAccessorie), tot };
}

function calcolaIRPEFAnnua(imponibileAnnuo){
  if(imponibileAnnuo <= AppState.tabelle.noTaxAreaAnnua) return 0;
  let imposta = 0, sogliaPrec = 0;
  for(const scaglione of AppState.tabelle.irpefScaglioni){
    if(imponibileAnnuo > sogliaPrec){
      const quota = Math.min(imponibileAnnuo, scaglione.fino) - sogliaPrec;
      imposta += quota * scaglione.aliquota / 100;
    }
    sogliaPrec = scaglione.fino;
  }
  return imposta;
}

// ───────────────────────────────────────────────────────────────────────────
// Netto: metodo ricavato da 7 cedolini reali (Polizia di Stato, dicembre 2025 – settembre 2026)
//  • FISSO (stipendio, pensionabile, assegno funzionale, vacanza contrattuale): annualizzato ×12, tassato a scaglioni
//  • VARIABILE (straordinari, indennità, tredicesima): tassato all'aliquota massima (marginale), senza ×12
//  • UNA TANTUM dell'anno prima (produttività collettiva, cambio turno): tassati all'aliquota media
//  • Contributi 9,15% su tutto; Opera di previdenza e maggiorazione INPDAP anche sulla tredicesima
//  • Detrazioni: costanti per tutto l'anno (non cambiano con le ore del mese)
//  • Addizionali: rate fisse da marzo a novembre, non legate alle accessorie
// ───────────────────────────────────────────────────────────────────────────
const sommaVoci = o => round2(Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0));

function aliquotaIRPEFMarginale(redditoAnnuo){
  for(const s of AppState.tabelle.irpefScaglioni) if(redditoAnnuo <= s.fino) return s.aliquota;
  return AppState.tabelle.irpefScaglioni[AppState.tabelle.irpefScaglioni.length - 1].aliquota;
}

// Detrazioni di legge (annue) in funzione del reddito complessivo annuo R.
function detrazioneLavoroDipendenteAnnua(R){
  let d = 0;
  if(R <= 15000) d = 1955;
  else if(R <= 28000) d = 1910 + 1190 * (28000 - R) / 13000;
  else if(R <= 50000) d = 1910 * (50000 - R) / 22000;
  if(R > 25000 && R <= 35000) d += 65;
  return d;
}
function ulterioreDetrazioneAnnua(R){            // L. 207/2024: 1.000 € fino a 32.000, poi cala fino a 40.000
  if(R <= 20000 || R > 40000) return 0;
  return R <= 32000 ? 1000 : 1000 * (40000 - R) / 8000;
}
function detrazioneConiugeAnnua(R){
  if(R <= 15000) return 800 - 110 * R / 15000;
  if(R > 80000) return 0;
  let d = R <= 40000 ? 690 : 690 * (80000 - R) / 40000;
  if(R > 29000 && R <= 29200) d += 10;
  else if(R > 29200 && R <= 34700) d += 20;
  else if(R > 34700 && R <= 35000) d += 30;
  else if(R > 35000 && R <= 35100) d += 20;
  else if(R > 35100 && R <= 35200) d += 10;
  return d;
}
function detrazioneFiglioOver21Annua(R){
  return R > 80000 ? 0 : AppState.tabelle.detrazionePerFiglioOver21Annua * (80000 - R) / 80000;
}

// Netto "in busta" di una voce variabile: lordo − contributi, poi l'aliquota indicata (nessuna detrazione né addizionale nel mese).
function nettoVoceInBusta(lordo, aliquotaIRPEF){
  return round2((lordo || 0) * (1 - AppState.tabelle.aliquotaPrevidenziale / 100) * (1 - aliquotaIRPEF / 100));
}

// comp = competenze del mese; meseIndice (0-11) serve solo per le rate delle addizionali (marzo–novembre).
function calcolaRitenute(comp, meseIndice){
  const T = AppState.tabelle, A = AppState.anagrafica || {};
  const pers = comp.personalizzate || [];
  const somma = l => round2(l.reduce((s, p) => s + (Number(p.importo) || 0), 0));
  const persMese = somma(pers.filter(p => p.unita !== 'turno'));
  const persTurno = somma(pers.filter(p => p.unita === 'turno'));
  const vacanza = somma(pers.filter(p => /vacanza contrattuale/i.test(p.nome || '')));
  const tredicesima = comp.fisse.tredicesima || 0;
  const unaTantum = round2((comp.accessorie.indProduttivitaCollettiva || 0) + (comp.accessorie.indCambioTurno || 0));

  const fisso = round2(sommaVoci(comp.fisse) - tredicesima + persMese);
  const variabile = round2(sommaVoci(comp.accessorie) - unaTantum + persTurno + tredicesima);
  const lordo = round2(fisso + variabile + unaTantum);

  // Contributi: 9,15% su tutto; Opera di previdenza e maggiorazione sulla parte fissa e, a dicembre, ancora sulla tredicesima
  const aliqPrev = T.aliquotaPrevidenziale / 100, aliqOpera = (T.operaPrevidenzaAliquota ?? 2) / 100;
  const baseOpera = (comp.fisse.stipendioTabellare || 0) + (comp.fisse.iis || 0) + (comp.fisse.assegnoFunzione || 0) + vacanza;
  // Maggiorazione figurativa: 15% dello stipendio parametrato (tabellare + IIS + vacanza contrattuale), poi 9,15% di contributi su quell'importo
  const baseMaggiorazione = round2(((comp.fisse.stipendioTabellare || 0) + (comp.fisse.iis || 0) + vacanza) * (T.maggiorazioneFigurativaPct ?? 0) / 100);
  const extraPrev = round2(baseOpera * aliqOpera + baseMaggiorazione * aliqPrev);
  const contributiFisso = round2(fisso * aliqPrev + extraPrev);
  const contributiVariabile = round2(variabile * aliqPrev + (tredicesima > 0 ? extraPrev : 0));
  const contributiUnaTantum = round2(unaTantum * aliqPrev);
  const contributi = round2(contributiFisso + contributiVariabile + contributiUnaTantum);
  const imponibileFisso = round2(fisso - contributiFisso);
  const imponibileVariabile = round2(variabile - contributiVariabile);
  const imponibileUnaTantum = round2(unaTantum - contributiUnaTantum);
  const imponibile = round2(imponibileFisso + imponibileVariabile + imponibileUnaTantum);

  // Reddito annuo stimato: parte fissa e accessorie ×12, tredicesima una volta sola (una tantum escluse)
  const accessorieImp = imponibileVariabile - (tredicesima > 0 ? imponibileFisso : 0);
  const R = round2((imponibileFisso + accessorieImp) * 12 + imponibileFisso);

  // IRPEF
  const aliquotaMarginale = aliquotaIRPEFMarginale(R);
  const aliquotaMedia = R > 0 ? calcolaIRPEFAnnua(R) / R * 100 : 0;
  const irpefFisso = round2(calcolaIRPEFAnnua(imponibileFisso * 12) / 12);
  const irpefVariabile = round2(imponibileVariabile * aliquotaMarginale / 100);
  const irpefUnaTantum = round2(imponibileUnaTantum * aliquotaMedia / 100);
  const irpefTotale = round2(irpefFisso + irpefVariabile + irpefUnaTantum);

  // Detrazioni: se nelle Tabelle c'è il "Totale detrazioni" del cedolino si usa quello (nel cedolino è fisso per tutto l'anno), altrimenti una stima di legge
  const coniuge = A.coniugeACarico === 'si';
  const figli = Number(A.figliOver21) || 0;
  const detrazioniLavoroStima = round2((detrazioneLavoroDipendenteAnnua(R) + ulterioreDetrazioneAnnua(R)) / 12);
  const detrazioniFamiliariStima = round2(((coniuge ? detrazioneConiugeAnnua(R) : 0) + figli * detrazioneFiglioOver21Annua(R)) / 12);
  const detrazioniInserite = Number(T.detrazioniMensiliCedolino) || 0;
  const detrazioniTotali = detrazioniInserite > 0 ? detrazioniInserite : round2(detrazioniLavoroStima + detrazioniFamiliariStima);
  const detrazioni = Math.min(detrazioniTotali, irpefTotale);
  const detrazioniLavoro = detrazioniInserite > 0 ? round2(Math.max(0, detrazioniInserite - detrazioniFamiliariStima)) : detrazioniLavoroStima;
  const detrazioniFamiliari = detrazioniInserite > 0 ? round2(detrazioniInserite - detrazioniLavoro) : detrazioniFamiliariStima;

  // Trattamento integrativo: solo con reddito fino a 15.000 €
  const trattamentoIntegrativo = R <= 15000 ? T.trattamentoIntegrativoMensile : 0;

  // Addizionali: nel cedolino sono rate fisse da marzo a novembre; stima sul reddito ordinario del mese (senza tredicesima né una tantum)
  const aliqRegionale = A.regione ? calcolaAliquotaAddizionaleRegionale(A.regione, R) : 0;
  const aliqComunale = Number(A.addComunale) || 0;
  const inPeriodoRate = meseIndice === undefined || (meseIndice >= 2 && meseIndice <= 10);
  const addizionali = inPeriodoRate ? round2((imponibileFisso + accessorieImp) * (aliqRegionale + aliqComunale) / 100) : 0;

  // Altre ritenute: quota sindacale (anche sulla tredicesima) + Fondo assistenza
  const quotaSindacale = (normalizzaSindacato(A.sindacato) === 'si') ? T.sindacatoMensile * (tredicesima > 0 ? 2 : 1) : 0;
  const sindacato = round2(quotaSindacale + (T.fondoAssistenzaMensile || 0));

  return { lordo, contributi, imponibile, redditoAnnuoStimato: R, aliquotaMarginale, aliquotaMedia, irpefTotale, detrazioniLavoro, detrazioniFamiliari, detrazioni,
           trattamentoIntegrativo, addizionali, aliqRegionale, aliqComunale, sindacato };
}

// Netto "in busta" delle accessorie del mese: ordinarie all'aliquota marginale, produttività e cambio turno all'aliquota media.
// Niente detrazioni né addizionali: nel cedolino non cambiano con le ore o le indennità del mese.
function calcolaNettoAccessorie(anno, mese){
  const comp = calcolaCompetenze(anno, mese);
  const a = comp.accessorie;
  const ut = round2((a.indProduttivitaCollettiva || 0) + (a.indCambioTurno || 0));
  const ord = round2(sommaVoci(a) - ut);
  const lordo = round2(ord + ut);
  if(lordo <= 0) return { lordo: 0, netto: 0 };
  const r = calcolaRitenute(comp, mese);
  return { lordo, netto: round2(nettoVoceInBusta(ord, r.aliquotaMarginale) + nettoVoceInBusta(ut, r.aliquotaMedia)) };
}

function calcolaEffettoNettoStraordinario(anno, mese){
  const comp = calcolaCompetenze(anno, mese);
  const a = comp.accessorie;
  const lordo = round2(a.strDiurno + a.strNotturno + a.strFestivo + a.strNotturnoFestivo);
  if(lordo <= 0) return { ore: 0, lordo: 0, netto: 0 };
  const ore = round2((comp.tot.strDiurno || 0) + (comp.tot.strNotturno || 0) + (comp.tot.strFestivo || 0) + (comp.tot.strNotturnoFestivo || 0));
  const r = calcolaRitenute(comp, mese);
  return { ore, lordo, netto: nettoVoceInBusta(lordo, r.aliquotaMarginale) };
}

function generaCedolino(anno, mese, compForzato){
  const comp = compForzato || calcolaCompetenze(anno, mese);
  const r = calcolaRitenute(comp, mese);
  const conguagli = round2(Number(AppState.conguagliPerMese[chiaveMese(anno, mese)]) || 0);
  const netto = round2(r.lordo - r.contributi - r.irpefTotale + r.detrazioni + r.trattamentoIntegrativo - r.addizionali - r.sindacato + conguagli);
  return { comp, imponibilePrevidenziale: r.lordo, contributi: r.contributi, imponibileFiscaleTotale: r.imponibile,
           irpefTotale: r.irpefTotale, detrazioniLavoro: r.detrazioniLavoro, detrazioniFamiliari: r.detrazioniFamiliari, detrazioni: r.detrazioni,
           trattamentoIntegrativo: r.trattamentoIntegrativo, addizionali: r.addizionali, aliqRegionale: r.aliqRegionale, aliqComunale: r.aliqComunale,
           sindacato: r.sindacato, conguagli, netto };
}

function generaAccreditoConto(anno, mese){
  let meseFisse = mese - 1, annoFisse = anno;
  if(meseFisse < 0){ meseFisse = 11; annoFisse--; }
  let meseAccessorie = mese - 2, annoAccessorie = anno;
  if(meseAccessorie < 0){ meseAccessorie += 12; annoAccessorie--; }

  const compFisse = calcolaCompetenze(annoFisse, meseFisse);
  const compAccessorie = calcolaCompetenze(annoAccessorie, meseAccessorie);
  const tredicesimaAccredito = mese === 11 ? round2(calcolaCompetenze(anno, 11).fisse.tredicesima || 0) : 0;

  // Comp "misto": fisse del mese precedente, accessorie di due mesi prima
  const compMisto = {
    fisse: Object.assign({}, compFisse.fisse, { tredicesima: tredicesimaAccredito }),
    accessorie: compAccessorie.accessorie,
    personalizzate: [
      ...(compFisse.personalizzate || []).filter(p => p.unita !== 'turno'),
      ...(compAccessorie.personalizzate || []).filter(p => p.unita === 'turno')
    ]
  };
  const r = calcolaRitenute(compMisto, mese);
  const netto = round2(r.lordo - r.contributi - r.irpefTotale + r.detrazioni + r.trattamentoIntegrativo - r.addizionali - r.sindacato);
  const fisseBase = round2(sommaVoci(compFisse.fisse) - (compFisse.fisse.tredicesima || 0));
  return {
    meseFisse, annoFisse, meseAccessorie, annoAccessorie,
    fisseBase, tredicesimaAccredito, accessorieLorde: round2(r.lordo - fisseBase - tredicesimaAccredito), lordoTotale: r.lordo,
    contributi: r.contributi, irpefTotale: r.irpefTotale, detrazioni: r.detrazioni, trattamentoIntegrativo: r.trattamentoIntegrativo,
    addizionali: r.addizionali, sindacato: r.sindacato, netto
  };
}

function renderCedolino(){
  const c = generaCedolino(annoCorrente, meseCorrente);
  const box = el('contenitoreCedolino');
  const riga = (nome, val, sottr=false, meta='') => `<div class="cedolino-riga${sottr?' sottrazione':''}"><span>${nome}${meta ? `<small>${meta}</small>` : ''}</span><span>${sottr?'− ':''}${euro(val)}</span></div>`;
  const totaleAccessorie = c.comp.totaleAccessorie;
  const totaleFisse = c.comp.totaleFisse;
  const lordo = c.comp.totaleLordo;
  const ritenute = round2(c.contributi + c.irpefTotale + c.addizionali + c.sindacato);
  const trattenuteNetto = round2(ritenute - c.detrazioni - c.trattamentoIntegrativo - c.conguagli);
  const percent = (v) => lordo > 0 ? Math.max(0, Math.min(100, (v / lordo) * 100)) : 0;
  const pill = (label, value, cls='') => `<div class="cedolino-pill ${cls}"><span>${label}</span><strong>${euro(value)}</strong></div>`;

  box.innerHTML = `
    <div class="cedolino-v12-head">
      <div>
        <span class="cedolino-v12-kicker">CEDOLINO SIMULATO · ${NOMI_MESI[meseCorrente]} ${annoCorrente}</span>
        <h3>${c.comp.qualifica}</h3>
        <small>Stima non ufficiale basata sui dati inseriti</small>
      </div>
      <span class="cedolino-v12-badge">NON UFFICIALE</span>
    </div>

    <div class="cedolino-v12-netto">
      <div><span>NETTO STIMATO</span><small>Importo indicativo</small></div>
      <strong>${euro(c.netto)}</strong>
    </div>

    <div class="cedolino-v12-pills">
      ${pill('Lordo', lordo, 'lordo')}
      ${pill('Competenze fisse', totaleFisse)}
      ${pill('Accessorie', totaleAccessorie)}
      ${pill('Ritenute', ritenute, 'negativo')}
    </div>
    <div class="cedolino-v39-riepilogo" aria-label="Riepilogo cedolino">
      <div><span>Lordo</span><strong>${euro(lordo)}</strong></div>
      <div><span>Trattenute nette</span><strong>${euro(trattenuteNetto)}</strong></div>
      <div class="evidenza"><span>Netto stimato</span><strong>${euro(c.netto)}</strong></div>
    </div>

    <div class="cedolino-v12-composizione">
      <div class="cedolino-v12-section-title"><strong>Composizione del lordo</strong><span>${euro(lordo)}</span></div>
      <div class="cedolino-v12-barra"><span class="fisse" style="width:${percent(totaleFisse)}%"></span><span class="accessorie" style="width:${percent(totaleAccessorie)}%"></span></div>
      <div class="cedolino-v12-legenda"><span><i class="fisse"></i> Fisse ${percent(totaleFisse).toFixed(0)}%</span><span><i class="accessorie"></i> Accessorie ${percent(totaleAccessorie).toFixed(0)}%</span></div>
    </div>

    <details class="cedolino-v12-details" open>
      <summary><span>💼 Competenze fisse</span><strong>${euro(totaleFisse)}</strong></summary>
      <div class="cedolino-v12-body">
        ${riga('Stipendio Tabellare (incl. IIS conglobata)', c.comp.fisse.stipendioTabellare)}
        ${c.comp.fisse.iis > 0 ? riga('IIS', c.comp.fisse.iis) : ''}
        ${riga('Indennità Pensionabile', c.comp.fisse.indennitaPensionabile)}
        ${riga('Assegno Funzionale', c.comp.fisse.assegnoFunzione)}
        ${c.comp.fisse.tredicesima ? riga('Tredicesima Mensilità', c.comp.fisse.tredicesima) : ''}
      </div>
    </details>

    <details class="cedolino-v12-details">
      <summary><span>🚓 Competenze accessorie</span><strong>${euro(totaleAccessorie)}</strong></summary>
      <div class="cedolino-v12-body">
        ${riga(`Straordinario Diurno`, c.comp.accessorie.strDiurno, false, `${c.comp.tot.strDiurno} h`)}
        ${riga(`Straordinario Notturno`, c.comp.accessorie.strNotturno, false, `${c.comp.tot.strNotturno} h`)}
        ${riga(`Straordinario Festivo`, c.comp.accessorie.strFestivo, false, `${c.comp.tot.strFestivo} h`)}
        ${riga(`Straordinario Notturno Festivo`, c.comp.accessorie.strNotturnoFestivo, false, `${c.comp.tot.strNotturnoFestivo} h`)}
        ${riga('Ind. Turno Notturno', c.comp.accessorie.indTurnoNotturno, false, `${c.comp.tot.notturne} h`)}
        ${riga('Ind. Festiva/Domenicale', c.comp.accessorie.indFestiva)}
        ${c.comp.accessorie.indFestivitaParticolare ? riga('Ind. Festività Particolari', c.comp.accessorie.indFestivitaParticolare) : ''}
        ${riga('Ind. Ordine Pubblico', c.comp.accessorie.indOP)}
        ${riga('Ind. Servizi Esterni', c.comp.accessorie.indServizioEsterno)}
        ${riga('Ind. Controllo Territorio', c.comp.accessorie.indControlloTerritorio)}
        ${riga('Reperibilità', c.comp.accessorie.indReperibilita)}
        ${riga('Missioni', c.comp.accessorie.indMissioni)}
        ${riga('Compensazione Riposo Lavorato', c.comp.accessorie.indCompensazioneRiposo)}
        ${riga('Cambio Turno', c.comp.accessorie.indCambioTurno)}
        ${c.comp.accessorie.indProduttivitaCollettiva > 0 ? riga('Produttività Collettiva', c.comp.accessorie.indProduttivitaCollettiva, false, `anno ${annoCorrente - 1}`) : ''}
        ${c.comp.personalizzate.map(p => riga(p.nome, p.importo, false, p.unita === 'turno' ? 'per turno lavorato' : 'fisso al mese')).join('')}
      </div>
    </details>

    <details class="cedolino-v12-details">
      <summary><span>🧾 Ritenute e fiscalità</span><strong>− ${euro(ritenute)}</strong></summary>
      <div class="cedolino-v12-body">
        ${riga('Imponibile Previdenziale', c.imponibilePrevidenziale)}
        ${riga('Contributi', c.contributi, true)}
        ${riga('Imponibile Fiscale', c.imponibileFiscaleTotale)}
        ${riga('IRPEF', c.irpefTotale, true)}
        ${riga('Detrazioni Lavoro Dipendente', c.detrazioniLavoro)}
        ${c.detrazioniFamiliari ? riga('Detrazioni Familiari', c.detrazioniFamiliari) : ''}
        ${riga('Trattamento Integrativo', c.trattamentoIntegrativo)}
        ${riga(`Addizionali Regionale/Comunale`, c.addizionali, true, `${c.aliqRegionale.toFixed(2)}% / ${c.aliqComunale.toFixed(2)}%`)}
        ${riga('Quota Sindacale', c.sindacato, true)}
        ${riga('Conguagli', c.conguagli)}
      </div>
    </details>

    <div class="cedolino-v12-footer">
      <span>Netto stimato</span><strong>${euro(c.netto)}</strong>
      <small>Le cifre sono indicative: verifica sempre il cedolino NoiPA reale.</small>
    </div>`;
  box.hidden = false;
  el('btnStampaCedolino').hidden = false;
  el('btnNascondiCedolino').hidden = false;

  AppState.storico[chiaveMese(annoCorrente, meseCorrente)] = { totaleLordo: c.comp.totaleLordo, netto: c.netto };
  salvaStoricoStorage();
  renderStorico();
}
function renderAccreditoConto(){
  const a = generaAccreditoConto(annoCorrente, meseCorrente);
  const box = el('contenitoreAccreditoConto');
  const riga = (nome, val, sottr=false) => `<div class="cedolino-riga${sottr?' sottrazione':''}"><span>${nome}</span><span>${sottr?'− ':''}${euro(val)}</span></div>`;

  box.innerHTML = `
    <div class="timbro-simulazione">Simulazione<br>Non Ufficiale</div>
    <div class="cedolino-sezione">
      <h4>Accredito stimato — ${NOMI_MESI[meseCorrente]} ${annoCorrente}</h4>
      ${riga(`Stipendio base (competenza ${NOMI_MESI[a.meseFisse]} ${a.annoFisse})`, a.fisseBase)}
      ${a.tredicesimaAccredito ? riga('Tredicesima Mensilità', a.tredicesimaAccredito) : ''}
      ${riga(`Indennità accessorie (competenza ${NOMI_MESI[a.meseAccessorie]} ${a.annoAccessorie})`, a.accessorieLorde)}
    </div>
    <div class="cedolino-sezione">
      <h4>Trattenute (stimate sul totale accreditato)</h4>
      ${riga('Contributi Previdenziali', a.contributi, true)}
      ${riga('IRPEF Netta', a.irpefTotale, true)}
      ${riga('Detrazioni', a.detrazioni)}
      ${a.trattamentoIntegrativo ? riga('Trattamento Integrativo', a.trattamentoIntegrativo) : ''}
      ${riga(`Addizionali Regionale/Comunale`, a.addizionali, true)}
      ${a.sindacato ? riga('Quota Sindacale', a.sindacato, true) : ''}
    </div>
    <div class="cedolino-netto">
      <div class="etichetta">Netto Stimato in Arrivo sul Conto</div>
      <div class="valore">${euro(a.netto)}</div>
    </div>`;
  box.hidden = false;
  el('btnCancellaAccreditoConto').hidden = false;
}

function renderStorico(){
  const tbody = document.querySelector('#tabellaStorico tbody');
  const chiavi = Object.keys(AppState.storico).sort();
  if(chiavi.length === 0){
    tbody.innerHTML = '<tr><td colspan="3" class="sotto-titolo">Nessun cedolino generato finora.</td></tr>';
    renderStatisticheStorico();
    return;
  }
  tbody.innerHTML = chiavi.map(k => {
    const [anno, mese] = k.split('-').map(Number);
    const voce = AppState.storico[k];
    return `<tr><td>${NOMI_MESI[mese - 1]} ${anno}</td><td class="totale-riga">${euro(voce.totaleLordo)}</td><td class="totale-riga">${euro(voce.netto)}</td></tr>`;
  }).join('');
  renderStatisticheStorico();
}

function cancellaStorico(){
  const numVoci = Object.keys(AppState.storico).length;
  if(numVoci === 0){
    mostraAvviso('Lo AppState.storico è già vuoto, non c\'è nulla da cancellare.');
    return;
  }
  mostraConferma(
    `Stai per cancellare lo AppState.storico di ${numVoci} mese/i generati.\nL'operazione non è reversibile. Continuare?`,
    () => {
      AppState.storico = {};
      salvaStoricoStorage();
      renderStorico();
    }
  );
}

function renderRiepilogoAnnuale(anno){
  const tot = { ordinarie:0, notturne:0, festive:0, domenicali:0, notturneFestive:0, strDiurno:0, strNotturno:0, strFestivo:0, strNotturnoFestivo:0 };
  for(let m = 0; m < 12; m++){
    const { tot: totMese } = calcolaRiepilogoOreMese(anno, m);
    for(const k of Object.keys(tot)) tot[k] += totMese[k] || 0;
  }

  let totaleLordoAnno = 0, totaleNettoAnno = 0, mesiInclusi = 0;
  for(let m = 0; m < 12; m++){
    const voce = AppState.storico[chiaveMese(anno, m)];
    if(voce){ totaleLordoAnno += voce.totaleLordo; totaleNettoAnno += voce.netto; mesiInclusi++; }
  }

  el('raOrdinarie').textContent = round2(tot.ordinarie).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raNotturne').textContent = round2(tot.notturne).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raFestive').textContent = round2(tot.festive).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raDomenicali').textContent = round2(tot.domenicali).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raNotturneFestive').textContent = round2(tot.notturneFestive).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raStrDiurno').textContent = round2(tot.strDiurno).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raStrNotturno').textContent = round2(tot.strNotturno).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raStrFestivo').textContent = round2(tot.strFestivo).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raStrNotturnoFestivo').textContent = round2(tot.strNotturnoFestivo).toLocaleString('it-IT', {minimumFractionDigits:2});
  el('raTotaleLordo').textContent = euro(round2(totaleLordoAnno));
  el('raTotaleNetto').textContent = euro(round2(totaleNettoAnno));
  el('raMesiLordo').textContent = `(${mesiInclusi}/12 mesi generati)`;
  el('contenitoreRiepilogoAnnuale').hidden = false;
  el('btnCancellaRiepilogoAnnuale').hidden = false;
  el('btnStampaRiepilogoAnnuale').hidden = false;
}

// V13 — statistiche dello storico mensile
function calcolaStatisticheStorico(){
  const mesi = Object.keys(AppState.storico).sort().map(k => {
    const [anno,mese] = k.split('-').map(Number);
    const r = calcolaRiepilogoOreMese(anno,mese-1);
    const extra = r.tot || {};
    const ore = Object.values(extra).reduce((s,v)=>s+(Number(v)||0),0);
    const straordinario = ['strDiurno','strNotturno','strFestivo','strNotturnoFestivo'].reduce((s,x)=>s+(Number(extra[x])||0),0);
    return {k,anno,mese, lordo:Number(AppState.storico[k].totaleLordo)||0, netto:Number(AppState.storico[k].netto)||0, ore, straordinario};
  });
  return mesi;
}

function renderStatisticheStorico(){
  const box=el('statisticheStorico'); if(!box) return;
  const mesi=calcolaStatisticheStorico();
  if(!mesi.length){ box.hidden=true; return; }
  box.hidden=false;
  const lordo=mesi.reduce((s,m)=>s+m.lordo,0), netto=mesi.reduce((s,m)=>s+m.netto,0), ore=mesi.reduce((s,m)=>s+m.ore,0), stra=mesi.reduce((s,m)=>s+m.straordinario,0);
  el('statisticheStoricoPeriodo').textContent=`${mesi.length} ${mesi.length===1?'mese':'mesi'} disponibili`;
  el('statisticheStoricoCards').innerHTML=[
    ['💶',euro(netto),'Netto totale'],['📈',euro(lordo),'Lordo totale'],['🕐',formatOreDashboard(ore),'Ore registrate'],['⏱️',formatOreDashboard(stra),'Straordinario']
  ].map(x=>`<div class="stat-card"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
  const max=Math.max(...mesi.map(m=>m.netto),1);
  el('statisticheStoricoGrafico').innerHTML=`<strong>Netto per mese</strong>`+mesi.map(m=>`<div class="stat-chart-row"><span class="stat-chart-label">${NOMI_MESI[m.mese-1].slice(0,3)} ${m.anno}</span><div class="stat-chart-track"><div class="stat-chart-fill" style="width:${Math.max(2,m.netto/max*100)}%"></div></div><span class="stat-chart-value">${euro(m.netto)}</span></div>`).join('');
  const maxOre=Math.max(...mesi.map(m=>m.ore),1);
  el('statisticheStoricoMesi').innerHTML=mesi.map(m=>`<div class="stat-mese-row"><span>${NOMI_MESI[m.mese-1].slice(0,3)}</span><div class="stat-mese-bar"><div class="stat-mese-fill" style="width:${Math.max(2,m.ore/maxOre*100)}%"></div></div><strong>${formatOreDashboard(m.ore)}</strong></div>`).join('');
}
