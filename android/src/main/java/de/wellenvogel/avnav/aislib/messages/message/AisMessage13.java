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


import de.wellenvogel.avnav.aislib.messages.binary.SixbitException;
import de.wellenvogel.avnav.aislib.messages.sentence.Vdm;

/**
 * AIS message 13
 * 
 * Acknowledge message as defined by ITU-R M.1371-4
 * 
 */
public class AisMessage13 extends AisMessage7 {

    /** serialVersionUID. */
    private static final long serialVersionUID = 1L;

    public AisMessage13() {
        super(13);
    }

    public AisMessage13(Vdm vdm) throws AisMessageException, SixbitException {
        super(vdm);
    }

}
