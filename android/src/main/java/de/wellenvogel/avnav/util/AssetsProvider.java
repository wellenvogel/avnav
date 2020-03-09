package de.wellenvogel.avnav.util;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.regex.Pattern;

import de.wellenvogel.avnav.main.Constants;

public class AssetsProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        return false;
    }

    @Nullable
    @Override
    public Cursor query(@NonNull Uri uri, @Nullable String[] projection, @Nullable String selection, @Nullable String[] selectionArgs, @Nullable String sortOrder) {
        return null;
    }

    @Nullable
    @Override
    public String getType( @NonNull Uri uri) {
        return null;
    }


    @Nullable
    @Override
    public Uri insert(@NonNull Uri uri,  @Nullable ContentValues values) {
        return null;
    }

    @Override
    public int delete(@NonNull Uri uri, @Nullable String selection,  @Nullable String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(@NonNull Uri uri, @Nullable ContentValues values, @Nullable String selection, @Nullable String[] selectionArgs) {
        return 0;
    }

    @Nullable
    @Override
    public ParcelFileDescriptor openFile( @NonNull Uri uri, @NonNull String mode) throws FileNotFoundException {
        throw new FileNotFoundException();

    }


    @Nullable
    @Override
    public AssetFileDescriptor openAssetFile(@NonNull Uri uri,@NonNull String mode) throws FileNotFoundException {
        AvnLog.i("open assets file: "+uri);
        AssetManager am = getContext().getAssets();
        String file_name = getPathFromUri(uri);
        if (file_name == null)
            throw new FileNotFoundException();
        AssetFileDescriptor afd = null;
        try {
            afd = am.openFd(file_name);
        } catch (IOException e) {
            AvnLog.e("error opening assets file "+uri,e);
            throw new FileNotFoundException(e.getMessage());
        }
        return afd;
    }

    private static class PathMap extends HashMap<String,String>{
        PathMap(){
            put("layout","viewer/layout");
        }

    }
    private static PathMap pathMap=new PathMap();

    public static Uri createContentUri(String type, String fileName){
        String prefix=pathMap.get(type);
        if (prefix == null) return null;
        return Uri.parse("content://"+Constants.ASSETS_PROVIDER_AUTHORITY+"/"+type+"/"+fileName);
    }
    private static String getPathFromUri(Uri uri){
        List<String> segments=uri.getPathSegments();
        if (segments.size() != 2) return null;
        String prefix=pathMap.get(segments.get(0));
        if (prefix == null) return null;
        return prefix+"/"+segments.get(1);
    }

}
