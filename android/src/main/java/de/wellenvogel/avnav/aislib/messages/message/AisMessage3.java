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
 * AIS message 3
 * 
 * Special position report, response to interrogation;(Class A shipborne mobile equipment)
 * 
 * This class handles the content of an AIS class A transponders general position report as defined by ITU-R M.1371-4.
 * 
 * Generally the position report is handled in the super class but there are some ITDMA specific purposes of this class.
 * 
 */
public class AisMessage3 extends AisPositionMessage {

    /** serialVersionUID. */
    private static final long serialVersionUID = 1L;

    private int slotIncrement; // 13 bits : ITDMA Slot Increment
    private int numSlots; // 3 bits : ITDMA Number of Slots
    private int keep; // 1 bit : ITDMA Keep Flag

    public AisMessage3() {
        super(3);
    }

    public AisMessage3(Vdm vdm) throws AisMessageException, SixbitException {
        super(vdm);
        parse();
    }

    public void parse() throws AisMessageException, SixbitException {
        BinArray binArray = vdm.getBinArray();
        super.parse(binArray);
        this.slotIncrement = (int) binArray.getVal(13);
        this.numSlots = (int) binArray.getVal(3);
        this.keep = (int) binArray.getVal(1);
    }

    @Override
    public SixbitEncoder getEncoded() {
        SixbitEncoder encoder = super.encode();
        encoder.addVal(slotIncrement, 13);
        encoder.addVal(numSlots, 3);
        encoder.addVal(keep, 1);
        return encoder;
    }

    public int getSlotIncrement() {
        return slotIncrement;
    }

    public int getNumSlots() {
        return numSlots;
    }

    public int getKeep() {
        return keep;
    }

    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append(super.toString());
        builder.append(", keep=");
        builder.append(keep);
        builder.append(", numSlots=");
        builder.append(numSlots);
        builder.append(", slotIncrement=");
        builder.append(slotIncrement);
        builder.append("]");
        return builder.toString();
    }

}
