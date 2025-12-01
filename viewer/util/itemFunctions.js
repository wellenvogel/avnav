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
            item.server = true;
        })
    }
    if (items){
        items.forEach(item => {item.type=type})
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
        data = await layoutLoader.loadLayout(item.name);
        //the layout is loaded as json...
        data = JSON.stringify(data, undefined, 2);
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

export const fetchSequence = async (item) => {
    if (!item) return;
    if (item.type === 'chart') {
        if (!item.url) return undefined;
        const url = item.url + "/sequence?_=" + (new Date()).getTime();
        //set noCache to false to avoid pragma in header (CORS...)
        const data = await Requests.getJson(url, {useNavUrl: false, noCache: false});
        return data.sequence || 0;
    }
    if (item.url) {
        return await Requests.getLastModified(item.url);
    }
    const info = await fetchItemInfo(item);
    return info.time;
}