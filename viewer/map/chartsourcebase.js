/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
 ###############################################################################
 */

import base from '../base.js';
import assign from 'object-assign';
import Helper from '../util/helper.js';
import CryptHandler from './crypthandler.js';
import shallowcompare from '../util/compare.js';
import featureFormatter from "../util/featureFormatter";
import globalstore from "../util/globalstore";
import keys from '../util/keys';
import {LineString as olLineString, MultiLineString as olMultiLineString, Point as olPoint} from 'ol/geom';
import {Stroke as olStroke, Fill as olFill} from 'ol/style';
import {
    EditableBooleanParameter, EditableColorParameter,
    EditableIconParameter,
    EditableNumberParameter,
    EditableSelectParameter
} from "../util/EditableParameter";

export const getOverlayConfigName=(chartEntry)=>{
    return chartEntry.overlayConfig || chartEntry.chartKey;
}
class ChartSourceBase {

    COLOR_INVISIBLE='rgba(0,0,0,0)';
    /**
     *
     * @param mapholder
     * @param chartEntry
     *        properties: url           - the chart url
     *                    chartKey      - a base name for the chart used as key
     *                    overlayConfig - name of the overlay config assigned to this chart
     *                    tokenUrl      - the url for a token handler script (opt)
     *                    tokenFunction - the name of the token function we expect from the token handler
     */
    constructor(mapholder, chartEntry) {
        this.mapholder = mapholder;
        /**
         * @protected
         */
        this.chartEntry = assign({},chartEntry);
        for (let k in this.chartEntry){
            if (typeof this.chartEntry[k] === 'function'){
                delete this.chartEntry[k];
            }
        }

        /**
         * @protected
         * @type {undefined}
         */
        this.encryptFunction = undefined;
        /**
         * @protected
         * @type {boolean}
         */
        this.isReadyFlag = false;
        /**
         * @protected
         * @type {boolean}
         */

        this.layers = [];

        this.sequence='';

        this.removeSequence=0;

        this.visible=true;
    }
    getConfig(){
        return(assign({},this.chartEntry));
    }

    isReady(){
        return this.isReadyFlag;
    }
    getLayers() {
        if (!this.isReadyFlag) {
            return [];
        }
        return this.layers;

    }

    /**
     * redraw this layer if the sequence has changed
     * return true to let checkSequence always resolve to 0
     * thus preventing a complete redraw of the map
     * @return {boolean}
     */
    redraw(){
        return false;
    }
    getScale(){
        try {
            let view = this.mapholder.olmap.getView();
            let scale = 1;
            let currentZoom = view.getZoom();
            let cmin=parseFloat(this.chartEntry.minScale);
            let cmax=parseFloat(this.chartEntry.maxScale);
            if (cmin && currentZoom < cmin) {
                scale = 1 / Math.pow(2, cmin - currentZoom);
            }
            if (cmax && currentZoom > cmax) {
                scale = Math.pow(2, currentZoom - cmax);
            }
            return scale;
        }catch (e){}
        return 1;
    }

    /**
     * returns a promise that resolves to 1 for changed
     */
    checkSequence(force){
        let lastRemoveSequence=this.removeSequence;
        return new Promise((resolve,reject)=>{
            if (! globalstore.getData(keys.gui.capabilities.fetchHead,false)){
                resolve(0);
                return;
            }
            if (! this.visible){
                resolve(0);
                return;
            }
            fetch(this.getUrl(),{method:'HEAD'})
                .then((response)=>{
                    if (this.removeSequence !== lastRemoveSequence || (! this.isReady() && ! force)) {
                        resolve(0);
                        return;
                    }
                    let newSequence=response.headers.get('last-modified');
                    if (newSequence !== this.sequence) {
                        this.sequence=newSequence;
                        let drawn=this.redraw();
                        resolve(drawn?0:1);
                    }
                    else resolve(0)
                })
                .catch((e)=>resolve(0))
        });
    }

    isEqual(other){

        if (this.mapholder !== other.mapholder) return false;
        return shallowcompare(this.chartEntry,other.chartEntry);
    }
    getUrl(){
        return this.chartEntry.url;
    }

    getChartKey() {
        let chartBase = this.chartEntry.chartKey;
        if (!chartBase) chartBase = this.chartEntry.url;
        return chartBase;
    }
    getOverlayConfigName(){
        return getOverlayConfigName(this.chartEntry);
    }

    prepareInternal(){
        return new Promise((resolve,reject)=>{
            reject("prepareInternal not implemented in base class");
        })
    }

    prepare() {

        const runPrepare=(resolve,reject)=>{
            this.checkSequence(true)
                .then((r)=> {
                    this.prepareInternal()
                        .then((layers) => {
                            layers.forEach((layer)=>{
                                if (!layer.avnavOptions) layer.avnavOptions={};
                                layer.avnavOptions.chartSource=this;
                            });
                            this.layers = layers;
                            if (!this.chartEntry.enabled) {
                                this.visible=false;
                                this.layers.forEach((layer) => layer.setVisible(false));
                            }
                            this.isReadyFlag = true;
                            resolve(this.layers);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                })
                .catch((e)=>reject(e));
        };
        return new Promise((resolve, reject)=> {
            if (this.chartEntry.tokenUrl) {
                CryptHandler.createOrActivateEncrypt(this.getChartKey(), this.chartEntry.tokenUrl, this.chartEntry.tokenFunction)
                    .then((result)=> {
                        this.encryptFunction = result.encryptFunction;
                        runPrepare(resolve,reject)
                    })
                    .catch((error)=> {
                        reject(error)
                    });
                return;
            }
            runPrepare(resolve,reject);
        });
    }



    destroy(){
        CryptHandler.removeChartEntry(this.getChartKey());
        this.isReadyFlag=false;
        this.layers=[];
        this.removeSequence++;
    }

    setVisible(visible){
        this.visible=visible;
        if (! this.isReady()) return;
        this.layers.forEach((layer)=>layer.setVisible(visible));
    }
    resetVisible(){
        if (! this.isReady()) return;
        this.visible=this.chartEntry.enabled;
        this.layers.forEach((layer)=>layer.setVisible(this.chartEntry.enabled));
    }

    featureToInfo(feature,pixel,layer){
        return {};
    }
    getSymbolUrl(sym,opt_ext){
        if (! sym) return;
        if (! sym.match(/\./) && opt_ext) sym+=opt_ext;
        let url;
        if (sym.match(/^https*:/)) return sym;
        if (sym.match(/^\//)) return sym;
        if (this.chartEntry[editableOverlayParameters.icon]){
            url=this.chartEntry[editableOverlayParameters.icon] + "/" + sym;
            if (this.chartEntry[editableOverlayParameters.defaultIcon]) url+="?fallback="+encodeURIComponent(this.chartEntry[editableOverlayParameters.defaultIcon]);
        }
        else{
            return this.chartEntry[editableOverlayParameters.defaultIcon];
        }
        return url;
    }
    getLinkUrl(link){
        if (! link) return;
        if (link.match(/^https*:/)) return link;
        if (link.match(/^\//)) return link;
        if (! this.chartEntry[editableOverlayParameters.icon]) return;
        return this.chartEntry[editableOverlayParameters.icon]+"/"+link;
    }
    /**
     * call any user defined formatter with the properties
     * of the feature and merge this with the already fetched items
     * @param formatter {(string|function|undefined)}
     * @param info {Object} the info to be merged in
     * @param feature the ol feature
     * @param coordinates {navobjects.Point}
     * @param extended
     */
    formatFeatureInfo(formatter, info, feature, coordinates, extended) {
        if (!info || !feature) return {};
        if (typeof (formatter) === 'string') {
            formatter = featureFormatter[formatter];
        }

        if (formatter) {
            try {
                let fProps = assign({}, feature.getProperties());
                for (let k in fProps) {
                    if (typeof (fProps[k]) !== 'string' && typeof (fProps[k]) !== 'number') {
                        delete fProps[k];
                    }
                }
                if (coordinates) {
                    fProps.lat = coordinates.lat;
                    fProps.lon = coordinates.lon;
                }
                assign(info, Helper.filteredAssign({
                    sym: true,
                    name: true,
                    desc: true,
                    link: true,
                    htmlInfo: true,
                    time: true
                }, formatter(fProps, extended)));

            } catch (e) {
                base.log("error in feature info formatter : " + e);
            }
        }
        info.icon = this.getSymbolUrl(info.sym, '.png');
        info.link = this.getLinkUrl(info.link);
        return info;
    }

    setEnabled(enabled,opt_update){
        this.mapholder.setEnabled(this,enabled,opt_update);
    }

    /**
     * resolves to an array of featureInfo
     * @param pixel
     * @returns {ThenPromise<unknown>}
     */
    getChartFeaturesAtPixel(pixel){
        return new Promise((resolve,reject)=>{
            resolve([])
        })
    }

    hasFeatureInfo(){
        if (! this.isReady()) return false;
        return this.chartEntry.hasFeatureInfo||false;
    }
    /**
     *
     * @param supportedSettings {Object[]}
     */
    buildStyleConfig(supportedSettings){
        let rt={};
        if (! supportedSettings) return rt;
        Helper.iterate(supportedSettings,(setting)=>{
            const key=setting.name;
            if (this.chartEntry[setting.name] !== undefined){
                rt[key]=this.chartEntry[setting.name];
            }
            else{
                rt[key]=setting.default;
            }
        })
        return rt;
    }
}
class ConfigHelper extends Object {
    constructor(props) {
        super();
        this.apply(props);
    }
    apply(props){
        if (! props) return;
        for (let k in props) {
            this[k] = props[k];
        }
    }
    toString() {
        if (this.name !== undefined) return this.name;
        return super.toString();
    }
    clone(updates){
        let rt=new ConfigHelper()
        rt.apply(this);
        rt.apply(updates);
        return rt;
    }
}

/**
 * a list of known style parameters
 * we do not import EditableWidgetParameter here directly
 * as this could easily create circular dependencies
 * @type {*[]}
 */
export const editableOverlayParameters={
    minZoom:new EditableNumberParameter({name:'minZoom',displayName:'min zoom',default:0,description:'minimal zoom level to display this overlay'}),
    maxZoom:new EditableNumberParameter({name:'maxZoom',displayName:'max zoom',default: 0,description:'maximal zoom level to display this overlay'}),
    minScale:new EditableNumberParameter({name:'minScale',displayName:'min scale', default: 0,description:'shrink symbols below this zoom, 0 to unset'}),
    maxScale:new EditableNumberParameter({name:'maxScale',displayName:'max scale', default: 0,description:'enlarge symbols above this zoom, 0 to unset'}),
    allowOnline:new EditableBooleanParameter({name: 'allowOnline',displayName: 'allow online',default:false,description:'allow access to online http/https resources'}),
    showText:new EditableBooleanParameter({name:'showText',displayName: 'show text',default:false,description:'show text beside symbols if available'}),
    allowHtml:new EditableBooleanParameter({name:'allowHtml',displayName: 'allow html',default: false,description:'allow to show html content'}),
    icon: new EditableSelectParameter({name:'icons',displayName: 'icon file',readOnly:false,list:[undefined],description:'file that contains icons and linked resources'}),
    defaultIcon:new EditableIconParameter({name:'defaultIcon',displayName:'default icon',description:'default icon to be used for points'}),
    featureFormatter: new EditableSelectParameter({name:'featureFormatter',displayName:'featureFormatter',list:()=>{
            let formatters = [{label: '-- none --', value: undefined}];
            for (let f in featureFormatter) {
                if (typeof (featureFormatter[f]) === 'function') {
                    formatters.push({label: f, value: f,name:f});
                }
            }
            return formatters;
        },description:'a function to format the feature info (refer to the doc)'}),
    overwriteLineStyle: new EditableBooleanParameter({name:'style.overwriteLine',displayName:'own line style',default: false,description:'ignore line styles from document'}),
    lineWidth:new EditableNumberParameter({name:'style.lineWidth',list:[0,10],displayName:'line width',default: 3,description:'width in px for lines'}),
    lineColor:new EditableColorParameter({name: 'style.lineColor',displayName:'line color',default:'#000000',description:'line color' }),
    fillColor:new EditableColorParameter({name:'style.fillColor',displayName:'fill color',default: 'rgba(255,255,0,0.4)',description:'fill color for points'}),
    strokeWidth:new EditableNumberParameter({name: 'style.strokeWidth',displayName:'stroke width',default: 3,list:[0,40],description:'width in px for the border of point circles'}),
    strokeColor:new EditableColorParameter({name: 'style.strokeColor',displayName:'stroke color',default: '#ffffff',description:'color for the border of point circles'}),
    circleWidth:new EditableNumberParameter({name: 'style.circleWidth', displayName:'circle width',default: 10,list:[0,40],description:'width in px for point circles'}),
    overwriteTextStyle: new EditableBooleanParameter({name: 'style.overwriteText',  displayName:'own text style',default: false,description:'do not use the text style from the document'}),
    textSize:new EditableNumberParameter({name: 'style.textSize', displayName:'font size',default: 16,description:'font size in px for texts'}),
    textOffset:new EditableNumberParameter({name: 'style.textOffset', displayName: 'text offset',default: 32,description:'text offset in px from a point'}),
    textColor:new EditableColorParameter({name: 'style.textColor', displayName: 'text color',default: 'rgba(0,0,0,1)',description:'color for texts'}),
}
export const DEFAULT_SETTINGS=[editableOverlayParameters.minZoom,editableOverlayParameters.maxZoom];
export const SCALE_SETTINGS=[editableOverlayParameters.minScale,editableOverlayParameters.maxScale];
export const SYMBOL_SETTINGS=[editableOverlayParameters.icon,editableOverlayParameters.defaultIcon].concat(SCALE_SETTINGS);
export const CIRCLE_SETTINGS=[editableOverlayParameters.fillColor,editableOverlayParameters.circleWidth,editableOverlayParameters.strokeWidth,editableOverlayParameters.strokeColor].concat(SCALE_SETTINGS)
export const TEXT_FORMAT_SETTINGS=[editableOverlayParameters.textColor,editableOverlayParameters.textSize,editableOverlayParameters.textOffset]
export const TEXT_SETTINGS=[editableOverlayParameters.showText].concat(TEXT_FORMAT_SETTINGS)
export const LINE_SETTINGS=[editableOverlayParameters.lineWidth,editableOverlayParameters.lineColor]

/**
 *
 * @param settings {Object}
 * @param items
 * @param [opt_onlyExisting] {boolean} - if set only set items if already there
 */
export const addToSettings=(settings,items,opt_onlyExisting)=>{
    Helper.iterate(items,(item)=>{
        if (!item) return;
        if (settings[item.name] !== undefined ||  !opt_onlyExisting)
            settings[item.name]=item;
    })
}
/**
 * order a settings object (plain object)
 * will put all known settings in the order they have in editableOverlayParameters
 * and add all others at the end
 * @param settings
 * @param [opt_filter] if a filter is given - only add the settings that are available in the filter
 *        opt_filter can be an array of names or an array/plain object with ConfigHelper items as values
 * @returns {*[]} an array of settings
 */
export const orderSettings=(settings,opt_filter)=>{
    if (! settings) return;
    let ordered=[];
    let handled={};
    let filter;
    if (opt_filter){
        filter={};
        Helper.iterate(opt_filter,(fe)=>{
            filter[fe]=true; //we rely on toString for the config helper
        })
    }
    for (let k in editableOverlayParameters){
        const name=editableOverlayParameters[k].name;
        if (settings[name] !== undefined && (! filter || filter[name])){
            handled[name]=true;
            ordered.push(settings[name]);
        }
    }
    for (let k in settings){
        const name=settings[k].name;
        if (name && ! handled[name] && (! filter || filter[name])){
            ordered.push(settings[k]);
        }
    }
    return ordered;
}

export class FoundFeatureFlags{
    constructor() {
        this.hasAny=false;
        this.hasPoint=false;
        this.hasNonSymbolPoint=false;
        this.hasSymbol=false;
        this.hasLink=false;
        this.hasLineString=false;
        this.hasMultiline=false;
        this.hasLink=false;
        this.hasDescription=false;
        this.hasHtml=false;
        this.hasText=false;
    }

    /**
     * @callback ParseFeatureCallback
     * @param feature {olFeature}
     * @param rtv {FoundFeatureFlags}
     */
    /**
     * parse the found list of features
     * @param features {olFeature[]}
     * @param [featureCallback] {(ParseFeatureCallback|undefined)}
     * @return {FoundFeatureFlags}
     */
    static parseFoundFeatures(features,featureCallback){
        let rt=new FoundFeatureFlags();
        if (! features) return rt;
        features.forEach((feature)=>{
            if (featureCallback) featureCallback(feature,rt);
            const hasSymbol=(feature.get('symbol') !== undefined) || (feature.get('sym') !== undefined);
            if (feature.get('link') !== undefined) rt.hasLink=true;
            if (feature.get('name') !== undefined) rt.hasText=true;
            const desc=feature.get('desc')||feature.get('description');
            if (desc){
                rt.hasDescription=true;
                if (desc.indexOf("<")>=0) rt.hasHtml=true;
            }
            const geometry=feature.getGeometry();
            if (geometry) rt.hasAny=true;
            if (geometry instanceof olPoint){
               rt.hasPoint=true;
               if (!hasSymbol) rt.hasNonSymbolPoint=true;
               else rt.hasSymbol=true;
            }
            else if (geometry instanceof olLineString){
                rt.hasLineString=true;
            }
            else if(geometry instanceof olMultiLineString){
                rt.hasMultiline=true;
            }
        });
        return rt;
    }

    /**
     * @returns {Object.<string,Object>} a map of settings
     */
    createSettings(){
        let rt={};
        addToSettings(rt,DEFAULT_SETTINGS);
        if (this.hasSymbol) {
            addToSettings(rt,SYMBOL_SETTINGS)
        }
        if (this.hasLink) {
            addToSettings(rt,SYMBOL_SETTINGS)
            addToSettings(rt,editableOverlayParameters.allowOnline)
        }
        if (this.hasNonSymbolPoint){
            addToSettings(rt,CIRCLE_SETTINGS);
        }
        if (this.hasMultiline || this.hasLineString){
            addToSettings(rt,LINE_SETTINGS);
        }
        if (this.hasText){
            addToSettings(rt,TEXT_SETTINGS);
        }
        if (this.hasHtml){
            addToSettings(rt,editableOverlayParameters.allowHtml)
        }
        return rt;
    }
}

export const buildOlFontConfig=(settings,add)=>{
    let sz=settings[editableOverlayParameters.textSize];
    if (sz === undefined) sz=editableOverlayParameters.textSize.default;
    let color=settings[editableOverlayParameters.textColor];
    if (color === undefined) color=editableOverlayParameters.textColor.default;
    return {
        font:sz + "px " + globalstore.getData(keys.properties.fontBase),
        stroke: new olStroke({
            color: globalstore.getData(keys.properties.fontShadowColor),
            width: globalstore.getData(keys.properties.fontShadowWidth)
        }),
        fill: new olFill({
            color: color
        }),
        ...add
    }
}

export default  ChartSourceBase;