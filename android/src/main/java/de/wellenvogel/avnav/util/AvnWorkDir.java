package de.wellenvogel.avnav.util;

import android.content.Context;
import android.os.Build;
import android.os.Environment;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import androidx.annotation.Nullable;

public class AvnWorkDir {
    private final boolean withTitles;
    private boolean filled=false;
    public AvnWorkDir(boolean withTitles){
        this.withTitles=withTitles;
    }
    public static class Entry{
        private File file;
        private String configName;
        private String shortName;
        boolean isExternal=false;
        private String title;

        public File getFile() {
            return file;
        }

        public String getConfigName() {
            return configName;
        }

        public String getShortName() {
            return shortName;
        }

        public boolean isExternal() {
            return isExternal;
        }

        public String getTitle() {
            return title;
        }
        private Entry(){}
    }

    private ArrayList<Entry> entries=new ArrayList<>();
    private boolean isExisting(File f){
        if (! f.exists() || ! f.isDirectory()) return false;
        for (String s: getDefaultDirs()){
            File sdir=new File(f,s);
            if (! sdir.exists() || ! sdir.isDirectory()) return false;
        }
        return true;
    }
    /**
     * the external index for getExternalFilesDir
     */
    private static final int DEFAULT_EXT_IDX=0;
    private Entry buildEntry(Context ctx,File f,boolean isExternal,int extIdx){
        Entry rt=new Entry();
        rt.file=f;
        rt.configName=getConfig(isExternal,extIdx);
        rt.shortName= getShortName(rt.configName,ctx);
        rt.isExternal=isExternal;
        if (withTitles) {
            StringBuilder title = new StringBuilder();
            String avail = String.format("%dMB free", f.getFreeSpace() / (1024 * 1024));
            if (isExisting(f)){
                title.append("*");
            }
            title.append(rt.shortName).append(" - ");
            if (isExternal) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    if (Environment.isExternalStorageRemovable(f)) {
                        title.append(" removable");
                    }
                    if (Environment.isExternalStorageEmulated(f)){
                        title.append(" emulated");
                    }
                }
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                StorageManager sm=ctx.getSystemService(StorageManager.class);
                if (sm != null){
                    StorageVolume sv=sm.getStorageVolume(f);
                    if (sv != null){
                        String d=sv.getDescription(ctx);
                        if (d != null){
                            title.append(" [").append(d).append("]");
                        }
                    }
                }
            }
            title.append(' ').append(avail);
            rt.title = title.toString();
        }
        return rt;
    }

    String getConfigBase(boolean ext){
        if (ext) return "external";
        return "internal";
    }
    String getConfig(boolean ext,int idx){
        if (! ext) return getConfigBase(false);
        if (idx == DEFAULT_EXT_IDX) return getConfigBase(true);
        return getConfigBase(true)+idx;
    }
    String getShortName(String configName, Context ctx){
        return configName;
    }

    /**
     * get a list of dirs we always create
     * and we use to check existance
     * @return the list ob subdirs
     */
    String [] getDefaultDirs(){
        return new String[]{"charts"};
    }

    public List<Entry> fill(Context ctx){
        entries.clear();
        File f=ctx.getFilesDir();
        Entry e=buildEntry(ctx,f,false,0);
        entries.add(e);
        File ext0=ctx.getExternalFilesDir(null);
        if (ext0 != null && ext0.canWrite()) {
            e = buildEntry(ctx,ext0, true, DEFAULT_EXT_IDX);
            entries.add(e);
        }
        int idx=DEFAULT_EXT_IDX+1;
        for (File ext: ctx.getExternalFilesDirs(null)){
            if (ext != null) {
                if (ext0 != null && ext.getAbsolutePath().equals(ext0.getAbsolutePath())) {
                    continue;
                }
                if (ext.canWrite()) {
                    e = buildEntry(ctx,ext,true,idx);
                    entries.add(e);
                }
            }
            idx++;
        }
        filled=true;
        return entries;
    }
    public List<Entry> getEntries(){
        return entries;
    }
    public Entry getEntryForConfig(Context ctx,String cfg){
        if (! filled) fill(ctx);
        for (Entry e: entries){
            if (e.getConfigName().equals(cfg)) return e;
        }
        return null;
    }
    public File getFileForConfig(Context ctx,String cfg) {
        Entry e=getEntryForConfig(ctx,cfg);
        if (e == null) return null;
        return e.getFile();
    }
    static class InvalidWorkdirException extends Exception{
        File f;
        public InvalidWorkdirException(File f,String s) {
            super(s);
            this.f=f;
        }

        public InvalidWorkdirException(String s) {
            super(s);
        }

        @Nullable
        @Override
        public String getMessage() {
            if (f == null) return super.getMessage();
            return "WorkDir "+f.getAbsolutePath()+" "+super.getMessage();
        }
    }
    /**
     *
     * @param ctx
     * @param cfg
     * @param mustExist
     *
     */
    public void checkValidConfig(Context ctx,String cfg,boolean mustExist) throws InvalidWorkdirException{
        if (! filled) fill(ctx);
        for (Entry e : entries){
            if (e.getConfigName().equals(cfg)){
                if (! mustExist) return;
                if (! isExisting(e.getFile())){
                    throw new InvalidWorkdirException(e.getFile()," does not exist");
                }
            }
        }
        throw new InvalidWorkdirException("workdir "+cfg+" not found");
    }
    public void createDirs(File base) throws IOException {
        if (! base.exists() || ! base.isDirectory()){
            throw new IOException("base dir "+base.getAbsolutePath()+" is no directory");
        }
        if (! base.canWrite()){
            throw new IOException("cannot write "+base.getAbsolutePath());
        }
        for (String s:getDefaultDirs()){
            File sdir=new File(base,s);
            if (sdir.exists()){
                if (! sdir.isDirectory()){
                    if (sdir.delete()){
                        throw new IOException(" sub dir "+sdir.getAbsolutePath()+" exists as file, cannot delete");
                    }
                }
                else{
                    continue;
                }
            }
            if (! sdir.mkdir()){
                throw new IOException("unable to create sub dir "+sdir.getAbsolutePath());
            }
        }
    }
}
