# Turni & Accessorio PS

App **PWA** per la gestione personale di turni, assenze e simulazione cedolino, pensata per operatori della Polizia di Stato.

> **Progetto indipendente, non ufficiale e non affiliato alla Polizia di Stato né ad alcun ente pubblico.**  
> I valori delle tabelle sono indicativi (fonti pubbliche). Verifica sempre sul cedolino ufficiale prima di decisioni economiche.

**Versione:** 2.0.0 — prima versione della nuova interfaccia "a tutto schermo" ispirata a Supershift: calendario come schermata iniziale, navigazione a 4 schede (Calendario/Report/Turni/Altro), inserimento rapido tramite Modelli. Il motore di calcolo (turni, cedolino, IRPEF) è invariato rispetto alla 1.0.x.

---

## Funzionalità

- **Calendario turni** — inserimento manuale o sequenza automatica (es. turno in quinta)
- **Classificazione ore** — ordinarie, notturne, festive, domenicali, straordinari
- **Prossimo turno** e **riepilogo mensile** sempre visibili sopra il calendario
- **Assenze** — saldi personalizzabili (congedo, permesso breve, ecc.), con riporto ferie automatico
- **Cedolino simulato** — competenze, stima fiscale e netto indicativo
- **Tabelle ufficiali personalizzabili** — stipendi, indennità, straordinario, **IRPEF nazionale** e
  **addizionale regionale** (per la regione impostata in Anagrafica) modificabili da Impostazioni → Tabelle
- **Colori turni** — personalizzabili per categoria (colore su tutta la casella)
- **Backup** — export/import JSON locale; opzione backup Google Drive
- **Offline** — Service Worker, installabile come PWA
- **Tema** chiaro / scuro

---

## Avvio rapido (web / GitHub Pages)

1. Pubblica la root del repository su **GitHub Pages** (branch `main`, cartella `/`).
2. Apri l’URL del sito.
3. Dopo un aggiornamento: **hard refresh** (`Ctrl+Shift+R` / su mobile svuota cache del sito) per aggiornare il Service Worker.

In locale puoi aprire `index.html` con un server statico (consigliato, non `file://`):

```bash
npx serve .
# oppure
python3 -m http.server 8080
```

---

## Struttura del progetto

```text
index.html          # UI principale + caricamento moduli
style.css           # Stili (mobile-first, tema scuro)
script.js           # Inizializzazione e wiring eventi
sw.js               # Service Worker (cache app shell)
manifest.json       # Manifest PWA (usato anche da PWABuilder per generare il pacchetto Android)
icons/              # Icone PWA
tests/              # Test automatici sulle funzioni di calcolo (vedi tests/README.md)
js/
├── config.js       # Chiavi localStorage
├── state.js        # AppState
├── storage.js      # Adapter persistenza (TurniPSStorage)
├── utils.js
├── calendar.js     # Calendario, festività, classificazione turno
├── shifts.js       # Turni, colori, editor
├── absences.js     # Saldi assenze, ferie, recuperi
├── sequence.js     # Sequenza automatica
├── payroll.js      # Motore cedolino
├── tables.js       # Editor tabelle ufficiali (Impostazioni → Tabelle)
├── profile.js      # Anagrafica
├── backup.js       # Backup JSON locale + Google Drive
├── ui.js
├── dashboard.js
├── statistics.js
├── offline.js      # Stato connessione, pagina offline, prompt installazione
├── migrations.js   # Migrazioni dati fra versioni
├── data-guard.js
└── data/tabelle-2026.js  # Valori ufficiali predefiniti (stipendi, IRPEF, addizionali regionali)
```

---

## Navigazione (schede)

Solo **icone** nella barra:

| Icona | Sezione        |
|-------|----------------|
| 📅    | Turni          |
| 🗂️    | Assenze        |
| 📊    | Tabelle        |
| 💶    | Cedolino       |
| 🌓    | Tema           |
| 📈    | Statistiche    |
| ⚙️    | Impostazioni   |

- **Anagrafica**, **Backup** e **Colori** si raggiungono da Impostazioni (o dal pulsante Colori nel calendario).
- Su **smartphone** il calendario mostra soprattutto le **sigle** (M, P, S, N, R, …).

---

## Colori turni

Apri **🎨 Colori turni** nel calendario.

| Categoria   | Predefinito        | Dove si vede      |
|-------------|--------------------|-------------------|
| Mattina     | arancione chiaro   | tutta la casella  |
| Pomeriggio  | giallo ambrato     | tutta la casella  |
| Sera        | viola chiaro       | tutta la casella  |
| Notte       | blu chiaro         | tutta la casella  |
| Riposo      | verde soft         | tutta la casella  |
| Assenze     | grigio             | tutta la casella  |

- Tocca il quadrato colore per cambiare.
- **✕** o **Fatto — torna al calendario** per chiudere la tavolozza.
- **↺ Ripristina predefiniti** per tornare ai colori di fabbrica.
- **☁ Esporta / Importa colori** — solo con **Backup Drive** a pagamento (1,99€); i colori viaggiano anche nel backup automatico su Drive.
- Il backup JSON locale gratuito non include i colori (restano sul dispositivo).
- I colori sono salvati in `localStorage` e restano dopo il refresh.

**Nota:** le **assenze** hanno il **numero del giorno barrato**; i riposi no.

---

## Dati e privacy

- I dati restano **solo sul dispositivo** (browser / app), nelle chiavi `simCedolino_*`.
- Fai **backup JSON** periodicamente da Impostazioni → Backup locale.
- Un cambio telefono o la cancellazione dati del browser **cancella** i turni se non hai un backup esterno.

---

## Android — pacchetto automatico (GitHub Actions + Bubblewrap)

Il modo consigliato oggi: un workflow GitHub Actions genera l'AAB/APK firmato in automatico,
sempre con la stessa chiave di firma — niente più passaggi manuali su PWABuilder ad ogni
aggiornamento. Configurazione iniziale (una volta sola) e istruzioni complete in
**[ANDROID-BUILD.md](./ANDROID-BUILD.md)**.

Riassunto rapido una volta configurato: scheda **Actions** del repository → workflow
**"Genera pacchetto Android (AAB/APK)"** → **Run workflow** → scarica il risultato da
**Artifacts** a fine esecuzione.

### Alternativa manuale (PWABuilder)

Se preferisci non impostare il workflow automatico, resta possibile generare il pacchetto
anche a mano, senza alcun file di progetto locale:

1. Pubblica l'app su GitHub Pages (vedi sopra) e verifica che si apra correttamente da telefono.
2. Vai su **[pwabuilder.com](https://www.pwabuilder.com)** e incolla l'URL della tua GitHub Pages.
3. PWABuilder legge `manifest.json` e `sw.js` automaticamente e genera un pacchetto Android (AAB/APK)
   pronto per il Play Console.

⚠️ **Attenzione al nome del pacchetto (`Package ID` / `applicationId`)**, in entrambi i casi:
**una volta pubblicato sul Play Store non si può più cambiare**. Il nostro è già fissato in
`twa-manifest.json` (`turniaccessorio.ps`) — se usi PWABuilder manualmente, usa lo stesso valore
per restare coerente.

---

## Test automatici

Le funzioni di calcolo più delicate (IRPEF, addizionale regionale, ore turno/straordinario, cedolino,
saldi assenze) hanno una suite di test in `tests/` — vedi `tests/README.md` per i dettagli e come
eseguirli. Utile soprattutto dopo aver modificato `js/calendar.js`, `js/payroll.js` o `js/absences.js`,
per accorgersi subito di eventuali regressioni prima di pubblicare.

---

## Sviluppo e fix recenti (V46)

- Tabelle IRPEF nazionale e addizionale regionale rese modificabili da Impostazioni → Tabelle
  (prima erano fisse nel codice)
- **Corretto bug**: l'IRPEF su redditi annui oltre 50.000€ poteva risultare negativa a causa di una
  soglia persa nella serializzazione dei dati salvati — vedi `tests/irpef.test.js`
- **Corretto bug**: il totale ore del giorno contava due volte lo straordinario
  (es. 6h+3h straordinario mostrava 12h invece di 9h) — vedi `tests/turno.test.js`
- Sezione Turni riordinata: Calendario → Colori → Prossimo turno → Azioni rapide → Dettaglio giorno → Riepilogo mese
- Dettaglio giorno e riepilogo mensile ora richiudibili (ore ordinarie/straordinario/totale restano
  sempre visibili; "Indicatori del giorno" parte chiuso)
- Aggiunta suite di test automatici sulle funzioni di calcolo (`tests/`)

I file `README-FASE*.md` / `README-FIX.md` storici sono sostituiti da **questo unico README**.

---

## Disclaimer

Questa app è uno strumento di supporto personale. Non sostituisce NoiPA, il cedolino ufficiale o comunicazioni dell’amministrazione. L’autore non è responsabile di errori, omissioni o decisioni basate sui dati simulati.
