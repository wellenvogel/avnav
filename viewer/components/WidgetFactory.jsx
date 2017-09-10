var React=require("react");
var assign=require("object-assign");
var widgetList=require('./WidgetList');
var Widget=require('./Widget.jsx');
var ItemUpdater=require('./ItemUpdater.jsx');


class WidgetFactory{
    constructor(){
        this.createWidget=this.createWidget.bind(this);
    }
    /**
     * find a complete widget description
     * @param widget - either a name or a widget description with a name field
     * @returns {*}
     */
    findWidget(widget){
        var i=this.findWidgetIndex(widget);
        if (i < 0) return undefined;
        return widgetList[i];
    }

    /**
     * find teh index for a widget
     * @param widget - either a name or a widget description with a name field
     * @returns {number} - -1 omn error
     */
    findWidgetIndex(widget){
        if (widget === undefined) return -1;
        var search=widget;
        if (typeof(widget) !== "string"){
            search=widget.name;
        }
        var i;
        for (i=0;i<widgetList.length;i++) {
            var e = widgetList[i];
            if ((e.name !== undefined && e.name == search ) || (e.caption == search)) {
                return i;
            }
        }
        return -1;
    }
    createWidget(props,opt_properties){
        if (! props.name) return;
        var e=this.findWidget(props.name);
        var RenderWidget=e.wclass||Widget;
        var mergedProps=assign({},e,props,opt_properties);
        var dataKey;
        if (mergedProps.dataKey) dataKey=mergedProps.dataKey;
        if (mergedProps.store){
            RenderWidget=ItemUpdater(RenderWidget,mergedProps.store,dataKey);
        }
        if (e) {
            return React.createClass({
                render: function(){
                    var wprops=assign({},mergedProps,this.props);
                    return <RenderWidget {...wprops}/>
                }
            });
        }
    }
    getWidget(index){
        if (index < 0 || index >= widgetList.length) return undefined;
        var el=assign({},widgetList[index]);
        if (el.name === undefined) el.name=el.caption;
        if (el.description === undefined)el.description=el.name;
        return el;
    }
    getAvailableWidgets(){
        var rt=[];
        var i;
        for (i=0;i< widgetList.length;i++){
            var el=this.getWidget(i);
            rt.push(el);
        }
        return rt;
    }
}

module.exports=new WidgetFactory();