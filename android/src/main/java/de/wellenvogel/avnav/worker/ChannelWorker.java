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
    protected GpsService gpsService;
    protected NmeaQueue queue;
    ChannelWorker(String name, GpsService ctx, NmeaQueue queue){
        super(name);
        this.gpsService =ctx;
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
            return rt;
    }
    private abstract class ArgResolver<T extends Target.ResolveTarget>{
        private final T target;
        private boolean nslookup;
        ArgResolver(T target,boolean nslookup){
            this.target=target;
            this.nslookup=nslookup;
        }
        abstract int getPort(T resolvedTarget);
        protected abstract void resolveMethod(MdnsWorker resolver, T target, Target.Resolved<T> resolved, boolean forceNew) throws IOException;
        InetSocketAddress resolve(int startSequence,boolean forceNew){
            //we must wait more then the resolver to avoid filling it up with our requests
            long MAXWAIT= Resolver.RETRIGGER_TIME*(Resolver.MAX_RETRIGGER+1);
            InetSocketAddress address = null;
            try{
                if (!nslookup) throw new UnknownHostException("needs service");
                InetAddress ip= Inet4Address.getByName(target.getHostName());
                address=new InetSocketAddress(ip, getPort(target));
            }catch(UnknownHostException e){
                if (! nslookup || target.getHostName().endsWith("local")) {
                    setStatus(WorkerStatus.Status.STARTED, "waiting for MDNS resolve for " + target);
                    try {
                        final Target.Resolved<T> resolved =
                                new Target.Resolved<T>(target);
                        MdnsWorker resolver=gpsService.getMdnsResolver();
                        if (resolver == null) throw new IOException("no mdns resolver active");
                        resolveMethod(resolver,target,resolved,forceNew);
                        long start = System.currentTimeMillis();
                        InetAddress ip = null;
                        while ((start + MAXWAIT) > System.currentTimeMillis() && !shouldStop(startSequence)) {
                            if (resolved.isResolved()) {
                                ip = resolved.getResult().getAddress();
                                break;
                            }
                            sleep(1000);
                        }
                        if (ip == null) {
                            return null;
                        }
                        address = new InetSocketAddress(ip, getPort(resolved.getResult()));
                    }catch (IOException ex){
                        setStatus(WorkerStatus.Status.ERROR,"unable to resolve MDNS"+e.getMessage());
                        if (! shouldStop(startSequence)) sleep(5000);
                        return null;
                    }
                }
                else{
                    setStatus(WorkerStatus.Status.ERROR,"unable to resolve "+target);
                    if (! shouldStop(startSequence)) sleep(5000);
                    return null;
                }
            }
            return address;
        }

    }
    protected InetSocketAddress resolveAddress(String hostname, int port,int startSequence,boolean forceNew){
        Target.HostTarget target=new Target.HostTarget(hostname);
        ArgResolver<Target.HostTarget> resolver=new ArgResolver<Target.HostTarget>(target,true) {
            @Override
            int getPort(Target.HostTarget resolvedTarget) {
                return port;
            }

            @Override
            protected void resolveMethod(MdnsWorker resolver, Target.HostTarget target, Target.Resolved<Target.HostTarget> resolved, boolean forceNew) throws IOException {
                resolver.resolveMdns(target, new Resolver.Callback<Target.HostTarget>() {
                    @Override
                    public void resolve(Target.HostTarget target) {
                        resolved.resolve(target);
                    }
                },forceNew);
            }
        };
        return resolver.resolve(startSequence,forceNew);
    }
    protected InetSocketAddress resolveService(String type,String name,int startSequence, boolean forceNew){
        Target.ServiceTarget target=new Target.ServiceTarget(type,name);
        ArgResolver<Target.ServiceTarget> resolver=new ArgResolver<Target.ServiceTarget>(target,false) {
            @Override
            int getPort(Target.ServiceTarget resolvedTarget) {
                return resolvedTarget.port;
            }

            @Override
            protected void resolveMethod(MdnsWorker resolver, Target.ServiceTarget target, Target.Resolved<Target.ServiceTarget> resolved, boolean forceNew) throws IOException {
                resolver.resolveMdns(target, new Resolver.Callback<Target.ServiceTarget>() {
                    @Override
                    public void resolve(Target.ServiceTarget target) {
                        resolved.resolve(target);
                    }
                },forceNew);
            }
        };
        return resolver.resolve(startSequence,forceNew);
    }
}
