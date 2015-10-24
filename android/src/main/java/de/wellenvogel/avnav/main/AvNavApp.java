package de.wellenvogel.avnav.main;

import android.content.Context;
import android.content.pm.PackageManager;
import android.util.Log;
import org.xwalk.core.XWalkApplication;

/**
 * Created by andreas on 08.01.15.
 * we need this to make the SharedXWalkView happy...
 */
public class AvNavApp extends XWalkApplication {

    /**
     * we override here the access of the crosswalk stub to the app that contains the crosswalk runtime
     * it seems that there is no other way to configure this from outside.
     * It is hardcoded in ReflectionHelper
     * So we replace the name here with the name of our runtime
     * @param packageName
     * @param flags
     * @return
     * @throws PackageManager.NameNotFoundException
     */
    @Override
    public Context createPackageContext(String packageName, int flags) throws PackageManager.NameNotFoundException {
        if (packageName.equals(Constants.XWALKORIG)){
            String nname= Constants.XWALKAPP;
            Log.i(Constants.LOGPRFX, "changing package name for AvnAvXwalk runtime from " + packageName + " to " + nname);
            packageName=nname;
        }
        return super.createPackageContext(packageName, flags);
    }
}
