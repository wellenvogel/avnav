/**
 * the api definition the can be used by user code
 * will be visible at window.avnav.api
 */

import WidgetFactory from '../components/WidgetFactory.jsx';
import base from '../base.js';
import Formatter from './formatter.js';
import Helper from './helper.js';
import Toast from '../components/Toast.jsx';
import featureFormatter from "./featureFormatter";
import LatLon from "geodesy/latlon-spherical";
import Dms from "geodesy/dms";

class Api{
    constructor(){
        this.formatter=Formatter;
    }

    log(text){
        base.log("API: "+text);
    }
    registerWidget(description,opt_editableParameters){
        WidgetFactory.registerWidget(description,opt_editableParameters);
    }
    formatter(){
        return Formatter;
    }
    /**
     * replace any ${name} with the values of the replacement object
     * e.g. templateReplace("test${a} test${zzz}",{a:"Hello",zzz:"World"})
     * will return: "testHello testWorld"
     * @param tstring
     * @param replacements
     * @returns {string}
     */
    templateReplace(template,replacements){
        return Helper.templateReplace(template,replacements)
    }

    /**
     * escape special characters in a string
     * so it can be afterwards safely added to some HTML
     * @param string
     */
    escapeHtml(string){
        return Helper.escapeHtml(string);
    }

    /**
     * show a toast containing a message
     * @param string the message
     * @param opt_time a timeout in ms (optional)
     */
    showToast(string,opt_time){
        Toast(string,opt_time);
    }

    /**
     * register a formatter function
     * if the formatter (name) already exists an exception is thrown
     * the formatterFunction should have a "parameters" property describing the meaning
     * of it's (potentially) handled options
     * @param name the name of the formatter
     * @param formatterFunction the function
     */
    registerFormatter(name,formatterFunction){
        WidgetFactory.registerFormatter(name,formatterFunction);
    }

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
    registerFeatureFormatter(name,formatterFunction){
        if (! name){
            throw new Error("missing name in registerFeatureFormatter");
        }
        if (! formatterFunction){
            throw new Error("missing name in registerFeatureFormatter");
        }
        if (typeof(formatterFunction) !== 'function'){
            throw new Error("formatterFunction is no function in registerFeatureFormatter");
        }
        if (featureFormatter[name]){
            throw new Error("name "+name+" already exists in registerFeatureFormatter");
        }
        featureFormatter[name]=formatterFunction;
    }

    /**
     * get the version of AvNav as an int
     * @returns {number}
     */
    getAvNavVersion(){
        let version=window.avnav.version;
        if (version.match(/dev-/)){
            version=version.replace(/dev-/,'').replace(/[-].*/,'');
        }
        return parseInt(version);
    }

    /**
     * get the {@link https://www.movable-type.co.uk/scripts/geodesy-library.html LatLonSpherical} module
     * use it like:
     * let LatLon=avnav.api.LatLon();
     * let point=new LatLon(54,13);
     * @param lat
     * @param lon
     * @return {LatLonSpherical}
     */
    LatLon(){
        return LatLon;
    }

    /**
     * get an instance of {@link https://www.movable-type.co.uk/scripts/geodesy-library.html Dms} to parse
     * lat/lon data
     * @return {Dms}
     */
    dms(){
        return Dms;
    }
}

export default  new Api();

