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
import {createEditableParameter, EditableParameter} from "./EditableParameters";
import Compare from "../util/compare";
import CloneDeep from 'clone-deep';
import MapWidget from "./MapWidget";
import {CombinedWidget} from "./CombinedWidget";

export const filterByEditables=(editableParameters,values)=>{
    let rt={};
    if (! editableParameters) return rt;
    editableParameters.forEach((param)=>{
        if (! param.canEdit()) return;
        let v=param.getValue(values);
        if (v === undefined){
            param.setDefault(rt);
        }
        else {
            param.setValue(rt, v);
        }
    });
    let fixed=['name','weight'];
    fixed.forEach((fp)=>{
        if (values[fp] !== undefined) rt[fp]=values[fp];
    });
    for (let k in rt){
        if (typeof(rt[k]) === 'function') delete rt[k];
        if (rt[k] === undefined) delete rt[k];
    }
    return rt;
}
class KeyWidgetParameter extends EditableParameter {
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
        if ( value === undefined) return;
        if (!widget) widget = {};
        if (!widget.storeKeys) widget.storeKeys = {};
        if (value === '') value=undefined;
        widget.storeKeys[this.name] = value;
        return widget;
    }

    getValue(widget) {
        if (!widget) return ;
        if (!widget.storeKeys) return ;
        return widget.storeKeys[this.name];
    }

    getTypeForEdit(widget) {
        return EditableParameter.TYPE.SELECT;
    }
    isChanged(value) {
        return ! Compare(value,this.default);
    }
}

class ArrayWidgetParameter extends EditableParameter {
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
        if (! rt) return;
        if (typeof(rt) === 'string') return rt.split(",");
        return rt;
    }
    getValueForDisplay(widget,opt_placeHolder){
        let rt=this.getValue(widget);
        if (rt === undefined)  rt=CloneDeep(this.default);
        if (rt === undefined) rt=opt_placeHolder;
        if (! rt) return "";
        if (rt instanceof Array){
            return rt.join(",")
        }
        return rt;
    }
    getTypeForEdit(widget) {
        return EditableParameter.TYPE.STRING;
    }

    isChanged(value) {
        return ! Compare(value,this.default);
    }
}
class FormatterParamWidgetParameter extends EditableParameter {
    constructor(name, type, list, displayName) {
        super(name, type, list, displayName);
        this.parameterDescriptions=undefined;
    }

    setValue(widget, value) {
        if (!widget) widget = {};
        if (typeof(value) === 'string') value=value.split(",");
        widget[this.name]=value;
        return widget;
    }
    getValue(widget){
        let rt=widget[this.name];
        if (! rt) return;
        if (typeof(rt) === 'string') return rt.split(",");
        return rt;
    }
    getValueForDisplay(widget,opt_placeHolder){
        let rt=this.getValue(widget);
        if (rt === undefined)  rt=CloneDeep(this.default);
        if (rt === undefined) rt=opt_placeHolder;
        if (! rt) return "";
        if (rt instanceof Array){
            return rt.join(",")
        }
        return rt;
    }
    getTypeForEdit(widget) {
        let rt=EditableParameter.TYPE.STRING;
        let parameterDescriptions=this.parameterDescriptions;
        if (! parameterDescriptions) {
            parameterDescriptions=getFormatterParameters(widget);
            if (! parameterDescriptions) return rt;
        }
        rt=[];
        let idx=0;
        parameterDescriptions.forEach((fp)=>{
            let nested=createEditableParameter(this.name,fp.type,fp.list,
                'fmt:'+fp.name);
            if (! nested) return;
            nested.default=fp.default;
            nested.arrayIndex=idx;
            rt.push(nested);
            idx++;
        })
        return rt;
    }
    isChanged(value) {
        let cv=(typeof(value) === 'string'?value.split(','):value);
        let cd=(typeof(this.default) === 'string'?this.default.split(','):this.default);
        return ! Compare(cv,cd);
    }
}

class ReadOnlyWidgetParameter extends EditableParameter {
    constructor(name, type, list, displayName) {
        super(name, type, list, displayName);
        this.readOnly=true;
    }
    getValue(widget){
        let rt=widget[this.name];
        if (rt === undefined) return;
        if (typeof(rt)==='function'){
            rt=rt.name||"function";
        }
        return rt;
    }
    setValue(widget, value) {
        if (!widget) widget = {};
        return widget;
    }
    getTypeForEdit(widget) {
        return 'STRING';
    }
}


//must be different from editable parameter types
const WidgetParameter_TYPE={
    KEY:30,
    DISPLAY: 40,
    ARRAY: 50,
    FORMATTER_PARAM: 60
};


const createWidgetParameter=(name,type,list,displayName)=>{
    if (typeof(type) === 'string'){
        let wtype=WidgetParameter_TYPE[type];
        if (wtype === undefined) return createEditableParameter(name,type,list,displayName)
        type=wtype;
    }
    switch(type) {
        case WidgetParameter_TYPE.DISPLAY:
            return new ReadOnlyWidgetParameter(name,type,list,displayName);
        case WidgetParameter_TYPE.KEY:
            return new KeyWidgetParameter(name, type, list, displayName);
        case WidgetParameter_TYPE.ARRAY:
            return new ArrayWidgetParameter(name, type, list, displayName);
        case WidgetParameter_TYPE.FORMATTER_PARAM:
            return new FormatterParamWidgetParameter(name, type, list, displayName);

    }
    return createEditableParameter(name,type,list,displayName);
};

const typeIdFromType=(typeStr)=>{
    let sp=WidgetParameter_TYPE[typeStr];
    if (sp !== undefined) return sp;
    return EditableParameter.TYPE[typeStr];
}

const getDefaultParameter=(name)=>{
    if (name === 'caption') return createWidgetParameter('caption',EditableParameter.TYPE.STRING);
    if (name === 'unit') return createWidgetParameter('unit',EditableParameter.TYPE.STRING);
    if (name === 'formatterParameters') return createWidgetParameter('formatterParameters',WidgetParameter_TYPE.FORMATTER_PARAM,undefined,"formatter parameters");
    if (name === 'value') return createWidgetParameter('value',WidgetParameter_TYPE.KEY);
    if (name === 'className') return createWidgetParameter("className",EditableParameter.TYPE.STRING,undefined,"css class");
    if (name === 'formatter') return createWidgetParameter('formatter', EditableParameter.TYPE.SELECT,()=>{
        let fl=[];
        for (let k in Formatter){
            if (typeof(Formatter[k]) === 'function') fl.push(k);
        }
        return fl;
    });
    if (name === 'children') return createWidgetParameter('children',WidgetParameter_TYPE.CHILDREN_PARAM);
};


export const getFormatterParameters=(widget)=>{
    if (! widget) return;
    let formatter = widget.formatter;
    if (formatter) {
        if (typeof (formatter) !== 'function') {
            formatter = Formatter[formatter];
        }
        if (formatter && formatter.parameters) {
            return formatter.parameters;
        }
    }
}



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
        this.editableParametersCache={};
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
     * @return {EditableParameter[]|undefined}
     */
    getEditableWidgetParameters(widget){
        let name=widget;
        if (name === undefined) return[];
        if (typeof(name) !== 'string'){
            name=name.name;
        }
        let plist=this.editableParametersCache[name];
        if (plist) return plist;
        let widgetData=this.findWidget(widget);
        if (! widgetData) return[];
        let rt=[];
        let wClass=widgetData.wclass || DirectWidget;
        let editableParameters=assign({className:true},wClass.editableParameters,widgetData.editableParameters);
        let storeKeys=assign({},wClass.storeKeys,widgetData.storeKeys);
        for (let pname in editableParameters){
            let pdefinition=editableParameters[pname];
            if (pdefinition === undefined || pdefinition === false ) continue;
            if (pdefinition instanceof EditableParameter){
                //allow for a complete own parameter definition in widget classes
                if (wClass.editableParameters && wClass.editableParameters[pname] instanceof EditableParameter){
                    rt.push(pdefinition);
                    continue;
                }
            }
            //get a fresh (i.e. copied) default parameter
            let predefined=getDefaultParameter(pname);
            if (! predefined && (typeof(pdefinition) !== 'object')){
                base.log("invalid parameter definition in widget "+widgetData.name+": "+pname);
                continue;
            }
            if (predefined) {
                //we allow for overriding default definitions except for formatter
                //and formatter parameters as long as the type matches
                let usePredefined = pdefinition.name === 'formatter' || predefined.type === WidgetParameter_TYPE.FORMATTER_PARAM;
                if (!usePredefined && (typeof (pdefinition) !== 'object')) usePredefined = true;
                if (!usePredefined && (predefined.type !== typeIdFromType(pdefinition.type))) usePredefined = true;
                if (usePredefined) {
                    pdefinition = predefined;
                    //some special handling for the formatter
                    //some widgets have a fixed formatter
                    //but we still want to edit the formatter parameters
                    //and it is helpfull to show the formatter to the user
                    //so we set a readOnly parameter for the formatter
                    if (pdefinition.name === 'formatter') {
                        if (widgetData.formatter) {
                            pdefinition = createWidgetParameter(pdefinition.name, WidgetParameter_TYPE.DISPLAY,
                                undefined, 'formatter')

                        }
                    }
                    //do not allow to edit key parameters if they are already provided
                    //in the widget definition
                    if (pdefinition.type === WidgetParameter_TYPE.KEY && storeKeys[pdefinition.name]) {
                        continue;
                    }
                    if (pdefinition.type === WidgetParameter_TYPE.FORMATTER_PARAM) {
                        //if the widget has a predefined formatter
                        //we set the formatter parameters here
                        //if not the editWidgetDialog will do this dynamically later
                        let formatterParam=getFormatterParameters(widgetData);
                        if (formatterParam){
                                pdefinition.parameterDescriptions = formatterParam;
                        }
                    }
                } else {
                    //trigger creation of a copy
                    predefined = undefined;
                }
            }
            if (!predefined) {
                //create a copy as we potentially e.g. change the default
                let npdefinition = createWidgetParameter(pname, pdefinition.type, pdefinition.list, pdefinition.displayName);
                if (!npdefinition) {
                    base.log("unknown widget parameter type: " + pdefinition.type);
                    continue;
                }
                npdefinition.default = pdefinition.default;
                pdefinition = npdefinition;
            }
            let defaultv = pdefinition.getValue(widgetData);
            if (defaultv !== undefined) {
                //default values from the widget class or from the widget list will win against
                //defaults from the parameter defines
                pdefinition.default = defaultv;
            }
            rt.push(pdefinition);
        }
        this.editableParametersCache[name] = rt;
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
        let e = this.findWidget(props.name, true);
        if (!e) {
            return;
        }
        let editables = this.getEditableWidgetParameters(e);
        let filteredProps = props;
        if (editables) {
            filteredProps = filterByEditables(editables, props);
        }
        let mergedProps = assign({}, e, filteredProps, opt_properties);
        //we need a special handling for the store keys as the simple assign above will not merge them
        let mergedStoreKeys;
        [e, filteredProps, opt_properties].forEach((p) => {
            if (p && p.storeKeys) {
                if (!mergedStoreKeys) mergedStoreKeys = {};
                assign(mergedStoreKeys, p.storeKeys);
            }
        });
        if (mergedStoreKeys) {
            mergedProps.storeKeys = mergedStoreKeys;
        }
        if (mergedProps.key === undefined) mergedProps.key = props.name;
        if (mergedProps.formatter) {
            let ff = mergedProps.formatter;
            if (typeof mergedProps.formatter === 'string') {
                ff = this.formatter[mergedProps.formatter];
                if (typeof ff !== 'function') {
                    //return a string indicating a missing formatter
                    ff = () => '?#?#';
                }
            }
            mergedProps.formatter = function (v) {
                let param = mergedProps.formatterParameters;
                if (typeof (param) === 'string') {
                    param = param.split(",");
                }
                return ff.apply(self.formatter, [v].concat(param || []));
            }

        }

        return function (props) {
            let wprops = {...props, ...mergedProps};
            wprops.childProperties = opt_properties;
            let RenderWidget = mergedProps.wclass || DirectWidget;
            let storeKeys = mergedProps.storeKeys;
            if (wprops.className) wprops.className += " " + wprops.name;
            else wprops.className = wprops.name;
            if (!storeKeys) {
                storeKeys = RenderWidget.storeKeys;
            }
            if (wprops.handleVisible) {
                RenderWidget = Visible(RenderWidget);
                delete wprops.handleVisible;
            }
            if (wprops.nightMode === undefined && (storeKeys === undefined || storeKeys.nightMode === undefined)) {
                if (storeKeys === undefined) {
                    storeKeys = {nightMode: keys.properties.nightMode}
                } else {
                    storeKeys = assign({nightMode: keys.properties.nightMode}, storeKeys)
                }
            }
            if (storeKeys) {
                RenderWidget = Dynamic(RenderWidget, {storeKeys: storeKeys});
            }
            delete wprops.storeKeys;
            return <RenderWidget {...wprops}/>
        }
    }
    getWidget(index){
        if (index < 0 || index >= this.widgetDefinitions.length) return undefined;
        let el=assign({},this.widgetDefinitions[index]);
        if (el.name === undefined) el.name=el.caption;
        if (el.description === undefined)el.description=el.name;
        return el;
    }
    getAvailableWidgets(filter){
        let rt=[];
        for (let i=0;i< this.widgetDefinitions.length;i++){
            let el=this.getWidget(i);
            if (filter instanceof Array && filter.length > 0){
                let type=el.type;
                if (! type && el.wclass) type=el.wclass.name;
                let hasMatch=false;
                let hasInverseMatch=false;
                let hasWhite=false;
                filter.forEach((fe)=>{
                    if (fe === undefined || fe.match(/^ *$/)) return;
                    let fstring=fe;
                    if (fe.indexOf('!') === 0){
                        fstring=fstring.substr(1);
                        if (fstring === type){
                            hasInverseMatch=true;
                        }
                    }
                    else{
                        hasWhite=true;
                        if (fstring === type){
                            hasMatch=true;
                        }
                    }
                })
                if (hasWhite && ! hasMatch) continue;
                if (hasInverseMatch) continue;
            }
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
            case 'map':
                return MapWidget;
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

WidgetFactory.prototype.registerFormatter=function(name,formatterFunction){
    if (! name) throw new Error("registerFormatter: missing parameter name");
    if (! formatterFunction || (typeof(formatterFunction) !== 'function')){
        throw new Error("registerFormatter("+name+"): missing or invalid formatterFunction");
    }
    if (Formatter[name]){
        throw new Error("registerFormatter("+name+"): formatter already exists");
    }
    Formatter[name]=formatterFunction;
}

const theFactory=new WidgetFactory();

export default  theFactory;