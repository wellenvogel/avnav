package de.wellenvogel.avnav.worker;

/**
 * Created by andreas on 27.11.15.
 */
public interface INmeaLogger {
    public void logNmea(String data);

    public class Properties{
        public boolean logNmea=false;
        public boolean logAis=false;
        public String nmeaFilter=""; //, separated list of record types - empty for all
    }
}
