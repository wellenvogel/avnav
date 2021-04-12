package de.wellenvogel.avnav.worker;

import android.content.Context;

import org.json.JSONException;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.UnknownHostException;

import de.wellenvogel.avnav.mdns.Resolver;
import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.util.NmeaQueue;

/**
 * Created by andreas on 25.12.14.
 */
public class SocketReader extends SingleConnectionHandler {
    private InetAddress resolvedAddress;
    private final Object addressLock=new Object();

    static class Creator extends WorkerFactory.Creator{
        @Override
        ChannelWorker create(String name, GpsService ctx, NmeaQueue queue) throws JSONException {
            return new SocketReader(name,ctx,queue);
        }
    }


    private SocketReader(String name,GpsService ctx, NmeaQueue queue) throws JSONException {
        super(name,ctx,queue);
        parameterDescriptions.addParams(IPADDRESS_PARAMETER,
                IPPORT_PARAMETER,
                WRITE_TIMEOUT_PARAMETER,
                CONNECT_TIMEOUT_PARAMETER,
                READTIMEOUT_CLOSE_PARAMETER);
    }

    @Override
    public void run(int startSequence) throws JSONException, IOException {
        String target=IPADDRESS_PARAMETER.fromJson(parameters);
        Integer port=IPPORT_PARAMETER.fromJson(parameters);
        //we must wait more then the resolver to avoid filling it up with our requests
        long MAXWAIT=Resolver.RETRIGGER_TIME*(Resolver.MAX_RETRIGGER+1);
        while (! shouldStop(startSequence)) {
            InetSocketAddress address = null;
            try{
                InetAddress ip=Inet4Address.getByName(target);
                address=new InetSocketAddress(target, port);
            }catch(UnknownHostException e){
                if (target.endsWith("local")) {
                    setStatus(WorkerStatus.Status.STARTED, "waiting for MDNS resolve for " + target);
                    resolvedAddress = null;
                    gpsService.resolveMdnsHost(target, new Resolver.ResolveHostCallback() {
                        @Override
                        public void resolve(String name, InetAddress host) {
                            if (name.equals(target)) {
                                synchronized (addressLock) {
                                    resolvedAddress = host;
                                }
                                synchronized (waiter) {
                                    waiter.notifyAll();
                                }
                            }
                        }
                    }, true);

                    long start = System.currentTimeMillis();
                    InetAddress ip = null;
                    while ((start + MAXWAIT) > System.currentTimeMillis() && ip == null) {
                        synchronized (addressLock) {
                            ip = resolvedAddress;
                        }
                        if (ip == null) sleep(1000);
                    }
                    if (ip == null) {
                        continue;
                    }
                    address=new InetSocketAddress(ip,port);
                }
                else{
                    setStatus(WorkerStatus.Status.ERROR,"unable to resolve "+target);
                    sleep(5000);
                    continue;
                }
            }
            IpConnection con = new IpConnection(address, gpsService);
            runInternal(con, startSequence);
        }
    }
}
