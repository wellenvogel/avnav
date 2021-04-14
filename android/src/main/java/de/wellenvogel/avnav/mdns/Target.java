package de.wellenvogel.avnav.mdns;

import android.support.annotation.NonNull;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.SocketAddress;
import java.net.URI;
import java.net.URISyntaxException;

public class Target {
    public interface IResolver{
        void resolve(ServiceTarget t, Callback callback, boolean force) throws IOException;
        void resolve(HostTarget t, Callback callback, boolean force) throws IOException;
    }

    public static interface Callback{
        public void resolve(ResolveTarget target);
    }

    public static abstract class ResolveTarget{
        String hostname;
        InetAddress address;
        NetworkInterface intf;
        int port=0;
        abstract boolean isResolved();
        public String getHostName(){return hostname;}
        void setAddress(InetAddress addr,NetworkInterface intf) throws URISyntaxException{
            this.address=addr;
            this.intf=intf;
        }
        public InetAddress getAddress(){
            return address;
        };
        public InetSocketAddress getSocketAddress(){
            if (address == null) return null;
            return new InetSocketAddress(address,getPort());
        }

        void copyFrom(ResolveTarget other){
            this.hostname=other.hostname;
            this.intf=other.intf;
            this.address=other.address;
            this.port=other.port;
        }
        public int getPort(){ return port;}
        public abstract void resolve(IResolver res,Callback callback,boolean force) throws IOException;
    }
    public static class Resolved{
        private ResolveTarget request;
        private ResolveTarget result;
        private boolean resolved=false;
        public Resolved(ResolveTarget r){
            request=r;
        }
        public synchronized boolean isResolved(){
            return resolved;
        }
        public synchronized ResolveTarget getResult(){
            return result;
        }
        public synchronized void resolve(ResolveTarget r){
            resolved=true;
            result=r;
        }
    }
    public static class ServiceTarget extends ResolveTarget {
        public static final String  DEFAULT_TYPE="_http._tcp.";
        public String name;
        public URI uri;
        public String type=DEFAULT_TYPE;
        public ServiceTarget(String type, String name){
            this.type=type;
            this.name=name;
        }

        ServiceTarget(ServiceTarget other){
            copyFrom(other);
            name=other.name;
            type=other.type;
            uri=other.uri;
        }
        public boolean isResolved(){
            return uri != null;
        }
        protected void buildUri() throws URISyntaxException {
            if (address == null) return;
            uri=new URI("http", null, address.getHostAddress(), port, null, null, null);
        }
        @Override
        public void setAddress(InetAddress addr,NetworkInterface intf) throws URISyntaxException {
            super.setAddress(addr,intf);
            buildUri();
        }


        @Override
        public void resolve(IResolver res, Callback callback, boolean force) throws IOException {
            res.resolve(this,callback,force);
        }

        @NonNull
        @Override
        public String toString() {
            if (hostname == null) return String.format("Service: %s [unresolved]",name);
            if (address == null) return String.format("Service %s %s [no address]",name,hostname);
            return String.format("Service %s %s %s:%s",name,hostname,address,port);
        }
    }
    public static class HostTarget extends ResolveTarget{
        public long ttl;
        public long updated;
        public HostTarget(String name){
            this.hostname=name;
        }
        HostTarget(HostTarget other){
            copyFrom(other);
            ttl=other.ttl;
            updated=other.updated;
        }
        public HostTarget(String hostname, int port){
            this.hostname=hostname;
            this.port=port;
        }
        public boolean isResolved(){
            return address != null;
        }


        @Override
        public void resolve(IResolver res, Callback callback, boolean force) throws IOException {
            res.resolve(this,callback,force);
        }

        @NonNull
        @Override
        public String toString() {
            if (address == null) return String.format("Host %s [unresolved]",hostname);
            return String.format("Host %s %s",hostname,address);
        }
    }
}
