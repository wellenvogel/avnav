package de.wellenvogel.avnav.worker;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

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
        disabled=other.disabled;
        for (String k:other.children.keySet()){
            children.put(k,other.children.get(k));
        }
    }
    public synchronized WorkerStatus copy(){
        return new WorkerStatus(this);
    }
    public boolean canEdit=false;
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
    public synchronized void update(Status status,String info){
        this.status=status;
        this.info=info;
    }
    private static class Child{
        Status status;
        String info;
        Child(Child other){
            status=other.status;
            info=other.info;
        }
        Child(){}
    }
    private final HashMap<String,Child> children=new HashMap<>();
    public  synchronized void setChildStatus(String name,Status status,String info){
        Child child=children.get(name);
        if (child == null){
            child=new Child();
            children.put(name,child);
        }
        child.status=status;
        child.info=info;
    }
    public synchronized void unsetChildStatus(String name){
        children.remove(name);
    }
    public synchronized void removeChildren(){
        children.clear();
    }

    @Override
    public synchronized JSONObject toJson() throws JSONException {
        JSONObject rt=new JSONObject();
        rt.put("canEdit",canEdit);
        rt.put("canDelete",canDelete);
        rt.put("disabled",disabled);
        rt.put("id",id);
        rt.put("name", typeName);
        rt.put("configName",typeName);
        JSONObject sto=new JSONObject();
        sto.put("name", typeName);
        JSONArray cha=new JSONArray();
        JSONObject main=new JSONObject(); //WorkerStatus in python
        main.put("name","main");
        main.put("info",info);
        main.put("status",status.toString());
        cha.put(main);
        for (String k :children.keySet()){
            JSONObject cho=new JSONObject();
            cho.put("name",k);
            Child ch=children.get(k);
            cho.put("info",ch.info);
            cho.put("status",ch.status.toString());
            cha.put(cho);
        }
        sto.put("items",cha);
        rt.put("info",sto);
        return rt;
    }

}
