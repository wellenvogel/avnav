package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;

/**
 * Created by andreas on 09.01.15.
 * just to go back from the notification
 */
public class Dummy extends Activity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent notificationIntent = new Intent(this, MainActivity.class);
        startActivity(notificationIntent);
        finish();
    }
}