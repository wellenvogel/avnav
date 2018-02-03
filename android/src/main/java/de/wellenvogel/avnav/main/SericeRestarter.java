package de.wellenvogel.avnav.main;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import de.wellenvogel.avnav.gps.GpsService;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 02.02.18.
 * when a notification is received - just restart our gps service
 */

public class SericeRestarter extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent sintent = new Intent(context, GpsService.class);
        AvnLog.e("Service restart!");
        context.startService(sintent);
    }
}
