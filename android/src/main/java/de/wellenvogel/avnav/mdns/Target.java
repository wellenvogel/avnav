package de.wellenvogel.avnav.mdns;

import java.net.NetworkInterface;
import java.net.URI;

public class Target {
        public String name;
        public String host;
        public URI uri;
        public NetworkInterface intf;
        Target(){}
        Target(String name, String host, URI uri){
            this.name=name;
            this.host=host;
            this.uri=uri;
        }
}
