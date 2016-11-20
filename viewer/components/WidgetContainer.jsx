/**
 * Created by andreas on 20.11.16.
 */
var React=require('react');
var ReactDom=require('react-dom');
var Factory=require('./WidgetFactory.jsx');
var DynLayout=require('../util/dynlayout');

var WidgetContainer=function(reactProperties: Object,domId: String,opt_layoutHandler: DynLayout) {
    var self=this;
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
            items: React.PropTypes.array,
            updateCallback: React.PropTypes.func,
            store: React.PropTypes.object.isRequired,
            propertyHandler: React.PropTypes.object.isRequired
        },
        render: function () {
            var self = this;
            return (
                <div>
                    {this.props.items.map(function (item) {
                        var widget = Factory.createWidget(item, {
                            store: self.props.store,
                            propertyHandler: self.props.propertyHandler
                        }, function (data) {
                            self.widgetClicked(item, data);
                        });
                        return widget;
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
        }
    });
    this._instance=undefined;
};
WidgetContainer.prototype.render=function(){
    var container=React.createElement(this._reactFactory,this._reactProperties);
    this._instance=ReactDom.render(container,document.getElementById(this._domId));
    return this._instance;
};
WidgetContainer.prototype.layout=function(param){
    if (this._layoutHandler) this._layoutHandler.layout(param);
}
module.exports=WidgetContainer;