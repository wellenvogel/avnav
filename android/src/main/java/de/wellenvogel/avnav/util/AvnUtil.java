package de.wellenvogel.avnav.util;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;

import de.wellenvogel.avnav.main.Constants;

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

    public static File workdirStringToFile(String wd, Context context){
        if (wd.equals(Constants.INTERNAL_WORKDIR)){
            return context.getFilesDir();
        }
        if (wd.equals(Constants.EXTERNAL_WORKDIR)){
            return context.getExternalFilesDir(null);
        }
        return new File(wd);
    }
    public static File getWorkDir(SharedPreferences pref, Context context){
        if (pref == null){
            pref=context.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
        }
        String wd=pref.getString(Constants.WORKDIR,"");
        return workdirStringToFile(wd,context);
    }
}
