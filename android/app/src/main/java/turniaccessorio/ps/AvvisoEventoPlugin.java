package turniaccessorio.ps;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
}
