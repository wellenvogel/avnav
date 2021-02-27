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


import de.wellenvogel.avnav.aislib.messages.binary.SixbitEncoder;
import de.wellenvogel.avnav.aislib.messages.binary.SixbitException;
import de.wellenvogel.avnav.aislib.messages.sentence.Vdm;

/**
 * Class to fill in for AIS message classes not yet implemented
 */
public class AisUnsupportedMessageType extends AisMessage {

    /** serialVersionUID. */
    private static final long serialVersionUID = 1L;

    public AisUnsupportedMessageType(Vdm vdm) throws AisMessageException, SixbitException {
        super(vdm);
        parse(vdm.getBinArray());
    }

    @Override
    public SixbitEncoder getEncoded() {
        throw new UnsupportedOperationException();
    }

    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append(super.toString());
        builder.append(" TO BE IMPLEMENTED ");
        builder.append("]");
        return builder.toString();
    }

}
