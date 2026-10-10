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

    /** Notifiche dell'app attive? (lo stesso interruttore che si vede nelle impostazioni di Android) */
    @PluginMethod
    public void statoNotifiche(PluginCall call) {
        JSObject r = new JSObject();
        r.put("attive", androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(r);
    }

    /** Apre le impostazioni delle notifiche dell'app (dopo un "no", Android non le richiede più). */
    @PluginMethod
    public void apriImpostazioniNotifiche(PluginCall call) {
        String pacchetto = getContext().getPackageName();
        android.content.Context ctx = getActivity() != null ? getActivity() : getContext();
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
