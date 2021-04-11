package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

public abstract class Worker implements IWorker {
    static final EditableParameter.StringParameter FILTER_PARAM=
            new EditableParameter.StringParameter("filter", R.string.labelSettingsNmeaFilter,"");
    static final EditableParameter.StringParameter SEND_FILTER_PARAM=
            new EditableParameter.StringParameter("sendFilter",R.string.labelSettingsNmeaOutFilter,"");
    static final EditableParameter.BooleanParameter SEND_DATA_PARAMETER=
            new EditableParameter.BooleanParameter("sendOut",R.string.labelSettingsSendData,false);
    static final EditableParameter.BooleanParameter READ_DATA_PARAMETER=
            new EditableParameter.BooleanParameter("readData",R.string.labelSettingsReadData,false);
    public static final EditableParameter.BooleanParameter ENABLED_PARAMETER=
            new EditableParameter.BooleanParameter("enabled",R.string.labelSettingsEnabled,true);
    static final EditableParameter.StringParameter IPADDRESS_PARAMETER=
            new EditableParameter.StringParameter("ipaddress",R.string.labelSettingsIpAddress,null);
    static final EditableParameter.IntegerParameter IPPORT_PARAMETER=
            new EditableParameter.IntegerParameter("port",R.string.labelSettingsIpPort,null);
    static final EditableParameter.StringParameter SOURCENAME_PARAMETER=
            new EditableParameter.StringParameter("name",R.string.labelSettingsSource,"");
    static final EditableParameter.StringParameter TYPENAME_PARAMETER=
            new EditableParameter.StringParameter("typeName"); //not intended to be edited
    static final EditableParameter.StringListParameter BAUDRATE_PARAMETER=
            new EditableParameter.StringListParameter("baud rate",R.string.labelSettingsBaud,"9600",
                    "1200","2400","4800","9600","14400","19200","28800","38400","57600","115200","230400");
    static final EditableParameter.IntegerParameter TIMEOFFSET_PARAMETER=
            new EditableParameter.IntegerParameter("timeOffset",R.string.labelSettingsTimeOffset,0);
    static final EditableParameter.IntegerParameter CONNECT_TIMEOUT_PARAMETER=
            new EditableParameter.IntegerParameter("connectTimeout",R.string.labelSettingsConnectTimeout,0);
    static final EditableParameter.IntegerParameter READ_TIMEOUT_PARAMETER=
            new EditableParameter.IntegerParameter("readTimeout",R.string.labelSettingsReadTimeout,10);
    static final EditableParameter.BooleanParameter READTIMEOUT_CLOSE_PARAMETER=
            new EditableParameter.BooleanParameter("closeOnTimeout",R.string.labelSettingsCloseOnTimeout,true);
    static final EditableParameter.IntegerParameter WRITE_TIMEOUT_PARAMETER=
            new EditableParameter.IntegerParameter("writeTimeout",R.string.labelSettingsWriteTimeout,5);

    static final String CLAIM_BLUETOOTH ="bluetooth";
    static final String CLAIM_USB ="usb";
    protected static final String CLAIM_TCPPORT = "tcpport";

    private static class ResourceClaim{
        String kind;
        String name;
        Worker ref;
        ResourceClaim(Worker ref,String kind,String name){
            this.kind=kind;
            this.name=name;
            this.ref=ref;
        }
    }
    private static final ArrayList<ResourceClaim> resourceClaims=new ArrayList<>();

    protected void removeClaims(){
        synchronized (resourceClaims){
            for (int i=resourceClaims.size()-1;i>=0;i--){
                if (resourceClaims.get(i).ref == this){
                    resourceClaims.remove(i);
                }
            }
        }
    }

    /**
     * add a claim
     * @param kind
     * @param name
     * @return null if ok, the worker that currently has the claim otherwise
     */
    protected Worker addClaim(String kind,String name,boolean doThrow) throws IOException {
        synchronized (resourceClaims){
            Worker rt=checkClaimInternal(kind,name,doThrow);
            if (rt != null) return rt;
            resourceClaims.add(new ResourceClaim(this,kind,name));
        }
        return null;
    }
    private Worker checkClaimInternal(String kind,String name,boolean doThrow) throws IOException {
        for (ResourceClaim cl:resourceClaims){
            if (cl.kind.equals(kind) && cl.name.equals(name)){
                if (cl.ref == this) return null;
                else {
                    if (doThrow){
                        throw new IOException("device "+name+" already in use by "+cl.ref.getTypeName()+"-"+cl.ref.getId());
                    }
                    return cl.ref;
                }
            }
        }
        return null;
    }
    protected Worker checkClaim(String kind,String name,boolean doThrow) throws IOException {
        synchronized (resourceClaims){
            return checkClaimInternal(kind,name,doThrow);
        }
    }
    protected List<String> filterByClaims(String kind,List<String> values,boolean includeOwn){
        ArrayList<String> rt=new ArrayList<>();
        synchronized (resourceClaims){
            for (String v:values){
                boolean doAdd=true;
                for (ResourceClaim cl:resourceClaims){
                    if (cl.kind.equals(kind) && cl.name.equals(v)){
                        if (!includeOwn || cl.ref != this) doAdd=false;
                    }
                }
                if (doAdd) rt.add(v);
            }
        }
        return rt;
    }



    protected WorkerStatus status;
    protected JSONObject parameters=new JSONObject();
    protected EditableParameter.ParameterList parameterDescriptions=new EditableParameter.ParameterList();
    protected int paramSequence=0;
    protected Thread mainThread;
    private   boolean running=false;
    private   int startSequence;
    protected final Object waiter=new Object();

    protected Worker(String typeName){
        status=new WorkerStatus(typeName);
    }
    protected String getSourceName(){
        String n=null;
        try {
            n=SOURCENAME_PARAMETER.fromJson(parameters);
        } catch (JSONException e) {
        }
        if (n == null || n.isEmpty()) return status.typeName;
        return n;
    }

    @Override
    public synchronized WorkerStatus getStatus(){
        return new WorkerStatus(status);
    }
    @Override
    public synchronized JSONObject getJsonStatus() throws JSONException {
        WorkerStatus rt=new WorkerStatus(status);
        JSONObject ro=rt.toJson();
        if (!getTypeName().equals(getSourceName())){
            ro.put("name",rt.typeName +"("+getSourceName()+")");
        }
        return ro;
    }

    @Override
    public synchronized void setStatus(WorkerStatus.Status status, String info){
        this.status.status=status;
        this.status.info=info;
    }
    @Override
    public synchronized void setId(int id){
        status.id=id;
    }
    @Override
    public synchronized int getId(){
        return status.id;
    }
    @Override
    public synchronized JSONObject getEditableParameters(boolean includeCurrent,Context context) throws JSONException {
        JSONObject rt=new JSONObject();
        if (parameterDescriptions != null) rt.put("data",parameterDescriptions.toJson(context));
        if (includeCurrent) rt.put("values",parameters!=null?parameters:new JSONObject());
        rt.put("configName",status.typeName);
        rt.put("canDelete",status.canDelete);
        return rt;
    }
    @Override
    public JSONArray getParameterDescriptions(Context context) throws JSONException {
        return parameterDescriptions.toJson(context);
    }

    @Override
    public synchronized void setParameters(JSONObject newParam, boolean replace,boolean check) throws JSONException, IOException {
        if (parameterDescriptions == null) throw new JSONException("no parameters defined");
        if (! replace){
            for (Iterator<String> it = parameters.keys(); it.hasNext(); ) {
                String k = it.next();
                if (! newParam.has(k)) newParam.put(k,parameters.get(k));
            }
        }
        parameterDescriptions.check(newParam);
        if (check) {
            checkParameters(newParam);
        }
        parameters=newParam;
        paramSequence++;
    }

    protected void checkParameters(JSONObject newParam) throws JSONException,IOException{}

    @Override
    public String getTypeName() {
        return status.typeName;
    }

    @Override
    public JSONObject getConfig() {
        return parameters;
    }

    public void start(){
        if (mainThread != null){
            stopAndWait();
        }
        try {
            //check if we have a defined enabled parameter
            //otherwise use the generic one
            EditableParameter.BooleanParameter enabled=Worker.ENABLED_PARAMETER;
            for (EditableParameter.EditableParameterInterface p:parameterDescriptions){
                if (p.getName().equals(ENABLED_PARAMETER.name) && p instanceof EditableParameter.BooleanParameter){
                    enabled=(EditableParameter.BooleanParameter)p;
                }
            }
            if (enabled.fromJson(parameters)) {
                running = true;
                mainThread = new Thread(new Runnable() {
                    @Override
                    public void run() {
                        setStatus(WorkerStatus.Status.STARTED, "started");
                        try {
                            Worker.this.run(startSequence);
                            setStatus(WorkerStatus.Status.INACTIVE, "stopped");
                            status.removeChildren();
                        } catch (Throwable t) {
                            setStatus(WorkerStatus.Status.ERROR, "error: " + t.getMessage());
                        }
                        running = false;
                    }
                });
                mainThread.setDaemon(true);
                mainThread.start();
            }
            else{
                setStatus(WorkerStatus.Status.INACTIVE,"disabled");
                status.removeChildren();
            }
        } catch (JSONException e) {
            setStatus(WorkerStatus.Status.ERROR,"error: "+e.getMessage());
        }
    }

    protected boolean shouldStop(int sequence){
        return sequence != startSequence;
    }

    protected boolean sleep(long millis){
        synchronized (waiter){
            try {
                waiter.wait(millis);
            } catch (InterruptedException e) {
                return false;
            }
        }
        return true;
    }

    protected abstract void run(int startSequence) throws JSONException, IOException;

    /**
     * stop the service and free all resources
     * afterwards the provider will not be used any more
     */
    @Override
    public void stop(){
        startSequence++;
        if (mainThread != null){
            try{
                synchronized (waiter){
                    waiter.notifyAll();
                }
                mainThread.interrupt();
            }catch (Throwable t){
                AvnLog.e("unable to stop "+getTypeName()+": ",t);
            }
            mainThread=null;
        }
        running=false;
        removeClaims();
    }
    @Override
    public void stopAndWait(){
        Thread oldMain=mainThread;
        stop();
        if (oldMain == null) return;
        try {
            oldMain.join(2000);
        } catch (InterruptedException e) {
            AvnLog.e("unable to stop worker main thread for "+getSourceName(),e);
        }
    }
    /**
     * check if the handler is stopped and should be reinitialized
     * @return
     */
    @Override
    public boolean isStopped(){
        return !running;
    }

    /**
     * will be called from a timer in regular intervals
     * should be used to check (e.g. check if provider enabled or socket can be opened)
     */
    @Override
    public void check() throws JSONException {}
}
