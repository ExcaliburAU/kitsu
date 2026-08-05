package dev.exau.kitsu;

import android.graphics.Color;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Keep the WebView below status/nav bars (Android 15 edge-to-edge opt-out is in values-v35).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(Color.parseColor("#1A1210"));
        getWindow().setNavigationBarColor(Color.parseColor("#1A1210"));
        super.onCreate(savedInstanceState);
    }
}
