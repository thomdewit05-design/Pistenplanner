package nl.skipilot.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

// Het sterrenvenster van Google Play in de app zelf. Google beslist of het echt verschijnt.
// Vanuit de webapp: Capacitor.nativePromise("Review", "review", {}).
@CapacitorPlugin(name = "Review")
public class ReviewPlugin extends Plugin {
    @PluginMethod
    public void review(PluginCall call) {
        ReviewManager manager = ReviewManagerFactory.create(getContext());
        manager.requestReviewFlow().addOnCompleteListener(task -> {
            JSObject ret = new JSObject();
            if (!task.isSuccessful() || getActivity() == null) { ret.put("shown", false); call.resolve(ret); return; }
            ReviewInfo info = task.getResult();
            manager.launchReviewFlow(getActivity(), info).addOnCompleteListener(t -> { ret.put("shown", true); call.resolve(ret); });
        });
    }
}
