package turniaccessorio.ps;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.util.Map;

/**
 * Tiene l'elenco degli avvisi programmati (sopravvive a riavvio e aggiornamento dell'app, che
 * cancellano gli allarmi di Android) e li affida ad AlarmManager.
 */
final class AvvisoEventoGestore {
    private static final String PREFS = "avvisi_evento";
    static final String AZIONE_SCATTA = "turniaccessorio.ps.AVVISO_SCATTA";
    static final String AZIONE_SPEGNI = "turniaccessorio.ps.AVVISO_SPEGNI";
    static final String AZIONE_POSTICIPA = "turniaccessorio.ps.AVVISO_POSTICIPA";
    static final long POSTICIPA_MS = 5 * 60 * 1000L;

    private AvvisoEventoGestore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject leggi(Context c, int id) {
        try {
            String s = prefs(c).getString(String.valueOf(id), null);
            return s == null ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static void dimentica(Context c, int id) {
        prefs(c).edit().remove(String.valueOf(id)).apply();
    }

    static PendingIntent intentAllarme(Context c, int id) {
        Intent i = new Intent(c, AvvisoEventoReceiver.class);
        i.setAction(AZIONE_SCATTA);
        i.putExtra("id", id);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void programma(Context c, JSONObject d) throws Exception {
        int id = d.getInt("id");
        prefs(c).edit().putString(String.valueOf(id), d.toString()).apply();
        impostaAllarme(c, id, d.getLong("quando"));
    }

    private static void impostaAllarme(Context c, int id, long quando) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = intentAllarme(c, id);
        boolean esatto = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        try {
            if (esatto) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi);
                return;
            }
        } catch (SecurityException ignored) {
        }
        // Senza il permesso "Allarmi e promemoria" (su Xiaomi spesso negato) un allarme normale può
        // arrivare in forte ritardo: setAlarmClock è invece sempre puntuale, anche con il telefono in
        // risparmio energetico, e non richiede alcun permesso.
        try {
            PendingIntent mostra = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(quando, mostra), pi);
        } catch (Exception e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi);
        }
    }

    static void annulla(Context c, int id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(intentAllarme(c, id));
        c.stopService(new Intent(c, AvvisoEventoService.class));
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
        dimentica(c, id);
    }

    static void posticipa(Context c, int id) {
        JSONObject d = leggi(c, id);
        c.stopService(new Intent(c, AvvisoEventoService.class));
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
        if (d == null) return;
        try {
            long nuovo = System.currentTimeMillis() + POSTICIPA_MS;
            d.put("quando", nuovo);
            programma(c, d);
        } catch (Exception ignored) {
        }
    }

    /** Dopo un riavvio o un aggiornamento: riprogramma gli avvisi ancora nel futuro. */
    static void ripristina(Context c) {
        long ora = System.currentTimeMillis();
        for (Map.Entry<String, ?> e : prefs(c).getAll().entrySet()) {
            try {
                JSONObject d = new JSONObject(String.valueOf(e.getValue()));
                if (d.getLong("quando") > ora) impostaAllarme(c, d.getInt("id"), d.getLong("quando"));
                else dimentica(c, d.getInt("id"));
            } catch (Exception ignored) {
            }
        }
    }
}
