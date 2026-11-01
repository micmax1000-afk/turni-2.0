package turniaccessorio.ps;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * "Detta a voce": trasforma la voce in testo con il riconoscimento di Android.
 * Con offline = true chiede di usare SOLO il riconoscimento sul telefono (senza internet):
 * se l'italiano non è scaricato si risponde "offline" e l'app propone di scaricarlo.
 * L'audio non viene salvato: arriva all'app solo il testo.
 */
@CapacitorPlugin(
    name = "Voce",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microfono") }
)
public class VocePlugin extends Plugin {

    private SpeechRecognizer riconoscitore;
    private PluginCall chiamataAscolto;
    private boolean modoOffline;

    @PluginMethod
    public void disponibile(PluginCall call) {
        JSObject r = new JSObject();
        r.put("disponibile", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void permesso(PluginCall call) {
        if (getPermissionState("microfono") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("concesso", true);
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("microfono", call, "dopoPermesso");
    }

    @PermissionCallback
    private void dopoPermesso(PluginCall call) {
        JSObject r = new JSObject();
        r.put("concesso", getPermissionState("microfono") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void ascolta(final PluginCall call) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) {
            call.reject("Permesso del microfono mancante", "permesso");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Riconoscimento vocale non disponibile", "errore");
            return;
        }
        final boolean offline = Boolean.TRUE.equals(call.getBoolean("offline", true));
        final String lingua = call.getString("lingua", "it-IT");
        getActivity().runOnUiThread(() -> {
            chiudiRiconoscitore();
            chiamataAscolto = call;
            modoOffline = offline;
            try {
                riconoscitore = SpeechRecognizer.createSpeechRecognizer(getContext());
                riconoscitore.setRecognitionListener(new Ascoltatore());
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lingua);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lingua);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, offline);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
                riconoscitore.startListening(intent);
            } catch (Exception e) {
                rifiuta("Il microfono non si è avviato: " + e.getMessage(), "errore");
            }
        });
    }

    /** "Ho finito di parlare": il testo arriva comunque (onResults). */
    @PluginMethod
    public void ferma(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (riconoscitore != null) {
                try { riconoscitore.stopListening(); } catch (Exception ignored) { }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void annulla(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            rifiuta("Annullato", "annullato");
            chiudiRiconoscitore();
            call.resolve();
        });
    }

    /** Apre le impostazioni della voce, dove si scarica l'italiano per usarla senza internet. */
    @PluginMethod
    public void apriImpostazioni(PluginCall call) {
        String[] azioni = { Settings.ACTION_VOICE_INPUT_SETTINGS, "com.google.android.googlequicksearchbox.action.VOICE_SETTINGS", Settings.ACTION_SETTINGS };
        for (String azione : azioni) {
            try {
                Intent i = new Intent(azione);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
                return;
            } catch (Exception ignored) { }
        }
        call.reject("Impostazioni non disponibili");
    }

    @Override
    protected void handleOnDestroy() {
        chiudiRiconoscitore();
        super.handleOnDestroy();
    }

    private void chiudiRiconoscitore() {
        if (riconoscitore != null) {
            try { riconoscitore.cancel(); } catch (Exception ignored) { }
            try { riconoscitore.destroy(); } catch (Exception ignored) { }
            riconoscitore = null;
        }
    }

    private void rifiuta(String messaggio, String codice) {
        PluginCall c = chiamataAscolto;
        chiamataAscolto = null;
        if (c != null) c.reject(messaggio, codice);
    }

    private class Ascoltatore implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle params) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override
        public void onPartialResults(Bundle partialResults) {
            ArrayList<String> testi = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (testi != null && !testi.isEmpty()) {
                JSObject d = new JSObject();
                d.put("testo", testi.get(0));
                notifyListeners("parziale", d);
            }
        }

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> testi = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            PluginCall c = chiamataAscolto;
            chiamataAscolto = null;
            chiudiRiconoscitore();
            if (c == null) return;
            if (testi == null || testi.isEmpty() || testi.get(0).trim().isEmpty()) {
                c.reject("Non ho sentito niente", "niente");
                return;
            }
            JSObject r = new JSObject();
            r.put("testo", testi.get(0));
            JSArray alt = new JSArray();
            for (String t : testi) alt.put(t);
            r.put("alternative", alt);
            c.resolve(r);
        }

        @Override
        public void onError(int errore) {
            String codice;
            switch (errore) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    codice = "niente"; break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    codice = "permesso"; break;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                    codice = "occupato"; break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                case SpeechRecognizer.ERROR_SERVER:
                case 11: // ERROR_SERVER_DISCONNECTED
                case 12: // ERROR_LANGUAGE_NOT_SUPPORTED
                case 13: // ERROR_LANGUAGE_UNAVAILABLE
                    // Senza internet questi errori vogliono dire: l'italiano offline non c'è.
                    codice = modoOffline ? "offline" : "rete"; break;
                default:
                    codice = "errore";
            }
            rifiuta("Riconoscimento non riuscito (" + errore + ")", codice);
            chiudiRiconoscitore();
        }
    }
}
