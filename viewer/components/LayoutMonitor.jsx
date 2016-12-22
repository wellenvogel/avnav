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
        componentDidMount: function () {
            this.element=ReactDOM.findDOMNode(this.refs.item);
            this.rectangle=this.getItemRect();
            if (updateCallback && this.rectangle){
                this.hasNotified=true;
                updateCallback(this.rectangle);
            }
            else{
                if (updateCallback) updateCallback(null);
            }
        },
        componentDidUpdate: function () {
            if (!this.hasNotified){
                this.rectangle=this.getItemRect();
                if (updateCallback && this.rectangle){
                    this.hasNotified=true;
                    updateCallback(this.rectangle);
                }
                else{
                    if (updateCallback) updateCallback(null);
                }
            }
        },
        getItemRect:function(){
            if (! this.element) return;
            var rect=this.element.getBoundingClientRect();
            return rect;
        },
        componentWillUnmount: function () {
        },
        itemUpdate: function(){
            //TODO: check for changes
            this.element=ReactDOM.findDOMNode(this.refs.item);
            this.rectangle=this.getItemRect();
            if(updateCallback && this.rectangle) {
                updateCallback(this.rectangle,true);
            }
            else{
                if (updateCallback) updateCallback(null,true);
            }
        },
        render: function () {
            var props = avnav.assign({}, this.props, {updateCallback: this.itemUpdate});
            return <Item {...props} ref="item"/>
        }
    });
    return itemMonitor;
};

module.exports=Monitor;