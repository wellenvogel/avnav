/*
 * add updates from the store to components
 * it adds 2 properties to the component:
 * storeKeys: either an array of keys or an object with the keys being the keys of state and the values the store keys
 * and the values being the keys for the state
 * updateFunction: optional - a function that will receive the values as fetched from the store
 * (possibly already translated if storeKeys was an object) and the list of keys and must return the new state
 */

// @ts-ignore
import globalStore from "../util/globalstore.jsx";
import React, {Children, cloneElement, useEffect, useRef, useState} from 'react';
// @ts-ignore
import {KeyHelper} from "../util/keys";
// @ts-ignore
import {useStateRef} from "../util/GuiHelpers";


export type StoreKeys=Record<string, string>;
export type Props=Record<string, any>;
export type UpdateFunction=(props:Props,storeKeys:StoreKeys) => Props;
interface Options{
    storeKeys?:StoreKeys;
    store?:any
    updateFunction?:UpdateFunction;
    changeCallback?:(value:any) => void;
    minTime?: number; //minimal intervale between updates
}
const getStoreAndKeys=(props:Props,options:Options)=>{
    if (! options) options={};
    if (! props) props={};
    const usedStoreKeys=KeyHelper.removeNodeInfo({...options.storeKeys,...props.storeKeys});
    if (typeof(usedStoreKeys) !== 'object'){
        throw Error("invalid type of storeKeys: "+typeof(usedStoreKeys));
    }
    const store=options.store||globalStore;
    const usedUpdateFunction=options.updateFunction||props.updateFunction;
    return [store,usedStoreKeys,usedUpdateFunction];
}
const computeValues=(fw:any,storeKeys:StoreKeys,data:Record<string,any>,usedUpdateFunction:UpdateFunction)=>{
    if (usedUpdateFunction) return {...fw,...usedUpdateFunction({...data},storeKeys)};
    return {...fw,...data};
}
const getStoreValues=(forwardData:Props,store:any|undefined,storeKeys:StoreKeys|undefined,updateFunction:UpdateFunction)=>{
    if (! store || ! storeKeys) return forwardData;
    const values:Props=store.getMultiple(storeKeys);
    return computeValues(forwardData,storeKeys,values,updateFunction);
}

export const useStore=(props:Props,opt_options?:Options)=>{
    if (! props) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {storeKeys,updateFunction,minTime,changeCallback,...forward}=props;
    if (! opt_options) opt_options= {};
    const [store,usedStoreKeys,usedUpdateFunction]=getStoreAndKeys(props,opt_options);
    if (! usedStoreKeys) {
        return props;
    }
    const lastUpdate=useRef(0);
    const timer=useRef(undefined);
    const [values,setValues]=useState(store.getMultiple(usedStoreKeys));
    const usedChangeCallback=changeCallback||opt_options.changeCallback;
    const callbackRef=useRef();
    if (! callbackRef.current){
        callbackRef.current=store.register(()=>{
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
        },usedStoreKeys)
    }
    const doSetValues=(data:Props)=>{
        setValues(data);
        lastUpdate.current=(new Date()).getTime();
        if (usedChangeCallback) usedChangeCallback(computeValues(forward,usedStoreKeys,data,usedUpdateFunction));
    }
    useEffect(() => {
        return ()=>store.deregister(callbackRef.current);
    }, []);
    if (usedChangeCallback){
        useEffect(() => {
            usedChangeCallback(computeValues(forward,usedStoreKeys,values,usedUpdateFunction));
        }, []);
    }
    return computeValues(forward,usedStoreKeys,values,usedUpdateFunction);
}

export const DynamicFrame=(props:Props)=>{
    const values=useStore(props);
    return <React.Fragment>
        {Children.map(props.children,(child)=>cloneElement(child,values))}
    </React.Fragment>
}
/**
 * compute the current values for an item with storeKeys
 * @param props
 * @param options
 * @returns {*|(*)|(*)}
 */
export const dynamicWrapper=(props:Props,options:Options)=>{
    if (! props) return;
    const [store,storeKeys,updateFunctions]=getStoreAndKeys(props,options);
    if (! storeKeys) return props;
    return getStoreValues(props,store,storeKeys,updateFunctions);
}

export default  function(Component:any,opt_options?:Options,opt_store?:any){
    const store=opt_store||globalStore;
     return (props:Props)=>{
        const currentValues=useStore(props,{...opt_options,store:store});
        return <Component {...currentValues}/>
    }
}
/**
 * create a state that is backed up by the store
 * @param storeKey
 * @param defaultInitialValue - the initial value to be set if no value in the store (or forceInital)
 *        can be a function
 * @param forceInitial - always set this initial value if not undefine
 */
export const useStoreState = (storeKey:string, defaultInitialValue?:any, forceInitial?:boolean) => {
    const [value, setValue,valueRef] = useStateRef(() => {
        let iv = globalStore.getData(storeKey);
        if (iv === undefined || forceInitial) {
            iv = (typeof defaultInitialValue === 'function') ? defaultInitialValue(iv) : defaultInitialValue;
            if (iv !== undefined) globalStore.storeData(storeKey, iv);
        }
        return iv;
    });
    const setter = useRef();
    if (!setter.current) {
        setter.current = globalStore.register(() => {
            setValue(globalStore.getData(storeKey));
        }, storeKey);
    }
    useEffect(() => {
        return () => {
            globalStore.deregister(setter.current);
        }
    }, []);
    return [
        value,
        (nv:any) => {
            globalStore.storeData(storeKey, nv);
        },
        valueRef
    ]
}