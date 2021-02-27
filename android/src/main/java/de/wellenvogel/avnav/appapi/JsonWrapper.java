package de.wellenvogel.avnav.appapi;

import org.json.JSONException;
import org.json.JSONObject;

public class JsonWrapper implements INavRequestHandler.IJsonObect {
    JSONObject o;
    public JsonWrapper(JSONObject o){
        this.o=o;
    }
    @Override
    public JSONObject toJson() throws JSONException {
        return o;
    }
}
