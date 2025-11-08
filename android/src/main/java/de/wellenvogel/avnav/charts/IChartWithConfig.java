package de.wellenvogel.avnav.charts;

import java.util.List;

import de.wellenvogel.avnav.util.AvnUtil;

public interface IChartWithConfig extends AvnUtil.IJsonObect {
    static final String CKEY="name";
    static final String EXT_CKEY="chartKey"; //chartkey for external charts
    static final String DPNAME_KEY="displayName";
    static final String HASOVL_KEY="hasOverlay";
    /**
     * get a list of (ovl) config names that belong to this chart
     * the first one being the current one
     * others being old ones (for migration scenarios)
     * @return empty list on errors
     */
    public List<String> getChartCfgs();
    public String getChartKey();
}
