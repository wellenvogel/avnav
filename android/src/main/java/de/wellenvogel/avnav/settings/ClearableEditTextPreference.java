package de.wellenvogel.avnav.settings;

import android.content.Context;
import android.content.DialogInterface;
import android.util.AttributeSet;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.DialogBuilder;

/**
 * Created by andreas on 29.11.15.
 */
public class ClearableEditTextPreference extends OwnDialogEditTextPreference {

    public ClearableEditTextPreference(Context context) {
        super(context);
    }

    public ClearableEditTextPreference(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onShowDialog(DialogBuilder b) {
        super.onShowDialog(b);
        b.setButton(R.string.clear,DialogInterface.BUTTON_NEUTRAL);
    }
    @Override
    public void onClick(DialogInterface dialog, int which) {
        if (which == DialogInterface.BUTTON_NEUTRAL) setText("");
        super.onClick(dialog, which);
    }
}
