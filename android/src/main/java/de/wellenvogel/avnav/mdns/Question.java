package de.wellenvogel.avnav.mdns;

import net.straylightlabs.hola.dns.Domain;
import net.straylightlabs.hola.sd.Service;

import java.nio.ByteBuffer;

public class Question extends net.straylightlabs.hola.dns.Question {
    public Question(String name, QType type, QClass qClass) {
        super(name, type, qClass);
    }

    public Question(Service service, Domain domain) {
        super(service, domain);
    }
    ByteBuffer getBuffer(){
        return buffer;
    }
}
