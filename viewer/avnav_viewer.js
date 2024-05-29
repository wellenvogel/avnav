/*
# vim: ts=2 sw=2 et
###############################################################################
# Copyright (c) 2014, Andreas Vogel andreas@wellenvogel.net
# parts of software from movable-type
# http://www.movable-type.co.uk/
# for their license see the file latlon.js
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
###############################################################################

icons partly from http://www.tutorial9.net/downloads/108-mono-icons-huge-set-of-minimal-icons/
                  http://ionicons.com/ (MIT license)
*/

import splitsupport from "./util/splitsupport";

if (getParam('dimm')) avnav.testDim=true;

import React from 'react';
import ReactDOM from 'react-dom';
import propertyHandler from './util/propertyhandler';
import OverlayDialog from './components/OverlayDialog.jsx';
import App from './App.jsx';
import keys from './util/keys.jsx';
import globalStore from './util/globalstore.jsx';
import base from './base.js';
import Requests from './util/requests.js';
import Toast from './components/Toast.jsx';
import Api from './util/api.js';
import registerRadial from './components/CanvasGaugeDefinitions.js';
import AvNavVersion from './version.js';
import assign from 'object-assign';
import LeaveHandler from './util/leavehandler';
import isIosSafari from '@braintree/browser-detection/is-ios-safari';
import LocalStorage, {PREFIX_NAMES} from './util/localStorageManager';
import debugSupport from 'debugSupport.js';


if (! window.avnav){
    window.avnav={};
}

window.avnav.api=Api;
window.avnav.version=AvNavVersion;


function getParam(key)
{
    // Find the key and everything up to the ampersand delimiter
    let value=RegExp(""+key+"[^&]+").exec(window.location.search);

    // Return the unescaped value minus everything starting from the equals sign or an empty string
    return decodeURIComponent(!!value ? value.toString().replace(/^[^=]+./,"") : "");
}

/**
 * main function called when dom is loaded
 *
 */
export default function() {
    let storePrefix=getParam('storePrefix');
    if (storePrefix && storePrefix !== "") LocalStorage.setPrefix(storePrefix);
    if (LocalStorage.hasPrefix()){
        //fill the prefixed data with the unprefixed one if prefixed is not available
        for (let n in PREFIX_NAMES){
            let sn=PREFIX_NAMES[n];
            let item=LocalStorage.getItem(sn,undefined);
            if (! item){
                item=LocalStorage.getItem(sn,undefined);
                if (item){
                    LocalStorage.setItem(sn,undefined,item);
                }
            }

        }
    }
    propertyHandler.resetToSaved();
    propertyHandler.savePrefixedValues();
    //some workaround for lees being broken on IOS browser
    //less.modifyVars();
    let body=document.querySelector('body');
    body.style.display='block';
    if (isIosSafari()){
        //strange bug on IOS 13 safari - seems that it does not recompute the height after rotating and hiding address bar...
        body.style.height="100vh";
        document.querySelector('html').style.height="100vh";
    }

    if (getParam('log')) avnav.debugMode=true;
    let navurl=getParam('navurl');
    if (navurl){
        globalStore.storeData(keys.properties.navUrl,navurl,true);
        globalStore.storeData(keys.properties.routingServerError,false,true);
    }
    else {
        globalStore.storeData(keys.properties.routingServerError,true,true);
    }
    let ro="readOnlyServer";
    if (getParam(ro) && getParam(ro) == "true"){
        globalStore.storeData(keys.properties.connectedMode,false,true);
    }
    if (getParam("noCloseDialog") === "true"){
        LeaveHandler.stop();
    }
    if (getParam('preventAlarms') === 'true'){
        globalStore.storeData(keys.gui.global.preventAlarms,true);
    }
    if (getParam('ignoreAndroidBack') === 'true'){
        globalStore.storeData(keys.gui.global.ignoreAndroidBack,true);
    }
    if (getParam('splitMode') === 'true'){
        globalStore.storeData(keys.gui.global.splitMode,true);
    }
    let lateLoads=["/user/viewer/user.js"];
    let addScripts="addScripts";
    if (getParam(addScripts)){
        getParam(addScripts).split(',').forEach((script)=>{
            lateLoads.push(script);
        })
    }
    const loadScripts=(loadList)=>{
        let fileref=undefined;
        for (let i in  loadList) {
            let scriptname=loadList[i];
            if (scriptname.match(/js$/)){ //if filename is a external JavaScript file
                fileref=document.createElement('script');
                fileref.setAttribute("type","text/javascript");
                fileref.setAttribute("src", scriptname);
            }
            else { //if filename is an external CSS file
                fileref=document.createElement("link");
                fileref.setAttribute("rel", "stylesheet");
                fileref.setAttribute("type", "text/css");
                fileref.setAttribute("href", scriptname);
            }
            if (typeof fileref!="undefined")
                document.getElementsByTagName("head")[0].appendChild(fileref)
        }
    };

    const doLateLoads=(loadPlugins)=>{
        ReactDOM.render(<App/>,document.getElementById('new_pages'));
        //ios browser sometimes has issues with less...
        setTimeout(function(){
            propertyHandler.incrementSequence();
        },1000);

        let scriptsLoaded=false;
        //load the user and plugin stuff
        if (loadPlugins) {
            Requests.getJson("?request=plugins&command=list").then(
                (json)=> {
                    if (json.data) {
                        json.data.forEach((plugin)=> {
                            if (plugin.js) lateLoads.push(plugin.js);
                            if (plugin.css) lateLoads.push(plugin.css);
                        })
                    }
                    if (! scriptsLoaded)loadScripts(lateLoads);
                    scriptsLoaded=true;
                }
            ).catch(
                (error)=> {
                    Toast("unable to load plugin data: " + error);
                    if (! scriptsLoaded) loadScripts(lateLoads);
                }
            );
        }
        else{
            loadScripts(lateLoads);
        }
    };
    //register some widget definitions
    registerRadial();
    if (splitsupport.setSplitFromLast()){
        return;
    }
    //check capabilities
    let falseCapabilities={};
    for (let k in keys.gui.capabilities){
        falseCapabilities[k]=false;
    }
    Requests.getJson("?request=capabilities").then((json)=>{
        let capabilities=assign({},falseCapabilities,json.data);
        globalStore.storeMultiple(capabilities,keys.gui.capabilities);
        doLateLoads(globalStore.getData(keys.gui.capabilities.plugins));
    }).catch((error)=>{
        globalStore.storeMultiple(falseCapabilities,keys.gui.capabilities);
        doLateLoads(globalStore.getData(keys.gui.capabilities.plugins));
    });
    base.log("avnav loaded");
};

