// ── Domande a voce: "il 15 agosto che turno ho fatto?", "quando sono di notte?", "quante notti a ottobre?",
// "quanti giorni di congedo mi restano?", "quando ho la visita medica?".
// L'app risponde guardando i dati già salvati sul telefono: niente internet, niente viene salvato o cambiato.
'use strict';

const PAROLE_PASSATO_VOCE = /\b(ho fatto|ho lavorato|ho avuto|facevo|ero|avevo|era|sono stato|sono stata|ho svolto|e stato|scorso|scorsa)\b/;

// È una domanda? (le frasi per inserire non usano queste parole)
function eDomandaVoce(testo){
  const s = ' ' + normalizzaVoce(testo).replace(/[?!.]/g, ' ') + ' ';
  if(/\b(metti|mettimi|segna|segnami|inserisci|aggiungi|elimina|cancella|togli|rimuovi)\b/.test(s)) return false;
  return /\b(che turno|quale turno|che cosa (ho|faccio|facevo)|cosa (ho|faccio|facevo|ho fatto)|quando|quant[aeio]|ho lavorato|mi rest\w*|rimang\w*)\b/.test(s)
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
  const s = ' ' + preparaFraseVoce(testo).replace(/[?,]/g, ' ') + ' ';
  const passato = PAROLE_PASSATO_VOCE.test(s);

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
    if(/\bstraordinari/.test(s)){
      let min = 0; const righe = [];
      giorni.forEach(g => { const t = AppState.turni[g]; if(!t) return; let m = 0;
        [['straordinarioPrimaInizio', 'straordinarioPrimaFine'], ['straordinarioDopoInizio', 'straordinarioDopoFine']].forEach(([a, b]) => { if(t[a] && t[b]){ let x = minDa(t[b]) - minDa(t[a]); if(x <= 0) x += 1440; m += x; } });
        if(m){ min += m; righe.push(rigaGiornoVoce(g)); } });
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
      const pred = passato ? { da: giornoPiu(oggiIso, -30), a: giornoPiu(oggiIso, -1), nome: 'negli ultimi 30 giorni' } : { da: oggiIso, a: giornoPiu(oggiIso, 30), nome: 'nei prossimi 30 giorni' };
      const p = periodoVoce(s, oggi, passato, pred);
      const trovati = giorniPeriodoVoce(p).filter(g => corrispondeVoce(AppState.turni[g], cosa));
      const nome = nomeCosaVoce(cosa, false);
      return { titolo: trovati.length ? `${cosa.tipo === 'assenza' ? nome : (cosa.tipo === 'riposo' ? 'Riposo' : 'Di ' + nome)}: ${trovati.length} ${trovati.length === 1 ? 'giorno' : 'giorni'} ${p.nome}` : `Nessun ${nome} ${p.nome}`, sotto: '', righe: trovati.slice(0, 31).map(rigaGiornoVoce) };
    }
  }

  // 5) Che turno: "il 15 agosto che turno ho fatto", "domani che turno ho", "che turno faccio sabato"
  if(/\b(che turno|quale turno|cosa|che cosa|ho lavorato)\b/.test(s) || dateOk.length){
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
