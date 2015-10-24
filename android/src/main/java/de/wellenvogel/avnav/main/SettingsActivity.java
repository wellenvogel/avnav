package de.wellenvogel.avnav.main;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.preference.*;
import android.util.DisplayMetrics;
import android.view.Menu;
import android.view.MenuItem;

import java.util.List;

/**
 * Created by andreas on 03.09.15.
 */

public class SettingsActivity extends PreferenceActivity {
    private List<Header> headers=null;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getActionBar().setDisplayHomeAsUpEnabled(true);
        updateHeaderSummaries(true);
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
            if (h == null || h.fragmentArguments == null) continue;
            Object o=h.fragmentArguments.get("fragmentName");
            if (o != null && o instanceof String){
                String fragment=(String)o;
                String newSummary;
                if (fragment.equals("ip")){
                    newSummary=prefs.getString(Constants.IPADDR,"")+":"+prefs.getString(Constants.IPPORT,"");
                    if (! newSummary.equals(h.summary)){
                        h.summary=newSummary;
                        hasChanged=true;
                    }
                }
            }
        }
        if (hasChanged && allowInvalidate) invalidateHeaders();
    }
}

