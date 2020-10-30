package de.wellenvogel.avnav.appapi;

import android.content.res.AssetManager;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;

import de.wellenvogel.avnav.util.AvnLog;

public class UserDirectoryRequestHandler extends DirectoryRequestHandler {
    private static String templateFiles[]=new String[]{"user.css","user.js"};
    private static String emptyJsonFiles[]=new String[]{"keys.json","images.json"};
    public UserDirectoryRequestHandler(RequestHandler handler, IDeleteByUrl deleter) throws IOException {
        super(handler, RequestHandler.TYPE_USER, RequestHandler.typeDirs.get(RequestHandler.TYPE_USER).value, "user/viewer", deleter);
        AssetManager assets=handler.activity.getAssets();
        for (String filename : templateFiles){
            File file=new File(workDir,filename);
            if (! file.exists()){
                String templateName="viewer/"+filename;
                try {
                    InputStream src = assets.open(templateName);
                    AvnLog.i("creating user file " + filename + " from template");
                    FileOutputStream out=new FileOutputStream(file);
                    byte buffer[]=new byte[10000];
                    int rd=0;
                    while ((rd=src.read(buffer)) >=0 ){
                        out.write(buffer,0,rd);
                    }
                    out.close();
                    src.close();
                }catch (Throwable t){
                    AvnLog.e("unable to copy template "+templateName,t);
                }
            }
        }
        for (String filename : emptyJsonFiles){
            File file=new File(workDir,filename);
            if (! file.exists()){
                try {
                    AvnLog.i("creating empty user file " + filename );
                    PrintWriter out= new PrintWriter(new FileOutputStream(file));
                    out.println("{ }");
                    out.close();
                }catch (Throwable t){
                    AvnLog.e("unable to create "+filename,t);
                }
            }
        }
    }
}
