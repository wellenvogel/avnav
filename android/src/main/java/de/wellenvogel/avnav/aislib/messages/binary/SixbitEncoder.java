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
package de.wellenvogel.avnav.aislib.messages.binary;

import de.wellenvogel.avnav.aislib.messages.binary.BinArray;

/**
 * Class to encode into a six bit string
 */
public class SixbitEncoder {

    /**
     * The internal representation as binary arrya
     */
    private BinArray binArray = new BinArray();

    /**
     * The number of padding bits
     */
    private int padBits;

    /**
     * Add a value using bits number of bits
     * 
     * @param value
     * @param bits
     */
    public void addVal(long value, int bits) {
        binArray.append(value, bits);
    }

    /**
     * Add string
     * 
     * @param str
     */
    public void addString(String str) {
        for (int i = 0; i < str.length(); i++) {
            int c = str.charAt(i);
            if (c >= 64) {
                c -= 64;
            }
            addVal(c, 6);
        }
    }

    /**
     * Add string and a number of spaces to fill length characters
     * 
     * @param str
     * @param length
     */
    public void addString(String str, int length) {
        int i = 0;
        for (; i < str.length() && i < length; i++) {
            int c = str.charAt(i);
            if (c >= 64) {
                c -= 64;
            }
            addVal(c, 6);
        }
        for (; i < length; i++) {
            addVal(' ', 6);
        }
    }

    /**
     * Append another encoder
     * 
     * @param encoder
     */
    public void append(SixbitEncoder encoder) {
        binArray.append(encoder.binArray);
    }

    /**
     * Append a binary array
     * 
     * @param ba
     */
    public void append(BinArray ba) {
        binArray.append(ba);
    }

    /**
     * Get encoded six bit string
     * 
     * @return string
     * @throws SixbitException
     */
    public String encode() throws SixbitException {
        StringBuilder buf = new StringBuilder();
        int start = 0;
        int stop = 0;
        while (start < binArray.getLength()) {
            stop = start + 6 - 1;
            if (stop >= binArray.getLength()) {
                padBits = stop - binArray.getLength() + 1;
                stop = binArray.getLength() - 1;
            }
            int value = BinArray.intToSixbit((int) binArray.getVal(start, stop));
            buf.append((char) value);
            start = stop + 1;
        }
        return buf.toString();
    }

    /**
     * The number of padding bits
     * 
     * @return
     */
    public int getPadBits() {
        return padBits;
    }

    /**
     * Get bit length
     * 
     * @return
     */
    public int getLength() {
        return binArray.getLength();
    }

    /**
     * Get the underlying binary array
     * 
     * @return
     */
    public BinArray getBinArray() {
        return binArray;
    }

    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append("SixbitEncoder [binArray=");
        builder.append(binArray);
        builder.append(", padBits=");
        builder.append(padBits);
        builder.append("]");
        return builder.toString();
    }

}
