package de.wellenvogel.avnav.worker;

import android.content.Context;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.net.StandardProtocolFamily;
import java.nio.ByteBuffer;
import java.nio.channels.DatagramChannel;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.MovingSum;
import de.wellenvogel.avnav.util.NmeaQueue;

public class UdpReceiver extends ChannelWorker {
    static class Creator extends WorkerFactory.Creator{

        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException, IOException {
            return new UdpReceiver(name,ctx,queue);
        }
    }
    long lastReceived=0;
    MovingSum receiveCounter=new MovingSum(10);
    UdpReceiver(String name, GpsService ctx, NmeaQueue queue) {
        super(name, ctx, queue);
        parameterDescriptions.addParams(
                PORT_PARAMETER,
                ENABLED_PARAMETER,
                SOURCENAME_PARAMETER,
                SOURCE_PRIORITY_PARAMETER,
                EXTERNAL_ACCESS,
                FILTER_PARAM,
                READ_TIMEOUT_PARAMETER,
                STRIP_LEADING_PARAMETER
                );
        status.canDelete=true;
        status.canEdit=true;
    }
    private DatagramChannel channel;

    @Override
    protected void checkParameters(JSONObject newParam) throws JSONException, IOException {
        super.checkParameters(newParam);
        Integer port=PORT_PARAMETER.fromJson(newParam);
        checkClaim(CLAIM_UDPPORT,port.toString(),true);
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException { int MAXSIZE=10000;
        lastReceived=0;
        Integer port=PORT_PARAMETER.fromJson(parameters);
        int priority=SOURCE_PRIORITY_PARAMETER.fromJson(parameters);
        boolean allowExternal=EXTERNAL_ACCESS.fromJson(parameters);
        boolean stripLeading=STRIP_LEADING_PARAMETER.fromJson(parameters);
        addClaim(CLAIM_UDPPORT,port.toString(),true);
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
        SocketAddress bindAddress;
        if (allowExternal){
            bindAddress=new InetSocketAddress(Inet4Address.getByName("0.0.0.0"),port);
        }
        else{
            bindAddress=new InetSocketAddress(AvnUtil.getLocalHost(),port);
        }
        channel.socket().setBroadcast(true);
        channel.socket().setReuseAddress(true);
        channel.socket().bind(bindAddress);
        String source=getSourceName();
        setStatus(WorkerStatus.Status.STARTED,"listening on port "+port+", external access "+allowExternal);
        String[] nmeaFilter=AvnUtil.splitNmeaFilter(FILTER_PARAM.fromJson(parameters));
        while (! shouldStop(startSequence) && channel.isOpen()){
            ByteBuffer buffer = ByteBuffer.allocate(MAXSIZE);
            try{
                channel.receive(buffer);
                lastReceived=System.currentTimeMillis();
            }catch (Throwable t){
                setStatus(WorkerStatus.Status.ERROR,"receive error:"+t.getMessage());
                break;
            }
            try {
                buffer.flip();
                byte[] content = buffer.array();
                int start = 0;
                int end = 0;
                while (end < content.length && end < buffer.limit()) {
                    if (content[end] == '\n') {
                        if ((end - 1) > start) {
                            String record = new String(content, start, end  - start);
                            record = record.trim();
                            if (record.length() > 0) {
                                record=AvnUtil.removeNonNmeaChars(record);
                                if (stripLeading){
                                    record=AvnUtil.stripLeading(record);
                                }
                                if (! record.startsWith("!") && ! record.startsWith("$") ){
                                    AvnLog.dfs("broken line \"%s\"",record);
                                }
                                if (AvnUtil.matchesNmeaFilter(record,nmeaFilter)) {
                                    queue.add(record, source,priority);
                                    receiveCounter.add(1);                                }
                            }
                        }
                        start = end+1;
                    }
                    end++;
                }
                if ((end - 1) > start) {
                    String record = new String(content, start, end  - start);
                    record = record.trim();
                    if (record.length() > 0) {
                        if (AvnUtil.matchesNmeaFilter(record,nmeaFilter)) {
                            queue.add(record, source,priority);
                            receiveCounter.add(1);
                        }
                    }
                }
            }catch (Throwable t){
                AvnLog.e("unable to handle received packet",t);
            }
        }
        removeClaims();
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

    @Override
    public void check() throws JSONException {
        super.check();
        if (channel != null && channel.isOpen()){
            long now=System.currentTimeMillis();
            int timeout=READ_TIMEOUT_PARAMETER.fromJson(parameters)*1000;
            if (timeout > 0 && (lastReceived + timeout ) < now){
                if (status.status == WorkerStatus.Status.NMEA){
                    setStatus(WorkerStatus.Status.INACTIVE,"read timeout at port "+
                            PORT_PARAMETER.fromJson(parameters));
                }
            }
            else{
                if ((status.status != WorkerStatus.Status.NMEA && lastReceived > 0)
                        || receiveCounter.shouldUpdate(1000)
                ){
                    receiveCounter.add(0);
                    float avg=receiveCounter.avg();
                    setStatus(avg>0?WorkerStatus.Status.NMEA: WorkerStatus.Status.STARTED,"receiving at "+
                            PORT_PARAMETER.fromJson(parameters)+", external access "+
                            EXTERNAL_ACCESS.fromJson(parameters)+String.format(", rcv=%.2f/s ", avg));
                }
            }
        }
    }
}
