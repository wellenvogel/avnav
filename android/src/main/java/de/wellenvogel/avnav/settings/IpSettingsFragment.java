package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class IpSettingsFragment extends SettingsFragment {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.ip_preferences);
    }

    public static String getSummary(Activity a){
        String rt="";
        SharedPreferences prefs=a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        rt=prefs.getString(Constants.IPADDR,"")+":"+prefs.getString(Constants.IPPORT,"")+"["+
                (prefs.getBoolean(Constants.IPNMEA,false)?"NMEA ":"")+
                (prefs.getBoolean(Constants.IPAIS,false)?"AIS ":"")+"]";
        return rt;
    }
}
