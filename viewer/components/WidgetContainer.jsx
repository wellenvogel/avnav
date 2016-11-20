/**
 * Created by andreas on 20.11.16.
 */
var React=require('react');
var Factory=require('./WidgetFactory.jsx');
module.exports=React.createClass({
    propTypes:{
        onClick:            React.PropTypes.func.isRequired,
        items:              React.PropTypes.array,
        updateCallback:     React.PropTypes.func,
        store:              React.PropTypes.object.isRequired,
        propertyHandler:    React.PropTypes.object.isRequired
    },
    render: function(){
        var self=this;
        return (
        <div>
            {this.props.items.map(function(item){
                var widget=Factory.createWidget(item,{
                    store: self.props.store,
                    propertyHandler: self.props.propertyHandler
                    },function(data){self.widgetClicked(item,data);});
                return widget;
            })}
        </div>
        );
    },
    widgetClicked: function(widgetName,data){
        this.props.onClick(Factory.findWidget(widgetName),data);
    },
    componentDidMount: function(){
        if (this.props.updateCallback){
            this.props.updateCallback();
        }
    }
});
