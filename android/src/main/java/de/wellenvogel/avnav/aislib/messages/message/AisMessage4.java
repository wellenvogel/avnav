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

import java.util.Calendar;
import java.util.Date;
import java.util.TimeZone;


import de.wellenvogel.avnav.aislib.messages.binary.BinArray;
import de.wellenvogel.avnav.aislib.messages.binary.SixbitEncoder;
import de.wellenvogel.avnav.aislib.messages.binary.SixbitException;
import de.wellenvogel.avnav.aislib.messages.sentence.Vdm;
import de.wellenvogel.avnav.aislib.model.Position;


/**
 * AIS message 4
 * 
 * Base station report as defined by ITU-R M.1371-4
 * 
 */
public class AisMessage4 extends AisMessage implements IPositionMessage {

    /** serialVersionUID. */
    private static final long serialVersionUID = 1L;

    private int utcYear; // 14 bits : UTC Year
    private int utcMonth; // 4 bits : UTC Month
    private int utcDay; // 5 bits : UTC Day
    private int utcHour; // 5 bits : UTC Hour
    private int utcMinute; // 6 bits : UTC Minute
    private int utcSecond; // 6 bits : UTC Second
    private int posAcc; // 1 bit : AisPosition Accuracy
    private AisPosition pos; // : Lat/Long 1/100000 minute
    private int posType; // 4 bits : Type of position fixing device
    private int transmissionControl; // 1 bit : Transmission control for
                                     // longrange broadcast message
    private int spare; // 9 bits : Spare
    private int raim; // 1 bit : RAIM flag
    private int syncState; // 2 bits : SOTDMA sync state
    private int slotTimeout; // 3 bits : SOTDMA Slot Timeout
    private int subMessage; // 14 bits : SOTDMA sub-message

    public AisMessage4() {
        super(4);
    }

    public AisMessage4(Vdm vdm) throws AisMessageException, SixbitException {
        super(vdm);
        parse();
    }

    public void parse() throws AisMessageException, SixbitException {
        BinArray binArray = vdm.getBinArray();
        if (binArray.getLength() != 168) {
            throw new AisMessageException("Message 4 wrong length " + binArray.getLength());
        }

        super.parse(binArray);

        this.utcYear = (int) binArray.getVal(14);
        this.utcMonth = (int) binArray.getVal(4);
        this.utcDay = (int) binArray.getVal(5);
        this.utcHour = (int) binArray.getVal(5);
        this.utcMinute = (int) binArray.getVal(6);
        this.utcSecond = (int) binArray.getVal(6);
        this.posAcc = (int) binArray.getVal(1);

        this.pos = new AisPosition();
        this.pos.setRawLongitude(binArray.getVal(28));
        this.pos.setRawLatitude(binArray.getVal(27));

        this.posType = (int) binArray.getVal(4);
        this.transmissionControl = (int) binArray.getVal(1);
        this.spare = (int) binArray.getVal(9);
        this.raim = (int) binArray.getVal(1);
        this.syncState = (int) binArray.getVal(2);
        this.slotTimeout = (int) binArray.getVal(3);
        this.subMessage = (int) binArray.getVal(14);
    }

    @Override
    public SixbitEncoder getEncoded() {
        SixbitEncoder encoder = super.encode();
        encoder.addVal(utcYear, 14);
        encoder.addVal(utcMonth, 4);
        encoder.addVal(utcDay, 5);
        encoder.addVal(utcHour, 5);
        encoder.addVal(utcMinute, 6);
        encoder.addVal(utcSecond, 6);
        encoder.addVal(posAcc, 1);
        encoder.addVal(pos.getRawLongitude(), 28);
        encoder.addVal(pos.getRawLatitude(), 27);
        encoder.addVal(posType, 4);
        encoder.addVal(transmissionControl, 1);
        encoder.addVal(spare, 9);
        encoder.addVal(raim, 1);
        encoder.addVal(syncState, 2);
        encoder.addVal(slotTimeout, 3);
        encoder.addVal(subMessage, 14);
        return encoder;
    }

    public int getUtcYear() {
        return utcYear;
    }

    public void setUtcYear(int utcYear) {
        this.utcYear = utcYear;
    }

    public int getUtcMonth() {
        return utcMonth;
    }

    public void setUtcMonth(int utcMonth) {
        this.utcMonth = utcMonth;
    }

    public int getUtcDay() {
        return utcDay;
    }

    public void setUtcDay(int utcDay) {
        this.utcDay = utcDay;
    }

    public int getUtcHour() {
        return utcHour;
    }

    public void setUtcHour(int utcHour) {
        this.utcHour = utcHour;
    }

    public int getUtcMinute() {
        return utcMinute;
    }

    public void setUtcMinute(int utcMinute) {
        this.utcMinute = utcMinute;
    }

    public int getUtcSecond() {
        return utcSecond;
    }

    public void setUtcSecond(int utcSecond) {
        this.utcSecond = utcSecond;
    }

    public Date getDate() {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.YEAR, getUtcYear());
        cal.set(Calendar.MONTH, getUtcMonth() - 1);
        cal.set(Calendar.DAY_OF_MONTH, getUtcDay());
        cal.set(Calendar.HOUR_OF_DAY, getUtcHour());
        cal.set(Calendar.MINUTE, getUtcMinute());
        cal.set(Calendar.SECOND, getUtcSecond());
        cal.setTimeZone(TimeZone.getTimeZone("UTC"));
        return cal.getTime();
    }

    public int getPosAcc() {
        return posAcc;
    }

    public void setPosAcc(int posAcc) {
        this.posAcc = posAcc;
    }

    @Override
    public Position getValidPosition() {
        AisPosition pos = this.pos;
        return pos == null ? null : pos.getGeoLocation();
    }

    public AisPosition getPos() {
        return pos;
    }

    public void setPos(AisPosition pos) {
        this.pos = pos;
    }

    public int getPosType() {
        return posType;
    }

    public void setPosType(int posType) {
        this.posType = posType;
    }

    /**
     * @return the transmissionControl
     */
    public int getTransmissionControl() {
        return transmissionControl;
    }

    /**
     * @param transmissionControl
     *            the transmissionControl to set
     */
    public void setTransmissionControl(int transmissionControl) {
        this.transmissionControl = transmissionControl;
    }

    public int getSpare() {
        return spare;
    }

    public void setSpare(int spare) {
        this.spare = spare;
    }

    public int getRaim() {
        return raim;
    }

    public void setRaim(int raim) {
        this.raim = raim;
    }

    public int getSyncState() {
        return syncState;
    }

    public void setSyncState(int syncState) {
        this.syncState = syncState;
    }

    public int getSlotTimeout() {
        return slotTimeout;
    }

    public void setSlotTimeout(int slotTimeout) {
        this.slotTimeout = slotTimeout;
    }

    public int getSubMessage() {
        return subMessage;
    }

    public void setSubMessage(int subMessage) {
        this.subMessage = subMessage;
    }

    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append(super.toString());
        builder.append(", pos=");
        builder.append(pos);
        builder.append(", posAcc=");
        builder.append(posAcc);
        builder.append(", posType=");
        builder.append(posType);
        builder.append(", raim=");
        builder.append(raim);
        builder.append(", slotTimeout=");
        builder.append(slotTimeout);
        builder.append(", spare=");
        builder.append(spare);
        builder.append(", subMessage=");
        builder.append(subMessage);
        builder.append(", syncState=");
        builder.append(syncState);
        builder.append(", utcDay=");
        builder.append(utcDay);
        builder.append(", utcHour=");
        builder.append(utcHour);
        builder.append(", utcMinute=");
        builder.append(utcMinute);
        builder.append(", utcMonth=");
        builder.append(utcMonth);
        builder.append(", utcSecond=");
        builder.append(utcSecond);
        builder.append(", utcYear=");
        builder.append(utcYear);
        builder.append(", date=");
        builder.append(getDate());
        builder.append("]");
        return builder.toString();
    }
}
