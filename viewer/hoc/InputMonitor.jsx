/*
 * monitors a component to be included in the list of active
 * inputs
 */

import globalStore from "../util/globalstore.jsx";
import React from 'react';
import keys from '../util/keys.jsx';
import assign from 'object-assign';


let activeInputs={};
let currentId=0;

export default  function(Component,opt_store){
    let store=opt_store?opt_store:globalStore;
    class InputMonitor extends React.Component{
        constructor(props){
            super(props);
            this.id=0;
        }
        componentDidMount(){
            currentId++;
            this.id=currentId;
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