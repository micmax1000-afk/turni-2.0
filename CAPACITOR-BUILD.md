# App Android con Capacitor + GitHub Actions

Questa guida sostituisce `ANDROID-BUILD.md` (quello era per Bubblewrap/TWA — un metodo diverso,
che avvolge solo il sito senza dare accesso alle funzioni native del telefono). Capacitor crea
un'app Android vera, con accesso reale a cose come i promemoria affidabili — il motivo per cui
siamo passati a questo metodo.

**Non hai ancora pubblicato nulla su Play Console per questo progetto**, quindi qui sotto uso una
chiave di firma nuova, generata apposta — nessun rischio di conflitto con qualcosa di già online.

## ⚠️ La chiave di firma — leggi questo per primo

Il file `chiavi/turni-release.keystore` (nella cartella a parte, NON dentro il progetto da
caricare su GitHub) è **permanente**: ogni futuro aggiornamento dell'app dovrà essere firmato con
questa stessa identica chiave. Se la perdi, non potrai più pubblicare aggiornamenti alla stessa
app — dovresti ripartire da un'app nuova su Play Store, perdendo recensioni e installazioni.

**Salvala subito in almeno due posti sicuri e diversi** (un password manager + una chiavetta USB,
o due cloud diversi) — non fidarti solo di GitHub. La password è nello stesso posto
(`chiavi/password.txt`).

## Passo 1 — Carica il progetto su GitHub

Scarica lo zip del progetto (contiene già `android/`, `www/`, `capacitor.config.json`,
`.github/workflows/`) e caricalo nel repository `micmax1000-afk/turni` — sostituendo tutto il
contenuto attuale con questo.

## Passo 2 — Salva i quattro segreti su GitHub

Sul repository: **Settings → Secrets and variables → Actions → New repository secret**.
Crea questi quattro segreti (nome esatto a sinistra, valore a destra):

| Nome del secret | Valore |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Contenuto di `chiavi/turni-release.keystore.base64.txt` (tutto, è una riga sola) |
| `ANDROID_KEYSTORE_PASSWORD` | Contenuto di `chiavi/password.txt` |
| `ANDROID_KEY_ALIAS` | `turni-ps` |
| `ANDROID_KEY_PASSWORD` | Lo stesso valore di `ANDROID_KEYSTORE_PASSWORD` (la chiave usa la stessa password del keystore) |

## Passo 3 — Attiva GitHub Pages dalla scheda Actions

Repository → **Settings → Pages** → in "Source" scegli **GitHub Actions** (non più "Deploy from
a branch" se era impostato così prima).

## Passo 4 — Prova il workflow

Scheda **Actions** del repository → workflow **"Pubblica sito e genera pacchetto Android"** →
**Run workflow** → lascia la casella "Genera anche il pacchetto Android" spuntata → **Run
workflow**.

Da qui in avanti, **ogni volta che carichi modifiche sul branch main**, il sito si pubblica da
solo su GitHub Pages, e il pacchetto Android si rigenera insieme (a meno che tu non tolga la
spunta quando lo avvii a mano).

## Passo 5 — Scarica il pacchetto per Play Console

Al termine dell'esecuzione (qualche minuto), apri quella esecuzione del workflow → in fondo alla
pagina, sezione **Artifacts** → scarica `pacchetto-android-turni-ps`. Dentro trovi:
- Il file **.aab** — questo carichi su Play Console
- Il file **.apk** — questo installi/provi direttamente sul telefono (sideload), senza passare da Play Console

## Passo 6 — L'impronta SHA-256, se ti serve ancora `assetlinks.json`

Con Capacitor questo file non è più necessario (era specifico di Bubblewrap/TWA) — l'app nativa
non ne ha bisogno. Se un domani lo tenessi comunque per qualche motivo, l'impronta è stampata nei
log del workflow, nello step "Mostra l'impronta SHA-256...".

## ⚠️ Se attivi "Play App Signing" al primo caricamento

Play Console propone di default di far gestire a Google la firma finale di distribuzione
("Play App Signing"). In quel caso continui comunque a firmare i tuoi caricamenti con **questa**
chiave (quella che carichi tu resta la "chiave di upload") — Google la userà solo per verificare
che sei tu, poi ri-firma con una sua chiave per gli utenti finali. Non cambia nulla nel workflow:
continui a usare sempre questa stessa chiave per ogni nuovo caricamento.
