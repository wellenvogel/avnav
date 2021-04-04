package de.wellenvogel.avnav.worker;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public interface IWorker {
    WorkerStatus getStatus();

    JSONObject getJsonStatus() throws JSONException;

    void setId(int id);
    int getId();
    JSONObject getEditableParameters(boolean includeCurrent) throws JSONException;
    JSONObject getConfig();

    JSONArray getParameterDescriptions() throws JSONException;

    void setParameters(JSONObject newParam, boolean replace) throws JSONException;
    void stop();
    boolean isStopped();
    void check() throws JSONException;
    String getTypeName();
    void start();
}
