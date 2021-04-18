package de.wellenvogel.avnav.appapi;

import org.json.JSONException;
import org.json.JSONObject;

import de.wellenvogel.avnav.util.AvnUtil;

public class JsonWrapper implements AvnUtil.IJsonObect {
    JSONObject o;
    public JsonWrapper(JSONObject o){
        this.o=o;
    }
    @Override
    public JSONObject toJson() throws JSONException {
        return o;
    }
}
