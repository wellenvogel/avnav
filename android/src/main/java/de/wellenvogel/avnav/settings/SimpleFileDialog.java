package de.wellenvogel.avnav.settings;

// SimpleFileDialog.java


/*
*
* This file is licensed under The Code Project Open License (CPOL) 1.02
* http://www.codeproject.com/info/cpol10.aspx
* http://www.codeproject.com/info/CPOL.zip
*
* License Preamble:
* This License governs Your use of the Work. This License is intended to allow developers to use the Source
* Code and Executable Files provided as part of the Work in any application in any form.
*
* The main points subject to the terms of the License are:
*    Source Code and Executable Files can be used in commercial applications;
*    Source Code and Executable Files can be redistributed; and
*    Source Code can be modified to create derivative works.
*    No claim of suitability, guarantee, or any warranty whatsoever is provided. The software is provided "as-is".
*    The Article(s) accompanying the Work may not be distributed or republished without the Author's consent
*
* This License is entered between You, the individual or other entity reading or otherwise making use of
* the Work licensed pursuant to this License and the individual or other entity which offers the Work
* under the terms of this License ("Author").
*  (See Links above for full license text)
*/

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.DialogInterface.OnClickListener;
//import android.content.DialogInterface.OnKeyListener;
import android.text.Editable;
import android.util.Log;
//import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewGroup.LayoutParams;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import de.wellenvogel.avnav.main.Constants;
import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnDialogHandler;
import de.wellenvogel.avnav.util.DialogBuilder;

public class SimpleFileDialog
{
    public static final int DIALOGID=2;
    public static final int FileOpen     = 0;
    public static final int FileSave     = 1;
    public static final int FolderChoose = 2;
    public static final int FolderChooseWrite=3;
    public static final int FileOpenDefault =4;
    private int dialogId=DIALOGID;
    //some customization
    public String dialogTitle=null; //use this if set
    public String newFolderText="New Folder";
    public String newFolderNameText="New Folder Name";
    public String Selected_File_Name = "";
    public String Default_File_Name=null;


    private int okButtonText= R.string.ok;
    private int cancelButtonText=R.string.cancel;

    private int dialogType = FileSave;
    private Activity context;
    private AvnDialogHandler handler;

    private File currentDir = null;
    private List<FileEntry> subdirs = null;
    private SimpleFileDialogListener listener = null;
    private ArrayAdapter<FileEntry> adapter = null;
    private TextView subHeader;


    //////////////////////////////////////////////////////
    // Callback interface for selected directory
    //////////////////////////////////////////////////////
    public interface SimpleFileDialogListener
    {
        public void onChosenDir(File chosenDir);
        public void onCancel();
        public void onDefault();
    }

    //////////////////////////////////////////////////////
    // a directory/file entry
    //////////////////////////////////////////////////////
    private class FileEntry{
        String fileName;
        boolean isWritable=false;
        boolean isDir=false;
        FileEntry(String name,boolean wr,boolean dir){
            this.fileName=name;
            this.isWritable=wr;
            this.isDir=dir;
        }
    }

    public SimpleFileDialog(Activity context, int file_select_type, SimpleFileDialogListener listener)
    {
        dialogType = file_select_type;

        this.context = context;
        handler=new AvnDialogHandler(context);
        this.listener=listener;

    }

    public void setStartDir(String dir) throws Exception{
        if (dir == null || dir.isEmpty()) throw new Exception("file dialog without dir");
        File dirFile = new File(dir);
        if (! dirFile.exists()) throw new Exception(dir+" does not exist, need an existing file to start");
        if (! dirFile.isDirectory())
        {
            File parent=dirFile.getParentFile();
            if (parent == null || ! parent.isDirectory()) throw new Exception("parent of "+dir+" is no directory");
            Selected_File_Name=dirFile.getName();
            dirFile=parent;
        }
        currentDir = dirFile;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // chooseFile_or_Dir(String dir) - load directory chooser dialog for initial
    // input 'dir' directory
    ////////////////////////////////////////////////////////////////////////////////
    public void chooseFile_or_Dir(boolean startWithNewDir)  {
        if (currentDir == null) return;
        subdirs = getDirectories(currentDir);
        DialogBuilder mBuilder = createDirectoryChooserDialog(currentDir.getAbsolutePath(), subdirs);
        subHeader =(TextView) mBuilder.getContentView().findViewById(R.id.list_subtitle);
        mBuilder.setButton(cancelButtonText,DialogInterface.BUTTON_NEGATIVE, new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                handler.onCancel(dialogId);
                listener.onCancel();
                dialog.dismiss();
            }
        });
        mBuilder.setButton(okButtonText,DialogInterface.BUTTON_POSITIVE, new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                Boolean wantToCloseDialog = true;
                if (!handler.onOk(dialogId)) return;
                if (listener != null) {
                    {
                        if ((dialogType == FileOpen || dialogType == FileOpenDefault) && Selected_File_Name != null ) {
                            listener.onChosenDir(new File(currentDir,Selected_File_Name));
                        } else {
                            if (dialogType == FolderChooseWrite && !(currentDir.canWrite())){
                                wantToCloseDialog = false;
                                Toast.makeText(context, currentDir + " not writable", Toast.LENGTH_SHORT).show();
                            }
                            else {
                                listener.onChosenDir(currentDir);
                            }
                        }
                    }
                }
                //Do stuff, possibly set wantToCloseDialog to true then...
                if (wantToCloseDialog)
                    dialog.dismiss();
            }
        });

        final AlertDialog dirsDialog = mBuilder.getDialog();
        // Show directory chooser dialog
        dirsDialog.show();
        if (startWithNewDir){
            showNewDirDialog();
        }
    }

    private boolean createSubDir(File newDirFile)
    {
        if   (! newDirFile.exists() ) return newDirFile.mkdir();
        else return false;
    }

    private List<FileEntry> getDirectories(File dirFile)
    {
        List<FileEntry> dirs = new ArrayList<FileEntry>();
        try
        {

            if (! dirFile.exists() || ! dirFile.isDirectory())
            {
                return dirs;
            }

            // if directory is not the base sd card directory add ".." for going up one directory
            //if (! currentDir.equals(m_sdcardDirectory) )
            if (! currentDir.equals("/")) {
                File parent=new File(dirFile,"..");

                    dirs.add(new FileEntry("..",parent.canWrite(),true));
            }

            File [] list=dirFile.listFiles();

            if (list != null) {
                for (File file : list) {
                    if (file.isDirectory()) {

                        dirs.add(new FileEntry(file.getName(), file.canWrite(), true));
                    } else if (dialogType == FileSave || dialogType == FileOpen || dialogType == FileOpenDefault) {
                        // Add file names to the list if we are doing a file save or file open operation
                        dirs.add(new FileEntry(file.getName(), file.canWrite(), false));
                    }
                }
            }
        }
        catch (Exception e)	{
            Log.e(Constants.LOGPRFX,"exception while reading directory: "+e);
            e.printStackTrace();
        }

        Collections.sort(dirs, new Comparator<FileEntry>()
        {
            public int compare(FileEntry o1, FileEntry o2)
            {
                return o1.fileName.compareTo(o2.fileName);
            }
        });
        return dirs;
    }

    private void showNewDirDialog(){

        DialogBuilder builder=new DialogBuilder(context,R.layout.dialog_edittext);
        builder.setTitle(newFolderNameText);
        builder.createDialog();
        final EditText input=(EditText)builder.getContentView().findViewById(R.id.value);
        if (Default_File_Name != null) input.setText(Default_File_Name);

        // Show new folder name input dialog
        builder.setButton(okButtonText,DialogInterface.BUTTON_POSITIVE, new DialogInterface.OnClickListener()
        {
            public void onClick(DialogInterface dialog, int whichButton)
            {
                Editable newDir = input.getText();
                String newDirName = newDir.toString();
                // Create new directory
                if ( createSubDir(new File(currentDir,newDirName)) )
                {
                    // Navigate into the new directory
                    currentDir = new File(currentDir,newDirName);
                    updateDirectory();
                    dialog.dismiss();
                }
                else
                {
                    Toast.makeText(context, "Failed to create '"
                            + newDirName + "' folder", Toast.LENGTH_SHORT).show();
                }
            }
        });
        builder.setButton(cancelButtonText, DialogInterface.BUTTON_NEGATIVE);
        builder.getDialog().show();
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////                                   START DIALOG DEFINITION                                    //////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    private DialogBuilder createDirectoryChooserDialog(String title, List<FileEntry> listItems)
    {
        DialogBuilder dialogBuilder = new DialogBuilder(context,R.layout.dialog_file);
        ////////////////////////////////////////////////
        // Create title text showing file select type //
        ////////////////////////////////////////////////
        if (dialogTitle != null){
            dialogBuilder.setTitle(dialogTitle);
        }
        else {
            if (dialogType == FileOpen|| dialogType == FileOpenDefault) dialogBuilder.setTitle("Open:");
            if (dialogType == FileSave) dialogBuilder.setTitle("Save As:");
            if (dialogType == FolderChoose || dialogType == FolderChooseWrite) dialogBuilder.setTitle("Folder Select:");
        }

        dialogBuilder.createDialog();
        TextView subTitle=(TextView)dialogBuilder.getContentView().findViewById(R.id.list_subtitle);
        subTitle.setText(title);

        /*

        /////////////////////////////////////////////////////
        // Create View with folder path and entry text box //
        /////////////////////////////////////////////////////
        LinearLayout contentLayout = new LinearLayout(context);
        contentLayout.setOrientation(LinearLayout.VERTICAL);



        if (dialogType == FileOpen || dialogType == FileSave)
        {
            input_text = new EditText(context);
            input_text.setText(Default_File_Name);
            contentLayout.addView(input_text);
        }
        */
        if (dialogType == FolderChoose || dialogType == FolderChooseWrite|| dialogType == FileSave)
        {
            dialogBuilder.setButton(R.string.createFolder,DialogInterface.BUTTON_NEUTRAL, new DialogInterface.OnClickListener(){

                @Override
                public void onClick(DialogInterface dialog, int which) {
                    showNewDirDialog();
                }
            });
        }
        else if (dialogType == FileOpenDefault){
            dialogBuilder.setButton(R.string.setDefault,DialogInterface.BUTTON_NEUTRAL, new DialogInterface.OnClickListener(){

                @Override
                public void onClick(DialogInterface dialog, int which) {
                    if (listener != null){
                        listener.onDefault();
                    }
                    dialog.dismiss();
                }
            });
        }
        else dialogBuilder.hideButton(DialogInterface.BUTTON_NEUTRAL);
        ListView lv=(ListView)dialogBuilder.getContentView().findViewById(R.id.list_value);
        adapter = createListAdapter(listItems);
        lv.setAdapter(adapter);
        return dialogBuilder;
    }

    private void updateDirectory() {
        subdirs.clear();
        subdirs.addAll( getDirectories(currentDir) );

        try {
            subHeader.setText(currentDir.getCanonicalPath());
        } catch (IOException e) {
            //TODO
        }
        adapter.notifyDataSetChanged();
        //#scorch
        if (dialogType == FileSave || dialogType == FileOpen || dialogType ==FileOpenDefault)
        {
            //Selected_File_Name=null;
            //input_text.setText(Selected_File_Name);
        }
    }

    private ArrayAdapter<FileEntry> createListAdapter(List<FileEntry> items)
    {
        return new ArrayAdapter<FileEntry>(context, android.R.layout.select_dialog_item, android.R.id.text1, items)
        {
            @Override
            public View getView(final int position, View convertView, ViewGroup parent)
            {
                View v = super.getView(position, convertView, parent);
                if (v instanceof TextView)
                {
                    // Enable list item (directory) text wrapping
                    TextView tv = (TextView) v;
                    tv.getLayoutParams().height = LayoutParams.WRAP_CONTENT;

                    tv.setEllipsize(null);
                    String txt=getItem(position).fileName;
                    if (getItem(position).isDir) txt+="/";
                    if (!getItem(position).isWritable){
                        tv.setTextColor(context.getResources().getColor(R.color.colorTextSecondary));
                        //txt="*"+txt;
                    }
                    else {
                        tv.setTextColor(context.getResources().getColor(R.color.colorText));
                    }
                    if (Selected_File_Name != null && txt.equals(Selected_File_Name) && ! getItem(position).isDir){
                        tv.setBackgroundColor(context.getResources().getColor(R.color.colorSelection));
                    }
                    tv.setText(txt);
                    tv.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            FileEntry entry=getItem(position);
                            String sel = entry.fileName;
                            if (sel.charAt(sel.length()-1) == '/')	sel = sel.substring(0, sel.length()-1);

                            // Navigate into the sub-directory
                            if (sel.equals(".."))
                            {
                                File parent=currentDir.getParentFile();
                                if (parent != null) {
                                    if (parent.canRead()) currentDir = parent;
                                }
                            }
                            else
                            {
                                File selection=new File(currentDir,sel);
                                if (selection.isFile()){
                                    Selected_File_Name=sel;
                                    v.setBackgroundColor(context.getResources().getColor(R.color.colorSelection));
                                }
                                else {
                                    currentDir =selection;
                                }
                            }
                            updateDirectory();
                        }
                    });
                }
                return v;
            }

        };
    }
}