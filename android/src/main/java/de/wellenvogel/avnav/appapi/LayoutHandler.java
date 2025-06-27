package de.wellenvogel.avnav.appapi;

import android.content.Context;

import java.io.File;

public class LayoutHandler extends ScopedItemHandler {
    static final String PREFIX="layout";
    public LayoutHandler(Context context, String systemDir, File userDir) {
        super(PREFIX, context, PREFIX, systemDir, userDir);
    }
}
