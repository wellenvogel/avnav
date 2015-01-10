package de.wellenvogel.avnav.aislib.model;

/**
 * Created by andreas on 28.12.14.
 */
public class Position {
    private double longitude;
    private double latitude;
    public Position(double lat,double lon){
        latitude=lat;
        longitude=lon;
    }

    public double getLongitude() {
        return longitude;
    }

    public double getLatitude() {
        return latitude;
    }
    public static boolean isValid(double latitude, double longitude) {
        return latitude <= 90 && latitude >= -90 && longitude <= 180 && longitude >= -180;
    }
    public static Position create( double latitude, double longitude) {
        return new Position(latitude, longitude);
    }
}
