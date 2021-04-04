package de.wellenvogel.avnav.worker;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import de.wellenvogel.avnav.util.AvnUtil;

public class WorkerStatus implements AvnUtil.IJsonObect {
    WorkerStatus(String typeName){
        this.typeName = typeName;
    }
    WorkerStatus(WorkerStatus other){
        typeName =other.typeName;
        canEdit=other.canEdit;
        canDelete=other.canDelete;
        id=other.id;
        typeName =other.typeName;
        status=other.status;
        info=other.info;
    }
    boolean canEdit=false;
    boolean canDelete=false;
    boolean disabled=false;
    int id;
    String typeName;
    public static enum Status{
        INACTIVE,
        STARTED,
        RUNNING,
        NMEA,
        ERROR
    }
    Status status= Status.INACTIVE;
    String info;

    @Override
    public JSONObject toJson() throws JSONException {
        JSONObject rt=new JSONObject();
        rt.put("canEdit",canEdit);
        rt.put("canDelete",canDelete);
        rt.put("disabled",disabled);
        rt.put("id",id);
        rt.put("name", typeName);
        rt.put("configName",typeName);
        JSONObject sto=new JSONObject();
        sto.put("name", typeName);
        //currently we do not have children - but the JS side expects an array
        JSONArray children=new JSONArray();
        JSONObject main=new JSONObject(); //WorkerStatus in python
        main.put("name","main");
        main.put("info",info);
        main.put("status",status.toString());
        children.put(main);
        sto.put("items",children);
        rt.put("info",sto);
        return rt;
    }

}
