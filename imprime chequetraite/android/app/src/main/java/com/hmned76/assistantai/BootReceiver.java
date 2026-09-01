package com.hmned76.assistantai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d("HmiedWake", "Boot completed - WakeWord désactivé (correction beep)");
            // désactivé pour éviter beep parasite : à réactiver manuellement si besoin
            // Intent s = new Intent(context, WakeWordService.class);
            // if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(s);
            // else context.startService(s);
        }
    }
}
