package de.wellenvogel.avnav.worker;

import org.json.JSONException;

import java.io.IOException;
import java.net.InetSocketAddress;

import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class SocketReader extends SingleConnectionHandler {

    static class Creator extends WorkerFactory.Creator{
        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException {
            return new SocketReader(name,ctx,queue);
        }
    }

    private SocketReader(String name,GpsService ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        parameterDescriptions.insertParams(IPADDRESS_PARAMETER,
                IPPORT_PARAMETER);
        parameterDescriptions.addParams(
                WRITE_TIMEOUT_PARAMETER.cloneCondition(new AvnUtil.KeyValue<Boolean>(SEND_DATA_PARAMETER.name,true)),
                CONNECT_TIMEOUT_PARAMETER,
                READTIMEOUT_CLOSE_PARAMETER);
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String target=IPADDRESS_PARAMETER.fromJson(parameters);
        Integer port=IPPORT_PARAMETER.fromJson(parameters);
        while (! shouldStop(startSequence)) {
            InetSocketAddress address=resolveAddress(target,port,startSequence,true);
            if (address == null){
                setStatus(WorkerStatus.Status.ERROR,"unable to resolve "+target);
                sleep(3000);
                continue;
            }
            IpConnection con = new IpConnection(address, gpsService);
            runInternal(con, startSequence);
        }
    }
}
