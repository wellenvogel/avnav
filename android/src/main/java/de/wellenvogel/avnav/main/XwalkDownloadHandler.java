package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.widget.Toast;

import de.wellenvogel.avnav.util.AvnDialogHandler;
import de.wellenvogel.avnav.util.DialogBuilder;

/**
 * Created by andreas on 10.01.15.
 */
public class XwalkDownloadHandler {
    public static int DIALOGID=1;
    private Activity activity;
    private AvnDialogHandler handler;
    public XwalkDownloadHandler(Activity activity) {
        this.handler=new AvnDialogHandler(activity);
        this.activity = activity;
    }

    public void showDownloadDialog(String title, String message, final boolean finishOnCancel) {
        DialogBuilder builder = new DialogBuilder(this.activity, R.layout.dialog_confirm);
        builder.setNegativeButton(android.R.string.cancel,
                new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int id) {
                        if (handler.onCancel(DIALOGID)) return;
                        if (finishOnCancel) activity.finish();
                    }
                });
        final String downloadUrl = getLibraryApkDownloadUrl();
        if (downloadUrl != null && downloadUrl.length() > 0) {
            builder.setNeutralButton(R.string.xwalkDownloadFromUrl,
                    new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface dialog, int id) {
                            if (!handler.onNeutral(DIALOGID)) return;
                            Intent goDownload = new Intent(Intent.ACTION_VIEW);
                            goDownload.setData(Uri.parse(downloadUrl));
                            try {
                                activity.startActivity(goDownload);
                            } catch (Exception e) {
                                Toast.makeText(activity, e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                            }
                        }
                    });
        }
        builder.setPositiveButton(R.string.xwalkDownloadFromPlaystore,
                new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int id) {
                        if (!handler.onOk(DIALOGID)) return;
                        Intent goToMarket = new Intent(Intent.ACTION_VIEW);
                        goToMarket.setData(Uri.parse(
                                "market://details?id=" + Constants.XWALKAPP));
                        try {
                            activity.startActivity(goToMarket);
                        } catch (Exception e) {
                            Toast.makeText(activity, e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                        }
                    }
                });

        builder.setTitle(title);
        builder.setText(R.id.question, message);
        builder.show();
    }

    public String getLibraryApkDownloadUrl() {
        String arch = System.getProperty("os.arch").toUpperCase();
        String suffix="arm";
        if (!arch.contains("ARM")) {
            if (arch.contains("86")) {
                suffix="x86";
            }
            else {
                Log.e(Constants.LOGPRFX,"unknown architecture "+arch+"do not have any download url" );
                return null;
            }
        }
        String rt="http://www.wellenvogel.de/software/avnav/downloads/AvNavXwalk-"+ Constants.XWALKVERSION+"_"+suffix+".apk";
        Log.d(Constants.LOGPRFX,"download url: "+rt);
        return rt;
    }

}
