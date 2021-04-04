package de.wellenvogel.avnav.worker;

import org.json.JSONException;
import org.json.JSONObject;

public interface IWorker {
    WorkerStatus getStatus();
    void setId(int id);
    int getId();
    JSONObject getEditableParameters(boolean includeCurrent) throws JSONException;
    void setParameters(JSONObject newParam) throws JSONException;
    void stop();
    boolean isStopped();
    void check() throws JSONException;
    String getTypeName();
    void start();
}
