/**
 * Created by andreas on 25.11.16.
 */
var Store=require('../util/store');
var React=require('react');
/**
 * a simple item updater
 * that will register at a store with a key and will update its child based on the data
 * it retrieved from the store
 * all properties are forwarded to the children, mixed with the values fetched from the store
 * @param {*} Item the item (html or react class) that should be wrapped
 * @param {Store} store the store
 * @param {string||string[]} storeKey the key(s) to register at the store and fetch data
 * @returns {*} the wrapped react class
 * @constructor
 */
var Updater=function(Item,store,storeKey) {
    var getStoreKeys=function(){
        if (storeKey instanceof Array) return storeKey;
        else return [storeKey]
    };
    var itemUpdater = React.createClass({
        getInitialState: function () {
            var st={};
            getStoreKeys().forEach(function(key){
                avnav.assign(st,store.getData(key));
            });
            return st;
        },
        dataChanged: function () {
            var st={};
            getStoreKeys().forEach(function(key){
                avnav.assign(st,store.getData(key));
            });
            this.setState(st);
        },
        componentDidMount: function () {
            store.register(this, storeKey);
        },
        componentWillUnmount: function () {
            store.deregister(this);
        },
        render: function () {
            var props = avnav.assign({}, this.props, this.state);
            return <Item {...props}/>
        }
    });
    return itemUpdater;
};

module.exports=Updater;