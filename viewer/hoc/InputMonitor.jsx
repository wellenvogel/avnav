/*
 * monitors a component to be included in the list of active
 * inputs
 */

import globalStore from "../util/globalstore.jsx";
import React, {useEffect} from 'react';
import keys from '../util/keys.jsx';


let activeInputs={};
let currentId=0;

const getNextId=()=>{
    currentId++;
    return currentId;
}

export default  function(Component,opt_store){
    let store=opt_store?opt_store:globalStore;
    class InputMonitor extends React.Component{
        constructor(props){
            super(props);
            this.id=0;
        }
        componentDidMount(){
            this.id=getNextId();
            activeInputs[this.id]=true;
            store.storeData(keys.gui.global.hasActiveInputs,Object.keys(activeInputs).length > 0);
        }
        componentWillUnmount(){
            delete activeInputs[this.id];
            store.storeData(keys.gui.global.hasActiveInputs,Object.keys(activeInputs).length > 0);
        }
        render(){
            return <Component {...this.props}/>
        }
    };
    return InputMonitor;
};

export const useInputMonitor=(opt_store)=>{
    let store=opt_store?opt_store:globalStore;
    useEffect(() => {
        const id=getNextId();
        activeInputs[id]=true;
        store.storeData(keys.gui.global.hasActiveInputs,Object.keys(activeInputs).length > 0);
        return ()=>{
            delete activeInputs[id];
            store.storeData(keys.gui.global.hasActiveInputs,Object.keys(activeInputs).length > 0);
        }
    }, []);
}