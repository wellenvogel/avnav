/**
 * Created by andreas on 20.11.16.
 */
var React=require('react');
var ReactDom=require('react-dom');
var Factory=require('./WidgetFactory.jsx');
var DynLayout=require('../util/dynlayout');

var WidgetContainer=function(reactProperties: Object,domId: String,opt_layoutHandler: DynLayout) {
    var self=this;
    var container=this;
    /**
     * the react properties
     * @type {Object}
     * @private
     */
    this._reactProperties = reactProperties;
    /**
     * the dom id where we render to
     * @type {String}
     * @private
     */
    this._domId = domId;
    /**
     * the layout handler assigned
     * @type {DynLayout}
     */
    this._layoutHandler = opt_layoutHandler;
    /**
     * @private
     */
    this._reactFactory = React.createClass({
        propTypes: {
            onClick: React.PropTypes.func.isRequired,
            items: React.PropTypes.array.isRequired,
            updateCallback: React.PropTypes.func,
            store: React.PropTypes.object.isRequired,
            propertyHandler: React.PropTypes.object.isRequired
        },
        getInitialState: function(){
            var visible={};
            this.props.items.forEach(function(item){
                visible[item]=true;
            });
            return{
                items:this.props.items,
                visibility: visible
            }
        },
        render: function () {
            var self = this;
            return (
                <div>
                    {this.state.items.map(function (item) {
                        if (self.state.visibility[item]) {
                            var widget = Factory.createWidget(item, {
                                store: self.props.store,
                                propertyHandler: self.props.propertyHandler,
                                layoutUpdate: container.layout
                            }, function (data) {
                                self.widgetClicked(item, data);
                            });
                            return widget;
                        }
                        return <div key={name}></div>
                    })}
                </div>
            );
        },
        widgetClicked: function (widgetName, data) {
            this.props.onClick(Factory.findWidget(widgetName), data);
        },
        componentDidMount: function () {
            if (this.props.updateCallback) {
                this.props.updateCallback();
            }
            if (self._layoutHandler){
                self._layoutHandler.init();
            }
            this.componentDidUpdate();
        },
        componentDidUpdate:function(){
            if (self._layoutHandler){
                self._layoutHandler.layout();
            }
        },
        setItems:function(newItems){
            var visibility={};
            newItems.forEach(function(item){
               visibility[item]=true;
            });
            this.setState({
                items: newItems,
                visibility: visibility
            });
        },
        setVisibility:function(newVisibility){
            var current=avnav.assign({},this.state.visibility,newVisibility);
            var changed=false;
            var k;
            for (k in current){
                if (this.state.visibility[k] != current[k]){
                    changed=true;
                    break;
                }
            }
            if (! changed) return;
            this.setState({
                visibility: current
            });
        }



    });
    this._instance=undefined;
    this.layout=this.layout.bind(this);
};
WidgetContainer.prototype.render=function(){
    var container=React.createElement(this._reactFactory,this._reactProperties);
    var dom=avnav.isString(this._domId)?document.getElementById(this._domId):this._domId;
    this._instance=ReactDom.render(container,dom);
    return this._instance;
};
WidgetContainer.prototype.layout=function(param){
    if (this._layoutHandler) this._layoutHandler.layout(param);
};

WidgetContainer.prototype.getItems=function(){
  return this._reactProperties.items;
};

WidgetContainer.prototype.setItems=function(newItems){
    if (! newItems) newItems=[];
    if (this._instance) {
        this._reactProperties.items=newItems;
        this._instance.setItems(newItems);
        return this._instance;
    }
    this._reactProperties=newItems;
    return this.render();
};
WidgetContainer.prototype.removeItem=function(item){
    if (! item) return;
    var i=0;
    var items=this._reactProperties.items.slice(0);
    for (i=0;i<items.length;i++){
        if (items[i] == item){
            return this.setItems(items.splice(i,1));
        }
    }
};
WidgetContainer.prototype.insertAfter=function(after,item){
    if (! item) return;
    var i=0;
    var items=this._reactProperties.items.slice(0);
    if (after) {
        for (i = 0; i < items.length; i++) {
            if (items[i] == after) {
                return this.setItems(items.splice(i, 1, item));
            }
        }
        items.push(item);
    }
    else{
        items.unshift(item);
    }
    return this.setItems(items);
};
/**
 * change the visibility of an item
 * @param {object} newVisibility
 */
WidgetContainer.prototype.setVisibility=function(newVisibility){
    if (! this._instance) return;
    this._instance.setVisibility(newVisibility);
};
/**
 *
 * @returns {DynLayout}
 */
WidgetContainer.prototype.getLayout=function(){
    return this._layoutHandler;
};
module.exports=WidgetContainer;