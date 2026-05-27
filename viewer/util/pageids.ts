import {valueof} from "./helper";

/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
export const PAGEIDS={
    INFO:'infopage',
    GPS:'gpspage',
    AIS:'aispage',
    ADDON:'addonpage',
    ADDR:'addresspage',
    SERVER:'serverpage',
    WPA:'wpapage',
    SETTINGS:'settingspage',
    NAV:'navpage',
    ROUTE:'editroutepage',
    WARNING:'warningpage',
    ADDCFG:'addonconfigpage',
    CHANNELS:'channelspage',
    NROUTE: 'routepage',
    TRACKS: 'trackspage',
    AISCFG: 'aiscfgpage',
    LAYOUT:'layoutspage',
    CHARTS:'chartspage',
    PLUGINS:'pluginspage',
    REMOTE:'remotepage',
    LOADING:'loading',
    ACTIONS:':actions'
}

export type PageType=valueof<typeof PAGEIDS>;
/**
 * pages that allow userapps/plugins
 */
export const PLUGINPAGES:Omit<typeof PAGEIDS,'INFO'|'WPA'|'DOWNLOAD'|'WARNING'>={
    ADDCFG: PAGEIDS.ADDCFG,
    ADDON: PAGEIDS.ADDON,
    ADDR: PAGEIDS.ADDR,
    AIS: PAGEIDS.AIS,
    AISCFG: PAGEIDS.AISCFG,
    CHANNELS: PAGEIDS.CHANNELS,
    CHARTS: PAGEIDS.CHARTS,
    GPS: PAGEIDS.GPS,
    LAYOUT: PAGEIDS.LAYOUT,
    NAV: PAGEIDS.NAV,
    NROUTE: PAGEIDS.NROUTE,
    ROUTE: PAGEIDS.ROUTE,
    SERVER: PAGEIDS.SERVER,
    SETTINGS: PAGEIDS.SETTINGS,
    TRACKS: PAGEIDS.TRACKS,
    PLUGINS: PAGEIDS.PLUGINS,
    REMOTE: PAGEIDS.REMOTE,
    LOADING: PAGEIDS.LOADING,
    ACTIONS: PAGEIDS.ACTIONS,
}
export type PluginPageType=valueof<typeof PLUGINPAGES>

const PAGE_TITLES:Record<PageType, string> = {
    [PAGEIDS.TRACKS]: "Tracks/NMEALogs",
    [PAGEIDS.ADDCFG]: "Configure User Apps, JS, CSS",
    [PAGEIDS.ADDON]: "User Apps",
    [PAGEIDS.ADDR]: "Connect Urls",
    [PAGEIDS.AIS]: "AIS targets",
    [PAGEIDS.CHANNELS]: "Connections/Devices",
    [PAGEIDS.GPS]: "Dashboard",
    [PAGEIDS.INFO]: "Version and License",
    [PAGEIDS.NAV]: "Navigation",
    [PAGEIDS.ROUTE]: "Route Editor",
    [PAGEIDS.NROUTE]: "Routes",
    [PAGEIDS.SETTINGS]: "Display Settings",
    [PAGEIDS.SERVER]: "Server",
    [PAGEIDS.WARNING]: "Initial Warning",
    [PAGEIDS.WPA]: "Configure Wifi Clients",
    [PAGEIDS.AISCFG]: "AIS",
    [PAGEIDS.LAYOUT]: "Layouts",
    [PAGEIDS.CHARTS]: "Charts/Overlays",
    [PAGEIDS.PLUGINS]: "Plugins",
    [PAGEIDS.REMOTE]: "Remote Control",
    [PAGEIDS.LOADING]: "AvNav is Loading",
    [PAGEIDS.ACTIONS]: "Actions",
}
export const getPageTitle=(page:PageType)=>{
    const rt=PAGE_TITLES[page];
    if (rt !== undefined){ return rt;}
    return page;
}
 