package turniaccessorio.ps;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Accensione del telefono o aggiornamento dell'app: riprogramma gli avvisi degli eventi.
 * È separato da AvvisoEventoReceiver apposta: da Android 15 un ricevitore di BOOT_COMPLETED
 * non deve avviare servizi in primo piano, e questo si limita a reimpostare gli allarmi.
 */
public class AvvioTelefonoReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String azione = intent.getAction();
        if (azione == null) return;
        switch (azione) {
            case Intent.ACTION_BOOT_COMPLETED:
            case "android.intent.action.QUICKBOOT_POWERON":
            case Intent.ACTION_MY_PACKAGE_REPLACED:
                AvvisoEventoGestore.ripristina(context);
                break;
            default:
                break;
        }
    }
}
