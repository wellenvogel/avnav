import React from "react";
import assign from "object-assign";
import widgetList from './WidgetList';
import {useStore} from '../hoc/Dynamic.jsx';
import DirectWidget from './DirectWidget.jsx';
import Formatter from '../util/formatter';
import ExternalWidget from './ExternalWidget.jsx';
import keys from '../util/keys.jsx';
import base from '../base.js';
import {GaugeRadial,GaugeLinear} from './CanvasGauges.jsx';
import MapWidget from "./MapWidget";
import editableParameterFactory, {
    EditableKeyParameter,
    EditableParameter,
    EditableParameterTypes, EditableSelectParameter,
    EditableStringParameter
} from "../util/EditableParameter";
import editableParameterUI, {EditableParameterListUI, getCommonParam} from "./EditableParameterUI";
import {Input, InputReadOnly} from "./Inputs";
import {shallowEqualArrays} from "shallow-equal";
import Helper from "../util/helper";
import {SortableProps} from "../hoc/Sortable";

export const filterByEditables=(editableParameters,values)=>{
    let rt={};
    if (! editableParameters) return rt;
    editableParameters.forEach((param)=>{
        if (! param.canEdit()) return;
        let v=param.getValue(values);
        param.setValue(rt, v);
    });
    for (let k in rt){
        if (typeof(rt[k]) === 'function') delete rt[k];
        if (rt[k] === undefined) delete rt[k];
    }
    return rt;
}
class FormatterParameterUI extends EditableParameter {
    static TYPE=EditableParameterTypes.WIDGET_BASE+1;
    constructor(plain) {
        super(plain, FormatterParameterUI.TYPE,true);
        if (this.default !== undefined){
            if (! (this.default instanceof Array)){
                this.default=(this.default+"").split(',');
            }
        }
        this.render=this.render.bind(this);
        Object.freeze(this);
    }

    setValue(currentValues, value,check) {
        if (! currentValues) currentValues={};
        if (value === undefined) {
            if (this.readonly) return currentValues;
            currentValues[this.name]=value;
            return currentValues;
        }
        if (! (value instanceof Array)) value=(value+"").split(",");
        if (check){
            const definedParameters=getFormatterParameters(currentValues);
            if (definedParameters){

            }
        }
        if (this.readonly) return currentValues;
        currentValues[this.name]=value;
        return currentValues;
    }
    getValue(currentValues){
        if (! currentValues) currentValues={};
        let rt=currentValues[this.name];
        if (! rt) {
            return this.default;
        }
        if (! (rt instanceof Array)) return (rt+"").split(",");
        return rt;
    }
    getDefault(idx){
        if (! this.default) return;
        if (! (this.default instanceof Array)) return;
        return this.default[idx];
    }
    render({currentValues,initialValues,className,onChange}) {
        const common=getCommonParam({ep:this,currentValues,initialValues,className,onChange:this.readonly?undefined:onChange});
        const definedParameter=getFormatterParameters(currentValues);
        if (! definedParameter) {
            if (common.value instanceof Array) common.value=common.value.join(',');
            if (this.readonly) {
                return <InputReadOnly {...common}/>
            }
            return <Input
                {...common}
                type={'string'}
                onChange={(nv)=>onChange(this.setValue({},nv))}
            />
        }
        const parameterList=[];
        let idx=0;
        const currentAsDict={};
        const nameToIdx={};
        const current=common.value||[];
        let initialAsDict;
        const initial = this.getValue(initialValues) || [];
        if (initialValues) {
            initialAsDict={};
        }
        definedParameter.forEach((dp)=>{
            const pdef=this.getDefault(idx);
            const cv=current[idx];
            let parameter;
            if (pdef !== undefined){
                parameter=editableParameterUI.createEditableParameterUI({...dp,default:pdef,readonly: this.readonly,displayName: "fmt:"+dp.name});
            }
            else{
                parameter=editableParameterUI.createEditableParameterUI({...dp,readonly:this.readonly,displayName: "fmt:"+dp.name});
            }
            nameToIdx[parameter.name]=idx;
            currentAsDict[parameter.name]=cv;
            if (initialAsDict) initialAsDict[parameter.name]=initial[idx];
            parameterList.push(parameter);
            idx++;
        })

        return <EditableParameterListUI
            parameters={parameterList}
            values={currentAsDict}
            initialValues={initialAsDict}
            onChange={this.readonly?undefined:(nv)=>{
                const newVal=current.slice(0);
                for (let k in nv){
                    const idx=nameToIdx[k];
                    if (idx !== undefined) newVal[idx]=nv[k];
                }
                onChange(this.setValue({},newVal));
            }}
        />
    }

    isChanged(currentValues, initialValues) {
        const old=this.getValue(initialValues);
        const current=this.getValue(currentValues);
        return !shallowEqualArrays(old,current);
    }
}
const defaultWidgetParameters={
    caption: new EditableStringParameter({name:'caption',description:'the title of the widget'}),
    unit: new EditableStringParameter({name:'unit',description:'The unit to be shown in the title row.\nLeave it empty to use a unit parameter from the formatter if there is one.'}),
    formatterParameters: new FormatterParameterUI({name:'formatterParameters'}),
    value: new EditableKeyParameter({name:'value',description:'The value from the internal data store to be used.\nBe sure to select a matching formatter for this item.',mandatory: true}),
    className: new EditableStringParameter({name:'className',description:'add a CSS class to your widget to be able to style it in your user.css'}),
    formatter: new EditableSelectParameter({name:'formatter',description:'the formatter to convert your value into the display string',list:()=>{
        let rt=[];
        for (let k in Formatter){
            rt.push({label:k,value:k})
        }
        return rt;
        }})
}


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
/**
 * the properties we allow to pass to the widget on render
 * only parameters generated by the system - no editables or defaults
 * all of those must be passed during create (or via the store)
 * @type {{}}
 */
const allowedDynamicProps={
    ...SortableProps,
    mode: true,
    visible: true,
    onClick: true
}

const forbiddenEditables={
    storeKeys: true,
    editing: true,
    nightMode: true,
    name: true,
    updateFunction: true,
    translateFunction: true,
    wclass: true,
    handleVisible: true,
    editableParameters: true,
    ...allowedDynamicProps
}
const fixedStoreKeys={
    nightMode:keys.properties.nightMode,
    editing:keys.gui.global.layoutEditing
}

const DynamicWidget=({Widget,wprops,storeKeys})=>{
    const props=useStore(wprops,
        {
            storeKeys:storeKeys,
            updateFunction:wprops.updateFunction?(data)=>{
                const rt=wprops.updateFunction(data)
                //we keep some important parameters independent of the update function
                for (let k in fixedStoreKeys){
                    rt[k]=data[k];
                }
                for (let k in forbiddenEditables){
                    delete rt[k];
                }
                return rt;
            }:undefined
        });
    const {visible,handleVisible,...forward}=props;
    if (handleVisible && !Helper.unsetorTrue(visible)) return null;
    return <Widget {...forward}/>
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
     * @param [opt_fallback] if true - get a fallback widget
     * @param [opt_mergeEditables] if true also merge all editable Parameters
     * @returns {*}
     */
    findWidget(widget,opt_fallback,opt_mergeEditables){
        let i=this.findWidgetIndex(widget,opt_fallback);
        if (i < 0) return undefined;
        let e=this.widgetDefinitions[i];
        let RenderWidget = e.wclass || DirectWidget;
        let widgetPredefines=RenderWidget.predefined;
        if (! (widgetPredefines instanceof Object)) widgetPredefines= {};
        if (! opt_mergeEditables) {
            return {
                ...widgetPredefines, ...e,
                wclass: RenderWidget,
                storeKeys: {...RenderWidget.storeKeys,...widgetPredefines.storeKeys, ...e.storeKeys}
            }
        }
        else{
            return {
                ...widgetPredefines, ...e,
                wclass: RenderWidget,
                storeKeys: {...RenderWidget.storeKeys,...widgetPredefines.storeKeys, ...e.storeKeys},
                editableParameters: {...RenderWidget.editableParameters,...widgetPredefines.editableParameters, ...e.editableParameters}
            }
        }
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
        let wClass=widgetData.wclass;
        const predefined=wClass.predefined||{};
        const classParameters={ ...wClass.editableParameters,...predefined.editableParameters};
        const configParameters=widgetData.editableParameters||{};
        const allParameters={className:true,...classParameters,...configParameters};
        let storeKeys=widgetData.storeKeys; //they are already merged by findWidget
        //do not allow to override those definitions from widget data
        const forbiddenOverrides=['formatter','formatterParameters']
        for (let pname in allParameters){
            if (pname in forbiddenEditables){
                base.log(`forbidden editable ${pname} in ${widgetData.name}`);
                continue;
            }
            let foundEditableParameter;
            const defaultParam=defaultWidgetParameters[pname];
            let classParam=classParameters[pname];
            let finalParam=allParameters[pname];
            if (finalParam === undefined || finalParam === false) continue;
            if (classParam === true) {
                classParam=undefined; //fall through to defaultParam
            }
            if (finalParam === true) {
                finalParam = classParam||defaultParam;
            }
            if (! (finalParam instanceof Object)) {
                //no definition found
                 base.log("invalid parameter definition in widget - only true "+widgetData.name+": "+pname);
                 continue;
            }
            foundEditableParameter=finalParam;
            if (forbiddenOverrides.indexOf(pname) >= 0) {
                //we allow them to come from default or class only
                foundEditableParameter=classParam||defaultParam;
            }
            if (! (foundEditableParameter instanceof  Object)) {
                base.log("invalid parameter definition in widget - no object" + widgetData.name + ": " + pname);
                continue;
            }
            if (! (foundEditableParameter instanceof EditableParameter)) {
                foundEditableParameter=editableParameterFactory.createParameterFromPlain(foundEditableParameter,{name:pname});
            }
            if (defaultParam !== undefined) {
                //if we overwrite a default parameter the type must match!
                if (foundEditableParameter.type !== defaultParam.type) {
                    base.log("invalid default parameter overwrite in widget - different types" + widgetData.name + ": " + pname);
                    continue;
                }
            }
            //do not allow to edit key parameters if they are already provided
            //in the widget definition
            if (foundEditableParameter.type === EditableKeyParameter.TYPE && storeKeys[foundEditableParameter.name]) {
                base.log("cannot edit store key as it is already in the widget definition" + widgetData.name + ": " + pname);
                continue;
            }
            let overrides={name:pname};
            let defaultv = widgetData[pname]||wClass[pname];
            if (defaultv !== undefined) {
                //default values from the widget class or from the widget list will win against
                //defaults from the parameter defines
                overrides.default = defaultv;
            }
            if (pname === 'formatter'){
                if (widgetData.formatter) overrides.readOnly=true;
            }
            if (typeof foundEditableParameter.render === 'function'){
                rt.push(foundEditableParameter.clone(overrides));
            }
            else {
                rt.push(editableParameterUI.createEditableParameterUI({...foundEditableParameter, ...overrides}));
            }
        }
        rt.sort((a,b)=>{
            if (a.name === 'formatterParameters' || a.name === 'formatter') return 1;
            if (b.name === 'formatter'  || b.name === 'formatterParameters') return -1;
            return 0;
        })
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
        let RenderWidget = e.wclass;
        let mergedProps = {...e, ...filteredProps, ...opt_properties};
        //we need a special handling for the store keys as the simple assign above will not merge them
        let mergedStoreKeys={};
        [e, filteredProps, opt_properties].forEach((p) => {
            if (p && p.storeKeys) {
                Object.assign(mergedStoreKeys, p.storeKeys);
            }
        });
        delete mergedProps.storeKeys;
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
            let param = mergedProps.formatterParameters;
            if (typeof (param) === 'string') {
                param = param.split(",");
            }
            if (! param) param=[];
            const fmtParamDef=ff.parameters;
            if (fmtParamDef instanceof Array){
                //check if there is a "unit" fmt param and use it's value
                //as "unit" parameter if not provided
                if (!mergedProps.unit){
                    for (let i=0;i<fmtParamDef.length;i++){
                        if (fmtParamDef[i].name === 'unit'){
                            let punit=param[i];
                            if (punit === undefined) punit=fmtParamDef[i].default;
                            mergedProps.unit=punit;
                        }
                    }
                }
            }
            mergedProps.formatter =  (v)=> {
                return ff.apply(this.formatter, [v].concat(param));
            }

        }
        mergedProps.className=Helper.concatsp(mergedProps.className,props.name);
        Object.assign(mergedStoreKeys,fixedStoreKeys);
        return (wprops)=><DynamicWidget
            Widget={RenderWidget}
            wprops={{...mergedProps,...Helper.filteredAssign(allowedDynamicProps,wprops) }}
            storeKeys={mergedStoreKeys}
        />
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
        let reservedParameters=['wclass','editableParameters'].concat(Object.keys(allowedDynamicProps));
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
        let internalDescription={...description};
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
            if (! (opt_editableParameters instanceof Object)){
                throw new Error("editable parameters must be an Object");
            }
            for (let name in opt_editableParameters){
                if (Object.keys(forbiddenEditables).indexOf(name) >= 0) {
                    throw new Error(name + " is forbidden as an editable parameter name");
                }
                const ep=opt_editableParameters[name];
                if (! (ep instanceof Object) && ! (ep === true || ep === false)){
                    throw new Error("editable parameters must be Objects or booleans")
                }
                if (ep instanceof Object) {
                    const typeid = EditableParameterTypes[ep.type];
                    if (typeid === undefined || typeid >= EditableParameterTypes.UNKNOWN) {
                        throw new Error("invalid editable parameter type " + ep.type + " for " + name);
                    }
                }
            }
            internalDescription.editableParameters=opt_editableParameters;
        }

        this.addWidget(internalDescription);
    }
    registerFormatter(name,formatterFunction){
        if (! name) throw new Error("registerFormatter: missing parameter name");
        if (! formatterFunction || (typeof(formatterFunction) !== 'function')){
            throw new Error("registerFormatter("+name+"): missing or invalid formatterFunction");
        }
        if (Formatter[name]){
            throw new Error("registerFormatter("+name+"): formatter already exists");
        }
        Formatter[name]=formatterFunction;
    }

}
const theFactory=new WidgetFactory();

export default  theFactory;