package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

public abstract class Worker implements IWorker {
    static final EditableParameter.StringParameter FILTER_PARAM=
            new EditableParameter.StringParameter("filter","an NMEA filter, use e.g. $RMC or ^$RMC, !AIVDM","");
    static final EditableParameter.StringParameter SEND_FILTER_PARAM=
            new EditableParameter.StringParameter("sendFilter","an NMEA filter for send, use e.g. $RMC or ^$RMC, !AIVDM","");
    static final EditableParameter.BooleanParameter SEND_DATA_PARAMETER=
            new EditableParameter.BooleanParameter("sendOut","send out NMEA on this connection",false);
    static final EditableParameter.BooleanParameter ENABLED_PARAMETER=
            new EditableParameter.BooleanParameter("enabled","enabled",true);
    static final EditableParameter.StringParameter IPADDRESS_PARAMETER=
            new EditableParameter.StringParameter("ipaddress","ip address to connect",null);
    static final EditableParameter.IntegerParameter IPPORT_PARAMETER=
            new EditableParameter.IntegerParameter("port","ip port to connect",null);
    static final EditableParameter.StringParameter SOURCENAME_PARAMETER=
            new EditableParameter.StringParameter("source Name","name of this data source","");
    static final EditableParameter.StringListParameter BAUDRATE_PARAMETER=
            new EditableParameter.StringListParameter("baud rate","serial baud rate","9600",
                    "1200","2400","4800","9600","14400","19200","28800","38400","57600","115200","230400");
    static final EditableParameter.IntegerParameter TIMEOFFSET_PARAMETER=
            new EditableParameter.IntegerParameter("timeOffset","timeOffset(s)",0);


    abstract static class WorkerCreator{
        protected String name;
        WorkerCreator(String name){
            this.name=name;
        }
        abstract Worker create(Context ctx, NmeaQueue queue) throws JSONException, IOException;
        boolean canAdd(){return true;}
    }


    protected WorkerStatus status;
    protected JSONObject parameters=new JSONObject();
    protected EditableParameter.ParameterList parameterDescriptions=new EditableParameter.ParameterList();
    protected int paramSequence=0;
    protected Thread mainThread;
    private   boolean running=false;
    private   int startSequence;
    protected final Object waiter=new Object();

    protected Worker(String name){
        status=new WorkerStatus(name);
    }
    protected String getSourceName(){
        String n=null;
        try {
            n=SOURCENAME_PARAMETER.fromJson(parameters);
        } catch (JSONException e) {
        }
        if (n == null || n.isEmpty()) return status.name;
        return n;
    }

    @Override
    public synchronized WorkerStatus getStatus(){
        return new WorkerStatus(status);
    }

    protected synchronized void setStatus(WorkerStatus.Status status,String info){
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
    public synchronized JSONObject getEditableParameters(boolean includeCurrent) throws JSONException {
        JSONObject rt=new JSONObject();
        if (parameterDescriptions != null) rt.put("data",parameterDescriptions.toJson());
        if (includeCurrent) rt.put("values",parameters!=null?parameters:new JSONObject());
        rt.put("configName",status.name);
        rt.put("canDelete",status.canDelete);
        return rt;
    }

    @Override
    public synchronized void setParameters(JSONObject newParam) throws JSONException {
        if (parameterDescriptions == null) throw new JSONException("no parameters defined");
        parameterDescriptions.check(newParam);
        parameters=newParam;
        paramSequence++;
    }

    @Override
    public String getTypeName() {
        return status.name;
    }

    public void start(){
        if (mainThread != null){
            stop();
        }
        try {
            if (Worker.ENABLED_PARAMETER.fromJson(parameters)) {
                running = true;
                mainThread = new Thread(new Runnable() {
                    @Override
                    public void run() {
                        setStatus(WorkerStatus.Status.STARTED, "started");
                        try {
                            Worker.this.run(startSequence);
                            setStatus(WorkerStatus.Status.INACTIVE, "stopped");
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
