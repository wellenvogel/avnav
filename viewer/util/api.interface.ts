/**
 * the api definition the can be used by user code
 * will be provided as the first parameter to the initializer function
 */
import LatLonSpherical from 'geodesy/latlon-spherical';
import Dms from 'geodesy/dms';
import {UrlFunction} from 'ol/Tile';
import {Tile} from "ol";
import {Map as MapLibreMap} from 'maplibre-gl';


export type FormatterFunction=(value:any,...args: any[])=>string;
export type PredefinedFormatters=
    'formatDateTime'|
    'formatClock' |
    'formatTime'|
    'formatDecimalOpt'|
    'formatDecimal'|
    'formatFloat'|
    'formatLonLats'|
    'formatLonLatsDecimal'|
    'formatDistance' |
    'formatDirection' |
    'formatDirection360' |
    'formatSpeed' |
    'formatString' |
    'formatDate' |
    'formatPressure' |
    'formatTemperature' |
    'skTemperature' |
    'skPressure';

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
export type FeatureListFormatter=(featureList: [FeatureListItem],
                                  point:LatLon,
                                  context:UserMapLayerContext,
                                  )=>[FeatureInfoType]|FeatureInfoType;

export type WidgetType ='radialGauge'| 'linearGauge'| 'map'

/**
 * an object provided functions of user widgets
 * as "this" or as an explicit parameter
 * The widget code is allowed to store own data inside.
 * It is specific for every widget instance and remains the same
 * during it's life time
 */
export interface WidgetContext extends Record<string,any> {
    /**
     * a dictionary to register your event handlers for your html code
     */
    eventHandler: object;
    /**
     * trigger a redraw of the widget
     */
    triggerRedraw: () => void;
}

/**
 * the widget context for map widgets
 */
export interface MapWidgetContext extends Record<string, any> {
    /**
     * convert a position to a map pixel that can be used to draw on the map
     * only in widgets with type map during renderCanvas
     * @param lon
     * @param lat
     * @returns x,y
     */
    lonLatToPixel: (lon:number,lat:number) => [x:number,y:number];
    /**
     * convert from a pixel coordinate of the map canvas
     * to lon/lat
     * only in widgets with type map during renderCanvas
     * @param x
     * @param y
     */
    pixelToLonLat:(x:number,y:number)=>[lon:number,lat:number]
    /**
     * returns the devicePixelRatio for the display
     * only in widgets with type map during renderCanvas
     */
    getScale: ()=>number;
    /**
     * returns the map rotation in radians
     * Remark: starting from AvNav 20260104 the complete map canvas
     * is already rotated. The functions to convert from lon/lat to pixel coordinates
     * already consider this.
     * But if you draw text you must rotate it invers (i.e. by - getRotation())
     * You should potentially check getAvNavVersion
     * only in widgets with type map during renderCanvas
     * @returns rotation in radian
     */
    getRotation: ()=>number;
    /**
     * returns the canvas context you should render to
     * only in widgets with type map during renderCanvas
     */
    getContext:()=>CanvasRenderingContext2D;
    /**
     * get the width and height of the render context
     * only in widgets with type map during renderCanvas
     */
    getDimensions: ()=>[width:number,height:number];
    /**
     * trigger a rerender
     * only in widgets with type map
     */
    triggerRender:()=>void;
}

/**
 * the widget definition as you have to provide it at registerWidget
 */
export interface WidgetDefinition{
    name:string;                        //the name of the widget
    type?:WidgetType;                   //the widget type, empty for default
    /**
     * called during render
     * must return the HTML code as string
     * @param props properties and values from the store
     * @param context the widget context (also as "this" parameter)
     */
    renderHtml?:(props:object,context:WidgetContext)=>string;
    /**
     * render to the widget canvase
     * @param canvas
     * @param props properties and values from the store
     * @param context the widget context
     */
    renderCanvas?:(canvas:CanvasRenderingContext2D,
                   props:object,
                   context:WidgetContext)=>void;
    /**
     * the keys to be fetched from the store
     * the key values of this object will be the keys of the
     * property objects during renderXXX, the values are the
     * keys in the store (e.g. "nav.gps.position") - they
     * will be replaced by the values in the store
     */
    storeKeys?:Record<string,string>;
    /**
     * default caption for the widget
     */
    caption?:string;
    /**
     * default unit for the widget
     */
    unit?:string;
    /**
     * formatter to convert the value being fetched with the
     * storeKey "value" to a string
     * must be provided for radialGauge,linearGauge or if no
     * renderHtml or renderCanvas is provided
     */
    formatter?:FormatterFunction|PredefinedFormatters|string;
    /**
     * if provided this function will ba called before every render
     * and can be used to translate values
     * This can in many cases prevent the need for an own renderXXX function.
     * not for map widgets
     * @param props
     */
    translateFunction?:(props:object)=>object;
    /**
     * will be called when a widget is instantiated
     * only type map or with renderHtml or RenderCanvas
     * @param context
     * @param props
     */
    initFunction?:(context:WidgetContext|MapWidgetContext,props:object)=>void;
    /**
     * will be called when a widget is going to be destroyed
     * @param context
     * @param props
     */
    finalizeFunction?:(context:WidgetContext|MapWidgetContext,props:object)=>void;

}
export type WidgetParameterType='STRING'| 'NUMBER'|'FLOAT'|'KEY'| 'SELECT'| 'ARRAY'| 'BOOLEAN'| 'COLOR';

export interface WidgetParameter{
    type: WidgetParameterType;
    default?:string|number|boolean;
    list?:[string|number|boolean|object]
        | (() => [string|number|boolean|object]); //mandatory for type list
}




export interface Api{
    log(text:string):void;

    /**
     * regsiter a new widget
     * @param description the widget description
     * @param editableParameters editable parameters
     */
    registerWidget(description:WidgetDefinition,editableParameters?:Record<string,WidgetParameter|boolean>):void;
    get formatter():object;
    /**
     * replace any ${name} with the values of the replacement object
     * e.g. templateReplace("test${a} test${zzz}",{a:"Hello",zzz:"World"})
     * will return: "testHello testWorld"
     * @param template
     * @param replacements
     * @returns {string}
     */
    templateReplace(template:string,replacements:Record<string,string|number>):string

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

export type UserMapLayerContext=object;
export type LayerOptions=object;
export interface UserMapLayerResultBase {
    options?: LayerOptions; //the potentially modified layer options
    //avnav will merge them with the original layer options
    //if you do not modify any options this can be omitted
    /**
     * a function that will be called before the layer is destroyed
     * @param context
     */
    finalizeFunction?:(context:UserMapLayerContext)=>Promise<void>;
    /**
     * create a tile url function
     * you can use the provided originalTileUrlFunction
     * @param options
     * @param originalTileUrlFunction
     * @param context
     */
}
export interface UserMapLayerResultRaster extends UserMapLayerResultBase {

    createTileUrlFunction?:(options:LayerOptions,
                            originalTileUrlFunction:UrlFunction,
                            context:UserMapLayerContext)=>UrlFunction;
    /**
     * set the loaded image at the tile
     * the default is
     *    tile.getImage().src=src
     * @param tile an openlayers tile
     * @param src the src (normally the tile url)
     * @param context
     */
    tileLoadFunction?:(tile:Tile,src:string,context:UserMapLayerContext)=>Promise<void>;
}

export interface UserMapLayerResultVector extends UserMapLayerResultBase {
    /**
     * a callback that will give you access to the MapLibre map once it is loaded
     * when using this callback you can store a reference to the map in the context for
     * later access
     * @param map
     * @param context
     */
    loadCallback?:(map:MapLibreMap,context:UserMapLayerContext)=>void;
    /**
     * a function to format a list of features
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
     */
    featureListFormatter?:FeatureListFormatter;

}
export type UserMapLayerResult=UserMapLayerResultRaster|UserMapLayerResultVector;
/**
 * the callback that is called when a user map layer is created
 * @param options {object} the layer options as defined in the chart definition
 * @param context {object} an object that can be used to store data
 */
export type UserMapLayerCallback=(options:LayerOptions,context:UserMapLayerContext)=>Promise<UserMapLayerResult>;
export type MapLayerProfilesRaster="zxy"|"tms"|"wms"|"encrypted-zxy"|"PMTiles"
export type MapLayerProfilesVector="maplibre"
export type MapLayerProfiles=MapLayerProfilesRaster|MapLayerProfilesVector


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
     * register a customized map layer that can be used as the "profile" name in map
     * layer configurations
     * @param baseName {MapLayerProfiles} the name of an internal layer profile
     * @param name {string} the name of the layer. Internally plugin: or user: will be prepended
     *                      so for a layer of myplugin you need to use the profile plugin:myplugin
     * @param callback {UserMapLayerCallback} an callback that will be called with the layer options from
     *                      the chart definition
     *                      the result is an object with potentially modified layer options
     *                      and a set of callback functions (depending on the base layer)
     */
    registerUserMapLayer(baseName:MapLayerProfiles,name:string,callback:UserMapLayerCallback):void;


    /**
     * get the config values for the plugin
     * @return {Promise<void>}
     */
    getConfig():Promise<object>;
}


