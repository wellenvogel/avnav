package de.wellenvogel.avnav.mdns;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URI;
import java.net.URISyntaxException;

public class Target {
    public static interface ResolveTarget{
        boolean isResolved();
        String getHostName();
        void setAddress(InetAddress addr,NetworkInterface intf) throws URISyntaxException;
    }
    public static class Resolved<T>{
        private T request;
        private T result;
        private boolean resolved=false;
        public Resolved(T r){
            request=r;
        }
        public synchronized boolean isResolved(){
            return resolved;
        }
        public synchronized T getResult(){
            return result;
        }
        public synchronized void resolve(T r){
            resolved=true;
            result=r;
        }
    }
    public static class ServiceTarget implements ResolveTarget {
        public static final String  DEFAULT_TYPE="_http._tcp";
        public String name;
        public String host;
        public InetAddress address;
        public URI uri;
        public int port;
        public NetworkInterface intf;
        public String type=DEFAULT_TYPE;
        ServiceTarget(String name) {
            this.name=name;
        }
        ServiceTarget(String type,String name){
            this.type=type;
            this.name=name;
        }
        ServiceTarget(String name, String host, URI uri) {
            this.name = name;
            this.host = host;
            this.uri = uri;
        }
        ServiceTarget(ServiceTarget other){
            name=other.name;
            type=other.type;
            host=other.host;
            uri=other.uri;
            intf=other.intf;
            port=other.port;
            address=other.address;
        }
        public boolean isResolved(){
            return uri != null;
        }
        public String getHostName(){
            return host;
        }
        protected void buildUri() throws URISyntaxException {
            if (address == null) return;
            uri=new URI("http", null, address.getHostAddress(), port, null, null, null);
        }
        @Override
        public void setAddress(InetAddress addr,NetworkInterface intf) throws URISyntaxException {
            this.address=addr;
            buildUri();
            this.intf=intf;
        }
    }
    public static class HostTarget implements ResolveTarget{
        public String name;
        public NetworkInterface intf;
        public InetAddress address;
        public long ttl;
        public long updated;
        public HostTarget(String name){
            this.name=name;
        }
        HostTarget(HostTarget other){
            name=other.name;
            intf=other.intf;
            address=other.address;
            ttl=other.ttl;
            updated=other.updated;
        }
        public boolean isResolved(){
            return address != null;
        }
        public String getHostName(){
            return name;
        }
        @Override
        public void setAddress(InetAddress addr,NetworkInterface intf) throws URISyntaxException {
            this.address=addr;
            this.intf=intf;
        }
    }
}
