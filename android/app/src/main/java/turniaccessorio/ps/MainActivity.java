package turniaccessorio.ps;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Il plugin dell'avviso evento (suono/vibrazione brevi) fa parte dell'app: va registrato qui.
        registerPlugin(AvvisoEventoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
