package nl.skipilot.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

// Kijkt bij de favoriete skigebieden of er de komende 48 uur 20 cm of meer verse sneeuw verwacht wordt, en meldt dat.
public class SnowWorker extends Worker {
    public SnowWorker(@NonNull Context ctx, @NonNull WorkerParameters params) { super(ctx, params); }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences("skipilot", Context.MODE_PRIVATE);
        try {
            JSONObject cfg = new JSONObject(prefs.getString("snow", "{}"));
            if (!cfg.optBoolean("on")) return Result.success();
            String lang = cfg.optString("lang", "nl");
            JSONArray areas = cfg.optJSONArray("areas");
            if (areas == null) return Result.success();
            for (int i = 0; i < Math.min(8, areas.length()); i++) {
                JSONArray a = areas.getJSONArray(i);
                String name = a.getString(0);
                String key = "snow-told-" + name;
                if (System.currentTimeMillis() - prefs.getLong(key, 0) < 48L * 3600 * 1000) continue;
                // voorspelling van MET Norway (api.met.no, CC BY 4.0): neerslag en temperatuur per blok, voor de komende 48 uur
                URL url = new URL(String.format(java.util.Locale.US, "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=%.4f&lon=%.4f&altitude=%d",
                        a.getDouble(1), a.getDouble(2), a.getInt(3)));
                HttpURLConnection con = (HttpURLConnection) url.openConnection();
                con.setConnectTimeout(15000); con.setReadTimeout(15000);
                con.setRequestProperty("User-Agent", "Skipilot/1.0 (nl.skipilot.app)");   // de dienst vraagt om een herkenbare afzender
                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream()))) { String l; while ((l = r.readLine()) != null) sb.append(l); }
                JSONArray ts = new JSONObject(sb.toString()).getJSONObject("properties").getJSONArray("timeseries");
                // sneeuw uit neerslag: bij vorst ongeveer 1 cm per mm, rond het vriespunt de helft, daarboven regen
                double cm = 0; int hours = 0;
                for (int k = 0; k < ts.length() && hours < 48; k++) {
                    JSONObject d = ts.getJSONObject(k).getJSONObject("data");
                    double t = d.getJSONObject("instant").getJSONObject("details").optDouble("air_temperature", 5);
                    JSONObject b = d.optJSONObject("next_1_hours"); int n = 1;
                    if (b == null) { b = d.optJSONObject("next_6_hours"); n = 6; }
                    if (b == null) continue;
                    JSONObject det = b.optJSONObject("details");
                    double mm = det == null ? 0 : det.optDouble("precipitation_amount", 0);
                    cm += mm * (t <= 0 ? 1 : (t < 1.5 ? 0.5 : 0));
                    hours += n;
                }
                if (cm < 20) continue;
                prefs.edit().putLong(key, System.currentTimeMillis()).apply();
                notify(ctx, i, name, (int) Math.round(cm), lang);
            }
        } catch (Exception e) {
            return Result.retry();
        }
        return Result.success();
    }

    private void notify(Context ctx, int id, String name, int cm, String lang) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("snow", "Poederalarm", NotificationManager.IMPORTANCE_DEFAULT));
        String title, body;
        switch (lang) {
            case "en": title = "Powder alert in " + name; body = cm + " cm of fresh snow expected in the next 48 hours."; break;
            case "de": title = "Pulveralarm in " + name; body = cm + " cm Neuschnee in den nächsten 48 Stunden erwartet."; break;
            case "fr": title = "Alerte poudreuse à " + name; body = cm + " cm de neige fraîche attendus dans les 48 heures."; break;
            default: title = "Poederalarm in " + name; body = cm + " cm verse sneeuw verwacht in de komende 48 uur.";
        }
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, "snow")
                .setSmallIcon(R.mipmap.ic_launcher).setContentTitle(title).setContentText(body)
                .setAutoCancel(true).setContentIntent(pi);
        NotificationManagerCompat.from(ctx).notify(9000 + id, b.build());
    }
}
