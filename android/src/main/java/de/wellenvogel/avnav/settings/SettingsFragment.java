package de.wellenvogel.avnav.settings;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.content.res.XmlResourceParser;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.Preference;
import android.preference.PreferenceFragment;
import android.preference.PreferenceGroup;

import org.xmlpull.v1.XmlPullParser;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;

/**
 * Created by andreas on 24.10.15.
 */
public class SettingsFragment extends PreferenceFragment implements SharedPreferences.OnSharedPreferenceChangeListener {
    private static final String NAMESPACE="http://schemas.android.com/apk/res/android";

    /**
     * as there is no easy way of resetting all the defaults here, we parse the xml by our own...
     * @param id the resource id for the preferences xml
     */
    protected void setDefaults(int id){
        Resources res=getResources();
        XmlResourceParser xpp=res.getXml(id);
        try {
            xpp.next();
            int eventType = xpp.getEventType();
            while (eventType != XmlPullParser.END_DOCUMENT) {
                if (eventType == XmlPullParser.START_TAG) {
                    String k=xpp.getAttributeValue(NAMESPACE,"key");
                    String dv=xpp.getAttributeValue(NAMESPACE, "defaultValue");
                    if (dv != null) {
                        if (k.startsWith("@")) {
                            k = res.getString(Integer.parseInt(k.substring(1)));
                        }
                        if (dv.startsWith("@")) {
                            dv = res.getString(Integer.parseInt(dv.substring(1)));
                        }

                        Preference p = getPreferenceScreen().findPreference(k);
                        if (p != null) {
                            if (p instanceof EditTextPreference) {
                                ((EditTextPreference) p).setText(dv);
                            }
                        }
                    }

                }
                eventType = xpp.next();
            }
        } catch (Exception e) {
            AvnLog.e("unable to reset", e);
        }
    }

    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
        Preference pref = findPreference(key);
        if (pref != null) {
            if (updatePreferenceSummary(pref,sharedPreferences)) {
                if (pref instanceof EditTextPreference) {
                    pref.setSummary(sharedPreferences.getString(key,""));
                }
            }
        }
        updateActivity();
    }

    /**
     * override this
     * @param pref
     * @param prefs
     * @return false if no further handling
     */
    protected boolean updatePreferenceSummary(Preference pref, SharedPreferences prefs){
        return true;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getPreferenceManager().setSharedPreferencesName(Constants.PREFNAME);
        getActivity().getActionBar().setDisplayHomeAsUpEnabled(true);
    }

    public void onResume() {
        super.onResume();
        getPreferenceScreen().getSharedPreferences()
                .registerOnSharedPreferenceChangeListener(this);
        updateTextSummaries(getPreferenceScreen());
        getActivity().getActionBar().setDisplayHomeAsUpEnabled(true);

    }

    private void updateTextSummaries(PreferenceGroup cat) {
        for (int i = 0; i < cat.getPreferenceCount(); i++) {
            Preference pref = cat.getPreference(i);
            if (pref instanceof EditTextPreference) {
                pref.setSummary(((EditTextPreference) pref).getText());
            }
            if (pref instanceof PreferenceGroup) {
                updateTextSummaries((PreferenceGroup) pref);
            }
        }
        updateActivity();
    }

    private void updateActivity(){
        Activity a=getActivity();
        if (a instanceof SettingsActivity){
            ((SettingsActivity)a).updateHeaderSummaries(true);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        getPreferenceScreen().getSharedPreferences()
                .unregisterOnSharedPreferenceChangeListener(this);
    }

}
