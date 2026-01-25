/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 */
import Requests from "./requests";
import {layoutLoader} from "./layouthandler";
import PropertyHandler from "./propertyhandler";
import NavHandler from "../nav/navdata";
import Helper, {urlToString} from "./helper";
import base from "../base";

const RouteHandler=NavHandler.getRoutingHandler();
export const listItems = async (type) => {
    let items;
    if (type === 'route') {
        items = await RouteHandler.listRoutes();
    } else if (type === 'layout') {
        items = await layoutLoader.listLayouts()
    } else if (type === 'settings') {
        items = await PropertyHandler.listSettings();
    } else {
        items = (await Requests.getJson({
            type: type,
            command: 'list'
        })).items || [];
        items.forEach(item => {
            if (!item) return;
            item.server = true;
        })
    }
    if (items){
        for (let i in items){
            if (!items[i]) items[i]={};
            items[i].type=type;
        }
    }
    return items;
}
export const fetchItem = async (item) => {
    if (!item) throw new Error("no item def in fetch");
    if (item.type === 'chart') throw new Error("fetch not supported for charts")
    let data;
    const type = item.type;
    if (type === 'route') {
        data = await RouteHandler.fetchRoute(item.name,  true);
    } else if (type === 'layout') {
        data = await layoutLoader.loadLayout(item.name,true);
    } else {
        data = (await Requests.getHtmlOrText({
            type: type,
            command: 'download',
            name:item.name
        }));
    }
    return data;
}
export const fetchItemInfo = async (item) => {
    if (!item) return;
    let rt;
    try {
        if (item.type === 'route') {
            rt= await RouteHandler.getInfo(item.name);
        }
        const res = await Requests.getJson({
            type: item.type,
            command: 'info',
            name: item.name
        })
        rt=res.item;
        if (rt) rt.type=item.type;
        return rt;
    } catch (e) {
    }
}

export const injectBaseUrl=(url,baseUrlIn)=>{
    if (! url) return;
    try {
        const baseUrl = baseUrlIn ? (new URL(baseUrlIn, window.location.href)) : window.location.href;
        return urlToString(url, baseUrl);
    }catch (e){
        base.log(`error converting url ${url}, base ${baseUrlIn}: ${e}`);
    }
    return url;

}
export const getUrlWithBase=(item,element='url')=>{
    if (!item) return;
    const url=item[element];
    return injectBaseUrl(url,item.baseUrl);
}
export const itemListToSelectList = (itemList, opt_selected,opt_filter) => {
    const rt = [];
    if (!itemList) return rt;
    itemList.forEach(item => {
        if (opt_filter) {
            if (!opt_filter(item)) return;
        }
        const sitem = {...item,
            value: item.name,
            key: item.name,
            label: item.displayName || item.name,
        };
        if (opt_selected && item.name === opt_selected) {
            sitem.selected = true;
        }
        rt.push(sitem);
    });
    return rt;
}

export const KNOWN_OVERLAY_EXTENSIONS = ['gpx', 'kml', 'kmz', 'geojson'];
export const IMAGES = ['png', 'jpg', 'jpeg', 'svg', 'bmp', 'tiff', 'gif'];
export const getItemIconProperties=(item)=>{
    let icon=getUrlWithBase(item,'icon');
    if (icon){
        return {
            className:'icon',
            style:{backgroundImage: "url('" + (icon) + "')"}
        }
    }
    let typeClass=item.isDirectory?'directory':item.type;
    if (item.type === 'overlay'){
        const [fn,ext]=Helper.getNameAndExt(item.name);
        if (KNOWN_OVERLAY_EXTENSIONS.indexOf(ext) < 0) typeClass="user other"
    }
    else if (item.type === 'track'){
        const [fn,ext]=Helper.getNameAndExt(item.name);
        if (ext !== 'gpx') typeClass="user other"
    }
    else if (item.type === 'plugin'){
        const specialNames=['user.mjs','user.mjs','user.css','keys.json','splitkeys.json','images.json'];
        if (specialNames.indexOf(item.name) >= 0){
            typeClass= 'user special';
        }
        else {
            const [fn, ext] = Helper.getNameAndExt(item.name);
            if (IMAGES.indexOf(ext) >= 0) {
                typeClass= 'images';
            }
            else if (ext === 'html') {
                typeClass= 'user html'
            }
            else if (ext === 'txt') {
                typeClass= 'text';
            }
            typeClass= 'user other';
        }
    }
    if (! typeClass) return;
    return {
        className: Helper.concatsp('icon',typeClass)
    }
}