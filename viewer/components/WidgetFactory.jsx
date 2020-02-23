import React from "react";
import assign from "object-assign";
import widgetList from './WidgetList';
import Dynamic from '../hoc/Dynamic.jsx';
import DirectWidget from './DirectWidget.jsx';
import globalStore from '../util/globalstore.jsx';
import Formatter from '../util/formatter';
import Visible from '../hoc/Visible.jsx';
import ExternalWidget from './ExternalWidget.jsx';
import keys from '../util/keys.jsx';

export class WidgetParameter{
    constructor(name,type,defaultv,list){
        this.name=name;
        this.type=type;
        this.default=defaultv;
        this.list=list;
    }
    getList(){
        if (typeof (this.list) === 'function') return this.list();
        return this.list||[];
    }
    setValue(widget,value){
        if (! widget) widget={};
        if (this.type !== WidgetParameter.TYPE.NUMBER || value === undefined) {
            widget[this.name] = value;
        }
        else{
            widget[this.name] = parseFloat(value);
        }
        return widget;
    }
    getValue(widget){
        return widget[this.name];
    }
    getValueForDisplay(widget){
        let rt=this.getValue(widget);
        if (rt !== undefined) return rt;
        return this.default;
    }
    isValid(value){
        return true;
    }
    isChanged(value){
        return value !== this.default;
    }
}

WidgetParameter.TYPE={
    STRING:1,
    NUMBER:2,
    KEY:3,
    SELECT:4
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
    }
    /**
     * find a complete widget description
     * @param widget - either a name or a widget description with a name field
     * @returns {*}
     */
    findWidget(widget){
        let i=this.findWidgetIndex(widget);
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
        //simple approach: only DirectWidget...
        if (! widgetData.wclass || widgetData.wclass === DirectWidget || widgetData.wclass === ExternalWidget){
            rt.push(new WidgetParameter('caption',WidgetParameter.TYPE.STRING,widget.caption||widgetData.caption));
            rt.push(new WidgetParameter('unit',WidgetParameter.TYPE.STRING,widget.unit||widgetData.unit));
            if (! widgetData.formatter) {
                rt.push(new WidgetParameter('formatter', WidgetParameter.TYPE.SELECT,widget.formatter,()=>{
                    let fl=[];
                    for (let k in Formatter){
                        if (typeof(Formatter[k]) === 'function') fl.push(k);
                    }
                    return fl;
                }))
            }
            let fpar=new WidgetParameter('fmt parameter',WidgetParameter.TYPE.STRING,widget.formatterParameters||widgetData.formatterParameters,'formatterParameters');
            fpar.setValue=(widget,value)=>{
                if (! widget) widget={};
                widget.formatterParameters=value;
                return widget;
            };
            rt.push(fpar);
            if (! widgetData.storeKeys){
                let spar=new WidgetParameter('value',WidgetParameter.TYPE.KEY,widget.storeKeys?widget.storeKeys.value:undefined);
                spar.list=()=>{
                    let kl=[];
                    for( let k in keys.nav.gps){
                        kl.push(keys.nav.gps[k]);
                    }
                    //TODO: add currently available signalk keys
                    return kl;
                };
                spar.setValue=(widget,value)=>{
                    if (! widget) widget={};
                    if (!widget.storeKeys) widget.storeKeys={};
                    widget.storeKeys.value=value;
                    return widget;
                };
                spar.getValue=(widget)=>{
                    if (!widget) return;
                    if (!widget.storeKeys) return;
                    return widget.storeKeys.value;
                };
                rt.push(spar)
            }
        }
        return rt;
    }

    /**
     * find the index for a widget
     * @param widget - either a name or a widget description with a name field
     * @returns {number} - -1 omn error
     */
    findWidgetIndex(widget){
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
        return -1;
    }

    createWidget(props, opt_properties) {
        let self = this;
        if (!props.name) return;
        let e = this.findWidget(props.name);
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
                    return ff.apply(self.formatter, [v].concat(mergedProps.formatterParameters || []));
                }
            }
        }
        return function (props) {
            let wprops = assign({}, props, mergedProps);
            let {style,...childProperties}=opt_properties||{}; //filter out style for children
            if (mergedProps.children) {
                let cidx=0;
                return <div {...mergedProps} className="widget combinedWidget">
                    {mergedProps.children.map((item)=> {
                        let Item = self.createWidget(item, childProperties);
                        cidx++;
                        return <Item key={cidx}/>
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
    addWidget(definition){
        if (! definition) throw new Error("missing parameter definition");
        if (! definition.name) throw new Error("missing parameter name");
        let existing=this.findWidgetIndex(definition);
        if (existing >= 0) throw new Error("widget "+definition.name+" already exists");
        this.widgetDefinitions.push(definition);
    }
    registerExternalWidget(description){
        let reservedParameters=['onClick','wclass'];
        let forbiddenKeys=['name'].concat(reservedParameters);
        let internalDescription=assign({},description);
        if (internalDescription.renderHtml || internalDescription.renderCanvas){
            //we should use our external widget
            if (internalDescription.renderHtml && typeof(internalDescription.renderHtml) !== 'function'){
                throw new Error("renderHtml must be a function");
            }
            if (internalDescription.renderCanvas && typeof(internalDescription.renderCanvas) !== 'function'){
                throw new Error("renderCanvas must be a function");
            }
            internalDescription.wclass=ExternalWidget;
        }
        else{
            if (! internalDescription.formatter){
                throw new Error("formatter must be set for the default widget");
            }
        }
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

export default new WidgetFactory();