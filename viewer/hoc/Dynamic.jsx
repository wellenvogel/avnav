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



module.exports= function(Component,opt_store){
    let store=opt_store?opt_store:globalStore;
    class Dynamic extends React.Component{
        constructor(props){
            super(props);
            this.getTranslatedStoreValues=this.getTranslatedStoreValues.bind(this);
            this.getStoreKeys=this.getStoreKeys.bind(this);
            this.dataChanged=this.dataChanged.bind(this);
            this.state=this.getTranslatedStoreValues();
        }
        getStoreKeys(){
            if (!this.props.storeKeys) return [];
            if (this.props.storeKeys instanceof Array) return this.props.storeKeys;
            if (this.props.storeKeys instanceof Object) return Object.values(this.props.storeKeys);
            return [this.props.storeKeys];
        }
        getTranslatedStoreValues(){
            if (! this.props.storeKeys) return {};
            let values=store.getMultiple(this.props.storeKeys);
            if (this.props.updateFunction) {
                return this.props.updateFunction(values,this.props.storeKeys);
            }
            return values;
            }
        dataChanged(){
            this.setState(this.getTranslatedStoreValues()||{});
        }
        componentDidMount(){
            let keys=this.getStoreKeys();
            if (keys.length < 1) return;
            store.register(this,keys);
        }
        componentWillUnmount(){
            store.deregister(this);
        }
        render(){
            let {storeKeys,updateFunction,...forwardProps}=this.props;
            let childprops=assign({},forwardProps,this.state);
            return <Component {...childprops}/>
        }
    };
    return Dynamic;
};