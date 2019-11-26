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


import NavData from './nav/navdata';
import React from 'react';
import ReactDOM from 'react-dom';
import OverlayDialog from './components/OverlayDialog.jsx';
import propertyHandler from './util/propertyhandler';
ol.DEFAULT_TILE_CACHE_HIGH_WATER_MARK=256;
import App from './App.jsx';
import history from './util/history';
import MapHolder from './map/mapholder';
import keys from './util/keys.jsx';
import globalStore from './util/globalstore.jsx';
import base from './base.js';



if (! window.avnav){
    window.avnav={};
}


function getParam(key)
{
    // Find the key and everything up to the ampersand delimiter
    let value=RegExp(""+key+"[^&]+").exec(window.location.search);

    // Return the unescaped value minus everything starting from the equals sign or an empty string
    return unescape(!!value ? value.toString().replace(/^[^=]+./,"") : "");
}

/**
 * main function called when dom is loaded
 *
 */
avnav.main=function() {
    //some workaround for lees being broken on IOS browser
    //less.modifyVars();
    document.querySelector('body').style.display='block';

    if (getParam('log')) avnav.debugMode=true;
    let navurl=getParam('navurl');
    if (navurl){
        globalStore.storeData(keys.properties.navUrl,navurl,true);
        globalStore.storeData(keys.properties.routingServerError,false,true);
    }
    else {
        globalStore.storeData(keys.properties.routingServerError,true,true);
    }

    if (getParam('onAndroid')){
        globalStore.storeData(keys.gui.global.onAndroid,true,true);
    }
    else {
        globalStore.storeData(keys.gui.global.onAndroid,false,true);
    }
    let ro="readOnlyServer";
    if (getParam(ro) && getParam(ro) == "true"){
        globalStore.storeData(keys.properties.connectedMode,false,true);
    }
    //make the android API available as avnav.android
    if (window.avnavAndroid){
        base.log("android integration enabled");
        globalStore.storeData(keys.gui.global.onAndroid,true,true);
        avnav.android=window.avnavAndroid;
        globalStore.storeData(keys.properties.routingServerError,false,true);
        globalStore.storeData(keys.properties.connectedMode,true,true);
        avnav.version=avnav.android.getVersion();
        avnav.android.applicationStarted();
    }
    history.push('mainpage');
    ReactDOM.render(<App/>,document.getElementById('new_pages'));

    //ios browser sometimes has issues with less...
    setTimeout(function(){
        propertyHandler.incrementSequence();
    },1000);
    base.log("avnav loaded");
};

