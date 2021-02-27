package de.wellenvogel.avnav.settings;

import android.content.Context;
import android.preference.EditTextPreference;
import android.util.AttributeSet;

/**
 * Created by andreas on 11.12.16.
 */

public class ExternalDialogEditTextPreference extends EditTextPreference {
    public ExternalDialogEditTextPreference(Context context) {
        super(context);
    }

    public ExternalDialogEditTextPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public ExternalDialogEditTextPreference(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    /** we rely on some code to register an onClickListener and handle stuff there
     */
    @Override
    protected void onClick() {
        return;
    }
}
