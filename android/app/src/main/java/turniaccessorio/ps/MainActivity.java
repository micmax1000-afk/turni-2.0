package turniaccessorio.ps;

import android.content.pm.ActivityInfo;
import android.os.Bundle;

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
    }
}
