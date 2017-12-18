package de.wellenvogel.avnav.gps;

import android.content.Context;

/**
 * Created by andreas on 18.12.17.
 */

public interface NotifyInterface {
    void startNotification(Context ctx, String title, String text);
    void cancelNotification(Context ctx);
}
