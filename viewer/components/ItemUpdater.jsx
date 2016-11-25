/**
 * Created by andreas on 25.11.16.
 * a simple item updater
 * that will register at a store with a key and will update its child based on the data
 * it retrieved from the store
 * properties:
 *  store: the store to register
 *  storeKey: the key to bes used for the store
 *  child: the React child element to render
 *  all properties are forwarded to the children, mixed with the values fetched from the store
 */
var Store=require('../util/store');
var React=require('react');

var itemUpdater=React.createClass({
    propTypes:{
        store: React.PropTypes.instanceOf(Store).isRequired,
        storeKey: React.PropTypes.string.isRequired,
    },
    getInitialState: function(){
        var st=this.props.store.getData(this.props.storeKey);
        if (st) return st;
        return {
        };
    },
    dataChanged:function(){
        var newState=this.props.store.getData(this.props.storeKey);
        this.setState(newState);
    },
    componentDidMount: function(){
        this.props.store.register(this,this.props.storeKey);
    },
    componentWillUnmount: function(){
        this.props.store.deregister(this);
    },
    render:function(){
        var props=avnav.assign({},this.props,this.state);
        var children=React.Children.map(this.props.children,function(child){
            return React.cloneElement(child,props);
        });
        if (children.length > 1) throw new Error("item updater only supports one child element");
        if (children.length == 0) throw new Error("item updater needs exactly one child element");
        return children[0];
    }
});

module.exports=itemUpdater;