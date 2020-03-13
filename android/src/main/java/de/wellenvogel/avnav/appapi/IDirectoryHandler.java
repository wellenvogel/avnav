package de.wellenvogel.avnav.appapi;

import android.webkit.WebResourceResponse;

import java.io.FileNotFoundException;
import java.io.FileOutputStream;

public interface IDirectoryHandler {
    public String getUrlPrefix();
    FileOutputStream openForWrite(String name, boolean overwrite) throws Exception;


    String getDirName();
    void deleteFile(String name) throws Exception;
}
