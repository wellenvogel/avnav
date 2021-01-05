import React from "react";
import assign from "object-assign";
import widgetList from './WidgetList';
import Dynamic from '../hoc/Dynamic.jsx';
import DirectWidget from './DirectWidget.jsx';
import globalStore from '../util/globalstore.jsx';
import Formatter from '../util/formatter';
import Visible from '../hoc/Visible.jsx';
import ExternalWidget from './ExternalWidget.jsx';
import keys,{KeyHelper} from '../util/keys.jsx';
import Requests from '../util/requests.js';
import base from '../base.js';
import {GaugeRadial,GaugeLinear} from './CanvasGauges.jsx';

export class WidgetParameter{
    constructor(name,type,list,displayName){
        this.name=name;
        this.type=type;
        this.default=undefined;
        this.list=list;
        this.displayName=displayName||name;
    }
    clone(){
        let rt=createWidgetParameter(this.name,this.type,this.list,this.displayName);
        rt.default=this.default;
        return rt;
    }
    getList(){
        if (typeof (this.list) === 'function') return this.list();
        return this.list||[];
    }
    setValue(widget,value){
        if (! widget) widget={};
        if (this.type == WidgetParameter.TYPE.DISPLAY) return widget;
        if (value === '') value=undefined;
        widget[this.name] = value;
        return widget;
    }

    /**
     * unconditionally set the default value
     * @param widget
     */
    setDefault(widget){
        let current=this.getValue(widget);
        if (this.default !== undefined){
            this.setValue(widget,this.default);
        }
    }
    getValue(widget){
        let rt=widget[this.name];
        if (rt === undefined) rt='';
        return rt;
    }
    getValueForDisplay(widget,opt_placeHolder){
        let rt=this.getValue(widget);
        if (rt !== undefined) return rt;
        rt=this.default;
        if (rt !== undefined) return rt;
        return opt_placeHolder;
    }
    isValid(value){
        return true;
    }
    isChanged(value){
        return value !== this.default;
    }
    ensureValue(widget){
        if (this.type === WidgetParameter.TYPE.NUMBER){
            if (widget[this.name] !== undefined ) widget[this.name]=parseFloat(widget[this.name]);
        }
        if (this.type === WidgetParameter.TYPE.BOOLEAN){
            if (widget[this.name] !== undefined ) widget[this.name]=widget[this.name]?true:false;
        }
    }
}

class KeyWidgetParameter extends WidgetParameter {
    constructor(name, type, list, displayName) {
        super(name, type, list, displayName);
        this.list = ()=> {
            let kl = KeyHelper.getValueKeys().slice(0);
            let storeKeys=globalStore.getKeysByPrefix('nav.gps',true);
            storeKeys.forEach((sk)=>{
                if (kl.indexOf(sk) >= 0) return;
                kl.push(sk);
            })

            return kl;
        };
    }
    setValue(widget, value) {
        if (!widget) widget = {};
        if (!widget.storeKeys) widget.storeKeys = {};
        if (value === '') value=undefined;
        widget.storeKeys.value = value;
        return widget;
    }

    getValue(widget) {
        if (!widget) return '';
        if (!widget.storeKeys) return '';
        return widget.storeKeys.value||'';
    }

}

class ArrayWidgetParameter extends WidgetParameter {
    constructor(name, type, list, displayName) {
        super(name, type, list, displayName);
    }

    setValue(widget, value) {
        if (!widget) widget = {};
        if (typeof(value) === 'string') value=value.split(",");
        widget[this.name]=value;
        return widget;
    }
    getValue(widget){
        let rt=widget[this.name];
        if (! rt) return '';
        if (rt instanceof Array) return rt.join(",");
        return rt;
    }
}

class ReadOnlyWidgetParameter extends WidgetParameter {
    constructor(name, type, list, displayName) {
        super(name, type, list, displayName);
    }

    setValue(widget, value) {
        if (!widget) widget = {};
        return widget;
    }
}

WidgetParameter.TYPE={
    STRING:1,
    NUMBER:2,
    KEY:3,
    SELECT:4,
    DISPLAY: 5,
    ARRAY: 6,
    FORMATTER_PARAM: 7,
    BOOLEAN:8,
    COLOR:9
};


export const createWidgetParameter=(name,type,list,displayName)=>{
    if (typeof(type) === 'string'){
        type=WidgetParameter.TYPE[type];
        if (type === undefined) return;
    }
    switch(type) {
        case WidgetParameter.TYPE.DISPLAY:
            return new ReadOnlyWidgetParameter(name,type,list,displayName);
        case WidgetParameter.TYPE.STRING:
        case WidgetParameter.TYPE.NUMBER:
        case WidgetParameter.TYPE.SELECT:
        case WidgetParameter.TYPE.BOOLEAN:
        case WidgetParameter.TYPE.COLOR:
            return new WidgetParameter(name, type, list, displayName);
        case WidgetParameter.TYPE.KEY:
            return new KeyWidgetParameter(name, type, list, displayName);
        case WidgetParameter.TYPE.ARRAY:
        case WidgetParameter.TYPE.FORMATTER_PARAM:
            return new ArrayWidgetParameter(name, type, list, displayName);

    }
};

const PREDEFINED_PARAMETERS=[
    createWidgetParameter('caption',WidgetParameter.TYPE.STRING),
    createWidgetParameter('unit',WidgetParameter.TYPE.STRING),
    createWidgetParameter('formatter', WidgetParameter.TYPE.SELECT,()=>{
        let fl=[];
        for (let k in Formatter){
            if (typeof(Formatter[k]) === 'function') fl.push(k);
        }
        return fl;
    }),
    createWidgetParameter('formatterParameters',WidgetParameter.TYPE.FORMATTER_PARAM,undefined,"formatter parameters"),
    createWidgetParameter('value',WidgetParameter.TYPE.KEY),
    createWidgetParameter("className",WidgetParameter.TYPE.STRING,undefined,"css class")
];

const getDefaultParameter=(name)=>{
    for (let k in PREDEFINED_PARAMETERS){
        if (PREDEFINED_PARAMETERS[k].name === name) return PREDEFINED_PARAMETERS[k].clone();
    }
};






class WidgetFactory{
    constructor(){
        this.createWidget=this.createWidget.bind(this);
        this.formatter=Formatter;
        this.widgetDefinitions=[];
        //create a copy of the widget list for adding/removing
        for (let k=0;k<widgetList.length;k++){
            this.widgetDefinitions.push(widgetList[k]);
        }
        this.getAvailableWidgets=this.getAvailableWidgets.bind(this);
    }
    /**
     * find a complete widget description
     * @param widget - either a name or a widget description with a name field
     * @returns {*}
     */
    findWidget(widget,opt_useFallback){
        let i=this.findWidgetIndex(widget,opt_useFallback);
        if (i < 0) return undefined;
        return this.widgetDefinitions[i];
    }

    /**
     *
     * @param widget
     * @return {WidgetParameter[]|undefined}
     */
    getEditableWidgetParameters(widget){
        let widgetData=this.findWidget(widget);
        if (! widgetData) return[];
        let rt=[];
        let mergedData=assign({},widgetData,widget);
        let wClass=widgetData.wclass || DirectWidget;
        let editableParameters=assign({className:true},wClass.editableParameters,widgetData.editableParameters);
        let storeKeys=assign({},wClass.storeKeys,widgetData.storeKeys);
        for (let pname in editableParameters){
            let pdefinition=editableParameters[pname];
            if (! pdefinition) continue;
            let predefined=getDefaultParameter(pname);
            if (! predefined && (typeof(pdefinition) !== 'object')){
                base.log("invalid parameter definition in widget "+widgetData.name+": "+pname);
                continue;
            }
            if (predefined){
                pdefinition=predefined;
                if (pdefinition.name === 'formatter'){
                    if (widgetData.formatter){
                        pdefinition.type=WidgetParameter.TYPE.DISPLAY; //read only
                        pdefinition=pdefinition.clone(); //ensure correct class
                        pdefinition.getValue=(widget)=> {
                            if (typeof(widgetData.formatter) === 'function') {
                                return widgetData.formatter.name;
                            }
                            else {
                                return widgetData.formatter;
                            }
                        }
                    }
                }
                if (pdefinition.name === 'value' && storeKeys.value){
                    continue;
                }
            }
            else{
                let npdefinition=createWidgetParameter(pname,pdefinition.type,pdefinition.list,pdefinition.displayName);
                if (! npdefinition){
                    base.log("unknown widget parameter type: "+pdefinition.type);
                    continue;
                }
                npdefinition.default=pdefinition.default;
                pdefinition=npdefinition;
            }
            if (pdefinition.default === undefined) pdefinition.default=pdefinition.getValue(widgetData);
            rt.push(pdefinition);
        }
        return rt;
    }


    /**
     * find the index for a widget
     * @param widget - either a name or a widget description with a name field
     * @returns {number} - -1 omn error
     */
    findWidgetIndex(widget,opt_useFallback){
        if (widget === undefined) return -1;
        let search=widget;
        if (typeof(widget) !== "string"){
            search=widget.name;
        }
        for (let i=0;i<this.widgetDefinitions.length;i++) {
            let e = this.widgetDefinitions[i];
            if ((e.name !== undefined && e.name == search ) || (e.caption == search)) {
                return i;
            }
        }
        if (! opt_useFallback) return -1;
        return this.findWidgetIndex("Undefined");
    }

    createWidget(props, opt_properties) {
        let self = this;
        if (!props.name) return;
        let e = this.findWidget(props.name,true);
        if (!e ) {
            return;
        }
        let mergedProps = assign({}, e, props, opt_properties);
        if (mergedProps.key === undefined) mergedProps.key = props.name;
        if (mergedProps.formatter) {
            if (typeof mergedProps.formatter === 'string') {
                let ff = this.formatter[mergedProps.formatter];
                if (typeof ff !== 'function') {
                    throw new Error("invalid formatter " + mergedProps.formatter)
                }
                mergedProps.formatter = function (v) {
                    let param=mergedProps.formatterParameters;
                    if (typeof(param) === 'string'){
                        param=param.split(",");
                    }
                    return ff.apply(self.formatter, [v].concat(param || []));
                }
            }
        }
        return function (props) {
            let wprops = assign({}, props, mergedProps);
            let {style,...childProperties}=opt_properties||{}; //filter out style for children
            if (mergedProps.children) {
                let cidx=0;
                return <div {...mergedProps} className="widget combinedWidget" >
                    {mergedProps.children.map((item)=> {
                        let Item = self.createWidget(item, childProperties);
                        cidx++;
                        return <Item key={cidx} onClick={wprops.onClick}/>
                    })}
                </div>
            }
            else {
                let RenderWidget = mergedProps.wclass || DirectWidget;
                let storeKeys = mergedProps.storeKeys;
                if (wprops.className) wprops.className+=" "+wprops.name;
                else wprops.className=wprops.name;
                if (!storeKeys) {
                    storeKeys = RenderWidget.storeKeys;
                }
                if (wprops.handleVisible){
                    RenderWidget=Visible(RenderWidget);
                    delete wprops.handleVisible;
                }
                if (storeKeys) {
                    RenderWidget = Dynamic(RenderWidget, {storeKeys:storeKeys});
                }
                return <RenderWidget {...wprops}/>
            }
        };
    }
    getWidget(index){
        if (index < 0 || index >= this.widgetDefinitions.length) return undefined;
        let el=assign({},this.widgetDefinitions[index]);
        if (el.name === undefined) el.name=el.caption;
        if (el.description === undefined)el.description=el.name;
        return el;
    }
    getAvailableWidgets(){
        let rt=[];
        for (let i=0;i< this.widgetDefinitions.length;i++){
            let el=this.getWidget(i);
            rt.push(el);
        }
        return rt;
    }
    addWidget(definition,ignoreExisting){
        if (! definition) throw new Error("missing parameter definition");
        if (! definition.name) throw new Error("missing parameter name");
        let existing=this.findWidgetIndex(definition);
        if (existing >= 0 ) {
            if (! ignoreExisting) throw new Error("widget " + definition.name + " already exists");
            this.widgetDefinitions[existing]=definition;
        }
        this.widgetDefinitions.push(definition);
    }
    getWidgetFromTypeName(typeName){
        switch(typeName){
            case 'radialGauge':
                return GaugeRadial;
            case 'linearGauge':
                return GaugeLinear
        }
    }
    registerWidget(description,opt_editableParameters){
        let reservedParameters=['onClick','wclass','editableParameters'];
        let forbiddenKeys=['name'].concat(reservedParameters);
        reservedParameters.forEach((p)=>{
            if (description[p]){
                throw new Error("you cannot set the reserved parameter "+p);
            }
        });
        if (description.storeKeys){
            forbiddenKeys.forEach((k)=>{
                if (description.storeKeys[k]){
                    throw new Error("you cannot set the reserved parameter "+k+" as a storeKey");
                }
            })
        }
        let internalDescription=assign({},description);
        if (internalDescription.type){
            internalDescription.wclass=this.getWidgetFromTypeName(internalDescription.type);
            if (! internalDescription.wclass){
                throw new Error("invalid widget type: "+internalDescription.type);
            }
        }
        if (! internalDescription.wclass) {
            if (internalDescription.renderHtml || internalDescription.renderCanvas) {
                //we should use our external widget
                if (internalDescription.renderHtml && typeof(internalDescription.renderHtml) !== 'function') {
                    throw new Error("renderHtml must be a function");
                }
                if (internalDescription.renderCanvas && typeof(internalDescription.renderCanvas) !== 'function') {
                    throw new Error("renderCanvas must be a function");
                }
                internalDescription.wclass = ExternalWidget;
            }
            else {
                if (!internalDescription.formatter) {
                    throw new Error("formatter must be set for the default widget");
                }
            }
        }
        if (opt_editableParameters){
            //TODO: add some checks?
            internalDescription.editableParameters=opt_editableParameters;
        }

        this.addWidget(internalDescription);
    }
}
/**
 * filter a list of widget descriptiion by name
 * @param list the list
 * @param filterObject an object with {'name1':true,'name2':false} entries
 *        missing entries are treated as true
 */
WidgetFactory.prototype.filterListByName=function(list,filterObject){
    let rt=[];
    list.forEach((el)=>{
        if (el.name) {
            if (filterObject[el.name] !== false){
                rt.push(el);
            }
        }
    });
    return rt;
};

WidgetFactory.prototype.loadGaugeDefinitions=function(name,prefix,wclass){
    let self=this;
    let urls=[name+".json","/user/viewer/"+name+".json"];
    urls.forEach((url)=>{
        Requests.getJson(url,{useNavUrl:false,checkOk:false})
            .then((data)=>{
                for (let gName in data){
                    let description=data[gName];
                    description.name=prefix+"."+gName;
                    description.wclass=wclass;
                    let existing=self.findWidget(description);
                    if (existing){
                        if (existing.wclass !== description.wclass){
                            base.log("ignoring widget "+description.name+": already exists with different class");
                            return;
                        }
                    }
                    self.addWidget(description,true);
                }
            })
            .catch((error)=>{
                base.log("unable to read widget list "+url+": "+error);
            })
    })
};

WidgetFactory.prototype.loadAllGaugeDefinitions=function(){
    let self=this;
    let list=[
        {name:'radialGauges',prefix:'radGauge',wclass:GaugeRadial}
    ];
    list.forEach((le)=>{
        self.loadGaugeDefinitions(le.name,le.prefix,le.wclass);
    })
};


export default  new WidgetFactory();