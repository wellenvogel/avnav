package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public interface IWorker {
    WorkerStatus getStatus();

    JSONObject getJsonStatus() throws JSONException;

    void setId(int id);
    int getId();
    JSONObject getEditableParameters(boolean includeCurrent,Context context) throws JSONException;
    JSONObject getConfig();

    JSONArray getParameterDescriptions(Context context) throws JSONException;

    void setParameters(JSONObject newParam, boolean replace) throws JSONException;
    void stop();
    boolean isStopped();
    void check() throws JSONException;
    String getTypeName();
    void start();
}
