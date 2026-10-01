# App Android con Capacitor + GitHub Actions

## ⚠️ Ottobre 2026 — corretto un problema sul numero di build

Ogni AAB generato finora aveva lo stesso identico `versionCode` (1), un valore rimasto scritto a
mano nel file `android/app/build.gradle` fin dalla primissima configurazione del progetto, mai
aggiornato nonostante il numero di versione dell'app (`manifest.json`) sia cambiato decine di
volte. Play Console rifiuta qualsiasi caricamento con lo stesso `versionCode` (o uno più basso) di
uno già presente — per questo il tentativo di caricare un AAB più recente su un canale che ne
aveva già uno veniva respinto.

**Corretto**: ora `versionCode` viene calcolato da solo, leggendo la versione direttamente da
`www/manifest.json` (es. `2.45.2` → `20000 + 4500 + 2` = `24502`) — niente più da aggiornare a
mano, e ogni nuova build avrà sempre un numero più alto della precedente, automaticamente.

## ⚠️ La chiave di firma — leggi questo per primo

Il file `chiavi/turni-release.keystore` (nella cartella a parte, NON dentro il progetto da
caricare su GitHub) è **permanente**: ogni futuro aggiornamento dell'app deve essere firmato con
questa stessa identica chiave, altrimenti Play Console rifiuta l'aggiornamento trattandolo come
un'app estranea. **Questa chiave esiste già nei Secrets del tuo repository GitHub** — se hai
seguito la guida la prima volta, non devi rifare nulla su questo fronte; serve solo se un giorno
dovessi ricostruire il repository da zero.

**Conservala in almeno due posti sicuri e diversi**, oltre a GitHub — non fidarti solo di un
singolo posto.

## Passo 1 — Carica il progetto su GitHub

Scarica lo zip del progetto e caricalo nel repository (`micmax1000-afk/turni-2.0`), sostituendo
tutto il contenuto attuale con questo. Da terminale, più affidabile di un estrattore grafico
(che a volte salta le cartelle nascoste come `.github`):

```bash
cd ~/turni-2.0
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
unzip -o ~/Scaricati/Turni-Progetto-Capacitor.zip -d .
git add -A
git commit -m "Aggiornamento"
git push
```

## Passo 2 — I quattro segreti (solo se li stai impostando per la prima volta)

Settings → Secrets and variables → Actions → New repository secret:

| Nome del secret | Valore |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Contenuto di `chiavi/turni-release.keystore.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | Contenuto di `chiavi/password.txt` |
| `ANDROID_KEY_ALIAS` | `turni-ps` |
| `ANDROID_KEY_PASSWORD` | Lo stesso valore di `ANDROID_KEYSTORE_PASSWORD` |

Se li hai già impostati in precedenza, **non toccarli** — restano validi, non c'è nulla da
rifare qui.

## Passo 3 — GitHub Pages da Actions (solo se non già fatto)

Settings → Pages → Source → **GitHub Actions**.

## Passo 4 — Fai partire il workflow

Scheda Actions → "Pubblica sito e genera pacchetto Android" → **Run workflow**.

## Passo 5 — Scarica il pacchetto per Play Console

A fine esecuzione, apri quella run → **Artifacts** → scarica `pacchetto-android-turni-ps`. Dentro
trovi sia il `.aab` (per Play Console) sia l'`.apk` (per installarlo a mano sul telefono).

## Il prodotto in-app per il Backup Drive (1,99€)

Su Play Console serve un **prodotto in-app** con **esattamente** questo ID:

```
backup_drive_automatico
```

Monetizzazione → Prodotti → Prodotti in-app → Crea prodotto → incolla l'ID → prezzo 1,99€ →
Attiva. Un acquisto in-app si può testare solo tramite una build caricata su Play Console (almeno
"Test interni") — non funziona con l'APK installato a mano.
