package de.wellenvogel.avnav.gps;

import android.content.Context;
import android.content.Intent;

import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 18.12.17.
 */

public class BroadcastReceiver extends android.content.BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AvnLog.i("broadcast received");
    }
}
