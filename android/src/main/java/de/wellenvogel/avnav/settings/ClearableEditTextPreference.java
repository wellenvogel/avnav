package de.wellenvogel.avnav.settings;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.preference.EditTextPreference;
import android.util.AttributeSet;

import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 29.11.15.
 */
public class ClearableEditTextPreference extends EditTextPreference {

    public ClearableEditTextPreference(Context context) {
        super(context);
    }

    public ClearableEditTextPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onPrepareDialogBuilder(AlertDialog.Builder builder) {
        super.onPrepareDialogBuilder(builder);
        builder.setNeutralButton(R.string.clear, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                ClearableEditTextPreference.this.setText("");
            }
        });
    }
}
