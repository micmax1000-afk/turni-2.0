package turniaccessorio.ps;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.net.Uri;
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

    /**
     * I canali (le "categorie" nelle impostazioni di Android) che usa l'app. Si creano subito
     * all'avvio: così compaiono nelle impostazioni e si possono controllare prima della prima notifica.
     * Su alcuni telefoni (es. Xiaomi) una categoria può restare spenta anche con le notifiche
     * dell'app accese: in quel caso le notifiche di quella categoria non arrivano.
     */
    static final String[][] CANALI = {
            {"avviso_evento_semplice", "Promemoria eventi"},
            {"promemoria_eventi_v2", "Promemoria eventi (riserva)"},
            {"promemoria_turno", "Promemoria del turno"},
            {"avviso_evento", "Avvisi evento"}
    };

    static void creaCanali(Context context) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return;
        android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            // Stesse impostazioni con cui li creano le notifiche: se il canale c'è già, Android tiene le sue.
            android.app.NotificationChannel semplice = new android.app.NotificationChannel(
                    "avviso_evento_semplice", "Promemoria eventi", android.app.NotificationManager.IMPORTANCE_HIGH);
            semplice.enableVibration(true);
            nm.createNotificationChannel(semplice);
            android.app.NotificationChannel riserva = new android.app.NotificationChannel(
                    "promemoria_eventi_v2", "Promemoria eventi", android.app.NotificationManager.IMPORTANCE_HIGH);
            riserva.setDescription("Avvisi per gli eventi del calendario");
            riserva.enableVibration(true);
            riserva.enableLights(true);
            riserva.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(riserva);
            android.app.NotificationChannel turno = new android.app.NotificationChannel(
                    "promemoria_turno", "Promemoria del turno", android.app.NotificationManager.IMPORTANCE_HIGH);
            turno.setDescription("Il turno di domani o tra poco");
            turno.enableVibration(true);
            turno.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(turno);
            android.app.NotificationChannel forte = new android.app.NotificationChannel(
                    "avviso_evento", "Avvisi evento", android.app.NotificationManager.IMPORTANCE_HIGH);
            forte.setDescription("Avviso forte di pochi secondi per gli eventi del calendario");
            forte.setSound(null, null);
            forte.enableVibration(false);
            nm.createNotificationChannel(forte);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void load() {
        super.load();
        creaCanali(getContext());
    }

    /**
     * Notifiche dell'app attive? Oltre all'interruttore generale si guardano le singole categorie:
     * "canaliSpenti" elenca quelle spente (id e nome), che vanno riaccese a mano.
     */
    @PluginMethod
    public void statoNotifiche(PluginCall call) {
        JSObject r = new JSObject();
        r.put("attive", androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        com.getcapacitor.JSArray spenti = new com.getcapacitor.JSArray();
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            creaCanali(getContext());
            android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                for (String[] c : CANALI) {
                    try {
                        android.app.NotificationChannel ch = nm.getNotificationChannel(c[0]);
                        if (ch != null && ch.getImportance() == android.app.NotificationManager.IMPORTANCE_NONE) {
                            JSObject x = new JSObject();
                            x.put("id", c[0]);
                            x.put("nome", ch.getName() != null ? ch.getName().toString() : c[1]);
                            spenti.put(x);
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
        }
        try {
            r.put("canaliSpenti", spenti);
        } catch (Exception ignored) {
        }
        // Risparmio batteria: se l'app non è "senza restrizioni", Android la limita quando è chiusa.
        boolean batteriaLimitata = false;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                batteriaLimitata = pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            } catch (Exception ignored) {
            }
        }
        r.put("batteriaLimitata", batteriaLimitata);
        // Allarmi esatti (Android 12+): senza, l'app usa la sveglia di sistema, che è comunque puntuale.
        boolean allarmiEsatti = true;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            try {
                android.app.AlarmManager am = (android.app.AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                allarmiEsatti = am != null && am.canScheduleExactAlarms();
            } catch (Exception ignored) {
            }
        }
        r.put("allarmiEsatti", allarmiEsatti);
        String marca = (android.os.Build.MANUFACTURER + " " + android.os.Build.BRAND).toLowerCase(java.util.Locale.ROOT);
        r.put("xiaomi", marca.contains("xiaomi") || marca.contains("redmi") || marca.contains("poco"));
        call.resolve(r);
    }

    /**
     * Apre le impostazioni delle notifiche dell'app (dopo un "no", Android non le richiede più).
     * Con "canale" apre direttamente quella categoria (dove c'è "Mostra/Visualizza le notifiche").
     */
    @PluginMethod
    public void apriImpostazioniNotifiche(PluginCall call) {
        String pacchetto = getContext().getPackageName();
        android.content.Context ctx = getActivity() != null ? getActivity() : getContext();
        String canale = call.getString("canale", null);
        if (canale != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            try {
                Intent i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, pacchetto);
                i.putExtra(Settings.EXTRA_CHANNEL_ID, canale);
                if (getActivity() == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                call.resolve(new JSObject());
                return;
            } catch (Exception ignored) {
            }
        }
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, pacchetto);
            i.putExtra("app_package", pacchetto);                         // alcuni telefoni (vecchi Xiaomi/Huawei)
            i.putExtra("app_uid", getContext().getApplicationInfo().uid);
            if (getActivity() == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve(new JSObject());
            return;
        } catch (Exception ignored) {
        }
        try {
            // Ripiego: la scheda "Informazioni app", da cui si arriva a Notifiche.
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", pacchetto, null));
            if (getActivity() == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Impostazioni non aperte: " + e.getMessage());
        }
    }

    private void apri(Intent i) {
        android.content.Context ctx = getActivity() != null ? getActivity() : getContext();
        if (getActivity() == null) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }

    private boolean apriInfoApp() {
        try {
            apri(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null)));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Risparmio batteria: si apre la scheda dell'app (Informazioni app), dove c'è "Batteria"
     * con "Senza restrizioni". Non si usa la richiesta diretta (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS):
     * Google Play la permette solo ad alcuni tipi di app.
     */
    @PluginMethod
    public void apriImpostazioniBatteria(PluginCall call) {
        if (apriInfoApp()) {
            call.resolve(new JSObject());
            return;
        }
        try {
            apri(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Impostazioni batteria non aperte: " + e.getMessage());
        }
    }

    /** Avvio automatico di Xiaomi (MIUI/HyperOS); se la pagina non c'è, la scheda dell'app. */
    @PluginMethod
    public void apriAvvioAutomatico(PluginCall call) {
        JSObject r = new JSObject();
        try {
            Intent i = new Intent();
            i.setComponent(new android.content.ComponentName("com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"));
            apri(i);
            r.put("pagina", "avvio");
            call.resolve(r);
            return;
        } catch (Exception ignored) {
        }
        if (apriInfoApp()) {
            r.put("pagina", "app");
            call.resolve(r);
        } else {
            call.reject("Pagina non aperta");
        }
    }

    /**
     * Stampa / Salva come PDF: nella WebView di Android window.print() non fa nulla,
     * quindi si apre la finestra di stampa di Android (che offre anche "Salva come PDF").
     * La risposta arriva quando la finestra si chiude, così la pagina può rimettersi com'era.
     */
    @PluginMethod
    public void stampa(PluginCall call) {
        String titolo = call.getString("titolo", "Turni & Accessorio PS");
        if (getActivity() == null) {
            call.reject("Stampa non disponibile");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter base = getBridge().getWebView().createPrintDocumentAdapter(titolo);
                PrintDocumentAdapter adattatore = new PrintDocumentAdapter() {
                    @Override
                    public void onStart() { base.onStart(); }

                    @Override
                    public void onLayout(PrintAttributes vecchi, PrintAttributes nuovi, CancellationSignal annulla, LayoutResultCallback cb, Bundle extra) {
                        base.onLayout(vecchi, nuovi, annulla, cb, extra);
                    }

                    @Override
                    public void onWrite(PageRange[] pagine, ParcelFileDescriptor destinazione, CancellationSignal annulla, WriteResultCallback cb) {
                        base.onWrite(pagine, destinazione, annulla, cb);
                    }

                    @Override
                    public void onFinish() {
                        base.onFinish();
                        call.resolve(new JSObject());
                    }
                };
                pm.print(titolo, adattatore, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            } catch (Exception e) {
                call.reject("Stampa non avviata: " + e.getMessage());
            }
        });
    }

    /** Widget: l'app passa i giorni già pronti da mostrare (o {"attivo":false} se è spento). */
    @PluginMethod
    public void aggiornaWidget(PluginCall call) {
        try {
            TurnoWidgetProvider.salvaDati(getContext(), call.getString("dati", "{}"));
            TurnoWidgetProvider.aggiornaTutti(getContext());
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Widget non aggiornato: " + e.getMessage());
        }
    }

    /** Chiede ad Android di aggiungere il widget alla schermata Home (Android 8+, se il launcher lo permette). */
    @PluginMethod
    public void aggiungiWidget(PluginCall call) {
        JSObject r = new JSObject();
        boolean ok = false;
        try {
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                android.appwidget.AppWidgetManager m = android.appwidget.AppWidgetManager.getInstance(getContext());
                if (m.isRequestPinAppWidgetSupported()) {
                    ok = m.requestPinAppWidget(new android.content.ComponentName(getContext(), TurnoWidgetProvider.class), null, null);
                }
            }
        } catch (Exception ignored) {
        }
        r.put("ok", ok);
        call.resolve(r);
    }

    // ===== Tema "Luce": il sensore di luce del telefono (lo stesso della luminosità automatica).
    // Letto solo con l'app aperta: si ferma in pausa e riparte al ritorno. Nessun permesso.
    private SensorEventListener ascoltoLuce;
    private boolean luceRichiesta = false;
    private long ultimoInvioLuce = 0;

    @PluginMethod
    public void avviaLuce(PluginCall call) {
        luceRichiesta = true;
        JSObject r = new JSObject();
        r.put("disponibile", registraLuce());
        call.resolve(r);
    }

    @PluginMethod
    public void fermaLuce(PluginCall call) {
        luceRichiesta = false;
        sganciaLuce();
        call.resolve();
    }

    private boolean registraLuce() {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor sensore = sm != null ? sm.getDefaultSensor(Sensor.TYPE_LIGHT) : null;
        if (sensore == null) return false;
        if (ascoltoLuce != null) return true;
        ascoltoLuce = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                long ora = System.currentTimeMillis();
                if (ora - ultimoInvioLuce < 1000) return;
                ultimoInvioLuce = ora;
                try {
                    JSObject d = new JSObject();
                    d.put("lux", (double) e.values[0]);
                    notifyListeners("luce", d);
                } catch (Exception ignored) {
                }
            }
            @Override
            public void onAccuracyChanged(Sensor s, int a) { }
        };
        sm.registerListener(ascoltoLuce, sensore, SensorManager.SENSOR_DELAY_NORMAL);
        return true;
    }

    private void sganciaLuce() {
        if (ascoltoLuce == null) return;
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sm != null) sm.unregisterListener(ascoltoLuce);
        ascoltoLuce = null;
    }

    // ===== Barre di sistema in tinta con l'app: lo sfondo dietro la barra di stato e quella di
    // navigazione prende il colore dello sfondo dell'app, le icone sono chiare o scure di conseguenza.
    // Si riapplica al ritorno nell'app (Android può rimettere i colori del tema del telefono).
    private String coloreBarre = null;
    private boolean iconeChiareBarre = false;

    @PluginMethod
    public void coloriBarre(PluginCall call) {
        coloreBarre = call.getString("colore", null);
        iconeChiareBarre = Boolean.TRUE.equals(call.getBoolean("iconeChiare", false));
        getActivity().runOnUiThread(this::applicaColoriBarre);
        call.resolve();
    }

    @SuppressWarnings("deprecation")
    private void applicaColoriBarre() {
        if (coloreBarre == null) return;
        try {
            int colore = Color.parseColor(coloreBarre);
            Window w = getActivity().getWindow();
            w.getDecorView().setBackgroundColor(colore);
            if (android.os.Build.VERSION.SDK_INT < 35) {
                w.setStatusBarColor(colore);
                w.setNavigationBarColor(colore);
            }
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
            c.setAppearanceLightStatusBars(!iconeChiareBarre);
            c.setAppearanceLightNavigationBars(!iconeChiareBarre);
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        sganciaLuce();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (luceRichiesta) registraLuce();
        getActivity().runOnUiThread(this::applicaColoriBarre);
    }
}
