/*
    Copyright (c) 2012,2021,2019,2024 Andreas Vogel andreas@wellenvogel.net
    MIT license
    Permission is hereby granted, free of charge, to any person obtaining a
    copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following conditions:
    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
    THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    DEALINGS IN THE SOFTWARE.
 */
package de.wellenvogel.avnav.main;

import android.app.Activity;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.TextView;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;


public class DownloadHandler {
    private static final String LOGPRFX="BonjourBrowserDL";
    public static class Download {
        public String url;
        public String fileName;
        boolean done=false;
        Activity activity;
        public View progress=null;
        public TextView dlText=null;
        Uri uri=null;
        public Download(String url,Activity activity) {
            this.activity=activity;
            this.url = url;
        }
        public void start(OutputStream os, Uri uri){
            this.uri=uri;
        }
        public void stop(){}
        public boolean isRunning(){return false;}
    }
    public static class DownloadStream extends Download {
        private Thread thread=null;
        public DownloadStream(String url,Activity activity){
            super(url,activity);
        }
        private void update(long bytes){
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (progress == null) return;
                    if (bytes > 0){
                        if (progress.getVisibility() != View.VISIBLE){
                            progress.setVisibility(View.VISIBLE);
                        }
                    }
                    else{
                        if (progress.getVisibility() == View.VISIBLE){
                            progress.setVisibility(View.GONE);
                        }
                    }
                    if (dlText != null){
                        dlText.setText(String.format("%dkb: %s", bytes / 1024, fileName));
                    }
                }
            });
        }

        InputStream openInput() throws IOException {
            return null;
        }
        void closeInput() throws IOException {}
        private void toast(String msg){
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(activity,msg,Toast.LENGTH_LONG).show();
                }
            });
        }
        @Override
        public void start(OutputStream os,Uri uri){
            if (done) return;
            super.start(os,uri);
            try {
                try (Cursor c = activity.getContentResolver().query(uri, null, null, null, null)) {
                    int nameIdx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    c.moveToFirst();
                    fileName = c.getString(nameIdx);
                }
            }catch (Throwable t){}
            this.thread=new Thread(new Runnable() {
                @Override
                public void run() {
                    Log.i(LOGPRFX,"download started for "+url);
                    update(0);
                    long sum=0;
                    try {
                        InputStream is=openInput();
                        byte [] buffer=new byte[4*1024*1024];
                        int rdBytes=0;
                        final long UPDIV=2*1024*1024;
                        long lastUpdate=sum-UPDIV-1;
                        while ((rdBytes=is.read(buffer)) != -1){
                            if (done) throw new InterruptedException("user stop");
                            os.write(buffer,0,rdBytes);
                            sum+=rdBytes;
                            if (sum >= (lastUpdate+UPDIV)) {
                                update(sum);
                                lastUpdate=sum;
                            }
                        }
                        toast(activity.getString(R.string.download_finished));
                        os.close();
                        closeInput();
                        Log.i(LOGPRFX,"download finished for "+uri);
                    } catch (Throwable e) {
                        if (done){
                            toast(activity.getString(R.string.download_interrupted));
                        }
                        else {
                            toast(activity.getString(R.string.download_error) + e.getMessage());
                        }
                        try{
                            DocumentsContract.deleteDocument(activity.getContentResolver(),uri);
                            Log.i(LOGPRFX,"deleted download "+uri);
                        } catch(Throwable t){
                            Log.e(LOGPRFX,"unable to delete document "+uri);
                        }
                    }
                    update(-1);
                    done=true;
                }
            });
            this.thread.setDaemon(true);
            this.thread.start();
        }
        @Override
        public void stop(){
            try {
                this.thread.interrupt();
                this.thread.join(100);
            } catch (InterruptedException e) {
                Log.e(LOGPRFX,"unable to stop download "+url);
            }
            done=true;
        }

        @Override
        public boolean isRunning() {
            if (thread == null) return false;
            return thread.isAlive();
        }
    };

    public static class DownloadHttp extends DownloadStream {
        HttpURLConnection urlConnection=null;
        public String cookies=null;
        public String userAgent=null;
        public DownloadHttp(String url,Activity activity, String cookies, String userAgent) {
            super(url,activity);
            this.cookies=cookies;
            this.userAgent=userAgent;
        }
        @Override
        InputStream openInput() throws IOException {
            URL dlurl=new URL(this.url);
            urlConnection = (HttpURLConnection) dlurl.openConnection();
            urlConnection.setRequestProperty("Cookie", cookies);
            urlConnection.setRequestProperty("User-Agent", userAgent);
            urlConnection.connect();
            return urlConnection.getInputStream();
        }

        @Override
        void closeInput() throws IOException {
            super.closeInput();
            urlConnection.disconnect();
        }
    }
    public static class DataDownload extends Download {
        public DataDownload(String url,Activity activity) {
            super(url,activity);
        }

        @Override
        public void start(OutputStream os,Uri ruri) {
            if (done) return;
            super.start(os,ruri);
            try {
                Uri uri=Uri.parse(url);
                String data=uri.getSchemeSpecificPart();
                String [] parts=data.split(",",2);
                if (parts.length < 2) throw new IOException("invalid data url");
                String [] hparts=parts[0].split(";");
                byte [] res=null;
                if (hparts.length >1){
                    if (hparts[1].equalsIgnoreCase("base64")){
                        res= Base64.decode(parts[1],Base64.DEFAULT);
                    }
                }
                if (res == null) res=parts[1].getBytes(StandardCharsets.UTF_8);
                os.write(res);
                os.close();
            } catch (IOException e) {
                Log.e(LOGPRFX,"unable to close dl stream "+url);
            }
            done=true;
        }
    }
    public static class DownloadException extends Exception{
        public DownloadException(String message) {
            super(message);
        }
    };

    public static String guessFileName(String contentDisposition) throws UnsupportedEncodingException {
        if (contentDisposition == null) return null;
        if (contentDisposition.indexOf("filename*=") >= 0) {
            contentDisposition = contentDisposition.replaceAll(".*filename\\*=utf-8''", "");
            contentDisposition = URLDecoder.decode(contentDisposition, "utf-8");
            contentDisposition = "attachment; filename=" + contentDisposition;
        }
        String[] contentSplit = contentDisposition.split("filename=");
        if (contentSplit.length > 1) {
            return contentSplit[1].replace("filename=", "").replace("\"", "");
        }
        return null;
    }
    public static Download createHandler(Activity activity, String url, String userAgent, String
            contentDisposition, String mimeType, long contentLength) throws DownloadException, UnsupportedEncodingException {
        Download nextDownload = null;
        String fileName = "";
        boolean isData = false;
        Uri uri = Uri.parse(url);
        String[] knowSchemas = new String[]{"http", "https", "data"};
        String urlSchema = uri != null ? uri.getScheme().toLowerCase() : "";
        boolean known = false;
        for (String schema : knowSchemas) {
            if (urlSchema.equals(schema)) {
                known = true;
                break;
            }
        }
        if (!known) {
            throw new DownloadException("invalid type " + urlSchema);
        }
        isData = urlSchema.equals("data");
        fileName=guessFileName(contentDisposition);
        if (fileName == null){
            if (isData) {
                fileName = "data.bin";
            } else {
                fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            }
        }

        if (isData) {
            nextDownload = new DownloadHandler.DataDownload(url, activity);
        } else {
            nextDownload = new DownloadHandler.DownloadHttp(url, activity, CookieManager.getInstance().getCookie(url), userAgent);
        }
        nextDownload.fileName = fileName;
        return nextDownload;
    }

}
