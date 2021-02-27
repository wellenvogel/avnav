package de.wellenvogel.avnav.aislib.model;
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

import java.nio.charset.Charset;
import java.util.List;



        import java.io.IOException;
        import java.io.InputStreamReader;
        import java.io.Serializable;
        import java.net.URL;
        import java.nio.charset.StandardCharsets;
        import java.util.ArrayList;
        import java.util.Collections;
        import java.util.HashMap;
        import java.util.HashSet;
        import java.util.List;
        import java.util.Map;
        import java.util.Properties;

/**
 * Class to represent a country by its assigned MID's (Maritime Identification Digits) in addition to its ISO 3166
 * identification.
 *
 * See { http://en.wikipedia.org/wiki/Maritime_Mobile_Service_Identity}
 *
 */
public final class Country implements Serializable, Comparable<Country> {

    private static final long serialVersionUID = 1L;

    private static final String LOCATION = Country.class.getPackage().getName().replace(".", "/")
            + "/country.properties";

    static final HashMap<Integer, Country> MID_COUNTRY_MAP = new HashMap<Integer, Country>();
    static final HashMap<String, Country> THREE_LETTER_MAP = new HashMap<String, Country>();
    static final HashMap<String, Country> TWO_LETTER_MAP = new HashMap<String, Country>();

    static {
        Properties props = new Properties();
        URL url = ClassLoader.getSystemResource(LOCATION);
        if (url == null) {
            url = Thread.currentThread().getContextClassLoader().getResource(LOCATION);
        }
        if (url == null) {
            throw new Error("Could not locate " + LOCATION + " on classpath");
        }
        try {
            props.load(new InputStreamReader(url.openStream(), Charset.forName("UTF_8")));
        } catch (IOException e) {
            throw new Error("Failed to load country.properties: " + e.getMessage());
        }

        for (Object key : props.keySet()) {
            String a2 = (String) key;
            String val = props.getProperty(a2);
            String[] elems = val.split("\\|");
            Country country = new Country(elems[0], a2, elems[1], elems[2]);
            if (elems.length > 3) {
                String[] strMids = elems[3].split(",");
                for (String strMid : strMids) {
                    Integer mid = Integer.parseInt(strMid);
                    country.addMid(mid);
                    MID_COUNTRY_MAP.put(mid, country);
                }
            }
            TWO_LETTER_MAP.put(country.getTwoLetter(), country);
            THREE_LETTER_MAP.put(country.getThreeLetter(), country);
        }
    }

    private final HashSet<Integer> mids = new HashSet<Integer>();

    protected final String name;

    protected final String number;
    protected final String threeLetter;
    protected final String twoLetter;

    private Country(String name, String twoLetter, String threeLetter, String number) {
        this.name = name;
        this.twoLetter = twoLetter;
        this.threeLetter = threeLetter;
        this.number = number;
    }

    void addMid(int mid) {
        mids.add(mid);
    }

    @Override
    public boolean equals(Object obj) {
        return this.threeLetter.equals(((Country) obj).getThreeLetter());
    }

    public HashSet<Integer> getMids() {
        return mids;
    }

    public String getName() {
        return name;
    }

    public String getNumber() {
        return number;
    }

    public String getThreeLetter() {
        return threeLetter;
    }

    public String getTwoLetter() {
        return twoLetter;
    }

    @Override
    public int hashCode() {
        return twoLetter.hashCode();
    }

    public boolean matchMid(int mid) {
        return mids.contains(mid);
    }

    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append("[name=");
        builder.append(name);
        builder.append(", number=");
        builder.append(number);
        builder.append(", threeLetter=");
        builder.append(threeLetter);
        builder.append(", twoLetter=");
        builder.append(twoLetter);
        builder.append(", mids=");
        builder.append(mids);
        builder.append("]");
        return builder.toString();
    }

    /**
     * Get MidCountry by ISO 3166 two or three letter code
     *
     * @param code
     * @return
     */
    public static Country getByCode(String code) {
        if (code.length() == 2) {
            return TWO_LETTER_MAP.get(code);
        }
        return THREE_LETTER_MAP.get(code);
    }

    /**
     * Get MidCountry by MID
     *
     * @param mid
     * @return
     */
    public static Country getByMid(int mid) {
        Country country = MID_COUNTRY_MAP.get(mid);
        if (country == null) {
            // LOG.debug("Unknown MID " + mid);
        }
        return country;
    }

    public static Country getCountryForMmsi(Integer mmsi) {
        String str = Integer.toString(mmsi);
        if (str.length() == 9) {
            str = str.substring(0, 3);
            return getByMid(Integer.parseInt(str));
        }
        return null;
    }

    public static Map<Integer, Country> getMidMap() {
        return Collections.unmodifiableMap(MID_COUNTRY_MAP);
    }

    public static List<Country> findAllByCode(String... countries) {
        final List<Country> c = new ArrayList<Country>();
        for (String s : countries) {
            Country co = Country.getByCode(s);
            if (co == null) {
                throw new IllegalArgumentException("Unknown country: " + s);
            }
            c.add(co);
        }
        return c;
    }

    /** {@inheritDoc} */
    @Override
    public int compareTo(Country o) {
        return threeLetter.compareTo(o.threeLetter);
    }
}
