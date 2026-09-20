/* Pattern turno (V2) — un solo sistema: elenco di pattern salvati, ognuno modificabile
 * visivamente (giorno per giorno, con indennità fisse opzionali) e generabile direttamente
 * dalla stessa schermata. Sostituisce il vecchio doppio sistema (preset a tendina +
 * "Opzioni avanzate" separate). Vedi caricaPattern()/PATTERN_BASE_V2 in storage.js per i dati.
 */
'use strict';

let patternInModificaV2 = null; // id del pattern aperto nell'editor
let giornoPatternSelezionatoV2 = 0; // indice del giorno del ciclo attualmente selezionato

function renderSequenza(){
  const data = el('campoPatternDataInizio');
  if(data && !data.value) data.value = dataISO(new Date());
  patternInModificaV2 = null;
  renderListaPatternV2();
  mostraListaPatternV2();
}

function mostraListaPatternV2(){
  const lista = el('vistaListaPattern'), editor = el('vistaEditorPattern');
  if(lista) lista.hidden = false;
  if(editor) editor.hidden = true;
  const titolo = el('titoloSezioneSequenza');
  if(titolo) titolo.textContent = '🔁 Pattern turno';
  renderListaPatternV2();
}

function renderListaPatternV2(){
  const host = el('listaPatternV2');
  if(!host) return;
  const modelli = AppState.modelliTurno || [];
  const coloreDi = m => m ? coloreModelloV2(m) : '#E8ECF0';
  host.innerHTML = (AppState.pattern || []).map(p => {
    const pallini = p.giorni.slice(0, 6).map(g => {
      const m = modelli.find(x => x.id === g.modelloId);
      return `<span style="width:18px;height:18px;border-radius:50%;background:${coloreDi(m)};margin-right:-6px;border:2px solid #fff;display:inline-block;"></span>`;
    }).join('');
    return `<button type="button" class="riga-modello-selettore-corpo riga-modello-selettore" data-pattern-id="${escapeHtml(p.id)}">
      <span style="display:flex;flex-shrink:0;">${pallini}</span>
      <span class="riga-modello-testo"><strong>${escapeHtml(p.nome)}</strong><small>${p.giorni.length} giorni</small></span>
      <span class="riga-modello-freccia" aria-hidden="true">›</span>
    </button>`;
  }).join('') + `<button type="button" class="riga-modello-nuovo" id="btnNuovoPatternV2">＋ Nuovo pattern</button>`;
}

function apriEditorPatternV2(id){
  patternInModificaV2 = id;
  giornoPatternSelezionatoV2 = 0;
  const p = (AppState.pattern || []).find(x => x.id === id);
  if(!p) return;
  el('vistaListaPattern').hidden = true;
  el('vistaEditorPattern').hidden = false;
  const titolo = el('titoloSezioneSequenza');
  if(titolo) titolo.textContent = '🔁 ' + p.nome;
  el('campoPatternNome').value = p.nome;
  const durata = el('campoPatternDurataPreset');
  if(durata) aggiornaGiorniDaPresetV2();
  renderCicloPatternV2();
  renderTavolozzaPatternV2();
  renderIndennitaGiornoPatternV2();
}

function patternCorrenteV2(){
  return (AppState.pattern || []).find(p => p.id === patternInModificaV2);
}

function renderCicloPatternV2(){
  const host = el('cicloPatternV2');
  const p = patternCorrenteV2();
  if(!host || !p) return;
  const modelli = AppState.modelliTurno || [];
  host.innerHTML = p.giorni.map((g, i) => {
    const m = modelli.find(x => x.id === g.modelloId);
    const colore = m ? coloreModelloV2(m) : '#E8ECF0';
    const sigla = m ? (m.sigla || '?') : '?';
    const selezionato = i === giornoPatternSelezionatoV2;
    const bordo = selezionato ? 'border:2px solid #1B2440;' : 'border:2px solid transparent;';
    const badge = (g.indennita && g.indennita.length) ? '<span style="font-size:.5rem;">🛡️</span>' : '';
    return `<button type="button" class="ciclo-pattern-giorno-v2" data-giorno-index="${i}" style="background:${colore};${bordo}">
      <span style="font-size:.6rem;font-weight:800;">${escapeHtml(sigla)}</span>${badge}
    </button>`;
  }).join('') + `<button type="button" class="ciclo-pattern-aggiungi-v2" id="btnAggiungiGiornoPatternV2">+</button>`;
}

function renderTavolozzaPatternV2(){
  const host = el('tavolozzaPatternV2');
  if(!host) return;
  host.innerHTML = (AppState.modelliTurno || []).map(m => {
    const colore = coloreModelloV2(m);
    return `<button type="button" class="tavolozza-pattern-cerchio-v2" data-modello-id="${escapeHtml(m.id)}" style="background:${colore}" title="${escapeHtml(m.nome)}">${escapeHtml(m.sigla || '?')}</button>`;
  }).join('');
}

function renderIndennitaGiornoPatternV2(){
  const p = patternCorrenteV2();
  const box = el('indennitaGiornoPatternV2');
  const corpo = el('corpoIndennitaGiornoPatternV2');
  if(!p || !box || !corpo) return;
  const giorno = p.giorni[giornoPatternSelezionatoV2];
  if(!giorno){ box.hidden = true; return; }
  const modello = (AppState.modelliTurno || []).find(m => m.id === giorno.modelloId);
  if(!modello || modello.riposo){ box.hidden = true; return; } // il riposo non ha indennità
  box.hidden = false;
  const attive = giorno.indennita || [];
  corpo.innerHTML = INDENNITA_RAPIDE_V2.map(x => `<label class="campo-modale campo-riga">
    <input type="checkbox" data-indennita-pattern="${x.chiave}" ${attive.includes(x.chiave) ? 'checked' : ''}> ${escapeHtml(x.nome)}
  </label>`).join('');
}

function selezionaGiornoPatternV2(indice){
  giornoPatternSelezionatoV2 = indice;
  renderCicloPatternV2();
  renderIndennitaGiornoPatternV2();
}

function assegnaModelloAGiornoPatternV2(modelloId){
  const p = patternCorrenteV2();
  if(!p) return;
  const giorno = p.giorni[giornoPatternSelezionatoV2];
  if(!giorno) return;
  giorno.modelloId = modelloId;
  salvaPatternStorage();
  renderCicloPatternV2();
  renderIndennitaGiornoPatternV2();
  renderListaPatternV2();
}

function aggiornaIndennitaGiornoPatternV2(){
  const p = patternCorrenteV2();
  if(!p) return;
  const giorno = p.giorni[giornoPatternSelezionatoV2];
  if(!giorno) return;
  const spuntate = Array.from(el('corpoIndennitaGiornoPatternV2').querySelectorAll('[data-indennita-pattern]:checked')).map(c => c.dataset.indennitaPattern);
  giorno.indennita = spuntate;
  salvaPatternStorage();
  renderCicloPatternV2();
}

function aggiungiGiornoPatternV2(){
  const p = patternCorrenteV2();
  if(!p) return;
  const primoModello = (AppState.modelliTurno || [])[0];
  p.giorni.push({ modelloId: primoModello ? primoModello.id : '', indennita: [] });
  giornoPatternSelezionatoV2 = p.giorni.length - 1;
  salvaPatternStorage();
  renderCicloPatternV2();
  renderIndennitaGiornoPatternV2();
  renderListaPatternV2();
}

function rinominaPatternV2(){
  const p = patternCorrenteV2();
  if(!p) return;
  const nome = el('campoPatternNome').value.trim();
  if(!nome) return;
  p.nome = nome;
  salvaPatternStorage();
  const titolo = el('titoloSezioneSequenza');
  if(titolo) titolo.textContent = '🔁 ' + nome;
  renderListaPatternV2();
}

function nuovoPatternV2(){
  const primoModello = (AppState.modelliTurno || [])[0];
  const p = { id: 'pattern_' + Date.now(), nome: 'Nuovo pattern', giorni: [{ modelloId: primoModello ? primoModello.id : '', indennita: [] }] };
  AppState.pattern.push(p);
  salvaPatternStorage();
  apriEditorPatternV2(p.id);
}

function eliminaPatternV2(){
  if(!patternInModificaV2) return;
  mostraConferma('Eliminare definitivamente questo pattern?', () => {
    AppState.pattern = AppState.pattern.filter(p => p.id !== patternInModificaV2);
    salvaPatternStorage();
    mostraListaPatternV2();
  });
}

function aggiornaGiorniDaPresetV2(){
  const preset = el('campoPatternDurataPreset').value;
  if(preset === 'personalizzato') return;
  const dataInizioStr = el('campoPatternDataInizio').value || dataISO(new Date());
  const inizio = new Date(dataInizioStr + 'T00:00:00');
  const fine = new Date(inizio);
  if(preset === 'settimana') fine.setDate(fine.getDate() + 7);
  else if(preset === 'mese') fine.setMonth(fine.getMonth() + 1);
  else if(preset === 'mese3') fine.setMonth(fine.getMonth() + 3);
  else if(preset === 'mese6') fine.setMonth(fine.getMonth() + 6);
  else if(preset === 'anno') fine.setFullYear(fine.getFullYear() + 1);
  const giorni = Math.round((fine - inizio) / 86400000);
  el('campoPatternGiorni').value = Math.min(giorni, 366);
}

// Genera i turni reali sul calendario a partire da un pattern, per il periodo scelto.
function generaDaPatternV2(indiceInizialeForzato){
  const p = patternCorrenteV2();
  if(!p || !p.giorni.length) return;
  const dataInizioStr = el('campoPatternDataInizio').value;
  const numeroGiorni = Math.max(1, Math.min(366, Number(el('campoPatternGiorni').value) || 1));
  if(!dataInizioStr) return;

  const dataInizio = new Date(dataInizioStr + 'T00:00:00');
  const indiceIniziale = indiceInizialeForzato !== undefined
    ? ((indiceInizialeForzato % p.giorni.length) + p.giorni.length) % p.giorni.length
    : 0;

  let giorniEsistenti = 0;
  for(let i = 0; i < numeroGiorni; i++){
    const d = new Date(dataInizio); d.setDate(d.getDate() + i);
    if(AppState.turni[dataISO(d)]) giorniEsistenti++;
  }
  const eseguiGenerazione = () => {
    for(let i = 0; i < numeroGiorni; i++){
      const d = new Date(dataInizio); d.setDate(d.getDate() + i);
      const iso = dataISO(d);
      const giornoPattern = p.giorni[(indiceIniziale + i) % p.giorni.length];
      const modello = (AppState.modelliTurno || []).find(m => m.id === giornoPattern.modelloId);
      if(!modello) continue;
      if(modello.riposo){
        AppState.turni[iso] = { data: iso, riposo: true, generatoAutomaticamente: true };
      } else {
        if(!modello.oraInizio || !modello.oraFine) continue;
        const t = { data: iso, riposo: false, assenzaTipo: null, oraInizio: modello.oraInizio, oraFine: modello.oraFine, generatoAutomaticamente: true };
        (giornoPattern.indennita || []).forEach(chiave => { t[chiave] = true; });
        AppState.turni[iso] = t;
      }
    }
    if(indiceIniziale === 0) TurniPSStorage.setItem(CHIAVE_SEQUENZA_ANCORA, dataInizioStr);
    const ultimoGiornoScritto = new Date(dataInizio); ultimoGiornoScritto.setDate(ultimoGiornoScritto.getDate() + numeroGiorni - 1);
    TurniPSStorage.setItem(CHIAVE_SEQUENZA_ULTIMO_GIORNO, dataISO(ultimoGiornoScritto));
    TurniPSStorage.setItem(CHIAVE_SEQUENZA_ULTIMO_PATTERN_ID, p.id);
    salvaTurniStorage();

    annoCorrente = dataInizio.getFullYear();
    meseCorrente = dataInizio.getMonth();
    giornoSelezionato = dataInizioStr;
    mostraScheda('turni');
    renderCalendario();
    mostraToast(
      giorniEsistenti > 0 ? `Turni generati (${giorniEsistenti} giorno/i con un turno precedente sono stati sovrascritti)` : 'Turni generati',
      'successo'
    );
  };

  eseguiGenerazione();
}

// "Continua turnazione": riparte dal giorno dopo l'ultimo generato, con lo stesso pattern usato
// l'ultima volta, senza sfasare la rotazione — indipendentemente da quale pattern sia aperto ora.
function continuaSequenzaTurni(){
  const patternId = TurniPSStorage.getItem(CHIAVE_SEQUENZA_ULTIMO_PATTERN_ID);
  const ancoraStr = TurniPSStorage.getItem(CHIAVE_SEQUENZA_ANCORA);
  const ultimoGiornoStr = TurniPSStorage.getItem(CHIAVE_SEQUENZA_ULTIMO_GIORNO);
  if(!patternId || !ancoraStr || !ultimoGiornoStr){
    mostraAvviso('Non c\'è ancora una turnazione generata da cui continuare: apri un pattern e genera prima i turni, poi potrai continuarli senza sfasare la rotazione.');
    return;
  }
  const p = (AppState.pattern || []).find(x => x.id === patternId);
  if(!p){ mostraAvviso('Il pattern usato l\'ultima volta non esiste più.'); return; }

  const ultimoGiorno = new Date(ultimoGiornoStr + 'T00:00:00');
  const nuovoInizio = new Date(ultimoGiorno); nuovoInizio.setDate(nuovoInizio.getDate() + 1);
  const nuovoInizioStr = dataISO(nuovoInizio);

  const ancora = new Date(ancoraStr + 'T00:00:00');
  const giorniTrascorsi = Math.round((nuovoInizio - ancora) / 86400000);
  const indiceIniziale = giorniTrascorsi % p.giorni.length;

  if(patternInModificaV2 !== patternId) apriEditorPatternV2(patternId);
  el('campoPatternDataInizio').value = nuovoInizioStr;
  el('campoPatternDurataPreset').value = 'mese';
  aggiornaGiorniDaPresetV2();
  generaDaPatternV2(indiceIniziale);
}
