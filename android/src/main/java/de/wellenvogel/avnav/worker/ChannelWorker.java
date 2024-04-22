package de.wellenvogel.avnav.worker;

import org.json.JSONException;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.UnknownHostException;

import de.wellenvogel.avnav.mdns.MdnsWorker;
import de.wellenvogel.avnav.mdns.Resolver;
import de.wellenvogel.avnav.mdns.Target;
import de.wellenvogel.avnav.util.AvnUtil;
import de.wellenvogel.avnav.util.NmeaQueue;

public abstract class ChannelWorker extends Worker{
    protected NmeaQueue queue;
    ChannelWorker(String name, GpsService ctx, NmeaQueue queue){
        super(name, ctx);
        this.queue=queue;
    }

    protected ConnectionReaderWriter.ConnectionProperties getConnectionProperties() throws JSONException {
            ConnectionReaderWriter.ConnectionProperties rt=new ConnectionReaderWriter.ConnectionProperties();
            rt.readData=true;
            if (parameterDescriptions.has(SEND_DATA_PARAMETER))rt.writeData=Worker.SEND_DATA_PARAMETER.fromJson(parameters);
            if (parameterDescriptions.has(FILTER_PARAM)) rt.readFilter= AvnUtil.splitNmeaFilter(Worker.FILTER_PARAM.fromJson(parameters));
            if (parameterDescriptions.has(SEND_FILTER_PARAM)) rt.writeFilter=AvnUtil.splitNmeaFilter(Worker.SEND_FILTER_PARAM.fromJson(parameters));
            rt.sourceName=getSourceName();
            if (parameterDescriptions.has(READ_TIMEOUT_PARAMETER)) rt.noDataTime=Worker.READ_TIMEOUT_PARAMETER.fromJson(parameters);
            if (parameterDescriptions.has(READTIMEOUT_CLOSE_PARAMETER)) rt.closeOnReadTimeout=READTIMEOUT_CLOSE_PARAMETER.fromJson(parameters);
            if (parameterDescriptions.has(CONNECT_TIMEOUT_PARAMETER)) rt.connectTimeout =Worker.CONNECT_TIMEOUT_PARAMETER.fromJson(parameters);
            if (parameterDescriptions.has(WRITE_TIMEOUT_PARAMETER)) rt.writeTimeout=Worker.WRITE_TIMEOUT_PARAMETER.fromJson(parameters);
            if (parameterDescriptions.has(BLACKLIST_PARAMETER)) rt.blacklist=AvnUtil.splitNmeaFilter(BLACKLIST_PARAMETER.fromJson(parameters));
            if (parameterDescriptions.has(STRIP_LEADING_PARAMETER)) rt.stripLeading=STRIP_LEADING_PARAMETER.fromJson(parameters);
            if (parameterDescriptions.has(REPLY_RECEIVED_PARAMETER)) rt.doNotSendOwn=! REPLY_RECEIVED_PARAMETER.fromJson(parameters);
            return rt;
    }

    protected synchronized int getPriority(EditableParameter.IntegerParameter param)  {
        if (param == null) param=SOURCE_PRIORITY_PARAMETER;
        try {
            return param.fromJson(parameters);
        } catch (JSONException e) {
            return 50;
        }
    }

    private InetSocketAddress resolveMdns(Target.ResolveTarget target, int startSequence, boolean forceNew) {
        //we must wait more then the resolver to avoid filling it up with our requests
        long MAXWAIT = Resolver.RETRIGGER_TIME * (Resolver.MAX_RETRIGGER + 1);
        InetSocketAddress address = null;
        try {
            if (target.getHostName() == null) throw new UnknownHostException("needs service");
            InetAddress ip = Inet4Address.getByName(target.getHostName());
            address = new InetSocketAddress(ip, target.getPort());
        } catch (UnknownHostException e) {
            if (target.getHostName() == null || target.getHostName().endsWith("local")) {
                setStatus(WorkerStatus.Status.STARTED, "waiting for MDNS resolve for " + target);
                try {
                    final Target.Resolved resolved =
                            new Target.Resolved(target);
                    MdnsWorker resolver = gpsService.getMdnsResolver();
                    if (resolver == null) throw new IOException("no mdns resolver active");
                    target.resolve(resolver, new Target.Callback() {
                        @Override
                        public void resolve(Target.ResolveTarget target) {
                            resolved.resolve(target);
                        }
                    }, forceNew);
                    long start = System.currentTimeMillis();
                    while ((start + MAXWAIT) > System.currentTimeMillis() && !shouldStop(startSequence)) {
                        if (resolved.isResolved()) {
                            address = resolved.getResult().getSocketAddress();
                            break;
                        }
                        sleep(1000);
                    }
                    return address;
                } catch (IOException ex) {
                    setStatus(WorkerStatus.Status.ERROR, "unable to resolve MDNS" + ex.getMessage());
                    if (!shouldStop(startSequence)) sleep(5000);
                    return null;
                }
            } else {
                setStatus(WorkerStatus.Status.ERROR, "unable to resolve " + target);
                if (!shouldStop(startSequence)) sleep(5000);
                return null;
            }
        }
        return address;
    }

    protected InetSocketAddress resolveAddress(String hostname, int port,int startSequence,boolean forceNew){
        Target.HostTarget target=new Target.HostTarget(hostname,port);
        return resolveMdns(target,startSequence,forceNew);
    }
    protected InetSocketAddress resolveService(String type,String name,int startSequence, boolean forceNew){
        Target.ServiceTarget target=new Target.ServiceTarget(type,name);
        return resolveMdns(target,startSequence,forceNew);
    }

    @Override
    public void onResume() {
    }
}
