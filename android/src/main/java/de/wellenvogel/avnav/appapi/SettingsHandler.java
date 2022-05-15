package de.wellenvogel.avnav.appapi;

import android.content.Context;
import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;

import de.wellenvogel.avnav.fileprovider.AssetsProvider;
import de.wellenvogel.avnav.fileprovider.UserFileProvider;
import de.wellenvogel.avnav.util.AvnLog;

public class SettingsHandler extends ScopedItemHandler {
    static final String PREFIX="settings";
    public SettingsHandler(Context context, String systemDir, File userDir) {
        super(PREFIX, context, PREFIX, systemDir, userDir);
    }

    @Override
    public JSONObject handleRename(String oldName, String newName) throws Exception {
        oldName=nameToUserFileName(oldName,true);
        newName=nameToUserFileName(newName,true);
        File old=new File(userDir,oldName);
        if (! old.exists() || ! old.isFile()){
            return RequestHandler.getErrorReturn(oldName+" not found");
        }
        File newFile=new File(userDir,newName);
        if (newFile.exists()){
            return RequestHandler.getErrorReturn(newName+" already exists");
        }
        if (! old.renameTo(newFile)){
            return RequestHandler.getErrorReturn("rename failed");
        }
        return RequestHandler.getReturn();
    }

    public static Uri getUriForSettings(String url){
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
