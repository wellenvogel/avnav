package de.wellenvogel.avnav.main;

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
import android.os.Environment;
import android.text.Editable;
import android.util.Log;
//import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewGroup.LayoutParams;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import de.wellenvogel.avnav.util.AvnDialogHandler;
import de.wellenvogel.avnav.util.DialogBuilder;

public class SimpleFileDialog
{
    public static final int DIALOGID=2;
    public int dialogId=DIALOGID;
    //some customization
    public String dialogTitle=null; //use this if set
    public String newFolderText="New Folder";
    public String newFolderNameText="New Folder Name";
    public int okButtonText=R.string.ok;
    public int cancelButtonText=R.string.cancel;

    public static final int FileOpen     = 0;
    public static final int FileSave     = 1;
    public static final int FolderChoose = 2;
    public static final int FolderChooseWrite=3;
    private int Select_type = FileSave;
    private String m_sdcardDirectory = "";
    private Activity m_context;
    private AvnDialogHandler handler;
    private DialogBuilder mBuilder;
    public String Default_File_Name = "default.txt";
    private String Selected_File_Name = Default_File_Name;

    private String m_dir = "";
    private List<FileEntry> m_subdirs = null;
    private SimpleFileDialogListener m_SimpleFileDialogListener = null;
    private ArrayAdapter<FileEntry> m_listAdapter = null;
    private TextView mSubHeader;

    //////////////////////////////////////////////////////
    // Callback interface for selected directory
    //////////////////////////////////////////////////////
    public interface SimpleFileDialogListener
    {
        public void onChosenDir(String chosenDir);
        public void onCancel();
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

    public SimpleFileDialog(Activity context, int file_select_type, SimpleFileDialogListener SimpleFileDialogListener)
    {
        Select_type = file_select_type;

        m_context = context;
        handler=new AvnDialogHandler(context);
        m_sdcardDirectory = Environment.getExternalStorageDirectory().getAbsolutePath();
        m_SimpleFileDialogListener = SimpleFileDialogListener;

        try
        {
            m_sdcardDirectory = new File(m_sdcardDirectory).getCanonicalPath();
        }
        catch (IOException ioe)
        {
        }
    }

    ///////////////////////////////////////////////////////////////////////
    // chooseFile_or_Dir() - load directory chooser dialog for initial
    // default sdcard directory
    ///////////////////////////////////////////////////////////////////////
    public void chooseFile_or_Dir()
    {
        // Initial directory is sdcard directory
        if (m_dir.equals(""))	chooseFile_or_Dir(m_sdcardDirectory);
        else chooseFile_or_Dir(m_dir);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // chooseFile_or_Dir(String dir) - load directory chooser dialog for initial
    // input 'dir' directory
    ////////////////////////////////////////////////////////////////////////////////
    public void chooseFile_or_Dir(String dir)
    {
        boolean startWithNewDir=false;
        File dirFile = new File(dir);
        if (! dirFile.exists() || ! dirFile.isDirectory())
        {
            File parent=dirFile.getParentFile();
            if (parent != null && parent.isDirectory() && (Select_type == FolderChoose || Select_type == FolderChooseWrite)){
                startWithNewDir=true;
                Default_File_Name=dirFile.getName();
                dir=parent.getAbsolutePath();
            }
            else {
                dir = m_sdcardDirectory;
            }
        }

        try
        {
            dir = new File(dir).getCanonicalPath();
        }
        catch (IOException ioe)
        {
            return;
        }

        m_dir = dir;
        m_subdirs = getDirectories(dir);



        mBuilder = createDirectoryChooserDialog(dir, m_subdirs);
        mSubHeader=(TextView)mBuilder.getContentView().findViewById(R.id.list_subtitle);
        mBuilder.setButton(cancelButtonText,DialogInterface.BUTTON_NEGATIVE, new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                handler.onCancel(dialogId);
                m_SimpleFileDialogListener.onCancel();
                dialog.dismiss();
            }
        });
        mBuilder.setButton(okButtonText,DialogInterface.BUTTON_POSITIVE, new OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                Boolean wantToCloseDialog = true;
                if (!handler.onOk(dialogId)) return;
                if (m_SimpleFileDialogListener != null) {
                    {
                        if (Select_type == FileOpen || Select_type == FileSave) {
                            //Selected_File_Name = input_text.getText() + "";
                            //m_SimpleFileDialogListener.onChosenDir(m_dir + "/" + Selected_File_Name);
                        } else {
                            if (Select_type == FolderChooseWrite && !(new File(m_dir)).canWrite()){
                                wantToCloseDialog = false;
                                Toast.makeText(	m_context, m_dir + " not writable", Toast.LENGTH_SHORT).show();
                            }
                            else {
                                m_SimpleFileDialogListener.onChosenDir(m_dir);
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

    private boolean createSubDir(String newDir)
    {
        File newDirFile = new File(newDir);
        if   (! newDirFile.exists() ) return newDirFile.mkdir();
        else return false;
    }

    private List<FileEntry> getDirectories(String dir)
    {
        List<FileEntry> dirs = new ArrayList<FileEntry>();
        try
        {
            File dirFile = new File(dir);


            if (! dirFile.exists() || ! dirFile.isDirectory())
            {
                return dirs;
            }

            // if directory is not the base sd card directory add ".." for going up one directory
            //if (! m_dir.equals(m_sdcardDirectory) )
            if (! m_dir.equals("/")) {
                File parent=new File(dirFile,"..");
                dirs.add(new FileEntry("..",parent.canWrite(),true));
            }

            File [] list=dirFile.listFiles();

            if (list != null) {
                for (File file : list) {
                    if (file.isDirectory()) {

                        dirs.add(new FileEntry(file.getName(), file.canWrite(), true));
                    } else if (Select_type == FileSave || Select_type == FileOpen) {
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

        DialogBuilder builder=new DialogBuilder(m_context,R.layout.dialog_edittext);
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
                if ( createSubDir(m_dir + "/" + newDirName) )
                {
                    // Navigate into the new directory
                    m_dir += "/" + newDirName;
                    updateDirectory();
                    dialog.dismiss();
                }
                else
                {
                    Toast.makeText(	m_context, "Failed to create '"
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
        DialogBuilder dialogBuilder = new DialogBuilder(m_context,R.layout.dialog_file);
        ////////////////////////////////////////////////
        // Create title text showing file select type //
        ////////////////////////////////////////////////
        if (dialogTitle != null){
            dialogBuilder.setTitle(dialogTitle);
        }
        else {
            if (Select_type == FileOpen) dialogBuilder.setTitle("Open:");
            if (Select_type == FileSave) dialogBuilder.setTitle("Save As:");
            if (Select_type == FolderChoose || Select_type == FolderChooseWrite) dialogBuilder.setTitle("Folder Select:");
        }

        dialogBuilder.createDialog();
        TextView subTitle=(TextView)dialogBuilder.getContentView().findViewById(R.id.list_subtitle);
        subTitle.setText(title);

        /*

        /////////////////////////////////////////////////////
        // Create View with folder path and entry text box //
        /////////////////////////////////////////////////////
        LinearLayout contentLayout = new LinearLayout(m_context);
        contentLayout.setOrientation(LinearLayout.VERTICAL);



        if (Select_type == FileOpen || Select_type == FileSave)
        {
            input_text = new EditText(m_context);
            input_text.setText(Default_File_Name);
            contentLayout.addView(input_text);
        }
        */
        if (Select_type == FolderChoose || Select_type == FolderChooseWrite|| Select_type == FileSave)
        {
            dialogBuilder.setButton(R.string.createFolder,DialogInterface.BUTTON_NEUTRAL, new DialogInterface.OnClickListener(){

                @Override
                public void onClick(DialogInterface dialog, int which) {
                    showNewDirDialog();
                }
            });
        }
        else dialogBuilder.hideButton(DialogInterface.BUTTON_NEUTRAL);
        ListView lv=(ListView)dialogBuilder.getContentView().findViewById(R.id.list_value);
        m_listAdapter = createListAdapter(listItems);
        lv.setAdapter(m_listAdapter);
        return dialogBuilder;
    }

    private void updateDirectory()
    {
        m_subdirs.clear();
        m_subdirs.addAll( getDirectories(m_dir) );

        mSubHeader.setText(m_dir);
        m_listAdapter.notifyDataSetChanged();
        //#scorch
        if (Select_type == FileSave || Select_type == FileOpen)
        {
            //input_text.setText(Selected_File_Name);
        }
    }

    private ArrayAdapter<FileEntry> createListAdapter(List<FileEntry> items)
    {
        return new ArrayAdapter<FileEntry>(m_context, android.R.layout.select_dialog_item, android.R.id.text1, items)
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
                        tv.setTextColor(m_context.getResources().getColor(R.color.colorTextSecondary));
                        //txt="*"+txt;
                    }
                    else {
                        tv.setTextColor(m_context.getResources().getColor(R.color.colorText));
                    }
                    tv.setText(txt);
                    tv.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            String m_dir_old = m_dir;
                            FileEntry entry=getItem(position);
                            String sel = entry.fileName;
                            if (sel.charAt(sel.length()-1) == '/')	sel = sel.substring(0, sel.length()-1);

                            // Navigate into the sub-directory
                            if (sel.equals(".."))
                            {
                                m_dir = m_dir.substring(0, m_dir.lastIndexOf("/"));
                                if (m_dir.equals(""))m_dir="/";
                            }
                            else
                            {
                                m_dir += "/" + sel;
                            }
                            Selected_File_Name = Default_File_Name;

                            if ((new File(m_dir).isFile())) // If the selection is a regular file
                            {
                                m_dir = m_dir_old;
                                Selected_File_Name = sel;
                            }
                            if (m_dir.startsWith("//")) m_dir=m_dir.substring(1);
                            updateDirectory();
                        }
                    });
                    //tv.setBackgroundColor(tv.getContext().getResources().getColor(android.R.color.background_dark));
                }
                return v;
            }

        };
    }
}