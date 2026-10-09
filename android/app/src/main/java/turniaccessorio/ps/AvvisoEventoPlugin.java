package turniaccessorio.ps;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONObject;

/** Ponte tra la pagina web dell'app e l'avviso nativo (suono/vibrazione per pochi secondi). */
@CapacitorPlugin(name = "AvvisoEvento")
public class AvvisoEventoPlugin extends Plugin {

    @PluginMethod
    public void programma(PluginCall call) {
        try {
            JSONObject d = new JSONObject();
            d.put("id", call.getInt("id", 0));
            d.put("titolo", call.getString("titolo", ""));
            d.put("testo", call.getString("testo", ""));
            // L'orario è un numero grande (millisecondi): arriva come Long e PluginCall.getDouble()
            // lo ignorerebbe restituendo 0, cioè "subito". Si legge quindi dal JSON in modo diretto.
            long quando = call.getData().optLong("quandoMs", 0L);
            if (quando <= 0) {
                call.reject("Orario dell'avviso mancante");
                return;
            }
            d.put("quando", quando);
            d.put("durata", call.getInt("durataSec", 10));
            d.put("modo", call.getString("modo", "suono_vibra"));
            AvvisoEventoGestore.programma(getContext(), d);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Avviso non programmato: " + e.getMessage());
        }
    }

    @PluginMethod
    public void annulla(PluginCall call) {
        try {
            AvvisoEventoGestore.annulla(getContext(), call.getInt("id", 0));
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Avviso non annullato: " + e.getMessage());
        }
    }

    /** Apre le impostazioni delle notifiche dell'app (dopo un "no", Android non le richiede più). */
    @PluginMethod
    public void apriImpostazioniNotifiche(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", getContext().getPackageName(), null));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Impostazioni non aperte: " + e.getMessage());
        }
    }
}
