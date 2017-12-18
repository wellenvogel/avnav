package de.wellenvogel.avnav.gps;

import android.annotation.TargetApi;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.support.v4.app.NotificationCompat;
import android.widget.RemoteViews;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 18.12.17.
 */

public class LockScreenNotify implements NotifyInterface {

    @TargetApi(Build.VERSION_CODES.LOLLIPOP)
    @Override
    public void startNotification(Context ctx, String title, String text) {
        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(ctx)
                        .setVisibility(Notification.VISIBILITY_PUBLIC)
                        .setOngoing(true)
                        .setSmallIcon(R.drawable.sailboat)
                        .setContentTitle(title)
                        .setContentText(text);
        Intent bc=new Intent(ctx,BroadcastReceiver.class);
        bc.setAction("STOP");
        PendingIntent pendingIntent = PendingIntent.getBroadcast(ctx,1,bc,PendingIntent.FLAG_CANCEL_CURRENT);
        builder.setContentIntent(pendingIntent);
        builder.addAction(R.drawable.sailboat,"STOP",pendingIntent);
        NotificationManager mNotificationManager =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        mNotificationManager.notify(Constants.LOCKNOTIFY,
                builder.build());
    }

    @Override
    public void cancelNotification(Context ctx) {
        NotificationManager mNotificationManager =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        mNotificationManager.cancel(Constants.LOCKNOTIFY);
    }
}
