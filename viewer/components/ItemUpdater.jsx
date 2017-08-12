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
 * @param {string||string[]} opt_storeKey the key(s) to register at the store and fetch data
 *         if any of the returned items is not an object, the value will be assigned to a key with the
 *         name of the store key
 * @returns {*} the wrapped react class
 * @constructor
 */
var Updater=function(Item,store,opt_storeKey) {
    var getStoreKeys=function(){
        if (opt_storeKey === undefined) return;
        if (opt_storeKey instanceof Array) return opt_storeKey;
        else return [opt_storeKey]
    };
    var itemUpdater = React.createClass({
        getInitialState: function () {
            var st={};
            if (! opt_storeKey) return {update:1};
            getStoreKeys().forEach(function(key){
                var v=store.getData(key);
                if (typeof(v) != "object"){
                    v={};
                    v[key]=store.getData(key);
                }
                avnav.assign(st,v);
            });
            return st;
        },
        dataChanged: function () {
            var st={};
            if (! opt_storeKey) {
                this.setState({update:1});
                return;
            }
            getStoreKeys().forEach(function(key){
                var v=store.getData(key);
                if (typeof(v) != "object"){
                    v={};
                    v[key]=store.getData(key);
                }
                avnav.assign(st,v);
            });
            this.setState(st);
        },
        componentDidMount: function () {
            store.register(this, opt_storeKey);
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