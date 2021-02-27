package de.wellenvogel.avnav.appapi;

import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.support.annotation.NonNull;
import android.support.v4.provider.DocumentFile;
import android.util.Log;
import android.widget.Toast;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.nio.charset.StandardCharsets;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.WebViewFragment;
import de.wellenvogel.avnav.util.AvnLog;


public class UploadData{
    public static final long FILE_MAX_SIZE=1000000; //for file uploads

    long id;
    boolean doRead;
    String name;
    String fileData;
    Uri fileUri;
    WebViewFragment fragment;
    INavRequestHandler targetHandler;
    Thread copyThread;
    boolean noResults=false;
    long size;
    public UploadData(WebViewFragment fragment, INavRequestHandler targetHandler, long id, boolean doRead){
        this.id=id;
        this.doRead=doRead;
        this.fragment=fragment;
        this.targetHandler=targetHandler;
    }

    public boolean isReady(long id){
        if (id != this.id) return false;
        if (name == null || (fileData == null && doRead)) return false;
        return true;
    }

    public void saveFile(Uri uri) {
        if (noResults || fragment.getActivity() == null) return;
        try {
            AvnLog.i("importing file: " + uri);
            fileUri=uri;
            DocumentFile df = DocumentFile.fromSingleUri(fragment.getActivity(), uri);
            ParcelFileDescriptor pfd = fragment.getActivity().getContentResolver().openFileDescriptor(uri, "r");
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
            fragment.sendEventToJs(doRead?
                            Constants.JS_UPLOAD_AVAILABLE:
                            Constants.JS_FILE_COPY_READY
                    , id);
        } catch (Throwable e) {
            Toast.makeText(fragment.getActivity().getApplicationContext(), "unable to copy file: " + e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
            e.printStackTrace();
            Log.e(Constants.LOGPRFX, "unable to read file: " + e.getLocalizedMessage());
            return;
        }
    }

    public boolean copyFile(String newName) {
        if (doRead) return false;
        if (name == null || fileUri == null || targetHandler==null) return false;
        if (newName != null) name=newName;
        if (fragment.getActivity()==null) return false;
        try {
            final DocumentFile df = DocumentFile.fromSingleUri(fragment.getActivity(), fileUri);
            final ParcelFileDescriptor pfd = fragment.getActivity().getContentResolver().openFileDescriptor(fileUri, "r");
            if (pfd == null) {
                throw new Exception("unable to open: " + fileUri.getLastPathSegment());
            }
            size = pfd.getStatSize(); //maybe it changed in between
            AvnLog.i("copying file " + fileUri.getLastPathSegment());
            final long reportInterval=size/20;
            copyThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        InputStream is = new FileInputStream(pfd.getFileDescriptor()){
                            long bytesSinceReport=0;
                            long bytesRead=0;
                            @Override
                            public int read(@NonNull byte[] b, int off, int len) throws IOException {
                                if (Thread.interrupted()) throw new InterruptedIOException("interrupted");
                                int numRead=super.read(b, off, len);
                                if (numRead > 0) {
                                    bytesSinceReport += numRead;
                                    bytesRead += numRead;
                                    if (bytesSinceReport >= reportInterval) {
                                        bytesSinceReport=0;
                                        final int percent = (int) ((bytesRead * 100) / size);
                                        fragment.getActivity().runOnUiThread(new Runnable() {
                                            @Override
                                            public void run() {
                                                fragment.sendEventToJs(Constants.JS_FILE_COPY_PERCENT, percent);
                                            }
                                        });
                                    }
                                }
                                return numRead;
                            }
                        };
                        targetHandler.handleUpload(new PostVars(is,size),name,false);
                        if (! noResults) fragment.getActivity().runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                fragment.sendEventToJs(Constants.JS_FILE_COPY_DONE,0);
                            }
                        });
                    } catch (final Throwable e) {
                        if (fragment.getActivity() == null) return;
                        try{
                            targetHandler.handleDelete(df.getName(),null);
                        }catch(Throwable t){}
                        if (! noResults) fragment.getActivity().runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(fragment.getActivity(), "unable to copy: " + e.getLocalizedMessage(), Toast.LENGTH_LONG).show();
                            }
                        });
                        if (! noResults) fragment.getActivity().runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                fragment.sendEventToJs(Constants.JS_FILE_COPY_DONE,1);
                            }
                        });
                    }
                }
            });
            copyThread.setDaemon(true);
            copyThread.start();
        } catch (Throwable t) {
            if (! noResults) Toast.makeText(fragment.getActivity(), "unable to copy: " + t.getLocalizedMessage(), Toast.LENGTH_LONG).show();
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
