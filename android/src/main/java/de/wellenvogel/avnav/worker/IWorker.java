package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

public interface IWorker {
    WorkerStatus getStatus();

    JSONObject getJsonStatus() throws JSONException;

    void setStatus(WorkerStatus.Status status, String info);

    void setId(int id);
    int getId();
    JSONObject getEditableParameters(boolean includeCurrent,Context context) throws JSONException;
    JSONObject getConfig();

    JSONArray getParameterDescriptions(Context context) throws JSONException;

    void setParameters(JSONObject newParam, boolean replace,boolean check) throws JSONException, IOException;
    void stop();

    void stopAndWait();

    boolean isStopped();
    void check() throws JSONException;
    String getTypeName();
    void start();

}
