package de.wellenvogel.avnav.charts;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import android.os.ParcelFileDescriptor;
import android.support.v4.provider.DocumentFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;

import de.wellenvogel.avnav.util.AvnLog;

public class MbTilesFile extends ChartFile {
    private boolean schemeXyz=true;
    SQLiteDatabase db=null;
    Object lock=new Object();
    Object writerLock=new Object();
    long sequence=System.currentTimeMillis();
    public MbTilesFile(File pLocation) throws Exception {
        super(pLocation);
        initialize();
    }

    @Override
    public String getScheme() {
        return schemeXyz?"xyz":"tms";
    }

    @Override
    public boolean setScheme(String newScheme) throws Exception {
        newScheme=newScheme.toLowerCase();
        if (!newScheme.equals("xyz") && ! newScheme.equals("tms")){
            throw new Exception("invalid scheme");
        }
        if (newScheme.equals("xyz")){
            if (schemeXyz) return false;
        }
        else{
            if (!schemeXyz) return false;
        }
        synchronized (writerLock) {
            SQLiteDatabase dbrw = SQLiteDatabase.openDatabase(mRealFile.getPath(), null, SQLiteDatabase.OPEN_READWRITE);
            Cursor cu=null;
            try {
                cu = dbrw.rawQuery("select value from metadata where name='scheme'", null);
                ContentValues update = new ContentValues();
                update.put("value", newScheme);
                if (cu.moveToFirst()) {
                    cu.close();
                    dbrw.update("metadata", update, "name='scheme'", null);
                } else {
                    cu.close();
                    update.put("name","scheme");
                    dbrw.insert("metadata", null, update);
                }
            }finally{
                if (cu != null){
                    try{
                        cu.close();
                    }catch (Throwable t){}
                }
                dbrw.close();
            }
        }
        readHeader();
        return false;
    }

    @Override
    public long getSequence() {
        return sequence;
    }

    @Override
    public void close() throws IOException {
        synchronized (lock) {
            if (db != null) db.close();
        }
    }

    @Override
    public int numFiles() {
        return 1;
    }

    class Tile{
        int x; //tile_column
        int y; //tile_row
        int z; //zoom_level
        Tile(int z, int x, int y){
            this.x=x;
            this.y=y;
            this.z=z;
        }
        String[] toQueryArgs(){
            return new String[]{
                    Integer.toString(z),
                    Integer.toString(x),
                    Integer.toString(y)
            };
        }
    }

    //tile is (z,x,y)
    private Tile zxyToZoomColRow(int z,int x, int y) {
        if (schemeXyz) {
            return new Tile(z, x, (1 << z) - 1 - y);
        }
        else {
            return new Tile(z, x, y);
        }
    }

    private int rowToY(int z, int row) {
        if (schemeXyz){
            return (1<< z) - 1 - row;
        }
        else {
            return row;
        }
    }
    private int colToX(int z, int col) {
        return col;
    }

    @Override
    protected void openFiles() throws FileNotFoundException {

    }

    @Override
    protected void openFilesUri() throws IOException {
        throw new IOException("unable to read mbtiles from external dir");
    }

    @Override
    protected void readHeader() throws Exception {
        mSources.put(0,"mbtiles");
        Cursor cu=null;
        if (db != null){
            try{
                db.close();
                db=null;
            }catch (Throwable e){}
        }
        db=SQLiteDatabase.openDatabase(mRealFile.getPath(),null,SQLiteDatabase.OPEN_READONLY);
        try {
            cu = db.rawQuery("select value from metadata where name=?", new String[]{"scheme"});
            if (cu.moveToFirst()){
                String scheme=cu.getString(0);
                AvnLog.i("found schema for "+mRealFile.getPath()+": "+scheme);
                if (scheme.equalsIgnoreCase("tms")) schemeXyz=false;
            }
            cu.close();
            cu=db.rawQuery("select distinct zoom_level from tiles",null);
            ArrayList<Integer> zoomlevels=new ArrayList<Integer>();
            while(cu.moveToNext()){
                zoomlevels.add(cu.getInt(0));
            }
            AvnLog.i("read "+zoomlevels.size()+" zoomlevels");
            cu.close();
            for (int zl : zoomlevels){
                ChartRange range=new ChartRange();
                range.zoom=zl;
                range.sourceIndex=0;
                range.offset=0L; //not used
                cu=db.rawQuery("select min(tile_row),max(tile_row) from tiles where zoom_level=?",
                        new String[]{Integer.toString(zl)});
                if (cu.moveToFirst()){
                    if (schemeXyz) {
                        range.yMin=rowToY(zl,cu.getInt(1));
                        range.yMax=rowToY(zl,cu.getInt(0));
                    }
                    else{
                        range.yMin=rowToY(zl,cu.getInt(0));
                        range.yMax=rowToY(zl,cu.getInt(1));
                    }
                }
                cu.close();
                cu=db.rawQuery("select min(tile_column),max(tile_column) from tiles where zoom_level=?",
                        new String[]{Integer.toString(zl)});
                if (cu.moveToFirst()){
                    range.xMin=colToX(zl,cu.getInt(0));
                    range.xMax=colToX(zl,cu.getInt(1));
                }
                mRangeData.add(range);
            }
        }finally {
            if (cu != null) {
                try {
                    cu.close();
                }catch (Throwable t){}
            }
        }
        sequence=System.currentTimeMillis();

    }

    @Override
    public ChartInputStream getInputStream(int pX, int pY, int pZ, int sourceIndex) throws IOException {
        if (db == null) return null;
        synchronized (lock) {
            Tile param=zxyToZoomColRow(pZ,pX,pY);
            Cursor cu=db.query("tiles",
                    new String[]{"tile_data"},
                    "zoom_level=? and tile_column=? and tile_row=?",
                    param.toQueryArgs(),null,null,null);
            if (cu.moveToFirst()) {
                byte data[] = cu.getBlob(0);
                cu.close();
                return new ChartInputStream(new ByteArrayInputStream(data),data.length);
            }
            cu.close();
        }
        return null;
    }
}
