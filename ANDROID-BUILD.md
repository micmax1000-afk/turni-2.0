# Generare il pacchetto Android in automatico (GitHub Actions + Bubblewrap)

Questa guida serve **una sola volta** per l'impostazione iniziale. Dopo, generare un nuovo
pacchetto Android sarà solo: scheda **Actions** su GitHub → workflow "Genera pacchetto Android"
→ pulsante **Run workflow**.

## ⚠️ Leggi questo prima di tutto

La chiave di firma che generi qui sotto è **permanente**: ogni futuro aggiornamento dell'app
pubblicata su Play Store dovrà essere firmato con la stessa identica chiave. Se la perdi:

- Non potrai più pubblicare aggiornamenti all'app già online
- L'unica soluzione sarebbe pubblicare una nuova app da zero, perdendo recensioni e installazioni

**Appena la generi, salvala subito in almeno due posti sicuri e diversi** (es. un password
manager + una chiavetta USB, o due cloud personali diversi) — non fidarti solo di GitHub.

---

## Passo 1 — Genera la chiave di firma (una volta sola)

Sul tuo computer (serve Java installato — su Ubuntu: `sudo apt install default-jdk` se non
già presente), esegui:

```bash
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias turniaccessorioPS \
  -keyalg RSA -keysize 2048 -validity 10000
```

Ti verranno chieste alcune informazioni (nome, organizzazione, ecc. — puoi mettere quello che
vuoi, non è pubblico) e **due password**: quella del keystore e quella della chiave stessa.
**Annotale entrambe**, ti servono al passo 3.

Alla fine avrai un file `android.keystore` nella cartella corrente.

## Passo 2 — Codifica la chiave in base64

GitHub Secrets accetta solo testo, non file binari — serve convertirla:

```bash
base64 -w 0 android.keystore > android.keystore.base64.txt
```

Apri `android.keystore.base64.txt` con un editor di testo e copia **tutto il contenuto**
(è una singola lunga riga di testo).

## Passo 3 — Salva i tre segreti su GitHub

Sul repository GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
Crea questi tre segreti (nome esatto a sinistra, valore a destra):

| Nome del secret | Valore |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Il testo copiato dal passo 2 |
| `ANDROID_KEYSTORE_PASSWORD` | La password del keystore scelta al passo 1 |
| `ANDROID_KEY_PASSWORD` | La password della chiave scelta al passo 1 |

## Passo 4 — Esegui il workflow

Scheda **Actions** del repository → workflow **"Genera pacchetto Android (AAB/APK)"** →
pulsante **Run workflow** → conferma.

Al termine (qualche minuto), nella pagina del workflow completato trovi in basso la sezione
**Artifacts**: scarica `pacchetto-android-turni-ps`, contiene l'AAB (per Play Console) e l'APK
(per installare/testare direttamente sul telefono).

## Passo 5 — Recupera l'impronta SHA-256 per assetlinks.json

Il workflow stesso la stampa in chiaro nei log, nello step **"Mostra l'impronta SHA-256..."**
(cerca la riga che inizia con `SHA256:`). Copiala e sostituiscila in
`.well-known/assetlinks.json`, insieme al Package ID (`turniaccessorio.ps`, già impostato
in `twa-manifest.json`).

---

## ⚠️ Attenzione se pubblichi su Play Store con "Play App Signing" attivo

Se al primo caricamento su Play Console attivi la firma automatica di Google ("Play App
Signing", **attiva di default** su tutte le app nuove), Google **ri-firma l'app con una
chiave propria** per la distribuzione finale agli utenti. In quel caso, l'impronta SHA-256
che conta davvero per `assetlinks.json` **non è più quella della tua chiave locale**, ma
quella mostrata da Play Console in **Versione dell'app → Integrità dell'app → Certificato
di firma dell'app**. Se noti che la barra URL ricompare solo dopo la pubblicazione reale
(mentre funzionava testando l'APK sideloaded), è quasi certamente questo il motivo: aggiorna
`assetlinks.json` con l'impronta presa da lì, non da quella locale.
