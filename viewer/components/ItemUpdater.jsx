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
 * @param {string||string[]||object} opt_storeKey the key(s) to register at the store and fetch data
 *         if any of the returned items is not an object, the value will be assigned to a key with the
 *         name of the store key
 *         if the parameter is an object it is used as a translator
 *         the keys in the object will be the property names and the values the corresponding store keys
 * @param {function} opt_translator a translate function to convert the data fetched from the store into
 *        properties of the wrapped component
 *        will receive the state object as parameter
 *        if this function is provided, the store items are provided "as is" with their keys in the state object
 *        if the opt_storeKey parameter is an object and opt_translator is given additionally, the input is an object
 *        that still has the store keys as parameters
 * @returns {*} the wrapped react class
 * @constructor
 */
let Updater=function(Item,store,opt_storeKey,opt_translator) {
    class itemUpdater extends React.Component{
        constructor(props) {
            super(props);
            this.state={};
            let st={};
            this.storeKeys=[];
            this.transferFunction=function(state){return state};
            this.toObject=false;
            this.updateCount=1;
            if (opt_storeKey){
                if (opt_storeKey instanceof Array){
                    this.storeKeys=opt_storeKey;
                }
                else {
                    if (opt_storeKey instanceof  Object){
                        this.toObject=true;
                        this.storeKeys=[];
                        for (let k in opt_storeKey){
                            this.storeKeys.push(opt_storeKey[k]);
                        }
                        this.transferFunction=function(state){
                            let rt={};
                            for (let k in opt_storeKey){
                                rt[k]=state[opt_storeKey[k]];
                            }
                            return rt;
                        }

                    }
                    else{
                        this.storeKeys=[opt_storeKey];
                    }
                }
            }
            if (opt_translator){
                this.toObject=true;
                this.transferFunction=function(state){
                    return opt_translator(state);
                }
            }
            this.transferFunction=this.transferFunction.bind(this);
            let self=this;

            this.storeKeys.forEach(function(key){
                if (key === undefined) return;
                let v=store.getData(key);
                if (typeof(v) !== "object" || self.toObject){
                    v={};
                    v[key]=store.getData(key);
                }
                assign(st,v);
            });
            if (this.storeKeys.length < 1){
                st['update']=this.updateCount;
            }
            this.state=st;
            this.dataChanged=this.dataChanged.bind(this);
            return;

        }
        dataChanged(store,keys) {
            let self=this;
            let st={};
            if (this.storeKeys.length < 1) {
                this.updateCount++;
                this.setState({update:this.updateCount});
                return;
            }
            if (! keys || keys.length < 1) return; //if we have provided some keys - ignore any global callback
            this.storeKeys.forEach(function(key){
                let v=store.getData(key);
                if (typeof(v) !== "object" || self.toObject){
                    v={};
                    v[key]=store.getData(key);
                }
                assign(st,v);
            });
            this.setState(st);
        }
        componentDidMount() {
            store.register(this, this.storeKeys);
        }
        componentWillUnmount() {
            store.deregister(this);
        }
        render() {
            let props =assign({}, this.props, this.transferFunction(this.state));
            return <Item {...props}/>
        }
    }
    return itemUpdater;
};

module.exports=Updater;