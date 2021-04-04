package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.util.Log;

import org.json.JSONException;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public abstract class SingleConnectionHandler extends Worker {
    private final NmeaQueue queue;
    private ConnectionReaderWriter handler;
    private ConnectionReaderWriter.ConnectionProperties getConnectionProperties() throws JSONException {
        ConnectionReaderWriter.ConnectionProperties rt=new ConnectionReaderWriter.ConnectionProperties();
        rt.readData=true;
        rt.writeData=SEND_DATA_PARAMETER.fromJson(parameters);
        rt.readFilter=AvnUtil.splitNmeaFilter(FILTER_PARAM.fromJson(parameters));
        rt.writeFilter=AvnUtil.splitNmeaFilter(SEND_FILTER_PARAM.fromJson(parameters));
        rt.sourceName=getSourceName();
        return rt;
    }
    private static final String LOGPRFX="SingleConnectionHandler";
    Context context;
    AbstractConnection connection;
    String name;
    SingleConnectionHandler(String name, Context ctx, NmeaQueue queue) throws JSONException {
        super(name);
        parameterDescriptions.addParams(
                ENABLED_PARAMETER,
                SOURCENAME_PARAMETER,
                FILTER_PARAM,
                SEND_DATA_PARAMETER,
                SEND_FILTER_PARAM
        );
        context=ctx;
        this.queue=queue;
        this.name=name;
        status.canDelete=true;
        status.canEdit=true;
    }

    public void runInternal(AbstractConnection con,int startSequence) throws JSONException {
        this.connection =con;
        long lastConnect=0;
        while (! shouldStop(startSequence)) {
            try {
                lastConnect=System.currentTimeMillis();
                connection.connect();
            } catch (Exception e) {
                Log.e(LOGPRFX, name + ": Exception during connect " + e.getLocalizedMessage());
                setStatus(WorkerStatus.Status.ERROR,"connect error " + e);
                try {
                    connection.close();
                }catch (Exception i){}
                try {
                    synchronized (waiter) {
                        waiter.wait(5000);
                    }
                } catch (InterruptedException e1) {

                }
                continue;
            }
            AvnLog.d(LOGPRFX, name + ": connected to " + connection.getId());
            setStatus(WorkerStatus.Status.NMEA,"connected to "+connection.getId());
            try{
                handler=new ConnectionReaderWriter(connection,getConnectionProperties(),getSourceName(),queue);
                handler.run();
            } catch (JSONException e) {
                Log.e(LOGPRFX, name + ": Exception during read " + e.getLocalizedMessage());
                setStatus(WorkerStatus.Status.ERROR,"read exception " + e);
                try {
                    connection.close();
                } catch (Exception i) {
                }
            }
            long current=System.currentTimeMillis();
            if ((current-lastConnect) < 3000){
                if (!sleep(3000)) break;
            }
        }
    }

    @Override
    public void stop() {
        super.stop();
        if (handler != null){
            try{
                handler.stop();
            }catch (Throwable t){
                AvnLog.e(getTypeName()+" error stopping handler",t);
            }
        }

    }

    @Override
    public synchronized void check() throws JSONException {
        if (this.isStopped()) return;
        if(connection.check()){
            AvnLog.e(name+": closing socket due to write timeout");
        }
        if ( handler == null || ! handler.hasNmea()){
            if (status.status == WorkerStatus.Status.NMEA) {
                setStatus(WorkerStatus.Status.STARTED, "no data timeout");
            }
        }
        if (handler != null && handler.hasNmea()){
            if (status.status != WorkerStatus.Status.NMEA) {
                setStatus(WorkerStatus.Status.NMEA, "connected to " + connection.getId());
            }
        }
    }

}
