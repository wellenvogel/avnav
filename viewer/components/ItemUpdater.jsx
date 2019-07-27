/**
 * Created by andreas on 25.11.16.
 */
let Store=require('../util/store');
let React=require('react');
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
 * @param {function} a translate function to convert the data fetched from the store into
 *        properties of the wrapped component
 *        will receive the state object as parameter
 * @returns {*} the wrapped react class
 * @constructor
 */
let Updater=function(Item,store,opt_storeKey,opt_translater) {
    let getStoreKeys=function(){
        if (opt_storeKey === undefined) return;
        if (opt_storeKey instanceof Array) return opt_storeKey;
        else return [opt_storeKey]
    };
    let itemUpdater = React.createClass({
        getInitialState: function () {
            let st={};
            if (! opt_storeKey) return {update:1};
            getStoreKeys().forEach(function(key){
                if (key === undefined) return;
                let v=store.getData(key);
                if (typeof(v) !== "object"){
                    v={};
                    v[key]=store.getData(key);
                }
                avnav.assign(st,v);
            });
            return st;
        },
        dataChanged: function (store,keys) {
            let st={};
            if (! opt_storeKey) {
                this.setState({update:1});
                return;
            }
            if (! keys || keys.length < 1) return; //if we have provided some keys - ignore any global callback
            getStoreKeys().forEach(function(key){
                let v=store.getData(key);
                if (typeof(v) !== "object"){
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
            let props = {};
            if (! opt_translater)
                props=avnav.assign({}, this.props, this.state);
            else
                props=avnav.assign({},this.props, opt_translater(this.state))
            return <Item {...props}/>
        }
    });
    return itemUpdater;
};

module.exports=Updater;