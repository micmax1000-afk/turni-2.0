package turniaccessorio.ps;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Widget "Turno di oggi e domani". I dati li scrive l'app (prossimi giorni, già pronti da
 * mostrare) quando il widget è acceso in Altro; il widget sceglie oggi e domani in base alla data.
 * Spento: mostra solo come accenderlo. Ridotto a una riga (2×1, 3×1) usa un layout compatto:
 * solo oggi se è stretto, oggi e domani se è largo almeno 3 caselle.
 */
public class TurnoWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "turni_widget";
    static final String CHIAVE_DATI = "dati";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, costruisci(context, manager.getAppWidgetOptions(id)));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle opzioni) {
        manager.updateAppWidget(id, costruisci(context, opzioni));
    }

    /** Aggiorna tutti i widget presenti sulla schermata Home. */
    static void aggiornaTutti(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TurnoWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        for (int id : ids) manager.updateAppWidget(id, costruisci(context, manager.getAppWidgetOptions(id)));
    }

    static void salvaDati(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(CHIAVE_DATI, json).apply();
    }

    private static RemoteViews costruisci(Context context, Bundle opzioni) {
        // In verticale il launcher dà la larghezza minima e l'altezza massima del widget.
        int larghezza = opzioni != null ? opzioni.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0;
        int altezza = opzioni != null ? opzioni.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
        boolean riga = altezza > 0 && altezza < 100;
        boolean stretto = larghezza > 0 && larghezza < 170;
        RemoteViews v = new RemoteViews(context.getPackageName(), riga ? R.layout.widget_turno_riga : R.layout.widget_turno);
        Intent apri = new Intent(context, MainActivity.class);
        apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, apri, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_radice, pi);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject dati = null;
        try { dati = new JSONObject(prefs.getString(CHIAVE_DATI, "{}")); } catch (Exception ignored) { }
        boolean attivo = dati != null && dati.optBoolean("attivo", false);
        if (!attivo) {
            if (!riga) v.setTextViewText(R.id.widget_oggi_etichetta, "TURNI");
            v.setTextViewText(R.id.widget_oggi_nome, "Widget spento");
            v.setTextViewText(R.id.widget_oggi_orario, "Accendilo in Altro, nell'app");
            v.setInt(R.id.widget_oggi_colore, "setBackgroundColor", Color.parseColor("#C9CDC4"));
            v.setViewVisibility(R.id.widget_domani_riga, View.GONE);
            return v;
        }
        JSONObject giorni = dati.optJSONObject("giorni");
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        Calendar c = Calendar.getInstance();
        JSONObject oggi = giorni != null ? giorni.optJSONObject(f.format(c.getTime())) : null;
        c.add(Calendar.DAY_OF_MONTH, 1);
        JSONObject domani = giorni != null ? giorni.optJSONObject(f.format(c.getTime())) : null;

        if (!riga) v.setTextViewText(R.id.widget_oggi_etichetta, "OGGI");
        v.setTextViewText(R.id.widget_oggi_nome, oggi != null ? oggi.optString("nome", "—") : "Nessun turno");
        v.setTextViewText(R.id.widget_oggi_orario, oggi != null ? oggi.optString("orario", "") : "Apri l'app per aggiornare");
        v.setInt(R.id.widget_oggi_colore, "setBackgroundColor", colore(oggi));
        v.setViewVisibility(R.id.widget_domani_riga, riga && stretto ? View.GONE : View.VISIBLE);
        String testoDomani = "Domani: " + (domani != null ? domani.optString("nome", "—") : "—");
        if (domani != null && domani.optString("orario", "").length() > 0) testoDomani += (riga ? "\n" : " · ") + domani.optString("orario");
        v.setTextViewText(R.id.widget_domani_testo, testoDomani);
        v.setInt(R.id.widget_domani_colore, "setBackgroundColor", colore(domani));
        return v;
    }

    private static int colore(JSONObject giorno) {
        try { return Color.parseColor(giorno != null ? giorno.optString("colore", "#C9CDC4") : "#C9CDC4"); }
        catch (Exception e) { return Color.parseColor("#C9CDC4"); }
    }
}
