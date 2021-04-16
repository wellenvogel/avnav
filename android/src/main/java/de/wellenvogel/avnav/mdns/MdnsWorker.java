package de.wellenvogel.avnav.mdns;

import org.json.JSONException;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;

import de.wellenvogel.avnav.util.AvnLog;
import de.wellenvogel.avnav.worker.GpsService;
import de.wellenvogel.avnav.worker.Worker;
import de.wellenvogel.avnav.worker.WorkerStatus;

public class MdnsWorker extends Worker implements Target.IResolver {


    private static class ResolverWrapper{
        Resolver resolver;
        Thread thread;
        ResolverWrapper(Resolver resolver,Thread t){
            this.resolver=resolver;
            this.thread=t;
        }
        void stopAndWait(long timeout) throws IOException, InterruptedException {
            if (! thread.isAlive()) return;
            resolver.stop();
            thread.join(timeout);
        }
    }
    private final ArrayList<InetAddress> interfaceAddresses=new ArrayList<>();
    private final HashMap<String, ResolverWrapper> mdnsResolvers=new HashMap<>();
    private final ArrayList<Resolver.QRequest<Target.HostTarget>> storedRequests=new ArrayList<>();
    private final HashSet<Target.ResolveTarget> resolvedServices=new HashSet<>();

    public MdnsWorker(String typeName, GpsService ctx) {
        super(typeName,ctx);
        parameterDescriptions.addParams(ENABLED_PARAMETER);
        status.canEdit=true;
    }
    private void checkMdnsResolvers() {
        try {
            ArrayList<InetAddress> newAddresses = new ArrayList<>();
            HashMap<String, NetworkInterface> interfaces = new HashMap<>();
            Enumeration<NetworkInterface> intfs = NetworkInterface.getNetworkInterfaces();
            while (intfs.hasMoreElements()) {
                NetworkInterface intf = intfs.nextElement();
                if (!intf.isUp() || !intf.supportsMulticast()) continue;
                boolean hasIp4 = false;
                for (InterfaceAddress addr : intf.getInterfaceAddresses()) {
                    InetAddress ip = addr.getAddress();
                    if (!(ip instanceof Inet4Address)) continue;
                    newAddresses.add(ip);
                    hasIp4 = true;
                }
                if (!hasIp4) continue;
                interfaces.put(intf.getName(), intf);
            }
            boolean mustRenew = false;
            synchronized (interfaceAddresses) {
                if (newAddresses.size() != interfaceAddresses.size()) {
                    mustRenew = true;
                } else {
                    for (InetAddress a : newAddresses) {
                        if (interfaceAddresses.indexOf(a) < 0) {
                            mustRenew = true;
                            break;
                        }
                    }
                    if (!mustRenew) {
                        for (InetAddress a : interfaceAddresses) {
                            if (newAddresses.indexOf(a) < 0) {
                                mustRenew = true;
                                break;
                            }
                        }
                    }
                }
                if (mustRenew) {
                    interfaceAddresses.clear();
                    interfaceAddresses.addAll(newAddresses);
                }
            }
            if (!mustRenew) {
                AvnLog.d("network check - no change");
            } else {
                AvnLog.i("must renew mdns resolvers");
                synchronized (mdnsResolvers) {
                    for (ResolverWrapper r : mdnsResolvers.values()) {
                        try {
                            r.stopAndWait(1000);
                        }catch (Throwable t){
                            AvnLog.e("unable to stop resolver",t);
                        }
                    }
                    mdnsResolvers.clear();
                    resolvedServices.clear();
                    status.removeChildren();
                    for (String ifname : interfaces.keySet()) {
                        Resolver resolver=new Resolver(interfaces.get(ifname), new Target.Callback() {
                            @Override
                            public void resolve(Target.ResolveTarget target) {
                                synchronized (mdnsResolvers){
                                    resolvedServices.add(target);
                                }
                            }
                        });
                        Thread resolverThread=new Thread(new Runnable() {
                            @Override
                            public void run() {
                                status.setChildStatus(ifname, WorkerStatus.Status.NMEA,"active");
                                try{
                                    resolver.run();
                                    status.unsetChildStatus(ifname);
                                }
                                catch (Throwable t){
                                    status.setChildStatus(ifname, WorkerStatus.Status.ERROR,"error "+t.getMessage());
                                }
                            }
                        });
                        resolverThread.setDaemon(true);
                        resolverThread.start();
                        mdnsResolvers.put(ifname, new ResolverWrapper(resolver,resolverThread));
                    }
                    if (mdnsResolvers.size() > 0) {
                        for (Resolver.QRequest<Target.HostTarget> str : storedRequests) {
                            for (ResolverWrapper r : mdnsResolvers.values()) {
                                r.resolver.resolve(str.request,str.callback, false);
                            }
                        }
                        storedRequests.clear();
                    }
                }
            }
            synchronized (mdnsResolvers) {
                for (ResolverWrapper r : mdnsResolvers.values()) {
                    r.resolver.checkRetrigger();
                }
            }
        } catch (Throwable t) {
            AvnLog.e("error checking mdns", t);
        }
    }

    @Override
    protected void run(int startSequence) throws JSONException, IOException {
        setStatus(WorkerStatus.Status.STARTED,"starting MDNS resolvers");
        checkMdnsResolvers();
        while(! shouldStop(startSequence)){
            sleep(5000);
            checkMdnsResolvers();
            synchronized (mdnsResolvers) {
                if (mdnsResolvers.size() > 0) {
                    setStatus(WorkerStatus.Status.NMEA, mdnsResolvers.size() + " resolver(s) active");
                } else {
                    setStatus(WorkerStatus.Status.INACTIVE, "no interfaces for MDNS found");
                }
            }
        }
        stopInternal();
    }

    private void stopInternal(){
        AvnLog.i("stooping MDNS resolvers");
        synchronized (mdnsResolvers){
            for(ResolverWrapper r:mdnsResolvers.values()){
                try {
                    r.stopAndWait(1000);
                } catch (Exception e) {
                    AvnLog.e("exception while stopping resolver ",e);
                }
            }
            mdnsResolvers.clear();
            status.removeChildren();
        }
        synchronized (interfaceAddresses){
            interfaceAddresses.clear();
        }
    }
    @Override
    public void stop() {
        super.stop();
        stopInternal();
    }



    @Override
    public void resolve(Target.HostTarget target, Target.Callback callback, boolean force) throws IOException {
        Resolver.QRequest<Target.HostTarget> request= new Resolver.QRequest<>(target,callback);
        synchronized (mdnsResolvers){
            if (mdnsResolvers.size() < 1){
                storedRequests.add(request);
                if (storedRequests.size()>20){
                    storedRequests.remove(0);
                }
            }
            else{
                for (ResolverWrapper r:mdnsResolvers.values()){
                    r.resolver.resolve(target,callback,force);
                }
            }
        }
    }

    @Override
    public void resolve(Target.ServiceTarget target, Target.Callback callback, boolean force) throws IOException {
        synchronized (mdnsResolvers){
                for (ResolverWrapper r:mdnsResolvers.values()){
                    r.resolver.resolve(target,callback,force);
                }

        }
    }



}
