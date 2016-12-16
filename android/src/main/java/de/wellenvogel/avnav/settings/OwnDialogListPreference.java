package de.wellenvogel.avnav.settings;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Bundle;
import android.preference.EditTextPreference;
import android.preference.ListPreference;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.CheckedTextView;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;

import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 11.12.16.
 */

public class OwnDialogListPreference extends ListPreference {
     class CustomAdapter extends BaseAdapter {
        private LayoutInflater inflater;
        CustomAdapter() {

            inflater = (LayoutInflater.from(getContext()));

        }

        @Override
        public int getCount() {
            return mEntryValues.length;
        }

        @Override
        public Object getItem(int position) {
            return null;
        }

        @Override
        public long getItemId(int position) {
            return 0;
        }

        @Override
        public View getView(final int position, View view, ViewGroup parent) {
            view = inflater.inflate(R.layout.list_item, null);
            final TextView simpleCheckedTextView = (TextView) view.findViewById(R.id.checkedTextView);
            simpleCheckedTextView.setText(mEntryNames[position]);
            if (position == mClickedDialogEntryIndex) simpleCheckedTextView.setSelected(true);
            // perform on Click Event Listener on CheckedTextView
            view.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    selectItemClicked(position);
                }
            });
            return view;
        }
    }

    public OwnDialogListPreference(Context context) {
        super(context);
    }

    public OwnDialogListPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    private void selectItemClicked(int idx){
        mClickedDialogEntryIndex=idx;
        onClick(mDialogBuilder.getDialog(), DialogInterface.BUTTON_POSITIVE);
        mDialogBuilder.getDialog().dismiss();
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
        lv.setAdapter(new CustomAdapter());
        dialog.setOnDismissListener(this);
        mDialogBuilder.setButton(R.id.lspButton2,R.string.cancel,DialogInterface.BUTTON_NEGATIVE);
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
