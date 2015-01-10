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
package de.wellenvogel.avnav.aislib.packet;



import de.wellenvogel.avnav.aislib.messages.binary.SixbitException;
import de.wellenvogel.avnav.aislib.messages.message.AisMessage;
import de.wellenvogel.avnav.aislib.messages.message.AisMessageException;
import de.wellenvogel.avnav.aislib.messages.message.IPositionMessage;
import de.wellenvogel.avnav.aislib.messages.sentence.SentenceException;
import de.wellenvogel.avnav.aislib.messages.sentence.Vdm;
import de.wellenvogel.avnav.aislib.model.Position;

import java.io.UnsupportedEncodingException;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Date;
import java.util.List;


/**
 * Encapsulation of the VDM lines containing a single AIS message including leading proprietary tags and comment/tag
 * blocks.
 * 
 * @author Kasper Nielsen
 */
//@NotThreadSafe
public class AisPacket implements Comparable<AisPacket> {

    private final String rawMessage;
    private transient Vdm vdm;
    private transient AisPacketTags tags;
    private AisMessage message;
    private volatile long timestamp = Long.MIN_VALUE;

    private AisPacket(String stringMessage) {
        this.rawMessage = stringMessage;
    }

    AisPacket(Vdm vdm, String stringMessage) {
        this(stringMessage);
        this.vdm = vdm;
    }

    public static AisPacket fromByteBuffer(ByteBuffer buffer) {
        int cap = buffer.remaining();
        byte[] buf = new byte[cap];
        buffer.get(buf);
        return fromByteArray(buf);
    }

    public static AisPacket fromByteArray(byte[] array) {
        try {
            return from(new String(array, "US-ASCII"));
        } catch (UnsupportedEncodingException e) {
            e.printStackTrace();
        }
        return null;
    }

    public byte[] toByteArray() {
        try {
            return rawMessage.getBytes("US_ASCII");
        } catch (UnsupportedEncodingException e) {
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Returns the timestamp of the packet, or -1 if no timestamp is available.
     * 
     * @return the timestamp of the packet, or -1 if no timestamp is available
     */
    public long getBestTimestamp() {
        long timestamp = this.timestamp;
        if (timestamp == Long.MIN_VALUE) {
            Date date = getTimestamp();
            this.timestamp = timestamp = date == null ? -1 : date.getTime();
        }
        return timestamp;
    }

    public String getStringMessage() {
        return rawMessage;
    }

    public List<String> getStringMessageLines() {
        return Arrays.asList(rawMessage.split("\\r?\\n"));
    }

    /**
     * Get existing VDM or parse one from message string
     * 
     * @return Vdm
     */
    public Vdm getVdm() {
        if (vdm == null) {
            AisPacket packet;
            try {
                packet = readFromString(rawMessage);
                if (packet != null) {
                    vdm = packet.getVdm();
                }
            } catch (SentenceException e) {
                e.printStackTrace();
                return null;
            }
        }
        return vdm;
    }

    /**
     * Returns the tags of the packet.
     * 
     * @return the tags of the packet
     */
    public AisPacketTags getTags() {
        AisPacketTags tags = this.tags;
        if (tags == null) {
            return this.tags = AisPacketTags.parse(getVdm());
        }
        return tags;
    }

    // TODO fizx
    public AisMessage tryGetAisMessage() {
        try {
            return getAisMessage();
        } catch (AisMessageException i){
            return null;
        }
          catch ( SixbitException ignore) {
            return null;
        }
    }

    /**
     * Try to get AIS message from packet
     * 
     * @return
     * @throws SixbitException
     * @throws AisMessageException
     */
    public AisMessage getAisMessage() throws AisMessageException, SixbitException {
        if (message != null || getVdm() == null) {
            return message;
        }
        return this.message = AisMessage.getInstance(getVdm());
    }

    /**
     * Check if VDM contains a valid AIS message
     * 
     * @return
     */
    public boolean isValidMessage() {
        return tryGetAisMessage() != null;
    }

    /**
     * Try to get timestamp for packet.
     * 
     * @return
     */
    public Date getTimestamp() {
        if (getVdm() == null) {
            return null;
        }
        return vdm.getTimestamp();
    }

    /*
    public PositionTime tryGetPositionTime() {
        AisMessage m = tryGetAisMessage();
        if (m instanceof IPositionMessage) {
            Position p = ((IPositionMessage) m).getPos().getGeoLocation();
            return p == null ? null : PositionTime.create(p, getBestTimestamp());
        }
        return null;

    }
    */

    public static AisPacket from(String stringMessage) {
        return new AisPacket(stringMessage);
    }

    /**
     * Construct AisPacket from raw packet string
     * 
     * @param messageString
     *
     * @return
     * @throws SentenceException
     */
    public static AisPacket readFromString(String messageString) throws SentenceException {
        AisPacket packet = null;
        AisPacketParser packetReader = new AisPacketParser();
        // String[] lines = StringUtils.split(messageString, "\n");
        String[] lines = messageString.split("\\r?\\n");
        for (String line : lines) {
            packet = packetReader.readLine(line);
            if (packet != null) {
                return packet;
            }
        }
        return null;
    }

    /** {@inheritDoc} */
    @Override
    public int compareTo(AisPacket p) {
        return new Long(getBestTimestamp()).compareTo( p.getBestTimestamp());
    }
}
