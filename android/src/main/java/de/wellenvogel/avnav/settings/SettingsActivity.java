package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.preference.*;
import android.util.DisplayMetrics;
import android.view.Menu;
import android.view.MenuItem;

import java.util.List;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.main.XwalkDownloadHandler;

/**
 * Created by andreas on 03.09.15.
 */

public class SettingsActivity extends PreferenceActivity {
    private List<Header> headers=null;
    private static final int currentapiVersion = android.os.Build.VERSION.SDK_INT;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getActionBar().setDisplayHomeAsUpEnabled(true);
        handleInitialSettings(this);
        updateHeaderSummaries(true);


    }
    public static boolean isXwalRuntimeInstalled(Context ctx){
        return isAppInstalled(ctx, Constants.XWALKAPP, Constants.XWALKVERSION);
    }
    public static boolean isAppInstalled(Context ctx,String packageName, String version) {
        PackageManager pm = ctx.getPackageManager();
        boolean installed = false;
        try {
            PackageInfo pi=pm.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES);
            if (pi.versionName.equals(version)) installed = true;
        } catch (PackageManager.NameNotFoundException e) {
            installed = false;
        }
        return installed;
    }
    public static void handleInitialSettings(Activity activity){
        SharedPreferences sharedPrefs = activity.getSharedPreferences(Constants.PREFNAME,Context.MODE_PRIVATE);
        String mode=sharedPrefs.getString(Constants.RUNMODE,"");
        if (mode.equals("")) {
            //never set before
            if (currentapiVersion < Constants.OSVERSION_XWALK ) {
                if (! isXwalRuntimeInstalled(activity)){
                    (new XwalkDownloadHandler(activity)).showDownloadDialog(activity.getString(R.string.xwalkNotFoundTitle),
                            activity.getString(R.string.xwalkNotFoundText) + Constants.XWALKVERSION, false);
                }
                else {
                    mode=Constants.MODE_XWALK;
                }
            }
        }
        else {
            if (mode.equals(Constants.MODE_XWALK)){
                if (! isXwalRuntimeInstalled(activity) ){
                    if (currentapiVersion < Constants.OSVERSION_XWALK) {
                        (new XwalkDownloadHandler(activity)).showDownloadDialog(activity.getString(R.string.xwalkNotFoundTitle),
                                activity.getString(R.string.xwalkNotFoundText) + Constants.XWALKVERSION, false);
                    }
                    else {
                        mode= Constants.MODE_NORMAL;
                    }
                }
            }
        }
        SharedPreferences.Editor e=sharedPrefs.edit();
        e.putString(Constants.RUNMODE, mode);
        e.apply();
        NmeaSettingsFragment.checkGpsEnabled(activity,false);
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home){
            finish();
        }
        return super.onOptionsItemSelected(item);
    }
    @Override
    public boolean onCreateOptionsMenu(Menu menu){
        return true;
    }

    @Override
    public void onBuildHeaders(List<Header> target) {
        super.onBuildHeaders(target);
        headers=target;
        loadHeadersFromResource(R.xml.preference_headers, target);
        updateHeaderSummaries(false);
    }

    @Override
    protected void onResume() {
        updateHeaderSummaries(true);
        super.onResume();
    }
    @Override
    public boolean onIsMultiPane() {

        DisplayMetrics metrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(metrics);
        boolean preferMultiPane=false;
        if (metrics.widthPixels >= 1000) preferMultiPane=true;
        return preferMultiPane;
    }

    public void updateHeaderSummaries(boolean allowInvalidate){

        if (headers == null) return;
        SharedPreferences prefs=getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        boolean hasChanged=false;
        for (Header h: headers){
            String newSummary=null;
            if (h == null || h.fragment == null) continue;
            if (h.fragment.equals(NmeaSettingsFragment.class.getName())){
                newSummary= NmeaSettingsFragment.getSummary(this);
            }
            if (h.fragment.equals(MainSettingsFragment.class.getName())){
                newSummary= MainSettingsFragment.getSummary(this);
            }
            if (newSummary != null && newSummary != h.summary){
                h.summary=newSummary;
                hasChanged=true;
            }
        }
        if (hasChanged && allowInvalidate) invalidateHeaders();
    }
}

