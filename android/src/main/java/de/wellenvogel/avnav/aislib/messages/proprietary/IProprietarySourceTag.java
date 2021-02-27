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
package de.wellenvogel.avnav.aislib.messages.proprietary;

import de.wellenvogel.avnav.aislib.model.Country;

import java.util.Date;



/**
 * Interface for proprietary source tags
 */
public interface IProprietarySourceTag extends IProprietaryTag {

    /**
     * Time of message receival at source
     * 
     * @return
     */
    Date getTimestamp();

    /**
     * Country origin of message
     * 
     * @return
     */
    Country getCountry();

    /**
     * Unique region identifier
     * 
     * @return
     */
    String getRegion();

    /**
     * Base station MMSI
     * 
     * @return
     */
    Integer getBaseMmsi();

}
