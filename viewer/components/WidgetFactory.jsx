import React from "react";
import assign from "object-assign";
import widgetList from './WidgetList';
import Dynamic from '../hoc/Dynamic.jsx';
import DirectWidget from './DirectWidget.jsx';
import globalStore from '../util/globalstore.jsx';
import Formatter from '../util/formatter';
import Visible from '../hoc/Visible.jsx';
import ExternalWidget from './ExternalWidget.jsx';



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
     * find teh index for a widget
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
            e= {
                wClass:DirectWidget
            };
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
                return <div {...mergedProps} className="widget combinedWidget">
                    {mergedProps.children.map((item)=> {
                        let Item = self.createWidget(item, childProperties);
                        return <Item />
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
        for (let i=0;i< widgetList.length;i++){
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
            if (! internalDescription.storeKeys || ! internalDescription.storeKeys.value){
                throw new Error("you must provide storeKeys with at least a \"value\" key for the default widget")
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

module.exports=new WidgetFactory();