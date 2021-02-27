/*
 * add updates from the store to components
 * it adds 2 properties to the component:
 * storeKeys: either an array of keys or an object with the keys being the keys of state and the values the store keys
 * and the values being the keys for the state
 * updateFunction: optional - a function that will receive the values as fetched from the store
 * (possibly already translated if storeKeys was an object) and the list of keys and must return the new state
 */

import globalStore from "../util/globalstore.jsx";
import React from 'react';
import assign from 'object-assign';



export default  function(Component,opt_options){
    let store=globalStore;
    class Dynamic extends React.Component{
        constructor(props){
            super(props);
            this.getTranslatedStoreValues=this.getTranslatedStoreValues.bind(this);
            this.getStoreKeys=this.getStoreKeys.bind(this);
            this.dataChanged=this.dataChanged.bind(this);
            let keys=this.getStoreKeys();
            if (keys) store.register(this,keys);
            this.state=this.getTranslatedStoreValues();
            this.updateCallback(this.state);
        }
        updateCallback(data){
            let updateFunction=this.props.changeCallback;
            if (! updateFunction && opt_options) updateFunction=opt_options.changeCallback;
            if (! updateFunction) return;
            let {storeKeys,uf,changeCallback,...forwardProps}=this.props;
            let childprops=assign({},forwardProps,data);
            updateFunction(childprops);
        }
        getStoreKeys(){
            let storeKeys=this.props.storeKeys;
            if (opt_options && opt_options.storeKeys) {
                storeKeys=assign({},opt_options.storeKeys,storeKeys);
            }
            if (!storeKeys) return ;
            if (storeKeys instanceof Array) return storeKeys;
            if (storeKeys instanceof Object) return Object.values(storeKeys);
            return [storeKeys];
        }
        getTranslatedStoreValues(){
            if (! this.getStoreKeys()) return {};
            let values=store.getMultiple(this.props.storeKeys||opt_options.storeKeys);
            let updateFunction=this.props.updateFunction;
            if (! updateFunction){
                if (opt_options && opt_options.updateFunction) updateFunction=opt_options.updateFunction;
            }
            if (updateFunction) {
                return updateFunction(values,this.getStoreKeys());
            }
            return values;
            }
        dataChanged(){
            let data=this.getTranslatedStoreValues()||{};
            this.setState(data);
            this.updateCallback(data);
        }
        componentDidMount(){
            let keys=this.getStoreKeys();
            if (!keys) return;
            store.register(this,keys);
        }
        componentWillUnmount(){
            store.deregister(this);
        }
        render(){
            let {storeKeys,updateFunction,changeCallback,...forwardProps}=this.props;
            let childprops=assign({},forwardProps,this.state);
            return <Component {...childprops}/>
        }
    };
    return Dynamic;
};
