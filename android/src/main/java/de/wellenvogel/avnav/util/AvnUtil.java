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
    public static boolean matchesNmeaFilter(String record, String [] nmeaFilter){
        if (record == null || ! record.startsWith("$")) return true;
        boolean matches=true;
        if (nmeaFilter != null && nmeaFilter.length > 0){
            matches=false;
            for (String f: nmeaFilter){
                if (record.substring(3,3+f.length()).equals(f)){
                    matches=true;
                    break;
                }
            }
        }
        return matches;
    }
    public static String[] splitNmeaFilter(String nmeaFilter){
        if (nmeaFilter != null && ! nmeaFilter.isEmpty()){
            if (nmeaFilter.indexOf(",")>=0) {
                return nmeaFilter.split(" *, *");
            }
            else{
                return new String[]{nmeaFilter};
            }
        }
        return null;
    }
}
