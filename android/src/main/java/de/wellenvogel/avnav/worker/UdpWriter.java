package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.PortUnreachableException;
import java.net.SocketAddress;
import java.net.SocketOptions;
import java.net.StandardProtocolFamily;
import java.nio.ByteBuffer;
import java.nio.channels.DatagramChannel;

import de.wellenvogel.avnav.main.R;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

public class UdpWriter extends ChannelWorker {
    static class Creator extends WorkerFactory.Creator{

        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException, IOException {
            return new UdpWriter(name,ctx,queue);
        }
    }
    long lastSend=0;
    static final EditableParameter.BooleanParameter BROADCAST_PARAMETER=
            new EditableParameter.BooleanParameter("sendBroadcast", R.string.labelSettingsSendBroadcast,false);
    UdpWriter(String name, GpsService ctx, NmeaQueue queue) {
        super(name, ctx, queue);
        parameterDescriptions.addParams(
                IPADDRESS_PARAMETER,
                IPPORT_PARAMETER,
                ENABLED_PARAMETER,
                SEND_FILTER_PARAM,
                BLACKLIST_PARAMETER,
                BROADCAST_PARAMETER,
                QUEUE_AGE_PARAMETER
                );
        status.canDelete=true;
        status.canEdit=true;
    }
    private DatagramChannel channel;


    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        while (! shouldStop(startSequence)){
            Integer port=IPPORT_PARAMETER.fromJson(parameters);
            String ipAddress=IPADDRESS_PARAMETER.fromJson(parameters);
            InetSocketAddress addr=resolveAddress(ipAddress,port,startSequence,true);
            if (addr == null){
                setStatus(WorkerStatus.Status.ERROR,"unable to resolve "+ipAddress);
                sleep(5000);
                continue;
            }
            try {
                runInternal(startSequence, addr);
            }catch (Throwable t){
                setStatus(WorkerStatus.Status.ERROR,"error in send "+t.getMessage());
                sleep(1000);
            }
        }
    }

    protected void runInternal(int startSequence,InetSocketAddress target) throws JSONException, IOException { int MAXSIZE=10000;
        lastSend=0;
        if (channel != null){
            try{
                channel.close();
            }catch (Throwable t){}
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            channel=DatagramChannel.open(StandardProtocolFamily.INET);
        }
        else{
            channel=DatagramChannel.open();
        }
        if (BROADCAST_PARAMETER.fromJson(parameters)){
            channel.socket().setBroadcast(true);
        }
        channel.connect(target);
        String [] blacklist=AvnUtil.splitNmeaFilter(BLACKLIST_PARAMETER.fromJson(parameters));
        AvnLog.ifs("udpwriter start to %s",target);
        setStatus(WorkerStatus.Status.STARTED,"sending to "+target);
        int sequence=-1;
        int numOk=0;
        String[] nmeaFilter=AvnUtil.splitNmeaFilter(SEND_FILTER_PARAM.fromJson(parameters));
        long queueAge=QUEUE_AGE_PARAMETER.fromJson(parameters);
        while (! shouldStop(startSequence) && channel.isOpen()){
            NmeaQueue.Entry entry;
            try {
                entry = queue.fetch(sequence, 200,queueAge);
                if (entry == null) continue;
                if (! AvnUtil.matchesNmeaFilter(entry.data,nmeaFilter)){
                    AvnLog.dfs("udpwriter: skipping record %s due to filter",
                            entry.data);
                    continue;

                }
                if (blacklist != null){
                    boolean blackListed=false;
                    for (String be:blacklist){
                        if (be.equals(entry.source)){
                            AvnLog.dfs("udpwriter: skipping record %s due to blacklist %s",
                                    entry.data,be);
                            blackListed=true;
                            break;
                        }
                    }
                    if (blackListed) continue;
                }
            }catch (Exception e){
                setStatus(WorkerStatus.Status.ERROR,"error fetching from queue "+e.getMessage());
                break;
            }
            sequence=entry.sequence;
            ByteBuffer buffer = ByteBuffer.wrap((entry.data + "\r\n").getBytes());
            try {
                channel.write(buffer);
                lastSend=System.currentTimeMillis();
                numOk++;
                //we get an error on every xx packet if the target is not reachable...
                if (numOk >= 50) {
                    setStatus(WorkerStatus.Status.NMEA,"sending to "+target);
                }
            }catch (PortUnreachableException p){
                numOk=0;
                setStatus(WorkerStatus.Status.STARTED,"receiver port not open at "+target);
                continue;
            }
        }

    }

    @Override
    public void stop() {
        super.stop();
        if (channel != null){
            try{
                channel.close();
            }catch (Throwable t){
                AvnLog.e("unable to close udp reader",t);
            }
        }
    }

}
