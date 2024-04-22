package de.wellenvogel.avnav.worker;

import android.util.Log;

import org.json.JSONException;

import java.io.IOException;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public abstract class SingleConnectionHandler extends ChannelWorker {
    private ConnectionReaderWriter handler;
    private int connects=0;
    private static final String LOGPRFX="SingleConnectionHandler";
    AbstractConnection connection;
    String name;
    SingleConnectionHandler(String name, GpsService ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        parameterDescriptions.addParams(
                ENABLED_PARAMETER,
                SOURCENAME_PARAMETER,
                SOURCE_PRIORITY_PARAMETER,
                FILTER_PARAM,
                READ_TIMEOUT_PARAMETER,
                SEND_DATA_PARAMETER,
                SEND_FILTER_PARAM.cloneCondition(SEND_DATA_CONDITION),
                BLACKLIST_PARAMETER.cloneCondition(SEND_DATA_CONDITION),
                REPLY_RECEIVED_PARAMETER.cloneCondition(SEND_DATA_CONDITION),
                STRIP_LEADING_PARAMETER,
                QUEUE_AGE_PARAMETER
        );
        gpsService =ctx;
        this.queue=queue;
        this.name=name;
        status.canDelete=true;
        status.canEdit=true;
    }

    public void runInternal(AbstractConnection con,int startSequence) throws JSONException {
        con.setProperties(getConnectionProperties());
        this.connection =con;
        long lastConnect=0;
        connects=0;
        while (! shouldStop(startSequence)) {
            if (status.status != WorkerStatus.Status.ERROR) {
                setStatus(WorkerStatus.Status.STARTED, "connecting " + connection.getId());
            }
            try {
                lastConnect=System.currentTimeMillis();
                connection.connect();
                connects++;
                setStatus(WorkerStatus.Status.STARTED, "("+connects+") waiting for data from/to " + connection.getId());
            } catch (Exception e) {
                Log.e(LOGPRFX, name + ": Exception during connect " + e.getLocalizedMessage());
                setStatus(WorkerStatus.Status.ERROR,"connect error " + e);
                if (connection.shouldFail()){
                    try {
                        connection.close();
                    } catch (IOException ioException) {
                    }
                    if (! shouldStop(startSequence))sleep(2000);
                    stopHandler();
                    setStatus(WorkerStatus.Status.ERROR,"failing with connect error " + e);
                    break;
                }
                try {
                    connection.close();
                }catch (Exception i){}
                sleep(5000);
                continue;
            }
            AvnLog.d(LOGPRFX, name + ": connected to " + connection.getId());
            handler=new ConnectionReaderWriter(connection, getSourceName(), getPriority(null), queue, QUEUE_AGE_PARAMETER.fromJson(parameters), new ConnectionReaderWriter.StatusUpdater() {
                @Override
                public void update(WorkerStatus.Status status, String info) {
                    setStatus(status,info);
                }
            });
            try {
                handler.run();
            }catch (Throwable t){
                AvnLog.e("error in connection run",t);
            }
            long current=System.currentTimeMillis();
            if ((current-lastConnect) < 3000){
                if (!sleep(3000)) break;
            }
        }
    }

    private void stopHandler(){
        if (handler != null){
            try{
                handler.stop();
            }catch (Throwable t){
                AvnLog.e(getTypeName()+" error stopping handler",t);
            }
            handler=null;
        }
    }

    @Override
    public void stop() {
        super.stop();
        try{
            connection.close();
        }catch (Throwable t){}
        stopHandler();

    }

    @Override
    public synchronized void check() throws JSONException {
        if (this.isStopped()) {
            if (status.status == WorkerStatus.Status.NMEA) {
                setStatus(WorkerStatus.Status.ERROR,"stopped");
            }
        }
        if (connection != null) {
            if (connection.check()) {
                setStatus(WorkerStatus.Status.ERROR,"closed due to timeout");
                AvnLog.e(name + ": closing socket due to write timeout");
                return;
            }
        }
        if ( handler == null || ! handler.isConnected()){
            if (status.status == WorkerStatus.Status.NMEA) {
                setStatus(WorkerStatus.Status.STARTED, "no data timeout");
            }
        }
    }

}
