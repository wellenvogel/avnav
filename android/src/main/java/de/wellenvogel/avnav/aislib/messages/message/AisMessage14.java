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
 * Safety related broadcast message as defined by ITU-R M.1371-4
 */
public class AisMessage14 extends AisMessage {

    /** serialVersionUID. */
    private static final long serialVersionUID = 1L;

    private int spare; // 2 bit: Spare
    private String message; // Max 968 bit - 161 characters

    public AisMessage14() {
        super(14);
    }

    public AisMessage14(Vdm vdm) throws AisMessageException, SixbitException {
        super(vdm);
        parse();
    }

    public void parse() throws AisMessageException, SixbitException {
        BinArray binArray = vdm.getBinArray();
        if (binArray.getLength() < 40 || binArray.getLength() > 1008) {
            throw new AisMessageException("Message " + msgId + " wrong length: " + binArray.getLength());
        }
        super.parse(binArray);
        this.spare = (int) binArray.getVal(2);
        this.message = binArray.getString((binArray.getLength() - 40) / 6);
    }

    @Override
    public SixbitEncoder getEncoded() {
        SixbitEncoder encoder = super.encode();
        encoder.addVal(spare, 2);
        encoder.addString(message);
        return encoder;
    }

    /**
     * Set message from a binary array
     * 
     * @param binArray
     * @throws SixbitException
     */
    public void setMessage(BinArray binArray) throws SixbitException {
        message = binArray.getString(binArray.getLength() / 6);
    }

    public int getSpare() {
        return spare;
    }

    public String getMessage() {
        return message;
    }

    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append(super.toString());
        builder.append(", message=");
        builder.append(message);
        builder.append(", spare=");
        builder.append(spare);
        builder.append("]");
        return builder.toString();
    }

}
