package de.wellenvogel.avnav.appapi;

import static de.wellenvogel.avnav.main.Constants.TYPE_SETTINGS;

import android.content.Context;

import org.json.JSONObject;

import java.io.File;
import java.util.concurrent.ExecutionException;

import de.wellenvogel.avnav.util.AvnUtil;

public class SettingsHandler extends ScopedItemHandler {
    static final String PREFIX="settings";
    public SettingsHandler(Context context, String systemDir, File userDir) {
        super(TYPE_SETTINGS, context, PREFIX, systemDir, userDir);
    }


}
