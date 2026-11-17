package nl.skipilot.app;

import android.content.Context;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;

// Poederalarm: de webapp geeft de favoriete skigebieden door; SnowWorker kijkt elke 6 uur naar de sneeuwverwachting.
// Vanuit de webapp: Capacitor.nativePromise("Snow", "set", {value: "{\"on\":true,\"lang\":\"nl\",\"areas\":[[naam,lat,lon,hoogte],...]}"}).
@CapacitorPlugin(name = "Snow")
public class SnowPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        String value = call.getString("value", "");
        Context ctx = getContext();
        ctx.getSharedPreferences("skipilot", Context.MODE_PRIVATE).edit().putString("snow", value).apply();
        WorkManager wm = WorkManager.getInstance(ctx);
        if (value.contains("\"on\":true")) {
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(SnowWorker.class, 6, TimeUnit.HOURS).build();
            wm.enqueueUniquePeriodicWork("snow", ExistingPeriodicWorkPolicy.KEEP, req);
        } else {
            wm.cancelUniqueWork("snow");
        }
        call.resolve();
    }
}
