// ── Domande a voce: "il 15 agosto che turno ho fatto?", "quando sono di notte?", "quante notti a ottobre?",
// "quanti giorni di congedo mi restano?", "quando ho la visita medica?".
// L'app risponde guardando i dati già salvati sul telefono: niente internet, niente viene salvato o cambiato.
'use strict';

const PAROLE_PASSATO_VOCE = /\b(ho fatto|fatto|fatti|fatte|feci|facevo|ho lavorato|lavorato|lavoravo|ho avuto|avuto|avevo|ero|era|sono stato|sono stata|stato|stata|ho svolto|svolto|e stato|e stata|scorso|scorsa|ultimo|ultima|ultimi|ultime|passato|passata)\b/;
const PAROLE_FUTURO_VOCE = /\b(faro|farai|fara|faremo|lavorero|lavorera|saro|sara|avro|avra|prossimo|prossima|prossimi|prossime|tocca|toccano|devo fare|dovro|ancora da fare)\b/;

// ── Le parole come le dice la gente: plurali, sinonimi, verbi in ogni tempo, errori di battitura ──
// Ogni voce: le forme possibili → la parola che l'app conosce.
const FORME_DOMANDA = [
  [['nottate', 'nottata', 'notturni', 'notturno', 'notturna', 'notturne', 'notti'], 'notte'],
  [['mattinate', 'mattinata', 'mattine', 'mattini', 'mattutini', 'mattutino'], 'mattina'],
  [['pomeriggi', 'pomeridiani', 'pomeridiano'], 'pomeriggio'],
  [['serate', 'serata', 'serali', 'sere'], 'sera'],
  [['giorni liberi', 'giorno libero', 'riposi', 'liberi'], 'riposo'],
  [['ore in piu', 'ore extra', 'straordinari', 'extra'], 'straordinario'],
  [['buoni pasto', 'buoni', 'ticket'], 'buono pasto'],
  [['reperibilita', 'reperibile', 'reperibili'], 'reperibilita'],
  [['ordini pubblici', 'op'], 'ordine pubblico'],
  [['servizi esterni'], 'servizio esterno'],
  [['controlli del territorio', 'controlli territorio', 'controllo del territorio'], 'controllo territorio'],
  [['missioni'], 'missione'],
  [['festivi', 'festive', 'festiva', 'feste', 'domeniche e festivi', 'domeniche'], 'festivo'],
  [['licenze', 'congedi', 'ferie'], 'ferie'],
  [['chilometri', 'kilometri', 'kilometro', 'chilometro'], 'km'],
  [['volanti'], 'volante'],
  [['visite'], 'visita'],
  [['scadenze'], 'scadenza']
];
// Parole che l'app conosce: servono per correggere gli errori di battitura o di dettatura.
function vocabolarioDomanda(){
  const v = new Set(['quanti', 'quante', 'quanto', 'quando', 'turno', 'turni', 'notte', 'mattina', 'mattino', 'pomeriggio', 'sera', 'riposo', 'straordinario',
    'reperibilita', 'missione', 'festivo', 'ferie', 'congedo', 'visita', 'medica', 'scadenza', 'settimana', 'prossimo', 'prossima', 'ultimo', 'ultima',
    'lavorato', 'lavorero', 'fatto', 'faccio', 'restano', 'rimangono', 'giorni', 'buono', 'pasto', 'ordine', 'pubblico', 'servizio', 'esterno',
    'controllo', 'territorio', 'volante', 'scorso', 'scorsa', 'quest', 'anno', 'mese', 'ore', 'deve', 'devo', 'colleghi', 'collega', 'tiro', 'tesserino', 'corso', 'patente', ...MESI_VOCE, ...GIORNI_VOCE]);
  try{ (AppState.modelliTurno || []).forEach(m => normalizzaVoce(m.nome).split(' ').forEach(w => v.add(w))); }catch(e){}
  try{ (AppState.assenze || []).forEach(a => normalizzaVoce(a.nome).split(' ').forEach(w => v.add(w))); }catch(e){}
  try{ U.scadenze.forEach(x => normalizzaVoce(x.nome).split(' ').forEach(w => v.add(w))); U.mezzi.forEach(m => normalizzaVoce(m.sigla).split(' ').forEach(w => v.add(w))); }catch(e){}
  return [...v].filter(w => w.length >= 4);
}
function distanzaParole(a, b){
  if(Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for(let j = 1; j <= b.length; j++) d[0][j] = j;
  for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : 99);
  return d[a.length][b.length];
}
function correggiParoleDomanda(s){
  const voc = vocabolarioDomanda(), noti = new Set(voc);
  const comuni = new Set(['sono', 'sabato', 'quale', 'dove', 'come', 'cosa', 'dalla', 'dalle', 'della', 'delle', 'nelle', 'nella', 'questo', 'questa', 'tutti', 'tutte', 'ancora', 'anche', 'ottobre']);
  return s.split(' ').map(w => {
    if(w.length < 5 || noti.has(w) || comuni.has(w) || /\d/.test(w)) return w;
    const max = w.length >= 6 ? 2 : 1;
    let migliore = null, dist = 9;
    voc.forEach(x => { const d = distanzaParole(w, x); if(d < dist){ dist = d; migliore = x; } });
    return migliore && dist <= max ? migliore : w;
  }).join(' ');
}
// La frase pronta per essere capita: numeri, errori corretti, plurali e sinonimi portati alla forma base.
function normalizzaDomanda(testo){
  let s = ' ' + correggiParoleDomanda(preparaFraseVoce(testo).replace(/[?!,;]/g, ' ').replace(/\s+/g, ' ').trim()) + ' ';
  FORME_DOMANDA.forEach(([forme, base]) => {
    const re = new RegExp(`(?<=\\s)(${forme.sort((a, b) => b.length - a.length).join('|')})(?=\\s)`, 'g');
    s = s.replace(re, base);
  });
  return s.replace(/\s+/g, ' ');
}

// È una domanda? (le frasi per inserire non usano queste parole)
function eDomandaVoce(testo){
  const s = ' ' + normalizzaVoce(testo).replace(/[?!.]/g, ' ') + ' ';
  if(/\b(metti|mettimi|segna|segnami|inserisci|aggiungi|elimina|cancella|togli|rimuovi)\b/.test(s)) return false;
  return /\b(che turno|che turni|quale turno|quali turni|che cosa (ho|faccio|facevo|faro)|cosa (ho|faccio|facevo|faro|ho fatto)|quando|quand'e|quant[aeio]|ho lavorato|lavorero|mi rest\w*|rimang\w*|chi mi deve|chi deve|a chi devo|prossim[oaie] |ultim[oaie] )\b/.test(s)
    || /\?\s*$/.test(String(testo));
}

// Un periodo detto a parole: "questa settimana", "la prossima settimana", "questo mese", "a ottobre", "il mese scorso".
function periodoVoce(s, oggi, passato, predefinito){
  const lun = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const iso = d => dataISO(d);
  const da = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mese = (a, m) => ({ da: dataISO(new Date(a, m, 1, 12)), a: dataISO(new Date(a, m + 1, 0, 12)), nome: `a ${NOMI_MESI[m].toLowerCase()}${a !== oggi.getFullYear() ? ' ' + a : ''}` });
  if(/\b(settimana prossima|prossima settimana)\b/.test(s)){ const l = da(lun(oggi), 7); return { da: iso(l), a: iso(da(l, 6)), nome: 'la prossima settimana' }; }
  if(/\b(settimana scorsa|scorsa settimana)\b/.test(s)){ const l = da(lun(oggi), -7); return { da: iso(l), a: iso(da(l, 6)), nome: 'la settimana scorsa' }; }
  if(/\b(questa settimana|in settimana)\b/.test(s)){ const l = lun(oggi); return { da: iso(l), a: iso(da(l, 6)), nome: 'questa settimana' }; }
  if(/\b(mese prossimo|prossimo mese)\b/.test(s)) return mese(oggi.getFullYear(), oggi.getMonth() + 1);
  if(/\b(mese scorso|scorso mese)\b/.test(s)) { const d = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1); return mese(d.getFullYear(), d.getMonth()); }
  if(/\bquest'?anno\b|\bnel \d{4}\b/.test(s)){ const r = s.match(/\bnel (\d{4})\b/); const a = r ? Number(r[1]) : oggi.getFullYear(); return { da: `${a}-01-01`, a: `${a}-12-31`, nome: r ? `nel ${a}` : 'quest\'anno' }; }
  const r = s.match(new RegExp(`\\b(${MESI_VOCE.join('|')})(?: (\\d{4}))?\\b`));
  if(r){
    const m = MESI_VOCE.indexOf(r[1]);
    let a = r[2] ? Number(r[2]) : oggi.getFullYear();
    if(!r[2] && passato && m > oggi.getMonth()) a--;
    return mese(a, m);
  }
  if(/\b(questo mese|nel mese|del mese)\b/.test(s)) return mese(oggi.getFullYear(), oggi.getMonth());
  return predefinito;
}
function giorniPeriodoVoce(p){ const out = []; for(let g = p.da, k = 0; g <= p.a && k < 400; g = giornoPiu(g, 1), k++) out.push(g); return out; }

// Cosa si chiede: un turno (con i suoi modelli), il riposo, un'assenza.
function cosaChiestaVoce(s){
  const ass = assenzePerVoce().map(x => ({ ...x, tipo: 'assenza' }));
  const mod = modelliPerVoce().map(x => ({ ...x, tipo: x.m.riposo ? 'riposo' : 'turno' }));
  // plurali: notti, mattine, pomeriggi, sere, riposi
  const plurali = { notti: 'notte', mattine: 'mattina', mattini: 'mattino', pomeriggi: 'pomeriggio', sere: 'sera', serali: 'serale', riposi: 'riposo', ferie: 'ferie' };
  const t = (' ' + s + ' ').replace(/\b(notti|mattine|mattini|pomeriggi|sere|serali|riposi)\b/g, w => plurali[w]);
  for(const x of [...ass, ...mod]){
    const r = t.match(regexParole(x.parole));
    if(r) return x;
  }
  if(/\briposo\b/.test(t)) return { tipo: 'riposo' };
  return null;
}
function corrispondeVoce(t, cosa){
  if(!t || !cosa) return false;
  if(cosa.tipo === 'assenza') return t.assenzaTipo === cosa.a.id;
  if(cosa.tipo === 'riposo') return !!t.riposo;
  return !t.riposo && !t.assenzaTipo && t.modelloId === cosa.m.id;
}
function nomeCosaVoce(cosa, plurale){
  if(cosa.tipo === 'assenza') return cosa.a.nome;
  if(cosa.tipo === 'riposo') return plurale ? 'riposi' : 'riposo';
  const n = cosa.m.nome.toLowerCase();
  const pl = { mattino: 'mattini', mattina: 'mattine', notte: 'notti', sera: 'sere', pomeriggio: 'pomeriggi' };
  return plurale ? (pl[n] || n) : n;
}

// Il riassunto di un giorno, come lo direbbe un collega.
function rigaGiornoVoce(iso){
  const t = AppState.turni[iso];
  const extra = [];
  if(typeof nomeFestivita === 'function' && nomeFestivita(iso)) extra.push(nomeFestivita(iso));
  let titolo, chip = '';
  if(!t || !(t.riposo || t.assenzaTipo || t.oraInizio)){ titolo = 'Nessun turno inserito'; }
  else {
    chip = chipVoce(t);
    titolo = t.riposo || t.assenzaTipo ? '' : `${t.oraInizio} – ${t.oraFine}`;
    if(t.straordinarioDopoInizio && t.straordinarioDopoFine) extra.push(`straordinario ${t.straordinarioDopoInizio}–${t.straordinarioDopoFine}`);
    if(t.straordinarioPrimaInizio && t.straordinarioPrimaFine) extra.push(`straordinario ${t.straordinarioPrimaInizio}–${t.straordinarioPrimaFine}`);
    const nomi = { servizioEsterno: 'servizio esterno', controlloTerritorio: 'controllo territorio', ordinePubblico: 'ordine pubblico', reperibilita: 'reperibilità', missione: 'missione', buonoPasto: 'buono pasto', cambioTurno: 'cambio turno' };
    Object.keys(nomi).forEach(k => { if(t[k]) extra.push(nomi[k]); });
    if(t.servizioSvolto) extra.push(`«${t.servizioSvolto}»`);
  }
  try{ (typeof eventiDelGiorno === 'function' ? eventiDelGiorno(iso) : []).forEach(({ ev }) => extra.push((ev.tuttoIlGiorno || !ev.oraInizio ? '' : ev.oraInizio + ' ') + (ev.titolo || 'Evento'))); }catch(e){}
  return { iso, html: `${chip}${titolo ? `<b>${escapeHtml(titolo)}</b>` : ''}`, sotto: extra.map(escapeHtml).join(' · ') };
}

// Risponde alla domanda, oppure null se non è una domanda che conosce.
function rispondiDomandaVoce(testo, oggi){
  oggi = oggi || new Date();
  const s = normalizzaDomanda(testo);
  const futuro = PAROLE_FUTURO_VOCE.test(s);
  const passato = PAROLE_PASSATO_VOCE.test(s) && !/\bprossim/.test(s);
  const oggiIso0 = dataISO(oggi);

  // 0a) Cambi con i colleghi: "chi mi deve un turno?", "a chi devo un turno?"
  if(/\b(chi mi deve|chi deve|a chi devo|devo un turno|mi devono)\b/.test(s) && typeof U !== 'undefined'){
    const aperti = U.scambi.filter(x => !x.restituito);
    const devo = /\b(a chi devo|devo un turno)\b/.test(s);
    const lista = aperti.filter(x => x.verso === (devo ? 'devo' : 'mideve'));
    return { titolo: lista.length ? (devo ? `Devi un turno a ${lista.length === 1 ? lista[0].collega : lista.length + ' colleghi'}` : `${lista.length === 1 ? lista[0].collega + ' ti deve' : lista.length + ' colleghi ti devono'} un turno`) : (devo ? 'Non devi turni a nessuno' : 'Nessuno ti deve un turno'),
      sotto: lista.map(x => `${x.collega}: ${x.turno || 'turno'} del ${etichettaLungaVoce(x.giorno).toLowerCase()}`).join(' · '), righe: [], vai: 'scambi' };
  }
  // 0b) Km: "quanti km ho fatto a ottobre", "km con la volante 12 questo mese"
  if(/\bkm\b/.test(s) && typeof U !== 'undefined'){
    const p = periodoVoce(s, oggi, true, { da: dataISO(new Date(oggi.getFullYear(), oggi.getMonth(), 1, 12)), a: dataISO(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0, 12)), nome: 'questo mese' });
    const mezzo = U.mezzi.find(m => { const n = normalizzaVoce(m.sigla); return n && s.includes(' ' + n + ' '); });
    const uscite = U.uscite.filter(u => u.giorno >= p.da && u.giorno <= p.a && (!mezzo || u.mezzoId === mezzo.id));
    const km = uscite.reduce((t, u) => t + (kmPercorsi(u) || 0), 0);
    return { titolo: `${numeroIt0(km)} km ${p.nome}${mezzo ? ' con ' + mezzo.sigla : ''}`, sotto: `${uscite.length} ${uscite.length === 1 ? 'uscita' : 'uscite'}.`, righe: [], vai: 'veicolo' };
  }
  // 0c) Il prossimo / l'ultimo: "quando è il prossimo riposo", "quando ho fatto l'ultimo straordinario"
  const senzaPeriodo = s.replace(/\b(prossim\w*|ultim\w*|scors\w*) (settimana|mese)\b/g, ' ').replace(/\b(settimana|mese) (prossim\w*|scors\w*)\b/g, ' ');
  if(/\b(prossim|ultim)\w*/.test(senzaPeriodo)){
    const avanti = /\bprossim/.test(senzaPeriodo), cosa = cosaChiestaVoce(s), str = /\bstraordinario\b/.test(s), ind = indennitaChiestaVoce(s);
    const prova = g => { const t = AppState.turni[g]; if(cosa) return corrispondeVoce(t, cosa); if(str) return minutiStraordinario(t) > 0; if(ind) return conIndennita(t, ind); return false; };
    if(cosa || str || ind){
      let trovato = null;
      for(let k = 1; k <= 400 && !trovato; k++){ const g = giornoPiu(oggiIso0, avanti ? k - 1 : -k); if(prova(g)) trovato = g; }
      const nome = cosa ? nomeCosaVoce(cosa, false) : str ? 'straordinario' : ind.nome;
      const f = /^(notte|sera|mattina|missione|reperibilita|reperibilità)/.test(nome) || /e$/.test(nome) && !/^(riposo|pomeriggio)/.test(nome);
      const zeta = /^(s[bcdfghlmnpqrstvz]|z|gn|ps|x)/.test(nome);
      if(!trovato) return { titolo: `${f ? 'Nessuna' : zeta ? 'Nessuno' : 'Nessun'} ${nome}${avanti ? ' in arrivo' : ' nell\'ultimo anno'}`, sotto: 'Nei giorni inseriti non c\'è.', righe: [] };
      const d = Math.round((dataDaIso(trovato) - dataDaIso(oggiIso0)) / 86400000);
      return { titolo: `${avanti ? (f ? 'Prossima' : 'Prossimo') : (f ? 'Ultima' : 'Ultimo')} ${nome}: ${etichettaLungaVoce(trovato)}`, sotto: d === 0 ? 'Oggi.' : d === 1 ? 'Domani.' : d === -1 ? 'Ieri.' : d > 0 ? `Tra ${d} giorni.` : `${-d} giorni fa.`, righe: [rigaGiornoVoce(trovato)] };
    }
  }

  // 1) Quanto resta di un'assenza: "quanti giorni di congedo mi restano"
  if(/\b(rest|rimang|ancora)\w*/.test(s) && /\bquant/.test(s)){
    const cosa = cosaChiestaVoce(s);
    if(cosa && cosa.tipo === 'assenza' && typeof saldoAssenza === 'function'){
      const sal = saldoAssenza(cosa.a, { anno: oggi.getFullYear(), mese: oggi.getMonth() });
      const u = cosa.a.unita === 'h' ? 'ore' : 'giorni';
      const num = v => String(Math.round(v * 100) / 100).replace('.', ',');
      return { titolo: `${cosa.a.nome}: te ne ${sal.rimangono === 1 ? 'resta' : 'restano'} ${num(sal.rimangono)}`, sotto: `Su ${num(sal.spettanti)} ${u} spettanti nel ${oggi.getFullYear()}.`, righe: [], vai: 'assenze' };
    }
  }

  // 2) Scadenze: "quando ho la visita medica", "quando scade il tesserino"
  if(/\bquando\b/.test(s) && typeof U !== 'undefined' && U.scadenze && U.scadenze.length){
    const sc = U.scadenze.find(x => normalizzaVoce(x.nome).split(' ').filter(w => w.length > 3).some(w => new RegExp(`\\b${w.slice(0, -1)}\\w*`).test(s)));
    if(sc){
      const d = Math.round((dataDaIso(sc.data) - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12)) / 86400000);
      const quando = d === 0 ? 'oggi' : d === 1 ? 'domani' : d > 0 ? `tra ${d} giorni` : `${-d} giorni fa`;
      return { titolo: `${sc.nome}: ${etichettaLungaVoce(sc.data)}`, sotto: `${d < 0 ? 'Scaduta' : 'Scade'} ${quando}.`, righe: [], vai: 'scadenze' };
    }
  }

  const { date } = estraiDateVoce(s, oggi);
  // Con il passato ("ho fatto"), una data detta senza anno è quella già trascorsa.
  const oggiIso = dataISO(oggi);
  const dateOk = date.map(iso => passato && iso > oggiIso ? dataISO(new Date(dataDaIso(iso).getFullYear() - 1, dataDaIso(iso).getMonth(), dataDaIso(iso).getDate(), 12)) : iso).sort();

  // 3) Quanti: "quante notti ho fatto a ottobre", "quanti riposi questo mese"
  if(/\bquant[aeio]\b/.test(s)){
    const cosa = cosaChiestaVoce(s);
    const p = periodoVoce(s, oggi, passato, { da: dataISO(new Date(oggi.getFullYear(), oggi.getMonth(), 1, 12)), a: dataISO(new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0, 12)), nome: 'questo mese' });
    const giorni = giorniPeriodoVoce(p);
    if(cosa){
      const trovati = giorni.filter(g => corrispondeVoce(AppState.turni[g], cosa));
      const nome = nomeCosaVoce(cosa, trovati.length !== 1);
      return { titolo: `${trovati.length} ${nome} ${p.nome}`, sotto: trovati.length ? '' : 'Nessuno nei giorni inseriti.', righe: trovati.slice(0, 31).map(rigaGiornoVoce) };
    }
    if(/\bore\b/.test(s) && /\b(lavorato|lavorero|lavoro|servizio|fatto|faro)\b/.test(s) && !/\bstraordinario\b/.test(s)){
      let min = 0, n = 0;
      giorni.forEach(g => { const m = minutiTurno(AppState.turni[g]); if(m){ min += m; n++; } });
      return { titolo: `${hhmmDurata(min)} di servizio ${p.nome}`, sotto: `In ${n} ${n === 1 ? 'turno' : 'turni'}, straordinario a parte.`, righe: [] };
    }
    if(/\bfestivo\b/.test(s)){
      const fest = giorni.filter(g => { const t = AppState.turni[g]; return t && !t.riposo && !t.assenzaTipo && t.oraInizio && eFestivoOdDomenica(g); });
      return { titolo: `${fest.length} ${fest.length === 1 ? 'festivo lavorato' : 'festivi lavorati'} ${p.nome}`, sotto: 'Domeniche e festività.', righe: fest.map(rigaGiornoVoce) };
    }
    const ind = indennitaChiestaVoce(s);
    if(ind){
      const conInd = giorni.filter(g => conIndennita(AppState.turni[g], ind));
      const tot = ind.chiave === 'buonoPasto' ? conInd.reduce((t, g) => t + (Number(AppState.turni[g].buoniPastoGiorno) === 2 ? 2 : 1), 0) : conInd.length;
      return { titolo: `${tot} ${ind.chiave === 'buonoPasto' ? (tot === 1 ? 'buono pasto' : 'buoni pasto') : ind.nome} ${p.nome}`, sotto: ind.chiave === 'buonoPasto' ? `In ${conInd.length} ${conInd.length === 1 ? 'giorno' : 'giorni'}.` : (tot === 1 ? '1 giorno.' : `${tot} giorni.`), righe: conInd.slice(0, 31).map(rigaGiornoVoce) };
    }
    if(/\bstraordinario/.test(s)){
      let min = 0; const righe = [];
      giorni.forEach(g => { const m = minutiStraordinario(AppState.turni[g]); if(m){ min += m; righe.push(rigaGiornoVoce(g)); } });
      return { titolo: `${hhmmDurata(min)} di straordinario ${p.nome}`, sotto: righe.length ? `In ${righe.length} ${righe.length === 1 ? 'giorno' : 'giorni'}.` : 'Nessuno nei giorni inseriti.', righe };
    }
    if(/\b(turni|giorni|ho lavorato|lavorato)\b/.test(s)){
      const lav = giorni.filter(g => { const t = AppState.turni[g]; return t && !t.riposo && !t.assenzaTipo && t.oraInizio; });
      return { titolo: `${lav.length} ${lav.length === 1 ? 'turno' : 'turni'} ${p.nome}`, sotto: '', righe: [] };
    }
  }

  // 4) Quando: "quando sono di notte", "quando ho riposo la prossima settimana", "quando sono in ferie"
  if(/\bquando\b/.test(s)){
    const cosa = cosaChiestaVoce(s);
    if(cosa){
      const pred = passato && !futuro ? { da: giornoPiu(oggiIso, -30), a: giornoPiu(oggiIso, -1), nome: 'negli ultimi 30 giorni' } : { da: oggiIso, a: giornoPiu(oggiIso, 30), nome: 'nei prossimi 30 giorni' };
      const p = periodoVoce(s, oggi, passato, pred);
      const trovati = giorniPeriodoVoce(p).filter(g => corrispondeVoce(AppState.turni[g], cosa));
      const nome = nomeCosaVoce(cosa, false);
      return { titolo: trovati.length ? `${cosa.tipo === 'assenza' ? nome : (cosa.tipo === 'riposo' ? 'Riposo' : 'Di ' + nome)}: ${trovati.length} ${trovati.length === 1 ? 'giorno' : 'giorni'} ${p.nome}` : `Nessun ${nome} ${p.nome}`, sotto: '', righe: trovati.slice(0, 31).map(rigaGiornoVoce) };
    }
  }

  // 5) Che turno: "il 15 agosto che turno ho fatto", "domani che turno ho", "che turno faccio sabato"
  if(/\b(che turno|che turni|quale turno|quali turni|cosa|che cosa|ho lavorato|lavorero)\b/.test(s) || dateOk.length){
    let giorni = dateOk.length ? dateOk : null, nomePeriodo = '';
    if(!giorni){
      const p = periodoVoce(s, oggi, passato, null);
      giorni = p ? giorniPeriodoVoce(p) : [oggiIso, giornoPiu(oggiIso, 1)];
      nomePeriodo = p ? p.nome.replace(/^a /, '') : '';
    }
    giorni = giorni.slice(0, 31);
    if(giorni.length === 1){
      const r = rigaGiornoVoce(giorni[0]);
      const t = AppState.turni[giorni[0]];
      const verbo = giorni[0] < oggiIso ? 'hai fatto' : giorni[0] === oggiIso ? 'hai oggi' : 'farai';
      return { titolo: etichettaLungaVoce(giorni[0]), sotto: t && (t.riposo || t.assenzaTipo || t.oraInizio) ? `Ecco cosa ${verbo}:` : 'In questo giorno non c\'è niente di inserito.', righe: [r] };
    }
    const maiusc = t => t.charAt(0).toUpperCase() + t.slice(1);
    return { titolo: nomePeriodo ? maiusc(nomePeriodo) : giorni.length === 2 && giorni[0] === oggiIso ? 'Oggi e domani' : `${giorni.length} giorni`, sotto: '', righe: giorni.map(rigaGiornoVoce) };
  }
  return null;
}
function hhmmDurata(min){ const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${m} min` : `${h} h`; }
function etichettaLungaVoce(iso){
  const d = dataDaIso(iso);
  const nomi = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  return `${nomi[d.getDay()]} ${d.getDate()} ${NOMI_MESI[d.getMonth()].toLowerCase()}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

// La scheda con la risposta (stessa scheda dal basso della voce).
function schedaRispostaVoce(r, frase){
  schedaVoce(`<p class="voce-titolo">${escapeHtml(r.titolo)}</p>${r.sotto ? `<p class="voce-sotto">${escapeHtml(r.sotto)}</p>` : ''}
    <div class="voce-frase">${ICONA_MICROFONO}<span>«${escapeHtml(frase)}»</span></div>
    ${r.righe.length ? `<div class="voce-righe">${r.righe.map(x => `<button type="button" class="voce-riga voce-riga-risposta" data-voce="apri-giorno" data-iso="${x.iso}"><div class="voce-data"><small>${GIORNI_SETTIMANA_BREVI[dataDaIso(x.iso).getDay()]}</small><b>${dataDaIso(x.iso).getDate()}</b>${dataDaIso(x.iso).getMonth() !== new Date().getMonth() || r.righe.length > 1 ? `<small>${NOMI_MESI[dataDaIso(x.iso).getMonth()].slice(0, 3).toLowerCase()}</small>` : ''}</div><div class="voce-testo"><div>${x.html}</div>${x.sotto ? `<small>${x.sotto}</small>` : ''}</div><i aria-hidden="true">›</i></button>`).join('')}</div>` : ''}
    <div class="voce-tasti"><button type="button" class="voce-sec" data-voce="riprova">${ICONA_MICROFONO}Altra domanda</button>${r.vai ? `<button type="button" class="voce-pri" data-voce="vai-${r.vai}">Apri</button>` : `<button type="button" class="voce-pri" data-voce="chiudi">Fatto</button>`}</div>`);
}
function vaiAlGiornoVoce(iso){
  const d = dataDaIso(iso);
  meseCorrente = d.getMonth(); annoCorrente = d.getFullYear();
  if(typeof renderCalendario === 'function') renderCalendario();
  selezionaGiorno(iso);
  window.scrollTo(0, 0);
}

// Aiuti per contare
function minutiStraordinario(t){
  // v3.8.39: in un giorno di riposo o di assenza lo straordinario rimasto da prima non conta (come nel Report).
  if(!t || t.riposo || t.assenzaTipo) return 0; let m = 0;
  [['straordinarioPrimaInizio', 'straordinarioPrimaFine'], ['straordinarioDopoInizio', 'straordinarioDopoFine']].forEach(([a, b]) => { if(t[a] && t[b]){ let x = minDa(t[b]) - minDa(t[a]); if(x <= 0) x += 1440; m += x; } });
  return m;
}
function minutiTurno(t){
  if(!t || t.riposo || t.assenzaTipo || !t.oraInizio || !t.oraFine) return 0;
  const durata = (a, b) => { let x = minDa(b) - minDa(a); if(x <= 0) x += 1440; return x; };
  let m = durata(t.oraInizio, t.oraFine);
  if(t.secondoAttivo && t.secondoOraInizio && t.secondoOraFine) m += durata(t.secondoOraInizio, t.secondoOraFine);
  return m;
}
const INDENNITA_DOMANDA = [
  { chiave: 'buonoPasto', parola: 'buono pasto', nome: 'buoni pasto' },
  { chiave: 'reperibilita', parola: 'reperibilita', nome: 'reperibilità' },
  { chiave: 'ordinePubblico', parola: 'ordine pubblico', nome: 'ordine pubblico' },
  { chiave: 'servizioEsterno', parola: 'servizio esterno', nome: 'servizio esterno' },
  { chiave: 'controlloTerritorio', parola: 'controllo territorio', nome: 'controllo territorio' },
  { chiave: 'missione', parola: 'missione', nome: 'missioni' },
  { chiave: 'cambioTurno', parola: 'cambio turno', nome: 'cambi turno' }
];
function indennitaChiestaVoce(s){ return INDENNITA_DOMANDA.find(x => s.includes(' ' + x.parola + ' ')) || null; }
function conIndennita(t, ind){ return !!(t && !t.riposo && !t.assenzaTipo && t[ind.chiave]); }

// ── Suggerimenti mentre scrivi (al massimo 4) ──
function domandePronte(){
  const mese = NOMI_MESI[new Date().getMonth()].toLowerCase();
  const prima = NOMI_MESI[(new Date().getMonth() + 11) % 12].toLowerCase();
  const base = [
    'domani che turno ho?', 'che turni faccio questa settimana?', 'quando è il prossimo riposo?', 'quando sono di notte la prossima settimana?',
    `quante notti ho fatto a ${prima}?`, `quante ore ho lavorato a ${mese}?`, `quante ore di straordinario a ${mese}?`, 'quando ho fatto l\'ultimo straordinario?',
    `quanti buoni pasto a ${mese}?`, `quanti festivi ho lavorato a ${prima}?`, `quante reperibilità a ${mese}?`, 'quanti giorni di congedo mi restano?',
    'il 15 agosto che turno ho fatto?', 'chi mi deve un turno?', 'a chi devo un turno?', `quanti km ho fatto a ${mese}?`
  ];
  try{ U.scadenze.slice(0, 3).forEach(x => base.push(`quando ho ${x.nome.toLowerCase()}?`)); }catch(e){}
  return base;
}
function suggerimentiDomanda(testo){
  const q = normalizzaVoce(testo).replace(/[?!.,]/g, ' ').trim();
  const tutte = domandePronte();
  if(!q) return tutte.slice(0, 4);
  const parole = q.split(' ').filter(Boolean), ultima = parole.pop();
  return tutte.filter(f => { const n = normalizzaVoce(f); const w = n.split(/\s+/); return parole.every(p => n.includes(p)) && w.some(x => x.startsWith(ultima)) && n !== q + '?' && n !== q; }).slice(0, 4);
}
