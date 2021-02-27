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


import de.wellenvogel.avnav.aislib.messages.binary.BinArray;
import de.wellenvogel.avnav.aislib.messages.binary.SixbitEncoder;
import de.wellenvogel.avnav.aislib.messages.binary.SixbitException;
import de.wellenvogel.avnav.aislib.messages.sentence.Vdm;

/**
 * AIS message 27
 *
 * Long-range broadcast position report implemented according to ITU-R M.1371-4
 *
 */
public class AisMessage27 extends AisMessage implements IPositionMessage {

    /** serialVersionUID. */
    private static final long serialVersionUID = 1L;

    /**
     * As defined for Message 1.
     */
    private int posAcc; // 1 bit

    /**
     * As defined for Message 1.
     */
    private int raim; // 1 bit : RAIM flag

    /**
     * As defined for Message 1.
     */
    private int navStatus; // 4 bits

    /**
     * Longitude and latitude in 1/10 min.
     */
    private AisPosition pos;

    /**
     * Speed over ground (0-62 knots) 63 = not available = default.
     */
    private int sog; // 6 bits

    /**
     * Course over ground (0-359 degrees); 511 = not available = default.
     */
    private int cog; // 9 bits

    /**
     * Status of current GNSS position. 0 = Position is the current GNSS position; 1 = Reported position is not the current GNSS
     * position = default.
     */
    private int gnssPosStatus; // 1 bit

    /**
     * Spare set to zero to preserve byte boundaries.
     */
    private int spare; // 1 bit

    public AisMessage27() {
        super(27);
    }

    public AisMessage27(Vdm vdm) throws AisMessageException, SixbitException {
        super(vdm);
        parse();
    }

    public void parse() throws AisMessageException, SixbitException {
        BinArray binArray = vdm.getBinArray();
        if (binArray.getLength() != 96) {
            throw new AisMessageException("Message 27 wrong length " + binArray.getLength());
        }
        super.parse(binArray);
        this.posAcc = (int) binArray.getVal(1);
        this.raim = (int) binArray.getVal(1);
        this.navStatus = (int) binArray.getVal(4);
        this.pos = new AisPosition();
        this.pos.setRawLongitude(binArray.getVal(18));
        this.pos.setRawLatitude(binArray.getVal(17));
        this.pos.set1817();
        this.sog = (int) binArray.getVal(6);
        this.cog = (int) binArray.getVal(9);
        this.gnssPosStatus = (int) binArray.getVal(1);
        this.spare = (int) binArray.getVal(1);
    }

    @Override
    public SixbitEncoder getEncoded() {
        SixbitEncoder encoder = super.encode();
        encoder.addVal(posAcc, 1);
        encoder.addVal(raim, 1);
        encoder.addVal(navStatus, 4);
        encoder.addVal(this.pos.getRawLongitude(), 18);
        encoder.addVal(this.pos.getRawLatitude(), 17);
        encoder.addVal(sog, 6);
        encoder.addVal(cog, 9);
        encoder.addVal(spare, 1);
        return encoder;
    }

    public static long getSerialVersionUID() {
        return serialVersionUID;
    }

    public int getPosAcc() {
        return posAcc;
    }

    public void setPosAcc(int posAcc) {
        this.posAcc = posAcc;
    }

    public int getRaim() {
        return raim;
    }

    public void setRaim(int raim) {
        this.raim = raim;
    }

    public int getNavStatus() {
        return navStatus;
    }

    public void setNavStatus(int navStatus) {
        this.navStatus = navStatus;
    }

    public AisPosition getPos() {
        return pos;
    }

    public void setPos(AisPosition pos) {
        this.pos = pos;
    }

    public int getSog() {
        return sog;
    }

    public void setSog(int sog) {
        this.sog = sog;
    }

    public int getCog() {
        return cog;
    }

    public void setCog(int cog) {
        this.cog = cog;
    }

    public int getGnssPosStatus() {
        return gnssPosStatus;
    }

    public void setGnssPosStatus(int gnssPosStatus) {
        this.gnssPosStatus = gnssPosStatus;
    }

    public int getSpare() {
        return spare;
    }

    public void setSpare(int spare) {
        this.spare = spare;
    }

    @Override
    public String toString() {
        final StringBuilder builder = new StringBuilder();
        builder.append(super.toString()).append(", ");
        builder.append("posAcc=").append(posAcc);
        builder.append(", raim=").append(raim);
        builder.append(", navStatus=").append(navStatus);
        builder.append(", pos=").append(pos);
        builder.append(", sog=").append(sog);
        builder.append(", cog=").append(cog);
        builder.append(", gnssPosStatus=").append(gnssPosStatus);
        builder.append(", spare=").append(spare);
        builder.append('}');
        return builder.toString();
    }
}
