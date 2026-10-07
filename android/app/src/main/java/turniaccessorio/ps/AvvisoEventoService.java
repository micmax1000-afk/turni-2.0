package turniaccessorio.ps;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

/**
 * Suona e/o vibra per pochi secondi (con l'audio "sveglia", quindi anche in modalità silenziosa)
 * e poi si ferma da sola, lasciando la notifica al suo posto.
 */
public class AvvisoEventoService extends Service {
    private static final String CANALE = "avviso_evento";

    private MediaPlayer player;
    private Vibrator vibratore;
    private ToneGenerator toneBip;
    private final Runnable ripetiBip = new Runnable() {
        @Override public void run() {
            try { if (toneBip != null) { toneBip.startTone(ToneGenerator.TONE_PROP_BEEP, 200); handler.postDelayed(this, 700); } } catch (Exception ignored) { }
        }
    };
    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int idNotifica = 0;
    private JSONObject dati;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        idNotifica = intent != null ? intent.getIntExtra("id", 0) : 0;
        dati = AvvisoEventoGestore.leggi(this, idNotifica);
        creaCanale();
        startForeground(idNotifica, costruisciNotifica(false));
        if (dati == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        int durata = Math.max(3, Math.min(60, dati.optInt("durata", 10)));
        String modo = dati.optString("modo", "suono_vibra");
        if ("bip".equals(modo)) {
            avviaBip();
        } else {
            if (!"vibra".equals(modo)) avviaSuono();
            if (!"suono".equals(modo)) avviaVibrazione();
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "turni:avviso");
            wakeLock.acquire((durata + 5) * 1000L);
        }
        handler.postDelayed(this::terminaLasciandoNotifica, durata * 1000L);
        return START_NOT_STICKY;
    }

    private void creaCanale() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel c = new NotificationChannel(CANALE, "Avvisi evento", NotificationManager.IMPORTANCE_HIGH);
        c.setDescription("Avviso forte di pochi secondi per gli eventi del calendario");
        c.setSound(null, null);      // suono e vibrazione li gestisce il servizio, non la notifica
        c.enableVibration(false);
        nm.createNotificationChannel(c);
    }

    private PendingIntent azione(String az, int richiesta) {
        Intent i = new Intent(this, AvvisoEventoReceiver.class);
        i.setAction(az);
        i.putExtra("id", idNotifica);
        return PendingIntent.getBroadcast(this, idNotifica * 4 + richiesta, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification costruisciNotifica(boolean dopoAvviso) {
        String titolo = dati != null ? dati.optString("titolo", "Evento") : "Evento";
        String testo = dati != null ? dati.optString("testo", "") : "";
        Intent apri = new Intent(this, MainActivity.class);
        apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contenuto = PendingIntent.getActivity(this, idNotifica * 4 + 3, apri,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CANALE)
                .setSmallIcon(R.drawable.ic_stat_turni)
                .setColor(0xFF1B2440)
                .setContentTitle(titolo)
                .setContentText(testo)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setOngoing(false)
                .setOnlyAlertOnce(true)
                .setContentIntent(contenuto)
                .setDeleteIntent(azione(AvvisoEventoGestore.AZIONE_SPEGNI, 2))
                .addAction(0, "Posticipa 5 min", azione(AvvisoEventoGestore.AZIONE_POSTICIPA, 0))
                .addAction(0, "Spegni", azione(AvvisoEventoGestore.AZIONE_SPEGNI, 1));
        return b.build();
    }

    /** Solo "bip" brevi e ripetuti (volume sveglia), senza suoneria né vibrazione. */
    private void avviaBip() {
        try {
            toneBip = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            handler.post(ripetiBip);
        } catch (Exception e) {
            toneBip = null;
        }
    }

    private void avviaSuono() {
        try {
            Uri uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_NOTIFICATION);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            player.setDataSource(this, uri);
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception e) {
            fermaSuono();
        }
    }

    @SuppressWarnings("deprecation")
    private void avviaVibrazione() {
        try {
            vibratore = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibratore == null || !vibratore.hasVibrator()) return;
            long[] schema = {0, 600, 300, 600, 300};
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibratore.vibrate(VibrationEffect.createWaveform(schema, 0), aa);
            } else {
                vibratore.vibrate(schema, 0, aa);
            }
        } catch (Exception ignored) {
        }
    }

    private void fermaSuono() {
        try {
            if (player != null) {
                try { player.stop(); } catch (Exception ignored) { }
                player.release();
            }
        } catch (Exception ignored) {
        }
        player = null;
    }

    private void fermaTutto() {
        handler.removeCallbacksAndMessages(null);
        fermaSuono();
        try { if (toneBip != null) toneBip.release(); } catch (Exception ignored) { }
        toneBip = null;
        try { if (vibratore != null) vibratore.cancel(); } catch (Exception ignored) { }
        vibratore = null;
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) { }
        wakeLock = null;
    }

    /** Finito il tempo: spegne suono e vibrazione, ma la notifica resta (e si può togliere). */
    private void terminaLasciandoNotifica() {
        fermaTutto();
        stopForeground(Service.STOP_FOREGROUND_DETACH);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(idNotifica, costruisciNotifica(true)); // la rende di nuovo cancellabile
        stopSelf();
    }

    @Override
    public void onDestroy() {
        fermaTutto();
        super.onDestroy();
    }
}
