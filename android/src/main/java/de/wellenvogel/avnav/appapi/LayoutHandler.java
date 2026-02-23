package de.wellenvogel.avnav.appapi;

import static de.wellenvogel.avnav.main.Constants.TYPE_LAYOUT;

import android.content.Context;

import java.io.File;

public class LayoutHandler extends ScopedItemHandler {
    static final String PREFIX="layout";
    public LayoutHandler(Context context, String systemDir, File userDir) {
        super(TYPE_LAYOUT, context, PREFIX, systemDir, userDir);
    }

}
