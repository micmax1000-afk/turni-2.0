package turniaccessorio.ps;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.NotificationManager;

import androidx.core.content.ContextCompat;

public class AvvisoEventoReceiver extends BroadcastReceiver {
    private static android.app.PendingIntent azione(Context context, String az, int id, int richiesta) {
        Intent i = new Intent(context, AvvisoEventoReceiver.class);
        i.setAction(az);
        i.putExtra("id", id);
        return android.app.PendingIntent.getBroadcast(context, id * 4 + richiesta, i,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
    }

    /** Notifica normale (con suono e vibrazione del canale), con i tasti Posticipa e Spegni. */
    private static void pubblicaSoloNotifica(Context context, int id) {
        try {
            org.json.JSONObject d = AvvisoEventoGestore.leggi(context, id);
            if (d == null) return;
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                android.app.NotificationChannel c = new android.app.NotificationChannel(
                        "avviso_evento_semplice", "Promemoria eventi", NotificationManager.IMPORTANCE_HIGH);
                c.enableVibration(true);
                nm.createNotificationChannel(c);
            }
            android.app.PendingIntent apri = android.app.PendingIntent.getActivity(context, id,
                    new Intent(context, MainActivity.class),
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
            androidx.core.app.NotificationCompat.Builder b = new androidx.core.app.NotificationCompat.Builder(context, "avviso_evento_semplice")
                    .setSmallIcon(R.drawable.ic_stat_turni)
                    .setColor(0xFF1B2440)
                    .setContentTitle(d.optString("titolo", "Evento"))
                    .setContentText(d.optString("testo", ""))
                    .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(android.app.Notification.DEFAULT_ALL)
                    .setCategory(androidx.core.app.NotificationCompat.CATEGORY_EVENT)
                    .setAutoCancel(true)
                    .setContentIntent(apri)
                    .setDeleteIntent(azione(context, AvvisoEventoGestore.AZIONE_SPEGNI, id, 2))
                    .addAction(0, "Posticipa 5 min", azione(context, AvvisoEventoGestore.AZIONE_POSTICIPA, id, 0))
                    .addAction(0, "Spegni", azione(context, AvvisoEventoGestore.AZIONE_SPEGNI, id, 1));
            nm.notify(id, b.build());
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String azione = intent.getAction();
        if (azione == null) return;
        int id = intent.getIntExtra("id", 0);
        switch (azione) {
            case AvvisoEventoGestore.AZIONE_SCATTA: {
                // Durata 0 = promemoria normale: solo la notifica, senza servizio né suono prolungato.
                org.json.JSONObject d = AvvisoEventoGestore.leggi(context, id);
                if (d != null && d.optInt("durata", 10) <= 0) {
                    pubblicaSoloNotifica(context, id);
                    break;
                }
                Intent s = new Intent(context, AvvisoEventoService.class);
                s.putExtra("id", id);
                try {
                    ContextCompat.startForegroundService(context, s);
                } catch (Exception e) {
                    // Il sistema non ha permesso di avviare il servizio (limiti in background del
                    // telefono): almeno la notifica deve comparire.
                    pubblicaSoloNotifica(context, id);
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
