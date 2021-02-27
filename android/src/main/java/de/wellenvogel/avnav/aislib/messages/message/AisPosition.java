/* Copyright (c) 2011 Danish Maritime Authority.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.wellenvogel.avnav.aislib.messages.message;


import de.wellenvogel.avnav.aislib.model.Position;

/**
 * AIS position class
 * 
 * Convert raw unsigned AIS position to signed 1/10000 degree position and provide helper methods for other formats
 * 
 */
public class AisPosition {

    private int bitCorrection;
    private long rawLatitude;

    private long rawLongitude;
    private double resolution = 10000.0;

    public AisPosition() {}

    /**
     * Constructor given raw latitude and raw longitude as received in AIS message
     * 
     * @param rawLatitude
     * @param rawLongitude
     */
    public AisPosition(long rawLatitude, long rawLongitude) {
        this.rawLatitude = rawLatitude;
        this.rawLongitude = rawLongitude;
    }

    /**
     * Constructor given a GeoLocation
     * 
     * @param location
     */
    public AisPosition(Position location) {
        setLatitude(Math.round(location.getLatitude() * resolution * 60.0));
        setLongitude(Math.round(location.getLongitude() * resolution * 60.0));
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null) {
            return false;
        }
        AisPosition pos2 = (AisPosition) obj;
        return pos2.rawLatitude == this.rawLatitude && pos2.rawLongitude == this.rawLongitude;
    }

    /**
     * Get position as {@link Position} object
     * 
     * @return
     */
    public Position getGeoLocation() {
        double lat = getLatitude() / resolution / 60.0;
        double lon = getLongitude() / resolution / 60.0;
        if (Position.isValid(lat, lon)) {
            return Position.create(lat, lon);
        }
        return null;
    }

    /**
     * Get signed latitude
     * 
     * @return
     */
    public long getLatitude() {
        long latitude;
        if (rawLatitude >= 0x4000000 >> bitCorrection) {
            latitude = (0x8000000 >> bitCorrection) - rawLatitude;
            latitude *= -1;
        } else {
            latitude = rawLatitude;
        }
        return latitude;
    }

    public double getLatitudeDouble() {
        return getLatitude() / resolution / 60.0;
    }

    public double getLongitudeDouble() {
        return getLongitude() / resolution / 60.0;
    }

    /**
     * Get signed longitude
     * 
     * @return
     */
    public long getLongitude() {
        long longitude;
        if (rawLongitude >= 0x8000000 >> bitCorrection) {
            longitude = (0x10000000 >> bitCorrection) - rawLongitude;
            longitude *= -1;
        } else {
            longitude = rawLongitude;
        }
        return longitude;
    }

    public long getRawLatitude() {
        return rawLatitude;
    }

    public long getRawLongitude() {
        return rawLongitude;
    }

    /** {@inheritDoc} */
    @Override
    public int hashCode() {
        final int prime = 31;
        int result = 1;
        result = prime * result + bitCorrection;
        result = prime * result + (int) (rawLatitude ^ rawLatitude >>> 32);
        result = prime * result + (int) (rawLongitude ^ rawLongitude >>> 32);
        long temp;
        temp = Double.doubleToLongBits(resolution);
        result = prime * result + (int) (temp ^ temp >>> 32);
        return result;
    }

    /**
     * Set the resolution to be 25 and 24 bits for longitude and latitude respectively
     */
    public void set2524() {
        resolution = 1000.0;
        bitCorrection = 3;
    }

    /**
     * Set the resolution to be 18 and 17 bits for longitude and latitude respectively
     */
    public void set1817() {
        resolution = 10.0;
        bitCorrection = 10;
    }

    /**
     * Set signed latitude
     */
    public void setLatitude(long latitude) {
        if (latitude < 0) {
            rawLatitude = latitude + (0x8000000 >> bitCorrection);
        } else {
            rawLatitude = latitude;
        }
    }

    /**
     * Set signed longitude
     */
    public void setLongitude(long longitude) {
        if (longitude < 0) {
            rawLongitude = longitude + (0x10000000 >> bitCorrection);
        } else {
            rawLongitude = longitude;
        }
    }

    /**
     * Set the raw latitude as received from AIS
     * 
     * @param rawLatitude
     */
    public void setRawLatitude(long rawLatitude) {
        this.rawLatitude = rawLatitude;
    }

    /**
     * Set the raw longitude as received from AIS
     * 
     * @param rawLongitude
     */
    public void setRawLongitude(long rawLongitude) {
        this.rawLongitude = rawLongitude;
    }

    @Override
    public String toString() {
        return "(" + getRawLatitude() + "," + getRawLongitude() + ") = (" + getLatitude() + ","
                + getLongitude() + ")";
    }

}
