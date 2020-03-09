package de.wellenvogel.avnav.util;

import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.support.v4.provider.DocumentFile;
import android.util.Log;
import android.widget.Toast;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import de.wellenvogel.avnav.appapi.IDirectoryHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.main.MainActivity;


public class UploadData{
    public static final long FILE_MAX_SIZE=1000000; //for file uploads

    int id;
    boolean doRead;
    String name;
    String fileData;
    Uri fileUri;
    MainActivity activity;
    IDirectoryHandler targetHandler;
    Thread copyThread;
    boolean noResults=false;
    long size;
    public UploadData(MainActivity activity, IDirectoryHandler targetHandler, int id, boolean doRead){
        this.id=id;
        this.doRead=doRead;
        this.activity=activity;
        this.targetHandler=targetHandler;
    }
    public boolean isReady(int id){
        if (id != this.id) return false;
        if (name == null || (fileData == null && doRead)) return false;
        return true;
    }

    public void saveFile(Uri uri) {
        try {
            AvnLog.i("importing file: " + uri);
            fileUri=uri;
            DocumentFile df = DocumentFile.fromSingleUri(activity, uri);
            ParcelFileDescriptor pfd = activity.getContentResolver().openFileDescriptor(uri, "r");
            if (pfd == null){
                throw new IOException("unable to open "+uri.getLastPathSegment());
            }
            size = pfd.getStatSize();
            if (doRead) {
                if (size > FILE_MAX_SIZE)
                    throw new Exception("file to big, allowed " + FILE_MAX_SIZE);
                AvnLog.i("saving file " + uri.getLastPathSegment());
                byte buffer[] = new byte[(int) (FILE_MAX_SIZE / 10)];
                int rd = 0;
                StringBuilder data = new StringBuilder();
                InputStream is = new FileInputStream(pfd.getFileDescriptor());
                while ((rd = is.read(buffer)) > 0) {
                    data.append(new String(buffer, 0, rd, StandardCharsets.UTF_8));
                }
                is.close();
                fileData = data.toString();
            }
            else{
                pfd.close();
            }
            name = df.getName();
            activity.sendEventToJs(doRead?
                            Constants.JS_UPLOAD_AVAILABLE:
                            Constants.JS_FILE_COPY_READY
                    , id);
        } catch (Throwable e) {
            Toast.makeText(activity.getApplicationContext(), "unable to copy file: " + e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            e.printStackTrace();
            Log.e(Constants.LOGPRFX, "unable to read file: " + e.getLocalizedMessage());
            return;
        }
    }

    public boolean copyFile() {
        if (doRead) return false;
        if (name == null || fileUri == null || targetHandler==null) return false;
        try {
            final DocumentFile df = DocumentFile.fromSingleUri(activity, fileUri);
            final ParcelFileDescriptor pfd = activity.getContentResolver().openFileDescriptor(fileUri, "r");
            if (pfd == null) {
                throw new Exception("unable to open: " + fileUri.getLastPathSegment());
            }
            size = pfd.getStatSize(); //maybe it changed in between
            final FileOutputStream os=targetHandler.openForWrite(df.getName(),false);
            AvnLog.i("saving file " + fileUri.getLastPathSegment()+ " to "+targetHandler.getDirName());
            final long bufferSize=FILE_MAX_SIZE / 10;
            final long reportInterval=size/20;
            copyThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    long ri=reportInterval;
                    if (ri < bufferSize) ri=bufferSize-1;
                    try {
                        byte buffer[] = new byte[(int) (FILE_MAX_SIZE / 10)];
                        long bytesRead=0;
                        long lastReport=0;
                        int rd = 0;
                        InputStream is = new FileInputStream(pfd.getFileDescriptor());
                        while ((rd = is.read(buffer)) > 0) {
                            if (Thread.interrupted()) throw new Exception("interrupted");
                            os.write(buffer,0,rd);
                            bytesRead+=rd;
                            if (bytesRead > (lastReport+ri)){
                                final int percent=(int)((bytesRead*100)/size);
                                activity.runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        activity.sendEventToJs(Constants.JS_FILE_COPY_PERCENT,percent);
                                    }
                                });
                            }
                        }
                        is.close();
                        os.close();
                        if (! noResults) activity.runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                activity.sendEventToJs(Constants.JS_FILE_COPY_DONE,0);
                            }
                        });
                    } catch (final Throwable e) {
                        try{
                            targetHandler.deleteFile(df.getName());
                        }catch(Throwable t){}
                        activity.runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(activity, "unable to copy: " + e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                            }
                        });
                        if (! noResults) activity.runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                activity.sendEventToJs(Constants.JS_FILE_COPY_DONE,1);
                            }
                        });
                    }
                }
            });
            copyThread.setDaemon(true);
            copyThread.start();
        } catch (Throwable t) {
            Toast.makeText(activity, "unable to copy: " + t.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            return false;
        }
        return true;
    }

    public boolean interruptCopy(boolean preventResults){
        if (copyThread == null) return false;
        if (! copyThread.isAlive()) return false;
        this.noResults=preventResults;
        copyThread.interrupt();
        return true;
    }
    public long getSize(){
        return size;
    }
    public String getFileData(){
        return fileData;
    }
    public String getName(){
        return name;
    }

}
