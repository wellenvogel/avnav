package de.wellenvogel.avnav.util;

import android.app.Activity;
import android.app.Fragment;
import android.support.v7.internal.view.menu.ActionMenuItem;
import android.support.v7.widget.Toolbar;
import android.view.MenuItem;
import android.view.View;

import de.wellenvogel.avnav.main.R;

/**
 * Created by andreas on 17.12.16.
 */

public class ActionBarHandler {

    private Activity mParent;
    private Toolbar mToolbar;
    public ActionBarHandler(Activity parent,int menuId){
        mParent=parent;
        mToolbar=(Toolbar)parent.findViewById(R.id.toolbar);
        if (mToolbar == null){
            throw new RuntimeException("toolbar not found in view ");
        }
        if (menuId != 0) mToolbar.inflateMenu(menuId);
    }
    public ActionBarHandler setTitle(CharSequence title){
        mToolbar.setTitle(title);
        return this;
    }
    public ActionBarHandler setTitle(int title){
        mToolbar.setTitle(title);
        return this;
    }
    public ActionBarHandler setOnMenuItemClickListener(final Toolbar.OnMenuItemClickListener listener){
        mToolbar.setOnMenuItemClickListener(listener);
        mToolbar.setNavigationOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                listener.onMenuItemClick(new ActionMenuItem(mToolbar.getContext(),0,android.R.id.home,0,0,"home"));
            }
        });
        return this;
    }
    public ActionBarHandler setOnMenuItemClickListener(final Fragment listener){
        mToolbar.setOnMenuItemClickListener(new Toolbar.OnMenuItemClickListener() {
            @Override
            public boolean onMenuItemClick(MenuItem menuItem) {
                return listener.onOptionsItemSelected(menuItem);
            }
        });
        mToolbar.setNavigationOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                listener.onOptionsItemSelected(new ActionMenuItem(mToolbar.getContext(),0,android.R.id.home,0,0,"home"));
            }
        });
        return this;
    }
    public ActionBarHandler setOnMenuItemClickListener(final Activity listener){
        mToolbar.setOnMenuItemClickListener(new Toolbar.OnMenuItemClickListener() {
            @Override
            public boolean onMenuItemClick(MenuItem menuItem) {
                return listener.onOptionsItemSelected(menuItem);
            }
        });
        mToolbar.setNavigationOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                listener.onOptionsItemSelected(new ActionMenuItem(mToolbar.getContext(),0,android.R.id.home,0,0,"home"));
            }
        });
        return this;
    }
    public ActionBarHandler hide(){
        mToolbar.setVisibility(View.GONE);
        mToolbar.setOnMenuItemClickListener(null);
        mToolbar.setNavigationOnClickListener(null);
        return this;
    }
    public ActionBarHandler show(){
        mToolbar.setVisibility(View.VISIBLE);
        return this;
    }
}
