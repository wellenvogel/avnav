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
 * the api definition the can be used by user code
 * will be provided as the first parameter to the initializer function
 */
import LatLonSpherical from 'geodesy/latlon-spherical';
import Dms from 'geodesy/dms';
import {UrlFunction} from 'ol/Tile';
import {Tile} from "ol";
import {Map as MapLibreMap} from 'maplibre-gl';
import {MapLibreOptions} from "../map/maplibre/MapLibreLayer";
import React from 'react';
import ReactDOM from 'react-dom';
import Htm from "htm";
import * as OpenLayers from 'ol/index';


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
export type FeatureFormatterFunction=(data:object,extended:boolean)=>FeatureInfoType;
export interface LatLon{
    lat:number;
    lon:number;
}




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
export type WidgetParameterValue=string|number|boolean;
export type WidgetParameterValues=Record<string, WidgetParameterValue>;
/**
 * a condition for the visibility of parameters
 * the keys are the names of other parameters
 * this is an "and" condition - i.e. all values have to match
 */
export type PConditionCheckFunction=(allValues:WidgetParameterValues,ownValue:WidgetParameterValue)=>boolean;
export type PConditionValue=WidgetParameterValue|PConditionCheckFunction
export interface PCondition extends Record<string,PConditionValue> {
}
export type PCheckFunction=(ownValue:WidgetParameterValue,allValues:WidgetParameterValues)=>boolean;
export interface WidgetParameter{
    type: WidgetParameterType;
    displayName?:string;                        //the label to be shown, defaults to the name
    default?:WidgetParameterValue;
    list?:[WidgetParameterValue|object]
        | (() => [WidgetParameterValue|object]);//mandatory for type list
    description?:string;                        //help to be shown
    condition?: PCondition|[PCondition];        //a condition when to show,
                                                //and array is an "or" of the elements

    mandatory?:boolean;                         //default false
    readOnly?:boolean;                          //default false
    checker?:PCheckFunction;                    //optional check function
}
export interface ParametersWithName extends WidgetParameter{
    name:string;
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

export interface FeatureListItem extends Record<string,string|number> {
    _lat?:number;
    _lon?:number;
    _gtype?: string; //Geometry type
}
export type FeatureListFormatter=(featureList: [FeatureListItem],
                                  point:LatLon,
                                  context:UserMapLayerContext,
)=>[FeatureInfoType]|FeatureInfoType;

export type UserMapLayerContext=object;
export interface BoundingBox{
    minlon:number;
    minlat:number;
    maxlon:number;
    maxlat:number;
}
export interface LayerOptionsBase extends Record<string, any> {
    url?:string;                //the layer URL
    href?:string;               //synonym for URL
    name?:string;               //layer name
    minzoom?:number;            //the minimal zoom
    maxzoom?:number;            //the maximal zoom
    boundingbox?:BoundingBox;   //the covered bounding box (some layers like PMTiles will compute this)
}
export interface VectorLayerOptions extends LayerOptionsBase {
    useproxy?:boolean;         //use a proxy to avoid cors issues
    maplibre: MapLibreOptions; //the options as provided to the MapLibre map
                               //must include a "style" property
}
export interface RasterLayerOptions extends LayerOptionsBase {}
export interface UserMapLayerResultBase {
    /**
     * a function that will be called before the layer is destroyed
     * @param context
     */
    finalizeFunction?:(context:UserMapLayerContext)=>Promise<void>;
    /**
     * if returned this function must return
     * a sequence that is used to determine if the map should be reloaded
     */
    sequenceFunction?:()=>Promise<string|number>;
}
export interface UserMapLayerResultRaster extends UserMapLayerResultBase {
    /**
     * the potentially modified layer options
     * avnav will merge them with the original layer options
     * if you do not modify any options this can be omitted
     */
    options?: RasterLayerOptions;
    /**
     * create a tile url function that translates the tile coordinates zxy to a URL
     * you can use the provided originalTileUrlFunction
     * @param options
     * @param originalTileUrlFunction
     * @param context
     */
    createTileUrlFunction?:(options:RasterLayerOptions,
                            originalTileUrlFunction:UrlFunction,
                            context:UserMapLayerContext)=>UrlFunction;
    /**
     * set the loaded image at the tile
     * the default is
     *    tile.getImage().src=src
     * @param tile an openlayers tile
     * @param src the src (normally the tile url as returned by the tileUrlFunction)
     * @param context
     */
    tileLoadFunction?:(tile:Tile,src:string,context:UserMapLayerContext)=>Promise<void>;
}

export interface UserMapLayerResultVector extends UserMapLayerResultBase {
    /**
     * the potentially modified layer options
     * avnav will merge them with the original layer options
     * if you do not modify any options this can be omitted
     */
    options?: VectorLayerOptions;
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
export interface AdditionalLayerOptions{
    name:string; //the chart Name
}
/**
 * the callback that is called when a user map layer is created
 * @param options {object} the layer options as defined in the chart definition
 * @param context {object} an object that can be used to store data
 */
export type UserMapLayerCallback=(options:VectorLayerOptions|RasterLayerOptions,context:UserMapLayerContext,chartOptions:AdditionalLayerOptions)=>Promise<UserMapLayerResult>;
export type MapLayerProfilesRaster="zxy"|"tms"|"wms"|"encrypted-zxy"|"PMTiles"
export type MapLayerProfilesVector="maplibre"
export type MapLayerProfiles=MapLayerProfilesRaster|MapLayerProfilesVector

export type StoreData=object|string|boolean|number;


export interface Button{
    name:string;            //the button name and css class
    label?:string;          //the label, fallback: name with 1st letter uppercase
    visible?:boolean;       //just for convinience
    close?:boolean;         //if not set or true close the dialog when clicked
                            //otherwise you must implement onClick and call
                            //context.closeDialog()
    /**
     * the click handler of the butoon
     * @param event the original event (pass this e.g. to showDialog as context)
     * @param currentValues the current values of the parameters
     * @param closeFunction can be called to close the dialog
     * @returns {WidgetParameterValues|undefined} if you return a object it is interpreted as new values to be set in the dialog
     */
    onClick?:(event:object,
              currentValues:WidgetParameterValues,
              closeFunction:()=>void)=>WidgetParameterValues|undefined;
}
export interface DialogConfig {
    className?: string;
    title?: string;                      //the dialog title
    text?: string;                       //some text to be shown in the dialog
    html?: string;                       //some html to be shown after the text
    parameters?: [ParametersWithName];  //the list of parameters to be shown
    values?: WidgetParameterValues; //the initial values
    fullscreen?: boolean;                //fill the complete page
    /**
     * callback when a value changes
     * @param event
     * @param values only the changed values
     */
    onChange?: (event: object, values: WidgetParameterValues) => WidgetParameterValues | undefined;
    buttons?: [Button];               //if not provided Cancel is shown
    /**
     * if provided it will be called when the dialog closes
     *
     */
    onClose?: () => void;
}
/**
 * options that control caching for the proxy
 * (intended for online chart access)
 */
export interface ProxyOptions{
    maxage?:number; //max age of a cache entry in seconds
    name: string;   //the name of the cache (typical: chartName#layer)
    z:number;       //zoom
    x:number;       //x
    y:number;       //y
}
export type Page="mainpage"|"navpage"|"gpspage"|"addonpage"|"wpapage"|"settingspage"|"editroutepage"|"downloadpage"|"statuspage"
export interface UserButton{
    name: string;                   //will set the CSS class, unique inside the plugin
    icon?: string|URL;              //relative to plugin base
    onClick:(event:object)=>void    //if set this function is called instead of invoking the url
    visible?:boolean;
    disabled?:boolean;
    toggle?:boolean;
    storeKeys?:Record<string, string>; //can control visible/disabled/toogle
    updateFunction?:(values:object)=>object; //translate store values
}

/**
 * a couple of modules that are used inside AvNav
 * but also can be used by plugins
 * as they are not directly available as standalone modules
 * you will have to write e.g.
 *   const {useState,useRef}=api.modules().React;
 * instead of
 *   import {useState,useRef} from 'react';
 *
 */
export interface Modules{
    React: typeof React
    ReactDOM: typeof ReactDOM
    /**
     * Htm is the htm function from
     * https://github.com/developit/htm
     * bound to React.createElement
     * Using this function you can use htm's template
     * language that is very similar to react's JSX
     * The result can be used at several API methods that expect a string or HTML
     * Example:
     *  const HTM=api.modules().Htm;
     *  const value=99;
     *  const v=HTM`<div onClick=${(ev)=>console.log('click')}>${value}</div>`
     *
     * Refer to the documentation for usages.
     */
    Htm: typeof Htm,
    LatLonSpherical: typeof LatLonSpherical,
    Dms: typeof Dms,
    ol: typeof OpenLayers,
    avnav: any
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
     * build a proxy URL to send requests via the AvNav server
     * any header value will be forwareded
     * as you cannot really change the origin and referer header
     * you can add them to the returned URL like this:
     * buildProxyUrl(oriUrl)+"?referer="+encodeURIComponent(referer)+"&origin="+encodeURIComponent(origin)
     * @param url
     * @param headers - a map of headers that will update the request headers
     * @param proxyOptions - options to control the caching of the proxy
     */
    buildProxyUrl(url:string|URL,headers?:Record<string, string>,proxyOptions?:ProxyOptions):string;

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

    /**
     * register
     * @param button the button to be shown
     * @param page the page (or list of pages) that should show the button
     *             defaults to addonpage
     */
    registerUserButton(button: UserButton,page?:Page|[Page]):void;

    get FEATUREINFO_KEYS():FeatureInfoKeys;

    /**
     * register a customized map layer that can be used as the "profile" name in map
     * layer configurations
     * @param baseName {MapLayerProfiles} the name of an internal layer profile
     * @param name {string} the name of the layer. Internally plugin_ or user_ will be prepended
     *                      so for a layer of myplugin you need to use the profile plugin:myplugin
     * @param callback {UserMapLayerCallback} an callback that will be called with the layer options from
     *                      the chart definition
     *                      the result is an object with potentially modified layer options
     *                      and a set of callback functions (depending on the base layer)
     */
    registerUserMapLayer(baseName:MapLayerProfiles,name:string,callback:UserMapLayerCallback):void;

    /**
     * get a unique base key to read or write entries in the internal store
     * any keys being used for setStoreData must start with this key
     * As a recommendation the keys should use this prefix and append a dot + a name for the key
     */
    getStoreBaseKey():string;

    /**
     * store data in AvNav's internal store
     * This can be used to communicate with widgets. When storing a data item with a key that
     * is part of the storeKeys of a widget, this widget will get updated and will receive the stored
     * value
     * @param key   the key for the data to be stored. Must start with the string that you
     *              get from getStoreBaseKey
     * @param data  the data to be stored
     */
    setStoreData(key:string,data:StoreData):void;

    /**
     * retrieve data from AvNavs internal store.
     * When using the retrieved data to store it again bei careful to create a copy
     * if the data is not a simple type like number|boolean|string
     * @param key any store key. You can use keys that start with your own key but also and other key
     *            like nav.gps....
     * @param defaultv the default value to be returned if the item is not in the store
     */
    getStoreData(key:string,defaultv?:StoreData):StoreData;

    /**
     * show a simple dialog
     * @param dialog
     * @param context you can provide here the event object you got from events
     *                that you registered
     * @returns a function that can be called to close the dialog
     */
    showDialog(dialog:DialogConfig,context:object):Promise<(()=>void)>

    /**
     * write some data to the local storage
     * @param key a name
     * @param data {StoreData} undefined to remove the item
     */
    setLocalStorage(key:string,data:StoreData|undefined):void;

    /**
     * get some data from the local storage
     * @param key
     * @param defaultv
     */
    getLocalStorage(key:string,defaultv?:StoreData):StoreData;
    /**
     * get the config values for the plugin
     * @return {Promise<void>}
     */
    getConfig():Promise<object>;

    modules():Modules;
}


