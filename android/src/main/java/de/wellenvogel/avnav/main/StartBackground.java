package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;

import de.wellenvogel.avnav.settings.SettingsActivity;
import de.wellenvogel.avnav.util.AvnLog;

/*
# Copyright (c) 2022,2026 Andreas Vogel andreas@wellenvogel.net

#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
*/
public class StartBackground extends Activity {
    Handler retryHandler=new Handler();
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.start_background);
        SharedPreferences sharedPrefs = getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        int oldVersion=sharedPrefs.getInt(Constants.VERSION, -1);
        boolean startPendig=sharedPrefs.getBoolean(Constants.WAITSTART, false);
        if (oldVersion < 0 || startPendig){
            showNotInitializedError(null);
            return;
        }
        if (!SettingsActivity.checkNotificationPermission(this)){
            showNotInitializedError(getString(R.string.startBackgroundNotificationPermission));
            return;
        }
        if (!SettingsActivity.checkOrCreateWorkDir(this, sharedPrefs)){
            showNotInitializedError(getString(R.string.startBackgroundWorkDirError));
            return;
        }
        AvnLog.i("StartBackground","Starting background service");
        MainActivity.waitForeground(this, retryHandler, new Runnable() {
            @Override
            public void run() {
                AvnLog.i("StartBackground","Starting background service - foreground ready");
                try {
                    MainActivity.startService(StartBackground.this);
                    finish();
                } catch (Throwable t) {
                    AvnLog.e("unable to start background service", t);
                    showError(t);
                }
            }
        });
    }

    private void showNotInitializedError(String txt) {
        if (isFinishing() || isDestroyed()) return;
        if (txt == null) txt="";
        new AlertDialog.Builder(this)
                .setTitle(R.string.startBackgroundNotInitializedTitle)
                .setMessage(getString(R.string.startBackgroundNotInitializedMessage,txt))
                .setCancelable(true)
                .setPositiveButton(android.R.string.ok, null)
                .setOnDismissListener(new DialogInterface.OnDismissListener() {
                    @Override
                    public void onDismiss(DialogInterface dialog) {
                        finish();
                    }
                })
                .show();
    }

    private void showError(Throwable t){
        if (isFinishing() || isDestroyed()) return;
        String msg=t.getLocalizedMessage();
        if (msg == null) msg=t.getClass().getSimpleName();
        new AlertDialog.Builder(this)
                .setTitle(R.string.startBackgroundErrorTitle)
                .setMessage(getString(R.string.startBackgroundErrorMessage, msg))
                .setCancelable(true)
                .setPositiveButton(android.R.string.ok, null)
                .setOnDismissListener(new DialogInterface.OnDismissListener() {
                    @Override
                    public void onDismiss(DialogInterface dialog) {
                        finish();
                    }
                })
                .show();
    }
}
