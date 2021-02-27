package de.wellenvogel.avnav.settings;

/**
 * Created by andreas on 29.11.15.
 */
public interface ISettingsChecker {
    /**
     * check if the value is valid
     * @param newValue
     * @return null on success or an error text otherwise
     */
    public String checkValue(String newValue);


}
