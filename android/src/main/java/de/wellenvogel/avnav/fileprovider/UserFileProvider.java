package de.wellenvogel.avnav.fileprovider;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;

import de.wellenvogel.avnav.appapi.DirectoryRequestHandler;
import de.wellenvogel.avnav.appapi.RequestHandler;
import de.wellenvogel.avnav.charts.ChartHandler;
import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;

public class UserFileProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        return false;
    }

    @Nullable
    @Override
    public Cursor query(@NonNull Uri uri,  @Nullable String[] projection,  @Nullable String selection,@Nullable String[] selectionArgs, @Nullable String sortOrder) {
        return null;
    }

    @Nullable
    @Override
    public String getType(@NonNull Uri uri) {
        return null;
    }


    @Nullable
    @Override
    public Uri insert( @NonNull Uri uri,  @Nullable ContentValues values) {
        return null;
    }

    @Override
    public int delete(@NonNull Uri uri,@Nullable String selection, @Nullable String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(@NonNull Uri uri,  @Nullable ContentValues values,@Nullable String selection, @Nullable String[] selectionArgs) {
        return 0;
    }


    @Nullable
    @Override
    public ParcelFileDescriptor openFile( @NonNull Uri uri,  @NonNull String mode) throws FileNotFoundException {
        try {
            List<String> segments=uri.getPathSegments();
            if (segments.size() < 2){
                throw new Exception("invalid uri");
            }
            if (segments.get(0).equals("chart")){
                return ChartHandler.getFileFromUri(uri.getPath().substring(segments.get(0).length()+1),getContext());
            }
            File rt=getPathFromUri(uri);
            if (rt == null) throw new FileNotFoundException();
            return ParcelFileDescriptor.open(rt,ParcelFileDescriptor.MODE_READ_ONLY);
        } catch (Exception e) {
            AvnLog.e("unable to open file "+uri,e);
            throw new FileNotFoundException(e.getLocalizedMessage());
        }
    }

    /**
     * get the path from the content uri
     * would be better to use or handlers here - but there seems to be no easy
     * way doing that
     * @param uri
     * @return File
     * @throws Exception
     */
    private File getPathFromUri(Uri uri) throws Exception {
        List<String> segments=uri.getPathSegments();
        if (segments.size() != 2) return null;
        String safeName=DirectoryRequestHandler.safeName(segments.get(1),false);
        AvnUtil.KeyValue<File> base=RequestHandler.typeDirs.get(segments.get(0));
        if (base == null || base.value == null) return null;
        File rt= new File(AvnUtil.getWorkDir(null,getContext()),new File(base.value,safeName).getPath());
        if (! rt.exists() || ! rt.isFile() || ! rt.canRead()) return null;
        return rt;
    }

    /**
     * create a content url
     * @param type
     * @param fileName
     * @param url
     * @return
     * @throws Exception
     */
    public static Uri createContentUri(String type, String fileName,String url) throws Exception {
        if (RequestHandler.typeDirs.get(type) == null) return null;
        if (type.equals("chart")){
            fileName= ChartHandler.uriPath(fileName,url);
        }
        else {
            DirectoryRequestHandler.safeName(fileName, true);
        }
        return Uri.parse("content://"+ Constants.USER_PROVIDER_AUTHORITY+"/"+type+"/"+fileName);
    }
}
