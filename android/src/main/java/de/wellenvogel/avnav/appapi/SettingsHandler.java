package de.wellenvogel.avnav.appapi;

import android.content.Context;

import org.json.JSONObject;

import java.io.File;

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

}
