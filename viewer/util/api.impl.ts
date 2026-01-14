/**
 * the api definition the can be used by user code
 * will be provided as the first parameter to the initializer function
 */

// @ts-ignore
import WidgetFactory from '../components/WidgetFactory.jsx';
// @ts-ignore
import base from '../base.js';
// @ts-ignore
import Formatter from './formatter.js';
// @ts-ignore
import Helper from './helper.js';
// @ts-ignore
import Toast from '../components/Toast.jsx';
// @ts-ignore
import featureFormatter from "./featureFormatter";
import LatLonSperical from "geodesy/latlon-spherical";
import Dms from "geodesy/dms";
// @ts-ignore
import AvNavVersion from '../version';
import {
    Api as ApiIntf,
    ApiV2 as ApiV2Intf,
    FeatureFormatterFunction,
    FeatureInfoKeys,
    FeatureInfoType,
    FormatterFunction,
    MapLayerProfiles,
    UserMapLayerCallback
} from './api.interface';

export class ApiImpl implements ApiIntf {
    constructor() {
    }

    log(text: string) {
        base.log("API: " + text);
    }

    registerWidget(description: object, opt_editableParameters: object): void {
        WidgetFactory.registerWidget(description, opt_editableParameters);
    }

    get formatter() {
        return {...Formatter};
    }

    /**
     * replace any ${name} with the values of the replacement object
     * e.g. templateReplace("test${a} test${zzz}",{a:"Hello",zzz:"World"})
     * will return: "testHello testWorld"
     * @param template
     * @param replacements
     * @returns {string}
     */
    templateReplace(template: string, replacements: object): string {
        return Helper.templateReplace(template, replacements)
    }

    /**
     * escape special characters in a string
     * so it can be afterwards safely added to some HTML
     * @param string
     */
    escapeHtml(string: string): string {
        return Helper.escapeHtml(string);
    }

    /**
     * show a toast containing a message
     * @param string the message
     * @param opt_time a timeout in ms (optional)
     */
    showToast(string: string, opt_time?: number): void {
        Toast(string, opt_time);
    }

    /**
     * register a formatter function
     * if the formatter (name) already exists an exception is thrown
     * the formatterFunction should have a "parameters" property describing the meaning
     * of it's (potentially) handled options
     * @param name the name of the formatter
     * @param formatterFunction the function
     */
    registerFormatter(name: string, formatterFunction: FormatterFunction) {
        WidgetFactory.registerFormatter(name, formatterFunction);
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
    registerFeatureFormatter(name: string, formatterFunction: FeatureFormatterFunction) {
        if (!name) {
            throw new Error("missing name in registerFeatureFormatter");
        }
        if (!formatterFunction) {
            throw new Error("missing name in registerFeatureFormatter");
        }
        if (typeof (formatterFunction) !== 'function') {
            throw new Error("formatterFunction is no function in registerFeatureFormatter");
        }
        if (featureFormatter[name]) {
            throw new Error("name " + name + " already exists in registerFeatureFormatter");
        }
        featureFormatter[name] = formatterFunction;
    }

    /**
     * get the version of AvNav as an int
     * @returns {number}
     */
    getAvNavVersion(): number {
        let version = AvNavVersion;
        if (version.match(/dev-/)) {
            version = version.replace(/dev-/, '').replace(/[-].*/, '');
        }
        return parseInt(version);
    }

    /**
     * get the {@link https://www.movable-type.co.uk/scripts/geodesy-library.html LatLonSpherical} module
     * use it like:
     * let LatLon=avnav.api.LatLon();
     * let point=new LatLon(54,13);
     * @return {LatLonSpherical}
     */
    LatLon(): typeof LatLonSperical {
        return LatLonSperical;
    }

    /**
     * get an instance of {@link https://www.movable-type.co.uk/scripts/geodesy-library.html Dms} to parse
     * lat/lon data
     * @return {typeof Dms}
     */
    dms(): typeof Dms {
        return Dms;
    }
}

//update this whenever the FeatureInfoType changes
//otherwise compilation will fail - so it should be easy
const KeyHelper: Required<FeatureInfoType> = {
    buoy: "",
    description: "",
    htmlInfo: "",
    icon: "",
    light: "",
    link: "",
    name: "",
    position: undefined,
    symbol: "",
    time: 0,
    top: ""
}

export const getFeatureInfoKeys = (): FeatureInfoKeys => Object.keys(KeyHelper) as FeatureInfoKeys;

export class ApiV2 extends ApiImpl implements ApiV2Intf {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registerUserMapLayer(_baseName: MapLayerProfiles, _name: string, _callback: UserMapLayerCallback): void {
        throw new Error("Method not implemented.");
    }
    getBaseUrl(): string {
        throw new Error("Method not implemented.");
    }
    getPluginName(): string {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registerLayoutData(_name: string, _layoutJson: object): void {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registerLayout(_name: string, _url: string | URL): void {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registerUserApp(_name: string, _url: string | URL, _icon: string | URL, _title?: string, _newWindow?: boolean): void {
        throw new Error("Method not implemented.");
    }
    get FEATUREINFO_KEYS():FeatureInfoKeys {
        return getFeatureInfoKeys();
    }
    getConfig(): Promise<object> {
        throw new Error("Method not implemented.");
    }


}

export default  new ApiImpl();

