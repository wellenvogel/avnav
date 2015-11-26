package de.wellenvogel.avnav.util;

import android.content.SharedPreferences;

/**
 * Created by andreas on 26.11.15.
 */
public class AvnUtil {
    public static long getLongPref(SharedPreferences prefs,String key,long defaultValue){
        try{
            return prefs.getLong(key,defaultValue);
        }catch (Throwable x){}
        try {
            String v = prefs.getString(key, null);
            if (v == null) return defaultValue;
            try {
                long rt = Long.parseLong(v);
                return rt;
            } catch (Exception e) {
                return defaultValue;
            }
        }catch (Throwable t){

        }
        return defaultValue;
    }
}
