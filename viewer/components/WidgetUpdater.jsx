/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavData=require('../nav/navdata');

var WidgetUpdater=function(Widget){
    return React.createClass({
        propTypes:{
            name: React.PropTypes.string,
            unit: React.PropTypes.string,
            caption: React.PropTypes.string,
            dataKey:React.PropTypes.string,
            click: React.PropTypes.func,
            store: React.PropTypes.instanceOf(NavData).isRequired,
            classes: React.PropTypes.string
        },
        getInitialState: function(){
            return{
                count:1
            };
        },
        componentWillReceiveProps: function(nextProps) {
            this.setState({
                count:this.state.count+1
            });
        },
        dataChanged: function(){
            this.setState({count:this.state.count +1});
        },
        componentWillMount: function(){
            this.props.store.register(this);
        },
        componentWillUnmount: function(){
            this.props.store.deregister(this);
        },
        render: function(){
            return <Widget {...this.props}></Widget>;
        }

    });
};

module.exports=WidgetUpdater;