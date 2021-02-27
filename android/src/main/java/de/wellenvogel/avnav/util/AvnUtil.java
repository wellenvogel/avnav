package de.wellenvogel.avnav.util;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;

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

    public static String removeNonNmeaChars(String input){
        if (input == null) return input;
        return input.replaceAll("[^\\x20-\\x7F]", "");
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
            pref=getSharedPreferences(context);
        }
        String wd=pref.getString(Constants.WORKDIR,"");
        return workdirStringToFile(wd,context);
    }

    public static SharedPreferences getSharedPreferences(Context ctx){
        return ctx.getSharedPreferences(Constants.PREFNAME, Context.MODE_PRIVATE);
    }

    public static String getMandatoryParameter(Uri uri, String name)throws Exception{
        String rt=uri.getQueryParameter(name);
        if (rt == null) throw new Exception("missing mandatory parameter "+name);
        return rt;
    }
    public static boolean getFlagParameter(Uri uri, String name,boolean defaultV)throws Exception{
        String rt=uri.getQueryParameter(name);
        if (rt == null || rt.isEmpty()) return defaultV;
        return rt.toLowerCase().equals("true");
    }

    public static JSONObject readJsonFile(File file,long maxBytes) throws Exception {
        if (!file.exists()) throw new Exception("file " + file.getAbsolutePath() + " not found");
        if (file.length() > maxBytes)
            throw new Exception("file " + file.getAbsolutePath() + " too long to read");
        FileInputStream is = new FileInputStream(file);
        byte[] buffer = new byte[(int) (file.length())];
        int rd = is.read(buffer);
        if (rd != file.length())
            throw new Exception("unable to read all bytes for " + file.getAbsolutePath());
        JSONObject rt = new JSONObject(new String(buffer, StandardCharsets.UTF_8));
        return rt;
    }
}
