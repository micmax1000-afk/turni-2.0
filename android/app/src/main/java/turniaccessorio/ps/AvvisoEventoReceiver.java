package turniaccessorio.ps;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.NotificationManager;

import androidx.core.content.ContextCompat;

public class AvvisoEventoReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String azione = intent.getAction();
        if (azione == null) return;
        int id = intent.getIntExtra("id", 0);
        switch (azione) {
            case AvvisoEventoGestore.AZIONE_SCATTA: {
                Intent s = new Intent(context, AvvisoEventoService.class);
                s.putExtra("id", id);
                try {
                    ContextCompat.startForegroundService(context, s);
                } catch (Exception ignored) {
                }
                break;
            }
            case AvvisoEventoGestore.AZIONE_SPEGNI: {
                context.stopService(new Intent(context, AvvisoEventoService.class));
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancel(id);
                AvvisoEventoGestore.dimentica(context, id);
                break;
            }
            case AvvisoEventoGestore.AZIONE_POSTICIPA:
                AvvisoEventoGestore.posticipa(context, id);
                break;
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
