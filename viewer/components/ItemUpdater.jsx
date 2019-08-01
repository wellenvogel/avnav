/**
 * Created by andreas on 25.11.16.
 */
import StoreApi from '../util/storeapi';
import React from 'react';
import assign from 'object-assign';
/**
 * a simple item updater
 * that will register at a store with a key and will update its child based on the data
 * it retrieved from the store
 * all properties are forwarded to the children, mixed with the values fetched from the store
 * @param {*} Item the item (html or react class) that should be wrapped
 * @param {StoreApi} store the store
 * @param {string||string[]} opt_storeKey the key(s) to register at the store and fetch data
 *         if any of the returned items is not an object, the value will be assigned to a key with the
 *         name of the store key
 * @param {function} opt_translator a translate function to convert the data fetched from the store into
 *        properties of the wrapped component
 *        will receive the state object as parameter
 *        if this function is provided, the store items are provided "as is" with their keys in the state object
 * @returns {*} the wrapped react class
 * @constructor
 */
let Updater=function(Item,store,opt_storeKey,opt_translator) {
    let getStoreKeys=function(){
        if (opt_storeKey === undefined) return;
        if (opt_storeKey instanceof Array) return opt_storeKey;
        else return [opt_storeKey]
    };
    class itemUpdater extends React.Component{
        constructor(props) {
            super(props);
            this.state={};
            let st={};
            if (! opt_storeKey) {
                this.state= {update: 1};
                return;
            }
            getStoreKeys().forEach(function(key){
                if (key === undefined) return;
                let v=store.getData(key);
                if (typeof(v) !== "object" || opt_translator){
                    v={};
                    v[key]=store.getData(key);
                }
                assign(st,v);
            });
            this.state=st;
            this.dataChanged=this.dataChanged.bind(this);
            return;

        }
        dataChanged(store,keys) {
            let st={};
            if (! opt_storeKey) {
                this.setState({update:1});
                return;
            }
            if (! keys || keys.length < 1) return; //if we have provided some keys - ignore any global callback
            getStoreKeys().forEach(function(key){
                let v=store.getData(key);
                if (typeof(v) !== "object" || opt_translator){
                    v={};
                    v[key]=store.getData(key);
                }
                assign(st,v);
            });
            this.setState(st);
        }
        componentDidMount() {
            store.register(this, opt_storeKey);
        }
        componentWillUnmount() {
            store.deregister(this);
        }
        render() {
            let props = {};
            if (! opt_translator)
                props=assign({}, this.props, this.state);
            else
                props=assign({},this.props, opt_translator(this.state));
            return <Item {...props}/>
        }
    };
    return itemUpdater;
};

module.exports=Updater;