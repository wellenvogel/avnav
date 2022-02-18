package de.wellenvogel.avnav.appapi;

import android.content.Context;
import android.net.Uri;

import java.io.File;

import de.wellenvogel.avnav.fileprovider.AssetsProvider;
import de.wellenvogel.avnav.fileprovider.UserFileProvider;
import de.wellenvogel.avnav.util.AvnLog;

public class LayoutHandler extends ScopedItemHandler {
    static final String PREFIX="layout";
    public LayoutHandler(Context context, String systemDir, File userDir) {
        super(PREFIX, context, PREFIX, systemDir, userDir);
    }
    public static Uri getUriForLayout(String url){
        if (! url.startsWith(PREFIX)) return null;
        url=url.substring(PREFIX.length()+1);
        if (url.startsWith("system.")){
            return AssetsProvider.createContentUri(PREFIX,url.replaceAll("^system\\.",""));
        }
        else{
            try {
                Uri rt = UserFileProvider.createContentUri(PREFIX,url.replaceAll("^user\\.",""),null);
                return rt;
            }catch (Throwable t){
                AvnLog.e("error creating uri for layout "+url,t);
                return null;
            }
        }
    }
}
