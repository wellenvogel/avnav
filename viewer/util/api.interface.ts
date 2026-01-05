/**
 * the api definition the can be used by user code
 * will be provided as the first parameter to the initializer function
 */
import LatLonSpherical from 'geodesy/latlon-spherical';
import Dms from 'geodesy/dms';


export type FormatterFunction=(value:any,...args: any[])=>string;
export type FeatureFormatterFunction=(data:object,extended:boolean)=>object;
export interface LatLon{
    lat:number;
    lon:number;
}

/**
 * the allowed keys for the feature info elements
 * being returned from featureFormatter or featureListFormatter
 */
export interface FeatureInfoType{
    icon?:string;       //an icon url
    position?:LatLon;   //object wit lat/lon
    name?:string;
    description?:string;//short description
    time?:number;       //time (ms)
    symbol?:string;     //symbol name
    buoy?:string;       //a buoy description
    light?:string;      //a light description
    top?:string;        //a topmark description
    link?:string;       //a url to be called for extended info
    htmlInfo?:string;    //a html text to be shown as extended info - typically the list of other features
}
export type FeatureInfoKeys = (keyof FeatureInfoType)[];

export interface FeatureListItem extends Record<string,string|number> {
    _lat?:number;
    _lon?:number;
    _gtype?: string;
}
export type FeatureListFormatter=(featureList: [FeatureListItem],point:LatLon)=>[FeatureInfoType]|FeatureInfoType;

export interface Api{
    log(text:string):void;
    registerWidget(description:object,editableParameters?:object):void;
    get formatter():object;
    /**
     * replace any ${name} with the values of the replacement object
     * e.g. templateReplace("test${a} test${zzz}",{a:"Hello",zzz:"World"})
     * will return: "testHello testWorld"
     * @param template
     * @param replacements
     * @returns {string}
     */
    templateReplace(template:string,replacements:object):string

    /**
     * escape special characters in a string
     * so it can be afterwards safely added to some HTML
     * @param string
     */
    escapeHtml(string:string):string;

    /**
     * show a toast containing a message
     * @param string the message
     * @param time a timeout in ms (optional)
     */
    showToast(string:string,time?:number):void;

    /**
     * register a formatter function
     * if the formatter (name) already exists an exception is thrown
     * the formatterFunction should have a "parameters" property describing the meaning
     * of it's (potentially) handled options
     * @param name the name of the formatter
     * @param formatterFunction the function
     */

    registerFormatter(name:string,formatterFunction:FormatterFunction):void

    /**
     * you can register a function that can be used to get values
     * for the display in the feature info dialog from the selected
     * feature properties on overlays
     * @param name
     * @param formatterFunction a function that will be called with 2 parameters:
     *                          1. the properties of the feature a (depening on the overlay type)
     *                             as an object (this includes lat and lon)
     *                          2. a flag - if false just only compute name and sym
     *                                      must be fast as potentially called for every point
     *                                      if true you could also compute the other values
     *                                      this will be called only when clicking on the feature
     *                          that must return an object with infos to be displayed
     *                          the following fields are supported:
     *                          sym - a symbol url (relative to the used icon file)
     *                          name - the name
     *                          desc - a description (text)
     *                          link - a link to some HTML doc (relative to the icon file)
     *                          htmlInfo - a html text to be shown when clicking the info button
     *                          time - a time value or text string
     */
    registerFeatureFormatter(name:string,formatterFunction:FeatureFormatterFunction):void;

    /**
     * get the version of AvNav as an int
     * @returns {number}
     */
    getAvNavVersion():number;

    /**
     * get the {@link https://www.movable-type.co.uk/scripts/geodesy-library.html LatLonSpherical} module
     * use it like:
     * let LatLon=avnav.api.LatLon();
     * let point=new LatLon(54,13);
     * @return {typeof LatLonSpherical}
     */
    LatLon():typeof LatLonSpherical;

    /**
     * get an instance of {@link https://www.movable-type.co.uk/scripts/geodesy-library.html Dms} to parse
     * lat/lon data
     * @return {typeof Dms}
     */
    dms():typeof Dms;
}

/**
 * the new API as it is provided as the first parameter
 * to the default export function for plugin.mjs / user.mjs
 * many functions are identical to the V1 ApiImpl but some are new here
 */
export interface ApiV2 extends Api{
    /**
     * get the base url to access files that have been installed with the plugin
     * this URL points to the plugin base dir
     * for the user.mjs it points to the directory where the user.css is located
     */
    getBaseUrl():string;

    /**
     * return the name of the plugin
     * returns an empty string for the user.mjs
     */
    getPluginName():string;

    /**
     * register a layout that already is available as a JSON object
     * this function can only be used by plugins (not by user.mjs)
     * @param name
     * @param layoutJson
     */
    registerLayoutData(name:string,layoutJson:object):void;

    /**
     * register a layout file that can be accessed by an url
     * this function can only be used by plugins (not by user.mjs)
     * @param name
     * @param url the url - either a string or an URL object
     *            for a layout file in the plugin dir (or user dir) or below
     *            you can use the relative path as url (getBaseUrl will be added at the beginning)
     *            registerLayout("testlayout","testlayout.json")
     */
    registerLayout(name:string,url:string|URL):void;

    /**
     * register a user app (i.e. a web page that should be shown as user app)
     * @param name (namdatory) a name that should uniquely identify this userapp in your plugin/user.mjs
     * @param url (mandatory) either an internal or external url as string or URL object
     *            to use an HTML file in your plugin directory just use the file name
     *            If you have an external URL just use it as is
     * @param icon (mandatory) an icon URL
     *            build it the same way like the url parameter
     * @param title (optional) a title to be shown
     * @param newWindow (optional) if set open the page in a new window
     */
    registerUserApp(name:string,url:string|URL,icon:string|URL,title?:string,newWindow?:boolean):void;

    get FEATUREINFO_KEYS():FeatureInfoKeys;
    /**
     * register a formatter function for charts that implement
     * getFeatureAt...
     * @param name - the name
     *               this must be provided as the parameter featurelistformatter in the charts
     *               layerconfig
     * @param formatterFunction a function to format a list of features
     *                          it will get a list of feature objects as first parameter
     *                          each of them has all the properties of an openlayers feature
     *                          additionally it will contain:
     *                          _gtype: the type of geometry ('point','polygon'...)
     *                          _lat: lat if type is point
     *                          _lon: lon if type is point
     *
     *                          second parameter will be the click coordinate (Object with lat/lon)
     *
     *                          it must return an object (or a list) with the
     *                          topmost features - they will be shown in the feature list
     *                          the allowed keys: FEATUREINFO_KEYS
     *
     */
    registerFeatureListFormatter(name:string,formatterFunction:FeatureListFormatter):void;

    /**
     * get the config values for the plugin
     * @return {Promise<void>}
     */
    getConfig():Promise<object>;
}


