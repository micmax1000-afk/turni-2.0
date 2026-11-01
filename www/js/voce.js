// ── v3.8.13: "Detta a voce" ──
// Si tocca ＋ → "Detta a voce", si parla ("domani notte", "ferie dal 3 al 10 dicembre",
// "oggi straordinario 2 ore dopo", "giovedì alle 10 dentista") e l'app mostra cosa ha capito.
// Non salva mai niente da sola: si controlla e si tocca Salva.
// Le frasi le capisce l'app con delle regole (nessuna intelligenza artificiale su internet).
// La voce diventa testo con il riconoscimento di Android, prima di tutto senza internet.

const ICONA_MICROFONO = '<svg class="voce-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const ICONE_VOCE = {
  evento: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  assenza: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  domanda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.6v.4"/>'
};
function iconaVoce(nome){
  const d = ICONE_VOCE[nome];
  return d ? `<svg class="voce-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>` : '';
}

// ── Dove si trasforma la voce in testo ──
function pluginVoce(){
  try{
    const C = window.Capacitor;
    if(!C || !(C.isNativePlatform && C.isNativePlatform())) return null;
    if(C.Plugins && C.Plugins.Voce) return C.Plugins.Voce;
    return C.registerPlugin ? C.registerPlugin('Voce') : null;
  }catch(e){ return null; }
}
function riconoscitoreWeb(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function voceDisponibile(){ return !!(pluginVoce() || riconoscitoreWeb()); }

// ── Dal parlato alle cose da fare ──
const NUMERI_VOCE = { un:1, uno:1, una:1, primo:1, due:2, tre:3, quattro:4, cinque:5, sei:6, sette:7, otto:8, nove:9, dieci:10,
  undici:11, dodici:12, tredici:13, quattordici:14, quindici:15, sedici:16, diciassette:17, diciotto:18, diciannove:19, venti:20,
  ventuno:21, ventidue:22, ventitre:23, ventiquattro:24, venticinque:25, ventisei:26, ventisette:27, ventotto:28, ventinove:29, trenta:30, trentuno:31 };
const MESI_VOCE = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GIORNI_VOCE = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
const SINONIMI_TURNO = {
  mattina: ['mattina', 'mattino', 'mattutino', 'di mattina'],
  pomeriggio: ['pomeriggio', 'pomeridiano', 'di pomeriggio'],
  sera: ['sera', 'serale', 'di sera'],
  notte: ['notte', 'notturno', 'di notte', 'nottata'],
  riposo: ['riposo', 'libero', 'giorno libero', 'riposo settimanale'],
  ufficio: ['ufficio'],
  aggiornamentoProfessionale: ['aggiornamento professionale', 'aggiornamento'],
  addestramentoTiro: ['addestramento tiro', 'addestramento al tiro', 'tiro', 'poligono']
};
const SINONIMI_ASSENZA = {
  'Congedo ordinario': ['congedo ordinario', 'ferie', 'congedo', 'licenza ordinaria', 'licenza'],
  'Congedo straordinario': ['congedo straordinario', 'licenza straordinaria'],
  'L104': ['legge 104', 'l 104', 'l104', '104'],
  'Riposo legge': ['riposo legge', 'riposi legge', 'riposo di legge'],
  'Riposo festivo': ['riposo festivo'],
  'Recupero festivo': ['recupero festivo', 'recupero del festivo'],
  'Recupero riposo': ['recupero riposo', 'recupero del riposo'],
  'Riposo compensativo': ['riposo compensativo', 'compensativo'],
  'Donazione sangue': ['donazione sangue', 'donazione del sangue', 'donazione'],
  'Aspettativa': ['aspettativa'],
  'Congedo parentale': ['congedo parentale'],
  'Maternità/Paternità': ['maternita', 'paternita']
};
const SINONIMI_INDENNITA = [
  ['ordinePubblico', ['ordine pubblico']],
  ['controlloTerritorio', ['controllo del territorio', 'controllo territorio']],
  ['servizioEsterno', ['servizio esterno']],
  ['reperibilita', ['reperibilita', 'reperibile']],
  ['buonoPasto', ['buoni pasto', 'buono pasto']],
  ['cambioTurno', ['cambio turno', 'cambio di turno']],
  ['missione', ['missione']]
];

function normalizzaVoce(s){
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();
}
function regexParole(parole){ // le più lunghe per prime: "congedo straordinario" prima di "congedo"
  const ord = [...parole].sort((a, b) => b.length - a.length).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?:^|\\s)(${ord.join('|')})(?=\\s|$)`);
}
function hhmm(min){ min = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }
function minDa(h){ const p = String(h).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }

// Prepara il testo: numeri in cifre, orari "10:30", durate "90min".
function preparaFraseVoce(testo){
  let s = ' ' + normalizzaVoce(testo).replace(/[.!?]+(\s|$)/g, ', ') + ' ';
  s = s.replace(/\bun'ora\b/g, '1 ora').replace(/\bmezz'?ora\b/g, '30min').replace(/\bun quarto d'ora\b/g, '15min');
  s = s.replace(/\b([a-z]+)\b/g, (m, p) => NUMERI_VOCE[p] !== undefined && !['una', 'un', 'uno', 'primo'].includes(p) ? String(NUMERI_VOCE[p]) : m);
  s = s.replace(/\b(un|una|uno) (or[ae]|minuti)\b/g, '1 $2').replace(/\b(il|al|dal) primo\b/g, '$1 1');
  s = s.replace(/\bl'(\d)/g, 'il $1').replace(/\bdall'(\d)/g, 'dal $1').replace(/\ball'(\d)/g, 'al $1').replace(/\bdell'(\d)/g, 'del $1');
  s = s.replace(/\b(\d{1,2})[.:](\d{2})\b/g, '$1:$2');
  s = s.replace(/\b(\d+) or[ae] e mezz[ao]\b/g, (m, h) => `${h * 60 + 30}min`);
  s = s.replace(/\b(\d+) or[ae] e (\d{1,2})(?: minuti)?\b/g, (m, h, mm) => `${h * 60 + Number(mm)}min`);
  s = s.replace(/\b(\d+) or[ae]\b/g, (m, h) => `${h * 60}min`);
  s = s.replace(/\b(\d+) minuti\b/g, '$1min');
  s = s.replace(/\b(alle|dalle|le|a|fino alle|verso le) (\d{1,2}) e (mezza|mezzo|30)\b/g, '$1 $2:30')
       .replace(/\b(alle|dalle|le|a|fino alle|verso le) (\d{1,2}) e un quarto\b/g, '$1 $2:15')
       .replace(/\b(alle|dalle|le|a|fino alle|verso le) (\d{1,2}) e (\d{2})\b/g, '$1 $2:$3');
  return s.replace(/\s+/g, ' ').trim();
}

function dataDaGiornoMese(g, m, oggi){
  let anno = oggi.getFullYear();
  if(m === null){
    let d = new Date(anno, oggi.getMonth(), g, 12);
    if(d.getDate() !== g) return null;
    if((oggi - d) / 86400000 > 7) d = new Date(anno, oggi.getMonth() + 1, g, 12); // "il 2" detto il 28: il mese dopo
    return d.getDate() === g ? dataISO(d) : null;
  }
  let d = new Date(anno, m, g, 12);
  if((oggi - d) / 86400000 > 60) d = new Date(anno + 1, m, g, 12);
  return d.getDate() === g ? dataISO(d) : null;
}
function dataDaGiornoSettimana(n, prossimo, oggi){
  // Senza "prossimo": il primo che viene (oggi compreso). Con "prossimo": quello della settimana dopo.
  let diff = (n - oggi.getDay() + 7) % 7;
  const pos = g => (g + 6) % 7; // lunedì = 0 … domenica = 6
  if(prossimo && (diff === 0 || pos(n) > pos(oggi.getDay()))) diff += 7;
  return dataISO(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + diff, 12));
}
function giorniTra(da, a){
  const out = []; if(!da || !a) return out;
  if(a < da) [da, a] = [a, da];
  for(let g = da, k = 0; g <= a && k < 92; g = giornoPiu(g, 1), k++) out.push(g);
  return out;
}

// Trova le date in una parte della frase e le toglie dal testo.
function estraiDateVoce(s, oggi){
  const MESE = `(${MESI_VOCE.join('|')})`, WD = `(${GIORNI_VOCE.join('|')})`;
  const mese = m => m ? MESI_VOCE.indexOf(m) : null;
  let date = [], r;
  // "dal 3 al 10 dicembre", "dal 28 novembre al 2 dicembre"
  r = s.match(new RegExp(`\\b(?:dal|da) (\\d{1,2})(?: ${MESE})? (?:al|a) (\\d{1,2})(?: ${MESE})?\\b`));
  if(r){
    const m2 = mese(r[4]) !== null ? mese(r[4]) : mese(r[2]);
    const m1 = mese(r[2]) !== null ? mese(r[2]) : m2;
    const a = dataDaGiornoMese(Number(r[3]), m2, oggi);
    let da = dataDaGiornoMese(Number(r[1]), m1, oggi);
    if(da && a && da > a && m1 === m2 && r[2] === undefined) da = dataISO(new Date(dataDaIso(a).getFullYear(), dataDaIso(a).getMonth() - 1, Number(r[1]), 12));
    date = giorniTra(da, a); s = s.replace(r[0], ' ');
  }
  // "da lunedì a venerdì"
  r = s.match(new RegExp(`\\b(?:dal|da) ${WD} (?:al|a) ${WD}\\b`));
  if(r){
    const da = dataDaGiornoSettimana(GIORNI_VOCE.indexOf(r[1]), false, oggi);
    let a = dataDaGiornoSettimana(GIORNI_VOCE.indexOf(r[2]), false, oggi);
    if(a < da) a = giornoPiu(a, 7);
    date = date.concat(giorniTra(da, a)); s = s.replace(r[0], ' ');
  }
  const parole = [['dopodomani', 2], ["l'altro ieri", -2], ['altroieri', -2], ['oggi', 0], ['stasera', 0], ['stanotte', 0], ['domani', 1], ['ieri', -1]];
  for(const [p, n] of parole){
    const re = new RegExp(`\\b${p}\\b`);
    if(re.test(s)){ date.push(dataISO(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + n, 12))); s = s.replace(re, ' '); }
  }
  // "giovedì 22 (ottobre)": conta il numero, il nome del giorno è solo detto in più
  let rx = new RegExp(`\\b${WD} (\\d{1,2})(?: ${MESE})?\\b(?!:|min)`, 'g');
  s = s.replace(rx, (m, g, n, mm) => { const d = dataDaGiornoMese(Number(n), mm ? mese(mm) : null, oggi); if(d) date.push(d); return ' '; });
  rx = new RegExp(`\\b(?:(prossimo|prossima|questo|questa) )?${WD}(?: (prossimo|prossima))?\\b`, 'g');
  s = s.replace(rx, (m, pre, g, post) => { date.push(dataDaGiornoSettimana(GIORNI_VOCE.indexOf(g), !!((pre && pre.startsWith('pross')) || post), oggi)); return ' '; });
  s = s.replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (m, g, mm) => { const d = dataDaGiornoMese(Number(g), Number(mm) - 1, oggi); if(d) date.push(d); return ' '; });
  rx = new RegExp(`\\b(?:il |giorno )?(\\d{1,2}) ${MESE}\\b`, 'g');
  s = s.replace(rx, (m, g, mm) => { const d = dataDaGiornoMese(Number(g), mese(mm), oggi); if(d) date.push(d); return ' '; });
  s = s.replace(/\b(?:il|giorno) (\d{1,2})\b(?!:|min)/g, (m, g) => { const d = dataDaGiornoMese(Number(g), null, oggi); if(d) date.push(d); return ' '; });
  return { date: [...new Set(date)], resto: s.replace(/\s+/g, ' ').trim() };
}

function modelliPerVoce(){
  const out = [];
  (AppState.modelliTurno || []).forEach(m => {
    const parole = new Set([normalizzaVoce(m.nome), ...(SINONIMI_TURNO[m.id] || [])]);
    if(m.riposo) SINONIMI_TURNO.riposo.forEach(p => parole.add(p));
    out.push({ m, parole: [...parole].filter(Boolean) });
  });
  return out;
}
function assenzePerVoce(){
  return (AppState.assenze || []).filter(a => a.nome !== 'Permesso breve').map(a => ({
    a, parole: [...new Set([normalizzaVoce(a.nome), ...(SINONIMI_ASSENZA[a.nome] || [])])]
  }));
}
function togliParole(s, parole){
  const re = regexParole(parole);
  const r = s.match(re);
  return r ? { trovata: r[1], resto: s.replace(re, ' ').replace(/\s+/g, ' ').trim() } : null;
}
const PAROLE_VUOTE = /\b(e|poi|ho|ce|c'e|c'è|un|una|uno|il|lo|la|i|gli|le|di|del|della|a|al|alla|in|con|per|faccio|fare|sono|di turno|turno|metti|mettimi|segna|segnami|inserisci|aggiungi|evento|appuntamento|promemoria|anche|pure|giorno|giornata|tutto|tutta)\b/g;
function titoloEvento(s, originali){
  let t = (' ' + s + ' ').replace(/^\s*(evento|appuntamento|promemoria|ho|c'e|devo andare|vado)\s+/, ' ');
  t = t.replace(/^\s*(un|una|il|la|lo|l'|dal|dalla|al|alla|a)\s+/, ' ').replace(/\s+/g, ' ').trim();
  // Le parole tornano come sono state dette (es. "Marco" con la maiuscola).
  if(originali) t = t.split(' ').map(w => originali[w] || w).join(' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// Il cuore: dalla frase a un elenco di azioni (turno, assenza, straordinario, indennità, evento).
function capisciFraseVoce(testo, rif){
  const oggi = rif && rif.oggi ? dataDaIso(rif.oggi) : (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();
  const predefinito = (rif && rif.giorno) || dataISO(oggi);
  const modelli = modelliPerVoce(), assenze = assenzePerVoce();
  const frase = preparaFraseVoce(testo);
  const originali = {};
  String(testo || '').split(/\s+/).forEach(w => { const pulita = w.replace(/[^\p{L}\p{N}']/gu, ''); const k = normalizzaVoce(pulita); if(k && !originali[k]) originali[k] = pulita; });
  const parti = frase.split(/\s*(?:,|;|\be poi\b|\bpoi\b|\be\b|\bed\b)\s*/).map(x => x.trim()).filter(Boolean);
  const azioni = [], nonCapito = [];
  let ultimeDate = [predefinito], inSospeso = [];
  parti.forEach(parte => {
    const { date, resto: r0 } = estraiDateVoce(parte, oggi);
    let resto = ' ' + r0 + ' ';
    const trovate = [];
    // Orari: "dalle 7 alle 13" (turno o straordinario), "alle 10" (evento)
    let intervallo = null, ora = null;
    const ri = resto.match(/\b(?:dalle|da) (\d{1,2}(?::\d{2})?) (?:alle|a) (\d{1,2}(?::\d{2})?)\b/);
    if(ri){ intervallo = [hhmm(minDa(ri[1])), hhmm(minDa(ri[2]))]; resto = resto.replace(ri[0], ' '); }
    const ro = resto.match(/\b(?:alle|verso le|per le|a) (\d{1,2}(?::\d{2})?)\b/);
    if(ro && minDa(ro[1]) < 1440){ ora = hhmm(minDa(ro[1])); resto = resto.replace(ro[0], ' '); }
    const rd = resto.match(/\b(\d+)min\b/);
    const durata = rd ? Number(rd[1]) : null;
    if(rd) resto = resto.replace(rd[0], ' ');
    // Assenze (prima dei turni: "riposo compensativo" non è il turno "Riposo")
    for(const x of assenze){
      const t = togliParole(resto, x.parole);
      if(t){ trovate.push({ tipo: 'assenza', assenzaId: x.a.id, nome: x.a.nome }); resto = ' ' + t.resto + ' '; break; }
    }
    // Straordinario
    const rs = resto.match(/\bstraordinari[oi]\b/);
    if(rs){
      const prima = /\bprima\b/.test(resto);
      resto = resto.replace(/\bstraordinari[oi]\b/, ' ').replace(/\b(prima|dopo)( del turno| il turno)?\b/, ' ');
      trovate.push({ tipo: 'straordinario', minuti: durata, intervallo, quando: prima ? 'prima' : 'dopo' });
      intervallo = null;
    }
    // Indennità
    SINONIMI_INDENNITA.forEach(([chiave, parole]) => {
      const t = togliParole(resto, parole);
      if(t){
        const due = chiave === 'buonoPasto' && /\b2 buoni\b/.test(resto);
        trovate.push({ tipo: 'indennita', chiave, due, oreMissione: chiave === 'missione' && durata && !rs ? durata / 60 : null });
        resto = ' ' + t.resto + ' ';
      }
    });
    // Turno (non quando c'è un'ora sola: "alle 20 cena di sera" è un evento)
    if(!ora && !trovate.some(x => x.tipo === 'assenza')){
      for(const x of modelli){
        const t = togliParole(resto, x.parole);
        if(t){ trovate.push({ tipo: 'turno', modelloId: x.m.id, intervallo }); intervallo = null; resto = ' ' + t.resto + ' '; break; }
      }
    }
    if(intervallo && !trovate.some(x => x.tipo === 'turno')){ trovate.push({ tipo: 'turno', modelloId: null, intervallo }); intervallo = null; }
    // Evento: un'ora sola, oppure parole rimaste con un giorno detto
    const avanzo = resto.replace(PAROLE_VUOTE, ' ').replace(/\s+/g, ' ').trim();
    if(ora || /\b(evento|appuntamento|promemoria)\b/.test(resto) || (avanzo && date.length && !trovate.length)){
      const titolo = titoloEvento(resto.replace(/\s+/g, ' ').trim(), originali);
      trovate.push({ tipo: 'evento', titolo: titolo || 'Evento', ora });
    } else if(avanzo && !trovate.length){
      nonCapito.push(avanzo);
    }
    if(!trovate.length){ if(date.length) inSospeso = inSospeso.concat(date); return; }
    const giorni = date.length ? inSospeso.concat(date) : (inSospeso.length ? inSospeso : ultimeDate);
    inSospeso = []; ultimeDate = giorni;
    trovate.forEach(x => azioni.push({ ...x, giorni: [...giorni] }));
  });
  return { azioni, nonCapito, frase: testo };
}

// ── Anteprima: righe da controllare prima di salvare ──
function modelloDaId(id){ return (AppState.modelliTurno || []).find(m => m.id === id) || null; }
function righeDaAzioniVoce(capito){
  const righe = [], turnoPrevisto = {};
  const avvisi = capito.nonCapito.map(p => `«${escapeHtml(p)}»: non l'ho capito.`);
  capito.azioni.filter(a => a.tipo === 'turno' || a.tipo === 'assenza').forEach(a => {
    if(a.tipo === 'turno'){
      const m = a.modelloId ? modelloDaId(a.modelloId) : null;
      a.giorni.forEach(iso => {
        const nuovo = m && m.riposo ? { data: iso, riposo: true }
          : { data: iso, oraInizio: a.intervallo ? a.intervallo[0] : m.oraInizio, oraFine: a.intervallo ? a.intervallo[1] : m.oraFine, ...(m ? { modelloId: m.id } : {}) };
        turnoPrevisto[iso] = nuovo;
        righe.push({ tipo: 'turno', iso, nuovo });
      });
    } else {
      const lunga = a.giorni.length > 1;
      const giorni = a.giorni.filter(iso => !(lunga && AppState.turni[iso] && AppState.turni[iso].riposo && !turnoPrevisto[iso]));
      giorni.forEach(iso => { turnoPrevisto[iso] = { data: iso, assenzaTipo: a.assenzaId }; });
      righe.push({ tipo: 'assenza', giorni, assenzaId: a.assenzaId, nome: a.nome, riposiSaltati: a.giorni.length - giorni.length });
    }
  });
  capito.azioni.filter(a => a.tipo === 'indennita' || a.tipo === 'straordinario').forEach(a => {
    a.giorni.forEach(iso => {
      const t = turnoPrevisto[iso] || AppState.turni[iso];
      if(!t || !t.oraInizio || !t.oraFine || t.riposo || t.assenzaTipo){
        avvisi.push(`${a.tipo === 'straordinario' ? 'Lo straordinario' : 'L\'indennità'} del ${etichettaDataVoce(iso)} va su un turno: quel giorno non c'è.`);
        return;
      }
      if(a.tipo === 'indennita'){ righe.push({ tipo: 'indennita', iso, chiave: a.chiave, due: a.due, oreMissione: a.oreMissione }); return; }
      let da, al;
      if(a.intervallo){ [da, al] = a.intervallo; }
      else {
        const min = a.minuti || 60;
        if(a.quando === 'prima'){ al = t.oraInizio; da = hhmm(minDa(al) - min); }
        else { da = t.oraFine; al = hhmm(minDa(da) + min); }
      }
      const prima = a.intervallo ? minDa(al) <= minDa(t.oraInizio) && minDa(da) < minDa(t.oraInizio) : a.quando === 'prima';
      righe.push({ tipo: 'straordinario', iso, da, al, prima, minuti: ((minDa(al) - minDa(da)) + 1440) % 1440 || 1440 });
    });
  });
  capito.azioni.filter(a => a.tipo === 'evento').forEach(a => a.giorni.forEach(iso => righe.push({ tipo: 'evento', iso, titolo: a.titolo, ora: a.ora })));
  return { righe, avvisi };
}
function etichettaDataVoce(iso){
  const d = dataDaIso(iso);
  return `${GIORNI_SETTIMANA_BREVI[d.getDay()]} ${d.getDate()} ${NOMI_MESI[d.getMonth()].slice(0, 3).toLowerCase()}`;
}
function dataRigaVoce(r){
  if(r.tipo === 'assenza' && r.giorni.length > 1){
    const a = dataDaIso(r.giorni[0]), b = dataDaIso(r.giorni[r.giorni.length - 1]);
    const mm = d => NOMI_MESI[d.getMonth()].slice(0, 3).toLowerCase();
    return `<small>${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + mm(a) : ''}–${b.getDate()}</small><b>${mm(b)}</b>`;
  }
  const d = dataDaIso(r.iso || r.giorni[0]);
  return `<small>${GIORNI_SETTIMANA_BREVI[d.getDay()]}</small><b>${d.getDate()}</b>`;
}
function chipVoce(t){
  const col = coloreGiornoVista(t) || '#C9CED6';
  return `<span class="voce-chip" style="background:${col};color:${testoSuColore(col)}">${escapeHtml(nomeGiornoVista(t) || 'Turno')}</span>`;
}
function primaVoce(iso){
  const t = AppState.turni[iso];
  return t && (t.riposo || t.assenzaTipo || t.oraInizio) ? ` · prima: ${escapeHtml(nomeGiornoVista(t) || 'Turno')}` : '';
}
function htmlRigaVoce(r, i){
  let titolo = '', sotto = '';
  if(r.tipo === 'turno'){
    titolo = chipVoce(r.nuovo) + (r.nuovo.oraInizio ? ` ${escapeHtml(r.nuovo.oraInizio)} – ${escapeHtml(r.nuovo.oraFine)}` : '');
    sotto = (r.nuovo.riposo ? 'Riposo' : 'Turno') + primaVoce(r.iso);
  } else if(r.tipo === 'assenza'){
    titolo = chipVoce({ assenzaTipo: r.assenzaId }) ;
    sotto = r.giorni.length > 1 ? `${r.giorni.length} giorni${r.riposiSaltati ? ' · i riposi restano riposi' : ''}` : 'Assenza' + primaVoce(r.giorni[0]);
  } else if(r.tipo === 'straordinario'){
    titolo = `${iconaIndennita('straordinario', 'voce-ic')}Straordinario ${formatOreMinuti(r.minuti / 60)}`;
    sotto = `${r.prima ? 'Prima del turno' : 'Dopo il turno'} · ${r.da} → ${r.al}`;
  } else if(r.tipo === 'indennita'){
    const voce = ELENCO_INDENNITA.find(x => x.chiave === r.chiave);
    titolo = `${iconaIndennita(r.chiave, 'voce-ic')}${escapeHtml(r.due ? '2 buoni pasto' : voce ? voce.nome : r.chiave)}${r.oreMissione ? ` ${formatOreMinuti(r.oreMissione)}` : ''}`;
    sotto = 'Indennità';
  } else if(r.tipo === 'evento'){
    titolo = `${iconaVoce('evento')}${escapeHtml(r.titolo)}`;
    sotto = r.ora ? `Evento · ${r.ora} – ${hhmm(Math.min(minDa(r.ora) + 60, 1439))}` : 'Evento · tutto il giorno';
  }
  return `<div class="voce-riga"><div class="voce-data">${dataRigaVoce(r)}</div><div class="voce-testo"><div>${titolo}</div><small>${sotto}</small></div>`
    + `<button type="button" class="voce-togli" data-voce-togli="${i}" aria-label="Togli questa riga">✕</button></div>`;
}
function notaSaldoVoce(righe){
  const r = righe.find(x => x.tipo === 'assenza' && x.giorni.length);
  if(!r || typeof saldoAssenza !== 'function') return '';
  const voce = (AppState.assenze || []).find(a => a.id === r.assenzaId);
  if(!voce || voce.unita === 'h' || !(voce.valore > 0 || voce.nome === 'Congedo ordinario')) return '';
  try{
    const d = dataDaIso(r.giorni[0]);
    const nuovi = r.giorni.filter(iso => !(AppState.turni[iso] && AppState.turni[iso].assenzaTipo === r.assenzaId)).length;
    const resto = saldoAssenza(voce, { anno: d.getFullYear(), mese: d.getMonth() }).rimangono - nuovi;
    const nome = voce.nome === 'Congedo ordinario' ? 'congedo' : voce.nome;
    return `<div class="voce-nota">${iconaVoce('assenza')}<span>Usi <b>${nuovi} ${nuovi === 1 ? 'giorno' : 'giorni'}</b> di ${escapeHtml(nome)}: ${resto === 1 ? 'te ne resta' : 'te ne restano'} <b>${String(Math.round(resto * 100) / 100).replace('.', ',')}</b>.</span></div>`;
  }catch(e){ return ''; }
}

// ── Le schede ──
let statoVoce = { righe: [], avvisi: [], frase: '', ascolto: null, finito: false };
function schedaVoce(html){
  let velo = el('veloVoce'), box = el('schedaVoce');
  if(!box){
    velo = document.createElement('div'); velo.id = 'veloVoce'; velo.className = 'voce-velo';
    box = document.createElement('div'); box.id = 'schedaVoce'; box.className = 'voce-scheda'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    document.body.append(velo, box);
    velo.addEventListener('click', chiudiVoce);
    box.addEventListener('click', clicSchedaVoce);
  }
  velo.hidden = false; box.hidden = false;
  box.innerHTML = '<div class="voce-maniglia"></div>' + html;
}
function chiudiVoce(){
  fermaAscoltoVoce(true);
  if(el('veloVoce')) el('veloVoce').hidden = true;
  if(el('schedaVoce')) el('schedaVoce').hidden = true;
}
function schedaAscoltoVoce(){
  const web = !pluginVoce();
  schedaVoce(`<p class="voce-titolo voce-centro">Parla pure</p>
    <button type="button" class="voce-mic in-ascolto" data-voce="fine" aria-label="Ho finito di parlare">${ICONA_MICROFONO}</button>
    <p class="voce-live" id="voceLive"><i>Ti ascolto…</i></p>
    <p class="voce-sotto">Puoi dire per esempio:</p>
    <div class="voce-esempi"><span>«Domani notte»</span><span>«Lunedì riposo, martedì mattina»</span><span>«Straordinario 2 ore dopo»</span><span>«Ferie dal 3 al 10 dicembre»</span><span>«Giovedì alle 10 dentista»</span></div>
    <p class="voce-privacy">${web ? 'Nel browser la voce passa dal servizio di Google solo per diventare testo. L\'app non salva l\'audio.' : '🔒 La voce è riconosciuta sul telefono. Niente viene salvato o inviato.'}</p>
    <div class="voce-tasti"><button type="button" class="voce-sec" data-voce="chiudi">Annulla</button></div>`);
}
function schedaOfflineVoce(){
  schedaVoce(`<p class="voce-titolo">Scarica l'italiano per la voce</p>
    <p class="voce-sotto">Così la voce viene capita <b>sul telefono, senza internet</b>, e non esce mai dal telefono. È gratis e si fa una volta sola.</p>
    <div class="voce-frase voce-passi"><b>Come si fa</b><span>1. Tocca <b>Apri impostazioni</b></span><span>2. Cerca <b>Riconoscimento vocale offline</b> (o Lingue)</span><span>3. Scarica <b>Italiano</b> e torna qui</span></div>
    <div class="voce-tasti"><button type="button" class="voce-pri" data-voce="impostazioni">Apri impostazioni</button></div>
    <button type="button" class="voce-link" data-voce="internet">Usa internet per questa volta</button>
    <p class="voce-privacy">Con internet la voce passa da Google solo per diventare testo. L'app non salva l'audio.</p>`);
}
function schedaRisultatoVoce(){
  const { righe, avvisi, frase } = statoVoce;
  const n = righe.length;
  const giorniTurni = new Set(righe.filter(r => r.tipo === 'turno').map(r => r.iso)).size;
  const soloTurni = n && righe.every(r => r.tipo === 'turno');
  const etichetta = !n ? 'Salva' : soloTurni ? `Salva ${giorniTurni} ${giorniTurni === 1 ? 'giorno' : 'giorni'}` : n === 1 ? 'Salva' : 'Salva tutto';
  const titolo = !n ? 'Non ho capito' : avvisi.length ? 'Non ho capito tutto' : 'Ho capito così';
  const sotto = !n ? 'Riprova con frasi brevi, come negli esempi.' : avvisi.length ? 'Controlla: una parte non l\'ho capita.' : 'Controlla e salva. Tocca ✕ per togliere una riga.';
  const nomiTurni = (AppState.modelliTurno || []).map(m => m.nome).join(', ');
  schedaVoce(`<p class="voce-titolo">${titolo}</p><p class="voce-sotto">${sotto}</p>
    <div class="voce-frase">${ICONA_MICROFONO}<span>«${escapeHtml(frase)}»</span></div>
    <div class="voce-righe">${righe.map(htmlRigaVoce).join('')}</div>
    ${notaSaldoVoce(righe)}
    ${avvisi.length ? `<div class="voce-nota voce-avviso">${iconaVoce('domanda')}<span>${avvisi.join('<br>')}${capitoNonTurno() ? `<br>I tuoi turni sono: ${escapeHtml(nomiTurni)}.` : ''}</span></div>` : ''}
    <div class="voce-tasti"><button type="button" class="voce-sec" data-voce="riprova">${ICONA_MICROFONO}Riprova</button>${n ? `<button type="button" class="voce-pri" data-voce="salva">${etichetta}</button>` : ''}</div>`);
}
function capitoNonTurno(){ return statoVoce.avvisi.some(a => a.includes('non l\'ho capito')); }
function mostraRisultatoVoce(testo){
  const capito = capisciFraseVoce(testo, { giorno: giornoSelezionato || null });
  const { righe, avvisi } = righeDaAzioniVoce(capito);
  statoVoce = { ...statoVoce, righe, avvisi, frase: testo };
  schedaRisultatoVoce();
}
function clicSchedaVoce(e){
  const togli = e.target.closest('[data-voce-togli]');
  if(togli){ statoVoce.righe.splice(Number(togli.dataset.voceTogli), 1); schedaRisultatoVoce(); return; }
  const b = e.target.closest('[data-voce]');
  if(!b) return;
  const azione = b.dataset.voce;
  if(azione === 'chiudi') chiudiVoce();
  else if(azione === 'fine') fermaAscoltoVoce(false);
  else if(azione === 'riprova') avviaAscoltoVoce(true);
  else if(azione === 'internet') avviaAscoltoVoce(false);
  else if(azione === 'impostazioni'){ const p = pluginVoce(); if(p && p.apriImpostazioni) p.apriImpostazioni().catch(() => {}); }
  else if(azione === 'salva') salvaRigheVoce();
}

// ── Ascolto ──
function apriDettaVoce(){
  if(typeof chiudiFabGiorno === 'function') chiudiFabGiorno();
  avviaAscoltoVoce(true);
}
async function avviaAscoltoVoce(offline){
  fermaAscoltoVoce(true);
  schedaAscoltoVoce();
  const live = t => { const p = el('voceLive'); if(p && t) p.textContent = t; };
  const p = pluginVoce();
  if(p){
    let ascoltatore = null;
    try{
      const perm = await p.permesso();
      if(!perm || !perm.concesso){ chiudiVoce(); mostraToast('Per dettare serve il permesso del microfono. Puoi darlo dalle impostazioni di Android.', 'avviso', 6000); return; }
      ascoltatore = await p.addListener('parziale', d => live(d && d.testo));
      statoVoce.ascolto = { tipo: 'nativo', p, ascoltatore };
      const r = await p.ascolta({ offline: offline !== false, lingua: 'it-IT' });
      if(ascoltatore) ascoltatore.remove();
      if(!el('schedaVoce') || el('schedaVoce').hidden) return;
      statoVoce.ascolto = null;
      if(r && r.testo) mostraRisultatoVoce(r.testo); else { statoVoce = { ...statoVoce, righe: [], avvisi: [], frase: '' }; schedaRisultatoVoce(); }
    }catch(err){
      if(ascoltatore) ascoltatore.remove();
      statoVoce.ascolto = null;
      const codice = (err && (err.code || err.message)) || '';
      if(!el('schedaVoce') || el('schedaVoce').hidden) return;
      if(/offline/.test(codice) && offline !== false) schedaOfflineVoce();
      else if(/niente/.test(codice)){ statoVoce = { ...statoVoce, righe: [], avvisi: [], frase: '…' }; schedaRisultatoVoce(); }
      else if(/permesso/.test(codice)){ chiudiVoce(); mostraToast('Per dettare serve il permesso del microfono.', 'avviso', 5000); }
      else { chiudiVoce(); mostraToast(/rete/.test(codice) ? 'Senza internet non riesco a capire la voce.' : 'Il microfono non è disponibile in questo momento. Riprova.', 'avviso', 5000); }
    }
    return;
  }
  const R = riconoscitoreWeb();
  if(!R){ chiudiVoce(); mostraToast('Su questo dispositivo la dettatura non è disponibile.', 'avviso'); return; }
  const rec = new R();
  rec.lang = 'it-IT'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
  let finale = '';
  rec.onresult = ev => {
    let tutto = '';
    for(let i = 0; i < ev.results.length; i++){ tutto += ev.results[i][0].transcript; if(ev.results[i].isFinal) finale = tutto; }
    live(tutto);
  };
  rec.onerror = ev => { statoVoce.erroreWeb = ev.error; };
  rec.onend = () => {
    statoVoce.ascolto = null;
    if(!el('schedaVoce') || el('schedaVoce').hidden) return;
    if(finale) mostraRisultatoVoce(finale);
    else if(statoVoce.erroreWeb === 'not-allowed'){ chiudiVoce(); mostraToast('Per dettare serve il permesso del microfono.', 'avviso', 5000); }
    else { statoVoce = { ...statoVoce, righe: [], avvisi: [], frase: '…' }; schedaRisultatoVoce(); }
  };
  statoVoce.erroreWeb = null;
  statoVoce.ascolto = { tipo: 'web', rec };
  try{ rec.start(); }catch(e){ chiudiVoce(); }
}
function fermaAscoltoVoce(annulla){
  const a = statoVoce.ascolto;
  if(!a) return;
  if(a.tipo === 'nativo'){ try{ (annulla ? a.p.annulla() : a.p.ferma()).catch(() => {}); }catch(e){} if(annulla){ if(a.ascoltatore) a.ascoltatore.remove(); statoVoce.ascolto = null; } }
  else { try{ annulla ? a.rec.abort() : a.rec.stop(); }catch(e){} if(annulla) statoVoce.ascolto = null; }
}

// ── Salvataggio (con Annulla) ──
function salvaRigheVoce(){
  const righe = statoVoce.righe;
  if(!righe.length) return;
  const turniPrima = JSON.stringify(AppState.turni), eventiPrima = JSON.stringify(AppState.eventiGiorno || {});
  righe.filter(r => r.tipo === 'turno').forEach(r => { AppState.turni[r.iso] = { ...r.nuovo }; });
  righe.filter(r => r.tipo === 'assenza').forEach(r => r.giorni.forEach(iso => {
    AppState.turni[iso] = segnaQuandoNuovo({ data: iso, assenzaTipo: r.assenzaId }, AppState.turni[iso]);
  }));
  righe.filter(r => r.tipo === 'indennita').forEach(r => {
    const t = AppState.turni[r.iso]; if(!t) return;
    t[r.chiave] = true;
    if(r.chiave === 'buonoPasto' && r.due) t.buoniPastoGiorno = 2;
    if(r.chiave === 'missione' && r.oreMissione) t.durataMissioneOre = r.oreMissione;
  });
  righe.filter(r => r.tipo === 'straordinario').forEach(r => {
    const t = AppState.turni[r.iso]; if(!t) return;
    if(r.prima){ t.straordinarioPrimaInizio = r.da; t.straordinarioPrimaFine = r.al; }
    else { t.straordinarioDopoInizio = r.da; t.straordinarioDopoFine = r.al; }
  });
  let eventi = 0;
  righe.filter(r => r.tipo === 'evento').forEach(r => {
    if(!AppState.eventiGiorno[r.iso]) AppState.eventiGiorno[r.iso] = [];
    AppState.eventiGiorno[r.iso].push({ id: 'evento_' + Date.now() + '_' + (eventi++), titolo: r.titolo, tuttoIlGiorno: !r.ora,
      oraInizio: r.ora || '', oraFine: r.ora ? hhmm(Math.min(minDa(r.ora) + 60, 1439)) : '', colore: COLORI_EVENTO[0], luogo: '', note: '',
      promemoria: [], oraPromemoria: '08:00', ricordami: false, anticipoMinuti: 0, avvisoSecondi: 0, avvisoModo: 'suono_vibra', ripeti: '', ripetiFino: '', eccezioni: [] });
  });
  salvaTurniStorage();
  if(eventi) salvaEventiGiornoStorage();
  chiudiVoce();
  const primo = righe[0].iso || (righe[0].giorni && righe[0].giorni[0]);
  if(primo){ const d = dataDaIso(primo); meseCorrente = d.getMonth(); annoCorrente = d.getFullYear(); }
  renderCalendario();
  if(primo) selezionaGiorno(primo);
  mostraToast(righe.length === 1 ? 'Salvato' : `Salvate ${righe.length} modifiche`, 'successo', 6000, { testo: 'Annulla', fn: () => {
    try{ AppState.eventiGiorno = JSON.parse(eventiPrima) || {}; salvaEventiGiornoStorage(); }catch(e){}
    ripristinaTurni(turniPrima);
  } });
}

function inizializzaVoce(){
  const b = el('btnDettaVoceFab');
  if(!b) return;
  b.hidden = !voceDisponibile();
  // Senza dettatura (es. alcuni browser) la guida alle novità non ne parla.
  if(b.hidden && typeof PASSI_NOVITA !== 'undefined' && PASSI_NOVITA[0] && /voce/.test(PASSI_NOVITA[0].titolo)) PASSI_NOVITA.splice(0, 1);
  b.addEventListener('click', apriDettaVoce);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && el('schedaVoce') && !el('schedaVoce').hidden) chiudiVoce(); });
}
