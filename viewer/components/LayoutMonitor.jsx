/**
 * Created by andreas on 21.12.16.
 */

var React=require('react');
var ReactDOM=require('react-dom');
/**
 * a simple item updater
 * that will register at a store with a key and will update its child based on the data
 * it retrieved from the store
 * all properties are forwarded to the children, mixed with the values fetched from the store
 * @param {*} Item the item (html or react class) that should be wrapped
 * @param updateCallback the callback to be invoked when the layout changes
 * @returns {*} the wrapped react class
 * @constructor
 */
var Monitor=function(Item,updateCallback) {
    var itemMonitor = React.createClass({
        propTypes:{
            updateCallback: React.PropTypes.func.isRequired,
        },
        componentDidMount: function () {
            this.itemUpdate();
        },
        componentDidUpdate: function () {
            this.itemUpdate();
        },
        componentWillUnmount: function () {
            if (updateCallback){
                updateCallback(null);
            }
        },
        itemUpdate: function(opt_force){
            if (! updateCallback) return;
            var element=ReactDOM.findDOMNode(this.refs.item);
            var rectangle=element?element.getBoundingClientRect():null;
            updateCallback(rectangle,opt_force);
        },
        render: function () {
            var self=this;
            var props = avnav.assign({}, this.props, {updateCallback: function(){self.itemUpdate(true);}});
            return <Item {...props} ref="item"/>
        }
    });
    return itemMonitor;
};

module.exports=Monitor;