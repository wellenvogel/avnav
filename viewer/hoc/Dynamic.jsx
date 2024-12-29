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
import {KeyHelper} from "../util/keys";


export default  function(Component,opt_options,opt_store){
    let store=opt_store||globalStore;
    class Dynamic extends React.Component{
        constructor(props){
            super(props);
            this.getTranslatedStoreValues=this.getTranslatedStoreValues.bind(this);
            this.getStoreKeys=this.getStoreKeys.bind(this);
            this.dataChanged=this.dataChanged.bind(this);
            let keys=this.getStoreKeys();
            if (keys) store.register(this,keys);
            this.lastUpdate=0;
            this.state=this.getTranslatedStoreValues();
            this.updateCallback(this.state);
            this.timer=undefined;
        }
        updateCallback(data){
            this.lastUpdate=(new Date()).getTime();
            let updateFunction=this.props.changeCallback;
            if (! updateFunction && opt_options) updateFunction=opt_options.changeCallback;
            if (! updateFunction) return;
            let {storeKeys,uf,changeCallback,...forwardProps}=this.props;
            let childprops={...forwardProps,...data};
            updateFunction(childprops);
        }
        getStoreKeys(){
            let storeKeys=this.props.storeKeys;
            if (opt_options && opt_options.storeKeys) {
                storeKeys={...opt_options.storeKeys,...storeKeys};
            }
            if (!storeKeys) return ;
            if (! (storeKeys instanceof Object)){
                throw Error("store keys is no object",storeKeys);
            }
            return KeyHelper.removeNodeInfo(storeKeys);
        }
        getTranslatedStoreValues(){
            const keys=this.getStoreKeys();
            if (! keys) return {};
            let values=store.getMultiple(keys);
            let updateFunction=this.props.updateFunction;
            if (! updateFunction){
                if (opt_options && opt_options.updateFunction) updateFunction=opt_options.updateFunction;
            }
            if (updateFunction) {
                return updateFunction(values,keys);
            }
            return values;
            }
        doUpdate(){
            let data=this.getTranslatedStoreValues()||{};
            this.setState(data);
            this.updateCallback(data);
        }
        dataChanged(){
            if (opt_options && opt_options.minTime){
                let now=(new Date()).getTime();
                let tdiff=this.lastUpdate+opt_options.minTime -now;
                if (tdiff > 0){
                    if (this.timer){
                        window.clearTimeout(this.timer);
                        this.timer=undefined;
                    }
                    this.timer=window.setTimeout(()=>{
                        this.timer=undefined;
                        this.doUpdate();
                    },tdiff);
                    return;
                }
            }
            this.doUpdate();
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
            let childprops={...forwardProps,...this.state};
            return <Component {...childprops}/>
        }
    }
    return Dynamic;
};
