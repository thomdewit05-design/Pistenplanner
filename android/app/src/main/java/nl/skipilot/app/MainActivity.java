package nl.skipilot.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReviewPlugin.class);   // eigen plug-in: beoordelen in de Play Store
        super.onCreate(savedInstanceState);
    }
}
