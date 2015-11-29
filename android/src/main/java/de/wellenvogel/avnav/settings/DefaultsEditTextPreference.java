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
public class DefaultsEditTextPreference extends EditTextPreference {

    private String defaultValue;

    public DefaultsEditTextPreference(Context context) {
        super(context);
    }

    public DefaultsEditTextPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onPrepareDialogBuilder(AlertDialog.Builder builder) {
        super.onPrepareDialogBuilder(builder);
        if (defaultValue != null) {
            builder.setNeutralButton(R.string.setDefault, new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    DefaultsEditTextPreference.this.setText(defaultValue);
                }
            });
        }
    }
    public void setDefaultValue(String defaultValue){
        this.defaultValue=defaultValue;
    }
}
