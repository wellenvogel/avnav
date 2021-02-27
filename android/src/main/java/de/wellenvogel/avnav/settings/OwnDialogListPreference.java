package de.wellenvogel.avnav.settings;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Bundle;
import android.preference.ListPreference;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Adapter;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.BaseAdapter;
import android.widget.ListAdapter;
import android.widget.ListView;
import android.widget.TextView;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.DialogBuilder;

/**
 * Created by andreas on 11.12.16.
 */

public class OwnDialogListPreference extends ListPreference {


    public OwnDialogListPreference(Context context) {
        super(context);
    }

    public OwnDialogListPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }


    private DialogBuilder mDialogBuilder;
    private CharSequence[] mEntryValues;
    private CharSequence[] mEntryNames;
    private int mClickedDialogEntryIndex=0;

    @Override
    protected void onDialogClosed(boolean positiveResult) {
        if (positiveResult && mClickedDialogEntryIndex >= 0 && mEntryValues != null) {
            String value = mEntryValues[mClickedDialogEntryIndex].toString();
            if (callChangeListener(value)) {
                setValue(value);
            }
        }

    }
    private int findIndexOf(String value) {
        if (value != null && mEntryValues != null) {
            for (int i = mEntryValues.length - 1; i >= 0; i--) {
                if (mEntryValues[i].equals(value)) {
                    return i;
                }
            }
        }
        return -1;
    }
    @Override
    protected void showDialog(Bundle state) {
        Context context = getContext();
        if (mDialogBuilder == null){
            mDialogBuilder=new DialogBuilder(context,R.layout.dialog_selectlist);
        }
        mEntryValues=getEntryValues();
        mEntryNames=getEntries();
        mClickedDialogEntryIndex=findIndexOf(getValue());
        mDialogBuilder.setTitle(getTitle());
        AlertDialog dialog=mDialogBuilder.createDialog();
        ListView lv=(ListView)mDialogBuilder.getContentView().findViewById(R.id.list_value);
        ListAdapter adapter=new ArrayAdapter<String>(context,R.layout.list_item, (String[]) mEntryNames);
        lv.setAdapter(adapter);
        lv.setItemChecked(mClickedDialogEntryIndex,true);
        lv.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                mClickedDialogEntryIndex=position;
                onClick(mDialogBuilder.getDialog(), DialogInterface.BUTTON_POSITIVE);
                mDialogBuilder.getDialog().dismiss();
            }
        });
        dialog.setOnDismissListener(this);
        mDialogBuilder.setButton(R.string.cancel,DialogInterface.BUTTON_NEGATIVE);
        dialog.show();
    }

    @Override
    public Dialog getDialog() {
        return mDialogBuilder.getDialog();
    }

    public AlertDialog getAlertDialog(){
        return mDialogBuilder.getDialog();
    }
}
