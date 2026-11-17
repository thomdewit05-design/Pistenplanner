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
                URL url = new URL("https://api.open-meteo.com/v1/forecast?latitude=" + a.getDouble(1) + "&longitude=" + a.getDouble(2)
                        + "&elevation=" + a.getInt(3) + "&daily=snowfall_sum&forecast_days=2&timezone=auto");
                HttpURLConnection con = (HttpURLConnection) url.openConnection();
                con.setConnectTimeout(15000); con.setReadTimeout(15000);
                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream()))) { String l; while ((l = r.readLine()) != null) sb.append(l); }
                JSONArray snow = new JSONObject(sb.toString()).getJSONObject("daily").getJSONArray("snowfall_sum");
                double cm = 0; for (int k = 0; k < snow.length(); k++) cm += snow.optDouble(k, 0);
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
