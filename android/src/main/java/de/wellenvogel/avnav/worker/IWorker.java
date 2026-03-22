package de.wellenvogel.avnav.worker;

import android.content.Context;

import androidx.annotation.NonNull;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

public interface IWorker {
    public enum Kind {
        CHART("chart"),
        TRACK( "track"),
        ROUTE( "route"),
        LAYOUT("layout"),
        SETTINGS("settings"),
        PLUGINS("plugins"),
        CHANNEL("channel"),
        USER("user"),
        ADDON("addon"),
        OTHER("other");
        private Kind(String s){
            name=s;
        }
        public final String name;
        @NonNull
        public String toString(){
            return name;
        }
    }
    boolean isEnabled();

    interface PermissionCallback{
        void permissionNeeded(NeededPermissions perm);
    }

    Kind getKind();
    WorkerStatus getStatus();

    JSONObject getJsonStatus() throws JSONException;

    void setStatus(WorkerStatus.Status status, String info);

    void setId(int id);
    int getId();
    JSONObject getEditableParameters(String child, boolean includeCurrent, Context context) throws JSONException;
    JSONObject getConfig();

    JSONArray getParameterDescriptions(Context context) throws JSONException;

    void setParameters(String child, JSONObject newParam, boolean replace, boolean check) throws JSONException, IOException;
    void deleteChild(String child) throws Exception;
    void stop();

    void stopAndWait();

    boolean isStopped();
    void check() throws JSONException;
    String getTypeName();
    void start(PermissionCallback permissionCallback);
    public EditableParameter.EditableParameterInterface getParameter(EditableParameter.EditableParameterInterface nameAndType, boolean fallBack);

    void onResume();
}
