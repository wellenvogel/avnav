package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.os.Bundle;
import android.preference.DialogPreference;
import android.preference.ListPreference;
import android.preference.Preference;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 24.10.15.
 */
public class MainSettingsFragment extends SettingsFragment {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPreferencesFromResource(R.xml.main_preferences);
        Preference myPref = (Preference) findPreference(Constants.WORKDIR);
        if (myPref != null) {
            myPref.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                public boolean onPreferenceClick(Preference preference) {
                    //open browser or intent here
                    ((DialogPreference)preference).getDialog().dismiss();
                    return true;
                }
            });
        }
        fillData();
    }

    @Override
    public void onResume() {
        super.onResume();
        fillData();
    }

    @Override
    protected boolean updatePreferenceSummary(Preference pref) {
        if (pref instanceof ListPreference && pref.getKey().equals(Constants.RUNMODE)){
            updateListSummary((ListPreference)pref);
            return false;
        }
        return true;
    }

    private ListPreference getRunMode(){
        Preference p = getPreferenceScreen().findPreference(Constants.RUNMODE);
        if (p != null) return (ListPreference)p;
        return null;
    }


    private void fillData() {
        ListPreference l = getRunMode();
        if (l != null) {
            Resources r = getResources();
            l.setEntries(new String[]{r.getString(R.string.runNormal), r.getString(R.string.runCrosswalk), r.getString(R.string.useExtBrowser)});
            l.setEntryValues(new String[]{Constants.MODE_NORMAL, Constants.MODE_XWALK, Constants.MODE_SERVER});
            String e[]=new String[l.getEntryValues().length];
            int index=0;
            SharedPreferences prefs = getActivity().getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
            String runMode = prefs.getString(Constants.RUNMODE, Constants.MODE_NORMAL);
            for (int i=0;i<l.getEntryValues().length;i++){
                e[i]=modeToLabel(getActivity(),l.getEntryValues()[i]);
                if (l.getEntryValues()[i].equals(runMode)) index=i;
            }
            l.setValueIndex(index);
            updateListSummary(l);
        }
    }
    private void updateListSummary(ListPreference l){
        l.setSummary(l.getValue());
    }
    private static String modeToLabel(Activity a,CharSequence mode){
        if (mode == null) return "";
        Resources r=a.getResources();
        if (mode.equals(Constants.MODE_NORMAL)) return r.getString(R.string.runNormal);
        if (mode.equals(Constants.MODE_XWALK)) return r.getString(R.string.runCrosswalk);
        if (mode.equals(Constants.MODE_SERVER)) return r.getString(R.string.useExtBrowser);
        return "";
    }

    public static String getSummary(Activity a){
        SharedPreferences prefs = a.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        String runMode = prefs.getString(Constants.RUNMODE, Constants.MODE_NORMAL);
        return a.getResources().getString(R.string.runMode)+":"+modeToLabel(a,runMode);
    }
}
