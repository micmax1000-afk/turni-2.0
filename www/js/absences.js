/* FASE 1 — modulo estratto dal precedente script.js. */

// ── Saldi di partenza ──
// Alla prima apertura l'app non può sapere quanti giorni restano a una persona (congedo degli
// anni scorsi, recuperi, riposo compensativo): li scrive lei, come risultano all'ufficio, e da
// quel giorno in poi conta l'app. I turni fino a quella data non contano più per questi saldi.
const CHIAVE_SALDI_PARTENZA = 'simCedolino_saldiPartenza_v1';
function saldiPartenza(){
  try{
    const s = JSON.parse(TurniPSStorage.getItem(CHIAVE_SALDI_PARTENZA) || 'null');
    if(s && /^\d{4}-\d{2}-\d{2}$/.test(s.data)){
      // Saldi salvati prima della divisione per anno: totale e "di cui dell'anno scorso".
      if(!s.congedoAnni){
        const y = Number(s.data.slice(0, 4)), vecchi = Number(s.congedoVecchi) || 0;
        s.congedoAnni = { [y]: round2((Number(s.congedo) || 0) - vecchi), [y - 1]: vecchi };
      }
      return s;
    }
  }catch(e){}
  return null;
}
function salvaSaldiPartenza(valori){
  const n = v => Math.max(0, round2(Number(v) || 0));
  const oggi = new Date();
  const annoOggi = oggi.getFullYear();
  // Congedo per anno ({ 2026: 37, 2025: 15, 2024: 3 }); totale e "anni prima" restano per compatibilità.
  const anni = {};
  Object.entries(valori.congedoAnni || {}).forEach(([y, g]) => { if(n(g) > 0 || Number(y) === annoOggi) anni[y] = n(g); });
  const totale = round2(Object.values(anni).reduce((a, b) => a + b, 0));
  const vecchi = round2(Object.entries(anni).filter(([y]) => Number(y) < annoOggi).reduce((a, [, g]) => a + g, 0));
  const s = {
    data: dataISO(oggi),
    salvatoIl: Date.now(),
    congedoAnni: anni,
    congedo: totale,
    congedoVecchi: vecchi,
    recuperoRiposo: n(valori.recuperoRiposo),
    recuperoFestivo: n(valori.recuperoFestivo),
    riposoCompensativoOre: n(valori.riposoCompensativoOre)
  };
  TurniPSStorage.setItem(CHIAVE_SALDI_PARTENZA, JSON.stringify(s));
  return s;
}
// Il giorno dei saldi è già compreso nei numeri scritti: si conta dal giorno dopo. v3.3: conta anche un giorno
// passato se lo straordinario a riposo, il recupero o l'assenza li hai segnati DOPO aver salvato i saldi
// (campo: compensaDal, recuperoRiposoDal, recuperoFestivoDal, assenzaDal = quando l'hai segnato).
const momentoSaldi = s => s.salvatoIl || Date.parse(`${s.data}T23:59:59`);
const dopoSaldi = (iso, s, t, campo) => !s || iso > s.data || !!(t && campo && t[campo] && t[campo] >= momentoSaldi(s));
// Quando salvi un giorno: segna il momento in cui hai acceso straordinario a riposo, recuperi o un'assenza.
const CAMPI_SEGNATI = [['compensaStraordinario', 'compensaDal'], ['compensazioneRiposo', 'recuperoRiposoDal'], ['recuperoFestivoLavorato', 'recuperoFestivoDal'], ['assenzaTipo', 'assenzaDal']];
function segnaQuandoNuovo(nuovo, vecchio){
  if(!nuovo) return nuovo;
  const ora = Date.now();
  for(const [campo, quando] of CAMPI_SEGNATI){
    if(!nuovo[campo]){ delete nuovo[quando]; continue; }
    const uguale = vecchio && vecchio[campo] && (campo !== 'assenzaTipo' || vecchio[campo] === nuovo[campo]);
    nuovo[quando] = uguale ? (vecchio[quando] || nuovo[quando]) : ora;
    if(!nuovo[quando]) delete nuovo[quando];
  }
  return nuovo;
}
// L'anno e il mese di oggi: la pagina Assenze non segue il mese aperto nel calendario.
function rifAssenze(){ const d = new Date(); return { anno: d.getFullYear(), mese: d.getMonth() }; }

function trovaAssenzaRecuperoFestivo(){
  return AppState.assenze.find(a => a.nome === 'Recupero festivo') || null;
}

function calcolaGiorniRecuperoFestivoAccumulati(){
  const s = saldiPartenza();
  return (s ? s.recuperoFestivo || 0 : 0) + Object.entries(AppState.turni).filter(([iso, t]) => t.recuperoFestivoLavorato && dopoSaldi(iso, s, t, 'recuperoFestivoDal')).length;
}

function trovaAssenzaRecuperoRiposo(){
  return AppState.assenze.find(a => a.nome === 'Recupero riposo') || null;
}

function calcolaGiorniRecuperoAccumulati(){
  const s = saldiPartenza();
  return (s ? s.recuperoRiposo || 0 : 0) + Object.entries(AppState.turni).filter(([iso, t]) => t.compensazioneRiposo && dopoSaldi(iso, s, t, 'recuperoRiposoDal')).length;
}

function calcolaOreCompensateAccumulate(){
  const s = saldiPartenza();
  let totale = s ? s.riposoCompensativoOre || 0 : 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(t.riposo || t.assenzaTipo || !dopoSaldi(iso, s, t, 'compensaDal')) continue;
    totale += classificaTurno(t).oreCompensate || 0;
  }
  return round2(totale);
}

// daData (facoltativo): si contano solo i giorni dopo quella data (i saldi di partenza).
function calcolaOreAssenzaUsate(assenzaId, daData){
  let totale = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(t.assenzaTipo !== assenzaId || (daData && iso <= daData && !dopoSaldi(iso, saldiPartenza(), t, 'assenzaDal'))) continue;
    const f = finestraDaOrari(t.data, t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine);
    totale += f.ore;
  }
  return round2(totale);
}

function contaGiorniUsatiAssenza(assenzaId, daData){
  const s = daData ? saldiPartenza() : null;
  return Object.entries(AppState.turni).filter(([iso, t]) => t.assenzaTipo === assenzaId && (!daData || iso > daData || (s && dopoSaldi(iso, s, t, 'assenzaDal')))).length;
}

function contaGiorniUsatiAssenzaNelMese(assenzaId, anno, mese){
  const prefisso = `${anno}-${String(mese + 1).padStart(2, '0')}-`;
  return Object.entries(AppState.turni).filter(([iso, t]) => iso.startsWith(prefisso) && t.assenzaTipo === assenzaId).length;
}

function contaGiorniUsatiAssenzaNelAnno(assenzaId, anno){
  const prefisso = `${anno}-`;
  return Object.entries(AppState.turni).filter(([iso, t]) => iso.startsWith(prefisso) && t.assenzaTipo === assenzaId).length;
}

function calcolaOreAssenzaUsateNelAnno(assenzaId, anno){
  const prefisso = `${anno}-`;
  let totale = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso) || t.assenzaTipo !== assenzaId) continue;
    totale += finestraDaOrari(t.data, t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine).ore;
  }
  return round2(totale);
}

function calcolaOrePermessoBreveUsateAnno(anno){
  const voce = AppState.assenze.find(a => a.nome === 'Permesso breve');
  const idVoce = voce ? voce.id : null;
  const prefisso = `${anno}-`;
  let totale = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso)) continue;
    if(idVoce && t.assenzaTipo === idVoce){
      totale += finestraDaOrari(t.data, t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine).ore;
    } else if(t.permessoBreveAttivo){
      totale += finestraDaOrari(t.data, t.permessoBreveOraInizio, t.permessoBreveOraFine).ore;
    }
  }
  return round2(totale);
}

function calcolaOreDaRecuperareAnno(anno){
  const prefisso = `${anno}-`;
  let prese = 0, recuperate = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso)) continue;
    if(t.permessoBreveAttivo) prese += finestraDaOrari(t.data, t.permessoBreveOraInizio, t.permessoBreveOraFine).ore;
    if(t.recuperoPermessoBreveAttivo) recuperate += finestraDaOrari(t.data, t.recuperoPermessoBreveOraInizio, t.recuperoPermessoBreveOraFine).ore;
  }
  return round2(Math.max(0, prese - recuperate));
}

function calcolaOreRecuperateAnno(anno){
  const prefisso = `${anno}-`;
  let totale = 0;
  for(const [iso, t] of Object.entries(AppState.turni)){
    if(!iso.startsWith(prefisso)) continue;
    if(t.recuperoPermessoBreveAttivo) totale += finestraDaOrari(t.data, t.recuperoPermessoBreveOraInizio, t.recuperoPermessoBreveOraFine).ore;
  }
  return round2(totale);
}

// Con i saldi di partenza: si parte dai giorni scritti (alla loro data), si tolgono i giorni di
// congedo segnati dopo, a gennaio si aggiungono gli spettanti dell'anno nuovo e l'avanzo passa avanti.
// Senza saldi di partenza: solo gli spettanti dell'anno, niente riporto (daInserire).
function calcolaSaldoCongedoOrdinario(anno){
  const voce = AppState.assenze.find(a => a.nome === 'Congedo ordinario');
  if(!voce) return { valoreEffettivo: 0, usate: 0, riporto: 0 };
  const s = saldiPartenza();
  const anno0 = s ? Number(s.data.slice(0, 4)) : null;
  if(!s || anno < anno0) return { valoreEffettivo: voce.valore, usate: contaGiorniUsatiAssenzaNelAnno(voce.id, anno), riporto: 0, daInserire: !s };
  const usatiDopo = y => Object.entries(AppState.turni).filter(([iso, t]) => iso.startsWith(`${y}-`) && t.assenzaTipo === voce.id && dopoSaldi(iso, s, t, 'assenzaDal')).length;
  const somma = o => round2(Object.values(o).reduce((a, b) => a + b, 0));
  if(anno === anno0){
    const vecchi = round2(Object.entries(s.congedoAnni).filter(([y]) => Number(y) < anno0).reduce((a, [, g]) => a + g, 0));
    return { valoreEffettivo: somma(s.congedoAnni), usate: usatiDopo(anno0), riporto: vecchi, perAnno: congedoPerAnno(anno) };
  }
  const residuo = somma(congedoPerAnno(anno - 1));
  return { valoreEffettivo: round2(voce.valore + residuo), usate: usatiDopo(anno), riporto: residuo, perAnno: congedoPerAnno(anno) };
}

// Quanti giorni di congedo restano per ogni anno ({ 2024: 2, 2025: 15, 2026: 37 }) alla fine
// dell'anno indicato, oppure fino a una data (finoA, compresa). I giorni non scadono mai: ogni
// congedo segnato si toglie dall'anno più vecchio che ne ha ancora; a gennaio arrivano gli spettanti.
function congedoPerAnno(anno, finoA){
  const voce = AppState.assenze.find(a => a.nome === 'Congedo ordinario');
  const s = saldiPartenza();
  if(!voce || !s) return {};
  const anno0 = Number(s.data.slice(0, 4));
  const conti = {};
  Object.entries(s.congedoAnni).forEach(([y, g]) => { conti[y] = Number(g) || 0; });
  const usati = Object.entries(AppState.turni)
    .filter(([iso, t]) => t.assenzaTipo === voce.id && dopoSaldi(iso, s, t, 'assenzaDal') && (!finoA || iso <= finoA))
    .map(([iso]) => Number(iso.slice(0, 4)));
  for(let y = anno0; y <= anno; y++){
    if(y > anno0) conti[y] = (conti[y] || 0) + voce.valore;
    let daTogliere = usati.filter(x => x === y).length;
    const anni = Object.keys(conti).map(Number).filter(x => x <= y).sort((a, b) => a - b);
    for(const x of anni){
      if(!daTogliere) break;
      const preso = Math.min(daTogliere, Math.max(0, conti[x]));
      conti[x] -= preso; daTogliere -= preso;
    }
    if(daTogliere) conti[y] = (conti[y] || 0) - daTogliere; // più giorni di quelli disponibili
  }
  Object.keys(conti).forEach(k => { conti[k] = round2(conti[k]); });
  return conti;
}

// Il conto di prima (riporto da ogni anno con turni): serve solo a proporre i numeri da confermare
// a chi aveva già l'app, quando inserisce i saldi di partenza la prima volta.
function stimaSaldiPartenza(){
  const { anno } = rifAssenze();
  const voce = nome => AppState.assenze.find(a => a.nome === nome);
  const co = voce('Congedo ordinario');
  let congedo = 0, congedoVecchi = 0;
  if(co){
    const st = calcolaSaldoCongedoOrdinarioStimato(anno);
    congedo = Math.max(0, round2(st.valoreEffettivo - st.usate));
    congedoVecchi = Math.min(congedo, Math.max(0, round2(st.riporto - st.usate)));
  }
  const tutti = Object.values(AppState.turni);
  const rr = voce('Recupero riposo'), rf = voce('Recupero festivo'), rc = voce('Riposo compensativo');
  const recuperoRiposo = Math.max(0, tutti.filter(t => t.compensazioneRiposo).length - (rr ? tutti.filter(t => t.assenzaTipo === rr.id).length : 0));
  const recuperoFestivo = Math.max(0, tutti.filter(t => t.recuperoFestivoLavorato).length - (rf ? tutti.filter(t => t.assenzaTipo === rf.id).length : 0));
  let oreRc = 0;
  for(const t of tutti){
    if(!t.riposo && !t.assenzaTipo) oreRc += classificaTurno(t).oreCompensate || 0;
    if(rc && t.assenzaTipo === rc.id) oreRc -= finestraDaOrari(t.data, t.riposoCompensativoOraInizio, t.riposoCompensativoOraFine).ore;
  }
  return { congedoAnni: { [anno]: round2(congedo - congedoVecchi), [anno - 1]: congedoVecchi, [anno - 2]: 0 }, recuperoRiposo, recuperoFestivo, riposoCompensativoOre: Math.max(0, round2(oreRc)) };
}

function calcolaSaldoCongedoOrdinarioStimato(anno){
  const voce = AppState.assenze.find(a => a.nome === 'Congedo ordinario');
  if(!voce) return { valoreEffettivo: 0, usate: 0, riporto: 0 };
  const anniConDati = Object.keys(AppState.turni).map(iso => Number(iso.slice(0, 4)));
  const primoAnno = anniConDati.length ? Math.min(anno, ...anniConDati) : anno;
  let riporto = 0;
  for(let y = primoAnno; y < anno; y++){
    riporto += voce.valore - contaGiorniUsatiAssenzaNelAnno(voce.id, y);
  }
  return { valoreEffettivo: round2(voce.valore + riporto), usate: contaGiorniUsatiAssenzaNelAnno(voce.id, anno), riporto: round2(riporto) };
}

function elencoDateDisponibiliCredito(nomeVoce, campoFonte){
  const voce = AppState.assenze.find(a => a.nome === nomeVoce);
  if(!voce) return [];
  const s = saldiPartenza();
  const dateGuadagnate = Object.entries(AppState.turni)
    .filter(([iso, t]) => t[campoFonte] && dopoSaldi(iso, s, t, campoFonte === 'compensazioneRiposo' ? 'recuperoRiposoDal' : 'recuperoFestivoDal'))
    .map(([iso]) => iso)
    .sort();
  // I giorni dei saldi di partenza (senza data) si usano per primi.
  const iniziali = s ? (nomeVoce === 'Recupero riposo' ? s.recuperoRiposo : s.recuperoFestivo) || 0 : 0;
  const usate = contaGiorniUsatiAssenza(voce.id, s ? s.data : null);
  return dateGuadagnate.slice(Math.max(0, usate - iniziali));
}

// Quanto spetta, quanto è stato usato e quanto resta di una voce (stesse regole di sempre:
// congedo ordinario con il riporto, L104 al mese, alcune voci all'anno, recuperi automatici).
const NOMI_ANNUALI_SEMPLICI = ['Congedo straordinario', 'Riposo legge', 'Donazione sangue', 'Ore studio', 'Permesso breve', 'Permesso sindacale'];
function saldoAssenza(a, rif){
  const anno = rif ? rif.anno : annoCorrente, mese = rif ? rif.mese : meseCorrente;
  const eRiposoCompensativo = a.nome === 'Riposo compensativo';
  const eRecuperoRiposo = a.nome === 'Recupero riposo';
  const eRecuperoFestivo = a.nome === 'Recupero festivo';
  const eL104 = a.nome === 'L104';
  const eCongedoOrdinario = a.nome === 'Congedo ordinario';
  const eAnnualeSemplice = NOMI_ANNUALI_SEMPLICI.includes(a.nome);
  const unita = eRiposoCompensativo ? 'h' : a.unita;
  const saldoCO = eCongedoOrdinario ? calcolaSaldoCongedoOrdinario(anno) : null;
  // Recuperi e riposo compensativo: con i saldi di partenza contano solo i giorni dopo la loro data.
  const sp = (eRiposoCompensativo || eRecuperoRiposo || eRecuperoFestivo) ? saldiPartenza() : null;
  const daData = sp ? sp.data : null;
  const spettanti = eRiposoCompensativo ? calcolaOreCompensateAccumulate()
    : eRecuperoRiposo ? calcolaGiorniRecuperoAccumulati()
    : eRecuperoFestivo ? calcolaGiorniRecuperoFestivoAccumulati()
    : eCongedoOrdinario ? saldoCO.valoreEffettivo
    : a.valore;
  const usate = eCongedoOrdinario ? saldoCO.usate
    : unita === 'h' ? (a.nome === 'Permesso breve' ? calcolaOrePermessoBreveUsateAnno(anno) : eAnnualeSemplice ? calcolaOreAssenzaUsateNelAnno(a.id, anno) : calcolaOreAssenzaUsate(a.id, daData))
    : eL104 ? contaGiorniUsatiAssenzaNelMese(a.id, anno, mese)
    : eAnnualeSemplice ? contaGiorniUsatiAssenzaNelAnno(a.id, anno)
    : contaGiorniUsatiAssenza(a.id, daData);
  return { spettanti, usate, rimangono: round2(spettanti - usate), unita, saldoCO, eRiposoCompensativo, eRecuperoRiposo, eRecuperoFestivo, eL104, eCongedoOrdinario, eAnnualeSemplice };
}
const ICONE_ASSENZE = { 'Congedo ordinario':'🌴', 'Congedo straordinario':'📋', 'Riposo legge':'🏛️', 'Riposo festivo':'🎉', 'Recupero festivo':'🔄', 'Recupero riposo':'🔄', 'Riposo compensativo':'♻️', 'Aspettativa':'🕰️', 'Maternità/Paternità':'👶', 'Congedo parentale':'🧸', 'L104':'♿', 'Donazione sangue':'🩸', 'Ore studio':'🎓', 'Permesso breve':'⏱️', 'Permesso sindacale':'🤝' };
const numeroIt = n => String(round2(n)).replace('.', ',');

// In cima: le tre cose che servono davvero (congedo, permesso breve, recuperi).
function renderDashboardAssenze(){
  const box = el('assenzeSummaryGrid');
  if(!box) return;
  const voce = nome => AppState.assenze.find(a => a.nome === nome);
  const rif = rifAssenze();
  const resto = nome => { const v = voce(nome); return v ? saldoAssenza(v, rif).rimangono : 0; };
  const daInserire = !saldiPartenza();
  const congedo = resto('Congedo ordinario');
  const recuperi = resto('Recupero riposo') + resto('Recupero festivo');
  box.innerHTML = `<small class="saldi-hero-anno">Ti restano nel ${rif.anno}</small>`
    + (daInserire
      ? `<b class="saldi-hero-numero">— giorni</b><div class="saldi-hero-voci"><span>🌴 congedo ordinario da inserire</span>`
      : `<b class="saldi-hero-numero">${numeroIt(congedo)} ${congedo === 1 ? 'giorno' : 'giorni'}</b><div class="saldi-hero-voci"><span>🌴 di congedo ordinario</span>`)
    + `<span>⏱️ ${numeroIt(resto('Permesso breve'))} h di permesso breve</span>`
    + `<span>🔄 ${numeroIt(recuperi)} ${recuperi === 1 ? 'recupero' : 'recuperi'}</span></div>`;
  const sotto = el('sottotitoloAssenze');
  if(sotto) sotto.textContent = `Quanto ti resta nel ${rif.anno} · non cambia il cedolino`;
  renderBoxSaldiPartenza();
}

// Sotto il riquadro blu: l'invito a inserire i saldi di partenza, oppure il loro riassunto con "Correggi".
function renderBoxSaldiPartenza(){
  const box = el('saldiPartenzaBox');
  if(!box) return;
  const s = saldiPartenza();
  if(!s){
    box.className = 'partenza-box';
    box.innerHTML = `<b>📌 Da dove partiamo?</b><p>L'app non sa quanti giorni ti restano dagli anni scorsi. Inserisci il congedo ordinario, i recuperi e il riposo compensativo che hai oggi.</p><button type="button" class="btn-primario" data-apri-saldi>Inserisci i saldi di partenza</button>`;
    return;
  }
  const data = new Date(s.data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const parti = [`Congedo ${numeroIt(s.congedo)} gg`];
  const recuperi = (s.recuperoRiposo || 0) + (s.recuperoFestivo || 0);
  if(recuperi) parti.push(`Recuperi ${numeroIt(recuperi)} gg`);
  if(s.riposoCompensativoOre) parti.push(`Riposo compensativo ${numeroIt(s.riposoCompensativoOre)} h`);
  box.className = 'partenza-riass partenza-v4';
  box.innerHTML = `<span aria-hidden="true">📌</span><i>Giorni di partenza al ${escapeHtml(data)}<small>Come risultavano all'ufficio: da lì conta l'app.</small></i><button type="button" data-apri-saldi title="${escapeHtml(parti.join(' · '))}">Modifica</button>`;
}

function inizializzaFiltriAssenze(){
  const search = el('cercaAssenza');
  const filtri = [...document.querySelectorAll('[data-filtro-assenze]')];
  let unita = 'tutte';
  const applica = () => {
    const q = (search?.value || '').trim().toLowerCase();
    document.querySelectorAll('#corpoAssenze .card-assenza, #corpoAssenzeNonUsate .card-assenza, #corpoAssenzePersonalizzate .card-assenza').forEach(r => {
      const voce = AppState.assenze.find(a => a.id === r.dataset.id);
      const okTesto = !q || (voce?.nome || '').toLowerCase().includes(q);
      const okUnita = unita === 'tutte' || voce?.unita === unita;
      r.classList.toggle('assenza-nascosta', !(okTesto && okUnita));
      r.toggleAttribute('hidden', !(okTesto && okUnita));
    });
  };
  filtri.forEach(btn => btn.addEventListener('click', () => {
    unita = btn.dataset.filtroAssenze;
    filtri.forEach(b => b.classList.toggle('attivo', b === btn));
    applica();
  }));
  search?.addEventListener('input', applica);
}

function aggiornaCardAssenza(riga, voce){
  if(!riga || !voce) return;
  const eRiposoCompensativo = voce.nome === 'Riposo compensativo';
  const eRecuperoRiposo = voce.nome === 'Recupero riposo';
  const eRecuperoFestivo = voce.nome === 'Recupero festivo';
  const eL104 = voce.nome === 'L104';
  const eCongedoOrdinario = voce.nome === 'Congedo ordinario';
  const annuali = ['Congedo straordinario','Riposo legge','Donazione sangue','Ore studio','Permesso breve','Permesso sindacale'];
  const unita = eRiposoCompensativo ? 'h' : voce.unita;
  const { anno, mese } = rifAssenze();
  const saldo = saldoAssenza(voce, { anno, mese });
  const spettanti = saldo.spettanti, usate = saldo.usate;
  const rimangono = round2(spettanti - usate);
  const percentuale = spettanti > 0 ? Math.min(100, Math.max(0, usate / spettanti * 100)) : (rimangono <= 0 ? 100 : 0);
  const stato = rimangono < 0 ? 'esaurito' : rimangono === 0 ? 'zero' : percentuale >= 80 ? 'attenzione' : 'positivo';
  riga.classList.remove('positivo','attenzione','zero','esaurito');
  riga.classList.add(stato);
  const boxes = riga.querySelectorAll('.saldo-box strong');
  if(boxes[0]) boxes[0].textContent = rimangono;
  if(boxes[1]) boxes[1].textContent = usate;
  if(boxes[2]) boxes[2].textContent = spettanti || 0;
  const residuoCompatto = riga.querySelector('.card-assenza-compact-residuo');
  if(residuoCompatto){
    residuoCompatto.textContent = numeroIt(rimangono);
    const unitaCompatta = residuoCompatto.nextElementSibling;
    if(unitaCompatta) unitaCompatta.textContent = unita;
  }
  const usatiCompatti = riga.querySelector('.saldo-usati em');
  if(usatiCompatti) usatiCompatti.textContent = numeroIt(usate);
  const spettantiCompatti = riga.querySelector('.saldo-su');
  if(spettantiCompatti) spettantiCompatti.textContent = numeroIt(spettanti || 0);
  const anello = riga.querySelector('.saldo-anello-pieno');
  if(anello){
    const c = 2 * Math.PI * 22;
    const pieno = spettanti > 0 ? Math.min(1, Math.max(0, rimangono / spettanti)) : 1;
    anello.setAttribute('stroke-dasharray', `${(c * pieno).toFixed(1)} ${c.toFixed(1)}`);
    anello.setAttribute('stroke-opacity', pieno ? '1' : '0');
    anello.setAttribute('stroke', rimangono < 0 ? '#D64545' : spettanti > 0 ? coloreAnelloAssenza(voce) : COLORE_ASSENZA_VUOTA);
  }
  const barra = riga.querySelector('.barra-residuo-assenza i');
  if(barra){
    const resto = spettanti > 0 ? Math.min(100, Math.max(0, rimangono / spettanti * 100)) : 0;
    barra.style.width = `${resto}%`;
    barra.style.background = rimangono < 0 ? '#D9534F' : (spettanti > 0 && resto <= 20) ? '#E08A00' : unita === 'h' ? '#2E7DD7' : '#2E9E5B';
  }
  const progress = riga.querySelector('.saldo-progress');
  if(progress){ progress.setAttribute('aria-valuenow', String(Math.round(percentuale))); const bar=progress.querySelector('span'); if(bar) bar.style.width=`${percentuale}%`; }
  const meta=riga.querySelector('.card-assenza-meta');
  if(meta){ const first=meta.querySelector('span'); const second=meta.querySelectorAll('span')[1]; if(first) first.textContent=eL104?`Usate a ${NOMI_MESI[mese]}: ${usate} ${unita}`:((annuali.includes(voce.nome)||eCongedoOrdinario)?`Usate nel ${anno}: ${usate} ${unita}`:`Usate: ${usate} ${unita}`); if(second) second.textContent=`${Math.round(percentuale)}% utilizzato`; }
  const status=riga.querySelector('.card-assenza-status');
  if(status) status.textContent=rimangono<0?'⚠ Esaurito':rimangono===0?'0 disponibili':percentuale>=80?'Quasi esaurito':'Disponibile';
}

// Anello del saldo: pieno quando la voce è tutta da usare, si svuota man mano che la si usa.
// v3.3: ogni voce ha il suo colore (prima andavano per posizione e alcuni si ripetevano); senza
// niente da usare (0 / 0) l'anello è grigio.
const COLORI_ANELLO_ASSENZE = ['#2E9E5B','#3A55B4','#E08A00','#8E44AD','#00838F','#D64545','#2E7DD7','#6D4C41','#546E7A'];
const COLORE_PER_ASSENZA = {
  'Congedo ordinario':'#2E9E5B', 'Congedo straordinario':'#3A55B4', 'Riposo legge':'#E08A00', 'Riposo festivo':'#8E44AD',
  'Recupero festivo':'#00838F', 'Recupero riposo':'#D64545', 'Riposo compensativo':'#2E7DD7', 'Aspettativa':'#6D4C41',
  'Maternità/Paternità':'#C2185B', 'Congedo parentale':'#689F38', 'L104':'#5C6BC0', 'Donazione sangue':'#B71C1C',
  'Ore studio':'#6A1B9A', 'Permesso breve':'#00897B', 'Permesso sindacale':'#F4511E'
};
const COLORE_ASSENZA_VUOTA = '#9AA1B0';
function coloreAnelloAssenza(a){
  if(COLORE_PER_ASSENZA[a.nome]) return COLORE_PER_ASSENZA[a.nome];
  const i = Math.max(0, AppState.assenze.filter(x => !COLORE_PER_ASSENZA[x.nome]).indexOf(a));
  return COLORI_ANELLO_ASSENZE[i % COLORI_ANELLO_ASSENZE.length];
}
function anelloAssenzaHtml(frazione, colore, icona){
  const c = 2 * Math.PI * 22;
  const pieno = Math.min(1, Math.max(0, Number(frazione) || 0));
  return `<span class="saldo-anello" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="none" stroke="${colore}" stroke-opacity=".18" stroke-width="6"/>`
    + `<circle class="saldo-anello-pieno" cx="26" cy="26" r="22" fill="none" stroke="${colore}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * pieno).toFixed(1)} ${c.toFixed(1)}"${pieno ? '' : ' stroke-opacity="0"'}/></svg>`
    + `<span class="card-assenza-icon">${icona}</span></span>`;
}

function renderCardAssenzaItem(a){
    const { anno, mese } = rifAssenze();
    const { spettanti: valoreEffettivo, usate, rimangono, unita: unitaEffettiva, saldoCO, eRiposoCompensativo, eRecuperoRiposo, eRecuperoFestivo, eL104, eCongedoOrdinario, eAnnualeSemplice } = saldoAssenza(a, { anno, mese });
    // Congedo ordinario senza saldi di partenza: invece di un numero inventato, la domanda.
    if(eCongedoOrdinario && saldoCO.daInserire){
      return `<article class="card-assenza card-da-inserire" data-id="${a.id}"><b>🌴 Congedo ordinario</b><p>Quanti giorni ti restano oggi? Spettano ${numeroIt(a.valore)} giorni l'anno, più quelli non goduti degli anni scorsi.</p><button type="button" class="btn-secondario" data-apri-saldi>Inserisci</button></article>`;
    }
    const automatica = eRiposoCompensativo || eRecuperoRiposo || eRecuperoFestivo;

    // Congedo ordinario: i giorni riportati dall'anno prima si consumano per primi (FIFO)
    let dettaglioRiporto = '';
    if(eCongedoOrdinario && saldoCO.perAnno){
      // Con i saldi di partenza: quanto resta di ogni anno (si usano prima i più vecchi, non scadono).
      const anniCO = Object.entries(saldoCO.perAnno).filter(([y, g]) => g !== 0 || Number(y) === anno).sort((a, b) => a[0] - b[0]);
      dettaglioRiporto = `<p class="congedo-anni-titolo">Rimasti per anno · si usano prima i più vecchi</p><div class="congedo-anni">${anniCO.map(([y, g]) => `<div><small>${y}</small><b${g < 0 ? ' class="negativo"' : ''}>${numeroIt(g)}</b> <small>gg</small></div>`).join('')}</div>`;
    } else if(eCongedoOrdinario && saldoCO.riporto !== 0){
      const poolVecchi = Math.max(0, saldoCO.riporto);
      const vecchiRimasti = round2(Math.max(0, poolVecchi - usate));
      const nuoviRimasti = round2(rimangono - vecchiRimasti);
      dettaglioRiporto = `<div class="riga-assenza-nota" style="margin-top:2px;"><span class="sotto-titolo" style="font-size:0.75rem;">di cui riportati dal ${anno - 1}: ${saldoCO.riporto} gg (${vecchiRimasti} ancora disponibili, consumati per primi) · spettanti ${anno}: ${round2(valoreEffettivo - saldoCO.riporto)} gg (${nuoviRimasti} disponibili)</span></div>`;
    }

    // Elenco a comparsa delle date che hanno generato credito, ancora disponibili (Recupero riposo/festivo)
    let elencoDate = '';
    if(eRecuperoRiposo || eRecuperoFestivo){
      const campoFonte = eRecuperoRiposo ? 'compensazioneRiposo' : 'recuperoFestivoLavorato';
      const dateDisponibili = elencoDateDisponibiliCredito(a.nome, campoFonte);
      elencoDate = `
      <div class="riga-assenza-nota" style="margin-top:2px;">
        <button type="button" class="btn-elenco-date" data-toggle-date="${a.id}">📅 ${dateDisponibili.length ? `Vedi le ${dateDisponibili.length} date disponibili` : 'Nessuna data disponibile'}</button>
      </div>
      <div class="lista-date-disponibili" data-lista-date="${a.id}" style="display:none;">${dateDisponibili.map(d => `<span class="chip-data">${formattaDataBreve(d)}</span>`).join('')}</div>`;
    }
    // Permesso breve: ore prese non toccano più le ore rimanenti col recupero — mostro separatamente
    // quanto resta da recuperare e quanto è già stato recuperato lavorandolo (due conteggi indipendenti).
    let dettaglioRecuperoPB = '';
    if(a.nome === 'Permesso breve'){
      const daRecuperare = calcolaOreDaRecuperareAnno(anno);
      const recuperate = calcolaOreRecuperateAnno(anno);
      if(daRecuperare > 0 || recuperate > 0){
        dettaglioRecuperoPB = `<div class="riga-assenza-nota" style="margin-top:2px;"><span class="sotto-titolo" style="font-size:0.75rem;">Ore da recuperare: ${daRecuperare} h · Ore recuperate nel ${anno}: ${recuperate} h</span></div>`;
      }
    }

    const etichettaUsate = eL104 ? `Usate a ${NOMI_MESI[mese]}: ${usate} ${unitaEffettiva}`
      : (eAnnualeSemplice || eCongedoOrdinario) ? `Usate nel ${anno}: ${usate} ${unitaEffettiva}`
      : `Usate: ${usate} ${unitaEffettiva}`;
    const notaRicarica = eL104 ? ' <span class="sotto-titolo" style="font-size:0.7rem;">(si ricarica ogni mese)</span>'
      : eCongedoOrdinario ? ' <span class="sotto-titolo" style="font-size:0.7rem;">(i giorni non goduti si sommano all\'anno nuovo)</span>'
      : eAnnualeSemplice ? ' <span class="sotto-titolo" style="font-size:0.7rem;">(si ricarica ogni anno, non si accumula)</span>'
      : '';
    const percentuale = valoreEffettivo > 0 ? Math.min(100, Math.max(0, (usate / valoreEffettivo) * 100)) : (rimangono <= 0 ? 100 : 0);
    const statoSaldo = rimangono < 0 ? 'esaurito' : (rimangono === 0 ? 'zero' : (percentuale >= 80 ? 'attenzione' : 'positivo'));
    const icona = ICONE_ASSENZE[a.nome] || (unitaEffettiva === 'h' ? '⏱️' : '📅');
    const resto = valoreEffettivo > 0 ? Math.min(100, Math.max(0, rimangono / valoreEffettivo * 100)) : 0;
    const coloreResto = rimangono < 0 ? '#D9534F' : (valoreEffettivo > 0 && resto <= 20) ? '#E08A00' : unitaEffettiva === 'h' ? '#2E7DD7' : '#2E9E5B';
    const valoreVisuale = valoreEffettivo || 0;
    // v2.94: nel congedo ordinario, i giorni di ogni anno (anche quelli vecchi) sotto il nome.
    const anniCongedoRiga = eCongedoOrdinario && saldoCO.perAnno
      ? `<span class="anni-congedo-v4">${Object.entries(saldoCO.perAnno).filter(([y, g]) => g !== 0 || Number(y) === anno).sort((x, y) => y[0] - x[0]).map(([y, g]) => `<em>${y}: ${numeroIt(g)}</em>`).join('')}</span>` : '';
    return `
    <article class="card-assenza ${statoSaldo} card-assenza-chiusa" data-id="${a.id}">
      <div class="card-assenza-compact riga-assenza-v4" role="button" tabindex="0" aria-label="Apri dettagli e modifica">
        ${anelloAssenzaHtml(valoreVisuale > 0 ? rimangono / valoreVisuale : 1, rimangono < 0 ? '#D64545' : valoreVisuale > 0 ? coloreAnelloAssenza(a) : COLORE_ASSENZA_VUOTA, icona)}
        <div class="card-assenza-compact-nome"><strong>${a.personalizzata ? (a.nome || 'Nuova voce') : a.nome}</strong>${anniCongedoRiga}</div>
        <span class="saldo-resta" style="color:${rimangono < 0 ? '#D64545' : valoreVisuale > 0 ? coloreAnelloAssenza(a) : COLORE_ASSENZA_VUOTA}"><strong class="card-assenza-compact-residuo">${numeroIt(rimangono)}</strong><small> / ${numeroIt(valoreVisuale)} ${unitaEffettiva}</small></span>
        <small class="saldo-usati" hidden>Usati <em>${numeroIt(usate)}</em> su <span class="saldo-su">${numeroIt(valoreVisuale)}</span></small>
      </div>
      <span class="barra-residuo-assenza" aria-hidden="true"><i style="width:${resto}%;background:${coloreResto}"></i></span>
      <div class="card-assenza-head">
        <div class="card-assenza-title">
          <span class="card-assenza-icon" aria-hidden="true">${icona}</span>
          <div><strong>${a.personalizzata ? '' : a.nome}</strong>${notaRicarica}</div>
        </div>
        <span class="card-assenza-status">${rimangono < 0 ? '⚠ Esaurito' : rimangono === 0 ? '0 disponibili' : percentuale >= 80 ? 'Quasi esaurito' : 'Disponibile'}</span>
      </div>
      ${a.personalizzata ? `<input class="card-assenza-name" type="text" data-campo="nome" value="${a.nome}">` : ''}
      <div class="card-assenza-main">
        <div class="saldo-box"><span>Disponibili</span><strong>${rimangono}</strong><small>${unitaEffettiva}</small></div>
        <div class="saldo-box"><span>Utilizzati</span><strong>${usate}</strong><small>${unitaEffettiva}</small></div>
        <div class="saldo-box saldo-spettanti"><span>Spettanti</span><strong>${valoreVisuale}</strong><small>${unitaEffettiva}</small></div>
      </div>
      <div class="saldo-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percentuale)}" aria-label="Utilizzo ${Math.round(percentuale)} percento">
        <span style="width:${percentuale}%"></span>
      </div>
      <div class="card-assenza-meta">
        <span>${etichettaUsate}</span>
        <span>${Math.round(percentuale)}% utilizzato</span>
      </div>
      <div class="card-assenza-edit">
        ${automatica
          ? `<span class="valore-automatico" title="Calcolato automaticamente">${valoreEffettivo} ${unitaEffettiva} · auto</span>`
          : `<label>Spettanti <input type="number" data-campo="valore" value="${a.valore}" step="1" min="0"></label>`}
        <label>Unità <select data-campo="unita" ${eRiposoCompensativo ? 'disabled' : ''}>
          <option value="gg" ${unitaEffettiva === 'gg' ? 'selected' : ''}>giorni</option>
          <option value="h" ${unitaEffettiva === 'h' ? 'selected' : ''}>ore</option>
        </select></label>
        ${a.personalizzata ? '<button class="riga-rimuovi" type="button" title="Rimuovi" aria-label="Rimuovi voce">✕</button>' : ''}
      </div>
      <div class="card-assenza-notes">
        ${dettaglioRiporto}${dettaglioRecuperoPB}${elencoDate}
      </div>
      <span class="indicatore-salvato">✓ Salvato</span>
    </article>`;
}

function renderAssenze(){
  renderDashboardAssenze();
  const box = el('corpoAssenze');
  const boxPersonalizzate = el('corpoAssenzePersonalizzate');
  // v2.98: tutte le voci in un unico elenco; quelle a zero e mai usate (es. Riposo festivo) in fondo.
  const nonUsata = a => { const x = saldoAssenza(a); return !x.spettanti && !x.usate; };
  const ufficiali = AppState.assenze.filter(a => !a.personalizzata);
  box.innerHTML = ufficiali.filter(a => !nonUsata(a)).concat(ufficiali.filter(nonUsata)).map(renderCardAssenzaItem).join('');
  if(boxPersonalizzate){
    const personalizzate = AppState.assenze.filter(a => a.personalizzata);
    boxPersonalizzate.innerHTML = personalizzate.map(renderCardAssenzaItem).join('');
    boxPersonalizzate.hidden = !personalizzate.length;
    const titoloP = el('titoloAssenzePersonalizzate'); if(titoloP) titoloP.hidden = !personalizzate.length;
  }

  if(!window.__filtriAssenzeInizializzati){ inizializzaFiltriAssenze(); window.__filtriAssenzeInizializzati = true; }

  [box, boxPersonalizzate].filter(Boolean).forEach(contenitore => wireEventiCardAssenza(contenitore));
}

// Collega gli eventi (modifica campo, apri/chiudi date, rimuovi) alle card già renderizzate in un
// contenitore — usata sia per la lista ufficiale sia per quella personalizzata, stessa logica.
function wireEventiCardAssenza(box){
  box.querySelectorAll('[data-toggle-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lista = box.querySelector(`[data-lista-date="${btn.dataset.toggleDate}"]`);
      if(lista) lista.style.display = lista.style.display === 'none' ? '' : 'none';
    });
  });

  box.querySelectorAll('.card-assenza').forEach(riga => {
    const id = riga.dataset.id;
    const voce = AppState.assenze.find(a => a.id === id);
    riga.querySelectorAll('input, select').forEach(campo => {
      const salvaModificaCampo = () => {
        if(campo.dataset.campo === 'valore') voce.valore = Math.max(0, Number(campo.value) || 0);
        else voce[campo.dataset.campo] = campo.value;
        salvaAssenzeStorage();
        aggiornaCardAssenza(riga, voce);
        if(voce.personalizzata){
          const titolo = riga.querySelector('.card-assenza-title strong');
          if(titolo) titolo.textContent = voce.nome || 'Nuova voce';
          const titoloCompatto = riga.querySelector('.card-assenza-compact-nome strong');
          if(titoloCompatto) titoloCompatto.textContent = voce.nome || 'Nuova voce';
        }
        renderDashboardAssenze();
        const indicatore = riga.querySelector('.indicatore-salvato');
        if(indicatore){
          indicatore.classList.add('visibile');
          clearTimeout(indicatore._timeoutSalvato);
          indicatore._timeoutSalvato = setTimeout(() => indicatore.classList.remove('visibile'), 1300);
        }
      };
      campo.addEventListener('input', salvaModificaCampo);
      campo.addEventListener('change', salvaModificaCampo);
    });
    const btnRimuovi = riga.querySelector('.riga-rimuovi');
    if(btnRimuovi){
      btnRimuovi.addEventListener('click', () => {
        AppState.assenze = AppState.assenze.filter(a => a.id !== id);
        salvaAssenzeStorage();
        renderAssenze();
      });
    }
  });
}

function popolaSelectAssenze(){
  const sel = el('campoAssenzaTipo');
  const valorePrecedente = sel.value;
  // Permesso breve ha una sua modalità dedicata dentro il turno (dalle-alle), non va più selezionato qui come assenza a giornata intera
  sel.innerHTML = '<option value="">— scegli —</option>' +
    AppState.assenze.filter(a => a.nome !== 'Permesso breve').map(a => `<option value="${a.id}">${a.nome} (${a.unita})</option>`).join('');
  sel.value = valorePrecedente;
}

const ASSENZE_PREDEFINITE = [
  { nome:'Congedo ordinario', valore:30, unita:'gg' },
  { nome:'Congedo straordinario', valore:45, unita:'gg' },
  { nome:'Riposo legge', valore:4, unita:'gg' },
  { nome:'Riposo festivo', valore:0, unita:'gg' },
  { nome:'Recupero festivo', valore:0, unita:'gg' },
  { nome:'Recupero riposo', valore:0, unita:'gg' },
  { nome:'Riposo compensativo', valore:0, unita:'h' },
  { nome:'Aspettativa', valore:730, unita:'gg' }, // 2 anni nell'arco della vita lavorativa (non annuale) — fonte: SIULP (https://siulp.it/i-tuoi-diritti/le-assenze-per-motivi-di-famiglia/), confermato anche dall'utente
  { nome:'Maternità/Paternità', valore:0, unita:'gg' }, // solo tracciamento date, nessun calcolo di importo (il pagamento varia nel tempo, vedi nota in Assenze)
  { nome:'Congedo parentale', valore:0, unita:'gg' }, // solo tracciamento date, nessun calcolo di importo (il pagamento varia nel tempo, vedi nota in Assenze)
  { nome:'L104', valore:3, unita:'gg' },
  { nome:'Donazione sangue', valore:12, unita:'gg' },
  { nome:'Ore studio', valore:150, unita:'h' },
  { nome:'Permesso breve', valore:54, unita:'h' },
  { nome:'Permesso sindacale', valore:36, unita:'h' }
];


function inizializzaCardAssenzeV45(){
  document.querySelectorAll('#corpoAssenze .card-assenza, #corpoAssenzeNonUsate .card-assenza, #corpoAssenzePersonalizzate .card-assenza').forEach(card=>{
    const trigger=card.querySelector('.card-assenza-compact');
    if(!trigger || trigger.dataset.v45Bound) return;
    trigger.dataset.v45Bound='1';
    const toggle=()=>{
      const aperta=card.classList.toggle('card-assenza-aperta');
      card.classList.toggle('card-assenza-chiusa',!aperta);
      trigger.setAttribute('aria-expanded',aperta?'true':'false');
    };
    trigger.addEventListener('click',toggle);
    trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
  });
}
const _renderAssenzeV45=renderAssenze;
renderAssenze=function(){
  _renderAssenzeV45();
  inizializzaCardAssenzeV45();
};

// ── Modulo dei saldi di partenza (apertura guidata e finestra "Saldi di partenza") ──
function formSaldiPartenzaHtml(prefisso, v){
  const campo = (id, val, unita, passo) => `<div class="partenza-campo"><div class="contatore-anagrafica"><button type="button" data-saldo-campo="${prefisso}${id}" data-saldo-delta="-${passo}" aria-label="Meno">−</button><input type="number" id="${prefisso}${id}" min="0" step="${passo === 1 ? 1 : 0.5}" inputmode="decimal" value="${val}"><button type="button" data-saldo-campo="${prefisso}${id}" data-saldo-delta="${passo}" aria-label="Più">+</button></div><span>${unita}</span></div>`;
  const riga = (testo, sotto, id, val, unita, passo, cls) => `<div class="partenza-riga${cls ? ' ' + cls : ''}"><div class="partenza-testo">${testo}<small>${sotto}</small></div>${campo(id, val, unita, passo)}</div>`;
  const voce = (icona, nome, righe) => `<div class="partenza-voce"><div class="partenza-testa"><span aria-hidden="true">${icona}</span>${nome}</div>${righe}</div>`;
  // Congedo: un campo per anno (quello di oggi e i due prima, più gli anni più vecchi con giorni rimasti).
  const annoOggi = new Date().getFullYear();
  const valAnni = v.congedoAnni || {};
  const anni = [...new Set([annoOggi, annoOggi - 1, annoOggi - 2, ...Object.keys(valAnni).map(Number).filter(y => y < annoOggi && valAnni[y] > 0)])].sort((a, b) => b - a);
  const righeAnni = anni.map((y, i) => riga(`Giorni del ${y}`, y === annoOggi ? 'che ti restano' : 'non ancora goduti', `Congedo${y}`, numeroIt(Math.max(0, valAnni[y] || 0)).replace(',', '.'), 'gg', 1, i ? 'partenza-sotto' : '').replace('class="partenza-riga', `data-anno-congedo="${y}" data-prefisso="${prefisso}" class="partenza-riga`)).join('');
  const totale = round2(anni.reduce((a, y) => a + Math.max(0, valAnni[y] || 0), 0));
  const vecchio = anni[anni.length - 1];
  return voce('🌴', 'Congedo ordinario', righeAnni
      + `<div class="partenza-totale"><span>Totale</span><b id="${prefisso}CongedoTotale">${numeroIt(totale)} ${totale === 1 ? 'giorno' : 'giorni'}</b></div>`
      + `<p class="partenza-nota">Si usano prima i giorni più vecchi (dal ${vecchio} in poi). Non scadono.</p>`)
    + voce('🔄', 'Recupero riposo', riga('Giorni da recuperare', 'riposi lavorati non ancora recuperati', 'RecuperoRiposo', v.recuperoRiposo, 'gg', 1))
    + voce('🔄', 'Recupero festivo', riga('Giorni da recuperare', 'festivi lavorati non ancora recuperati', 'RecuperoFestivo', v.recuperoFestivo, 'gg', 1))
    + voce('♻️', 'Riposo compensativo', riga('Ore accumulate', 'straordinario messo a riposo', 'RiposoCompensativo', numeroIt(v.riposoCompensativoOre).replace(',', '.'), 'h', 1));
}
function leggiFormSaldiPartenza(prefisso){
  const n = id => Number((el(prefisso + id) || {}).value) || 0;
  const congedoAnni = {};
  document.querySelectorAll(`[data-anno-congedo][data-prefisso="${prefisso}"]`).forEach(r => { congedoAnni[r.dataset.annoCongedo] = n('Congedo' + r.dataset.annoCongedo); });
  return { congedoAnni, recuperoRiposo: n('RecuperoRiposo'), recuperoFestivo: n('RecuperoFestivo'), riposoCompensativoOre: n('RiposoCompensativo') };
}
// Valori da proporre: con i saldi già inseriti, quanto resta oggi per anno (senza i congedi già
// segnati nei prossimi giorni, che si contano dopo); altrimenti il conto fatto fin qui dall'app.
function valoriSaldiPartenza(){
  const s = saldiPartenza();
  if(!s) return stimaSaldiPartenza();
  const oggi = new Date();
  return Object.assign({}, s, { congedoAnni: congedoPerAnno(oggi.getFullYear(), dataISO(oggi)) });
}
// Il totale del congedo si aggiorna mentre si scrivono i giorni dei singoli anni.
function aggiornaTotaleCongedoForm(prefisso){
  const box = el(prefisso + 'CongedoTotale');
  if(!box) return;
  const t = round2([...document.querySelectorAll(`[data-anno-congedo][data-prefisso="${prefisso}"] input`)].reduce((a, i) => a + Math.max(0, Number(i.value) || 0), 0));
  box.textContent = `${numeroIt(t)} ${t === 1 ? 'giorno' : 'giorni'}`;
}
function notaSpettantiCongedo(){
  const co = AppState.assenze.find(a => a.nome === 'Congedo ordinario');
  return co ? `📅 A gennaio l'app aggiunge da sola i <b>${numeroIt(co.valore)} giorni</b> dell'anno nuovo (li cambi in Assenze, nella scheda del Congedo ordinario).` : '';
}
function apriSaldiPartenza(){
  el('formSaldiPartenza').innerHTML = formSaldiPartenzaHtml('saldo', valoriSaldiPartenza());
  el('notaSaldiPartenza').innerHTML = notaSpettantiCongedo();
  el('overlaySaldiPartenza').hidden = false;
}
function salvaSaldiPartenzaDaForm(){
  salvaSaldiPartenza(leggiFormSaldiPartenza('saldo'));
  el('overlaySaldiPartenza').hidden = true;
  renderAssenze();
  if(typeof mostraToast === 'function') mostraToast('Saldi di partenza salvati: da domani conta l\'app.', 'successo');
}
function inizializzaSaldiPartenza(){
  document.addEventListener('click', e => {
    const passo = e.target.closest('[data-saldo-campo]');
    if(passo){
      const c = el(passo.dataset.saldoCampo);
      if(c) c.value = Math.max(0, round2((Number(c.value) || 0) + Number(passo.dataset.saldoDelta)));
      const r = passo.closest('[data-anno-congedo]');
      if(r) aggiornaTotaleCongedoForm(r.dataset.prefisso);
      return;
    }
    if(e.target.closest('[data-apri-saldi]')) apriSaldiPartenza();
  });
  document.addEventListener('input', e => {
    const r = e.target.closest && e.target.closest('[data-anno-congedo]');
    if(r) aggiornaTotaleCongedoForm(r.dataset.prefisso);
  });
  const chiudi = el('btnChiudiSaldiPartenza');
  if(chiudi) chiudi.addEventListener('click', () => { el('overlaySaldiPartenza').hidden = true; });
  const salva = el('btnSalvaSaldiPartenza');
  if(salva) salva.addEventListener('click', salvaSaldiPartenzaDaForm);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inizializzaSaldiPartenza);
else inizializzaSaldiPartenza();
