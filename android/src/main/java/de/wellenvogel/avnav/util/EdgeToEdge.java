package de.wellenvogel.avnav.util;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import de.wellenvogel.avnav.main.R;

public final class EdgeToEdge {
    private EdgeToEdge() {
    }

    public static void configure(Activity activity) {
        configure(activity, false);
    }

    public static void configure(Activity activity, boolean hideSystemBars) {
        if (Build.VERSION.SDK_INT < 35) return;

        TypedValue value = new TypedValue();
        activity.getTheme().resolveAttribute(androidx.appcompat.R.attr.colorPrimaryDark, value, true);
        WindowCompat.setDecorFitsSystemWindows(activity.getWindow(), false);
        View content = activity.findViewById(android.R.id.content);
        View statusBarScrim = addStatusBarScrim(activity, value.data);
        statusBarScrim.setVisibility(hideSystemBars ? View.GONE : View.VISIBLE);
        InsetsState state = new InsetsState(content, hideSystemBars, statusBarScrim);
        content.setTag(R.id.edgeToEdgeState, state);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets statusBar = windowInsets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars());
            Insets cutout = windowInsets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.displayCutout());
            if (state.statusBarScrim != null) {
                state.statusBarScrim.setVisibility(state.hideSystemBars ? View.GONE : View.VISIBLE);
                ViewGroup.LayoutParams params = state.statusBarScrim.getLayoutParams();
                params.height = Math.max(statusBar.top, cutout.top);
                state.statusBarScrim.setLayoutParams(params);
            }
            Insets bars;
            if (state.hideSystemBars) {
                Insets visibleCutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());
                bars = Insets.of(visibleCutout.left, Math.max(cutout.top, statusBar.top),
                        visibleCutout.right, visibleCutout.bottom);
                view.setBackgroundColor(Color.BLACK);
            } else {
                bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()
                        | WindowInsetsCompat.Type.displayCutout());
                view.setBackground(state.background);
            }
            view.setPadding(state.left + bars.left, state.top + bars.top,
                    state.right + bars.right, state.bottom + bars.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(content);
    }

    private static View addStatusBarScrim(Activity activity, int color) {
        ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
        View scrim = new View(activity);
        scrim.setBackgroundColor(color);
        scrim.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        decor.addView(scrim, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, android.view.Gravity.TOP));
        return scrim;
    }

    public static void setSystemBarsHidden(Activity activity, boolean hidden) {
        if (Build.VERSION.SDK_INT < 35) return;
        View content = activity.findViewById(android.R.id.content);
        Object tag = content.getTag(R.id.edgeToEdgeState);
        InsetsState state = tag instanceof InsetsState ? (InsetsState) tag : null;
        if (state == null || state.hideSystemBars == hidden) return;
        state.hideSystemBars = hidden;
        ViewCompat.requestApplyInsets(content);
    }

    private static final class InsetsState {
        final int left;
        final int top;
        final int right;
        final int bottom;
        final Drawable background;
        final View statusBarScrim;
        boolean hideSystemBars;

        InsetsState(View content, boolean hideSystemBars, View statusBarScrim) {
            left = content.getPaddingLeft();
            top = content.getPaddingTop();
            right = content.getPaddingRight();
            bottom = content.getPaddingBottom();
            background = content.getBackground();
            this.statusBarScrim = statusBarScrim;
            this.hideSystemBars = hideSystemBars;
        }
    }
}
