/*
 * add updates from the store to components
 * it adds 2 properties to the component:
 * storeKeys: either an array of keys or an object with the keys being the keys of state and the values the store keys
 * and the values being the keys for the state
 * updateFunction: optional - a function that will receive the values as fetched from the store
 * (possibly already translated if storeKeys was an object) and the list of keys and must return the new state
 */

import globalStore from "../util/globalstore.jsx";
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {KeyHelper} from "../util/keys";

export const useStore=(props,opt_options)=>{
    if (! props) return;
    const {storeKeys,updateFunction,minTime,changeCallback,...forward}=props;
    if (! opt_options) opt_options= {};
    const usedStoreKeys=KeyHelper.removeNodeInfo(opt_options.storeKeys||storeKeys);
    if (! usedStoreKeys) return props;
    const store=opt_options.store||globalStore;
    const lastUpdate=useRef(0);
    const timer=useRef(undefined);
    const [values,setValues]=useState(store.getMultiple(usedStoreKeys));
    const usedChangeCallback=opt_options.changeCallback||changeCallback;
    const computeValues=useCallback((data)=>{
        const usedUpdateFunction=opt_options.updateFunction||updateFunction;
        if (usedUpdateFunction) return usedUpdateFunction({...forward,...data},storeKeys);
        return {...forward,...data};
    },[])
    const doSetValues=(data)=>{
        setValues(data);
        if (usedChangeCallback) usedChangeCallback(computeValues(data));
    }
    const dataChanged=useCallback(()=>{
        const usedMinTime=opt_options.minTime||minTime;
        if (usedMinTime){
            if (timer.current !== undefined){
                window.clearTimeout(timer.current);
                timer.current=undefined;
            }
            const now=(new Date()).getTime();
            const tdiff=now-(lastUpdate.current + usedMinTime);
            if (tdiff < 0){
                timer.current=window.setTimeout(()=>doSetValues(store.getMultiple(usedStoreKeys)),-tdiff);
                return;
            }
        }
        doSetValues(store.getMultiple(usedStoreKeys));
    },[usedStoreKeys])
    useEffect(() => {
        store.register(dataChanged,usedStoreKeys);
        return ()=>store.deregister(dataChanged);
    }, [usedStoreKeys]);
    return computeValues(values);
}

export default  function(Component,opt_options,opt_store){
    let store=opt_store||globalStore;
    const Dynamic =(props)=>{
        const currentValues=useStore(props,{...opt_options,store:store});
        return <Component {...currentValues}/>
    }
    return Dynamic;
}
