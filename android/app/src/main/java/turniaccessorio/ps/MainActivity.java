package turniaccessorio.ps;

import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // v3.8.48: sui telefoni l'app resta in verticale (in orizzontale la barra in basso copriva metà
        // della pagina). Sui tablet (lato corto di almeno 600 dp) la rotazione resta libera.
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
        // Il plugin dell'avviso evento (suono/vibrazione brevi) fa parte dell'app: va registrato qui.
        registerPlugin(AvvisoEventoPlugin.class);
        // "Detta a voce": la voce diventa testo con il riconoscimento di Android.
        registerPlugin(VocePlugin.class);
        super.onCreate(savedInstanceState);
        svuotaCacheDopoAggiornamento();
    }

    // v3.8.59: alla prima apertura dopo un aggiornamento il WebView poteva usare ancora i file
    // vecchi tenuti in memoria (le novità comparivano solo chiudendo e riaprendo l'app).
    // Se l'app è stata aggiornata, svuoto la cache del WebView e ricarico la pagina una volta.
    private void svuotaCacheDopoAggiornamento() {
        try {
            long aggiornata = getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime;
            SharedPreferences prefs = getSharedPreferences("turni_versione_app", MODE_PRIVATE);
            long vista = prefs.getLong("ultimo_aggiornamento", 0L);
            if (vista == aggiornata) return;
            prefs.edit().putLong("ultimo_aggiornamento", aggiornata).apply();
            if (vista == 0L) return; // prima installazione: niente di vecchio da togliere
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.clearCache(true);
                webView.reload();
            }
        } catch (Exception ignored) {
            // se qualcosa non va, l'app parte comunque come prima
        }
    }
}
