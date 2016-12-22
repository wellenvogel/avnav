/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavData=require('../nav/navdata');

var WidgetUpdater=function(Widget){
    return React.createClass({
        propTypes:{
            store: React.PropTypes.instanceOf(NavData).isRequired
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
            return <Widget {...this.props}/>;
        }

    });
};

module.exports=WidgetUpdater;