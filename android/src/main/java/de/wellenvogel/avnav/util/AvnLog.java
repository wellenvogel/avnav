package de.wellenvogel.avnav.util;

import de.wellenvogel.avnav.main.BuildConfig;

/**
 * Created by andreas on 03.01.15.
 */
public class AvnLog {
    public static void d(String key,String txt){
        if (BuildConfig.DEBUG){
            android.util.Log.d(key,txt);
        }
    }
    public static void i(String key,String txt){
        if (BuildConfig.DEBUG){
            android.util.Log.i(key,txt);
        }
    }
}
