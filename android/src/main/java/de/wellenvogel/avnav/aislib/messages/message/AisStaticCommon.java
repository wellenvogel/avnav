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

import de.wellenvogel.avnav.aislib.messages.sentence.Vdm;

/**
 * Abstract base class for static AIS messages 5 and 24
 */
public abstract class AisStaticCommon extends AisMessage {

    /** serialVersionUID. */
    private static final long serialVersionUID = 1L;

    /**
     * Call sign: 7 = 6 bit ASCII characters, @@@@@@@ = not available = default
     */
    protected String callsign; // 7x6 (42) bits

    /**
     * Ship name: Maximum 20 characters 6 bit ASCII, as defined in Table 44
     * 
     * @@@@@@@@@@@@@@@@@@@@ = not available = default. For SAR aircraft, it should be set to "SAR AIRCRAFT NNNNNNN"
     *                      where NNNNNNN equals the aircraft registration number
     */
    protected String name; // 20x6 (120) bits

    /**
     * Type of ship and cargo type: 0 = not available or no ship = default 1-99 = as defined in � 3.3.2 100-199 =
     * reserved, for regional use 200-255 = reserved, for future use Not applicable to SAR aircraft
     */
    protected int shipType; // 8 bits

    /**
     * GPS Ant. Distance from bow (A): Reference point for reported position. Also indicates the dimension of ship (m)
     * (see Fig. 42 and § 3.3.3)
     * 
     * NOTE: When GPS position is not available, but the ships dimensions is available, then this field should be 0
     */
    protected int dimBow; // 9 bits

    /**
     * GPS Ant. Distance from stern (B) Reference point for reported position. Also indicates the dimension of ship (m)
     * (see Fig. 42 and § 3.3.3)
     * 
     * NOTE: When GPS position is not available, but the ships dimensions is available, then this field should be
     * representing the length of the ship
     */
    protected int dimStern; // 9 bits

    /**
     * GPS Ant. Distance from port (C) Reference point for reported position. Also indicates the dimension of ship (m)
     * (see Fig. 42 and § 3.3.3)
     * 
     * NOTE: When GPS position is not available, but the ships dimensions is available, then this field should be 0
     */
    protected int dimPort; // 6 bits

    /**
     * GPS Ant. Distance from starboard (D): Reference point for reported position. Also indicates the dimension of ship
     * (m) (see Fig. 42 and § 3.3.3)
     * 
     * NOTE: When GPS position is not available, but the ships dimensions is available, then this field should be
     * representing the with of the ship
     */
    protected int dimStarboard; // 6 bits

    public AisStaticCommon(int msgId) {
        super(msgId);
    }

    public AisStaticCommon(Vdm vdm) {
        super(vdm);
    }

    public String getCallsign() {
        return callsign;
    }

    public void setCallsign(String callsign) {
        this.callsign = callsign;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getShipType() {
        return shipType;
    }

    public void setShipType(int shipType) {
        this.shipType = shipType;
    }

    public int getDimBow() {
        return dimBow;
    }

    public void setDimBow(int dimBow) {
        this.dimBow = dimBow;
    }

    public int getDimStern() {
        return dimStern;
    }

    public void setDimStern(int dimStern) {
        this.dimStern = dimStern;
    }

    public int getDimPort() {
        return dimPort;
    }

    public void setDimPort(int dimPort) {
        this.dimPort = dimPort;
    }

    public int getDimStarboard() {
        return dimStarboard;
    }

    public void setDimStarboard(int dimStarboard) {
        this.dimStarboard = dimStarboard;
    }

}
