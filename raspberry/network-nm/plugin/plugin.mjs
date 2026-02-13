/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 */

 import htm from 'htm';
 import {useState,useEffect,useCallback} from 'react';
 const fetchStates={
    0: undefined,
    1: "reading devices",
    2: "reading connections configurations",
    4: "reading active connections",
    8: "scanning"
 };
 const fetchData=async (url)=>{
    const response=await fetch(url);
    if (! response.ok) throw new Error(`error fetching ${url}: ${response.status}`);
    const data=await response.json();
    if (data.status != 'OK') throw new Error(`error fetching ${url}: ${data.status}`);
    return data;
 }

 const nested=(obj,key)=>{
    const parts=key.split('.')
    for (let pp of parts){
        if (typeof(obj) !== 'object') return;
        if (! (pp in obj )) return;
        obj=obj[pp];
    }
    return obj;
 }

 const Interface=({intf})=>{
    return htm`<div className="interface dialogRow">${intf.interface}<//>`;
 }
 const Heading=htm`<h3>Wifi</h3>`
 const NetworkDialog=({api})=>{
    const [interfaces,setInterfaces]=useState([]);
    const [activeConnections,setActiveConnections]=useState([]);
    const [connections,setConnections]=useState([]);
    const [networks,setNetworks]=useState([]);
    const [fetchState,setFetchState]=useState(1);
    const fetchItems=useCallback((url,setter,key)=>{
        setFetchState((old)=>old | key);
        fetchData(url)
            .then ((response)=>{
                setter(response.data);
                setFetchState((old)=>old & (0xff ^ key));
            })
            .catch((error)=>{
                api.showToast(error);
                setFetchState((old)=>old & (0xff ^ key));
            }
            );

    },[api,setFetchState]);
    useEffect(()=>{
        const intfUrl=api.getBaseUrl()+"api/devices?full=true&deviceType=Wi-Fi";
        fetchItems(intfUrl,setInterfaces,1);
        const acUrl=api.getBaseUrl()+"api/activeConnections?includeIpConfig=true&type=802-11-wireless";
        fetchItems(acUrl,setActiveConnections,4);
        const conUrl=api.getBaseUrl()+"api/connections?type=802-11-wireless";
        fetchItems(conUrl,setConnections,2);
        const nwUrl=api.getBaseUrl()+"api/scan";
        fetchItems(nwUrl,setNetworks,8);
    },[]);
    if (fetchState != 0){
        return htm`${Heading}
        ${Object.keys(fetchStates).map((fs)=>(fetchState & fs)?htm`<div className="fetchState">${fetchStates[fs]}<//>`:null)}
        `
    }
    //filter interfaces that we can use
    //these need to have state "Activated" and either no active connection 
    //or an connection of type infrastructure
    const availableInterfaces=[];
    (interfaces||[]).forEach((intf)=>{
        if (intf.activeconnection){
            //find the connection
            for (let con of activeConnections){
                if (con.path !== intf.activeconnection) continue;
                if (nested(con,'connection.802-11-wireless.mode') !== 'infrastructure') return;
                break;
            }
            availableInterfaces.push(intf);
        }
    });
    if (availableInterfaces.length < 1){
        return htm`${Heading}
        <div className="dialogRow nointf">no free network interfaces</div>
        `
    }
    return htm`<h3>Wifi</h3>
    ${interfaces.map((intf)=>htm`<${Interface} intf=${intf}/>`)}
    `
 }

 export default async (api)=>{
    const KVISIBLE=api.getStoreBaseKey()+".visible";
    api.setStoreData(KVISIBLE,false);
    let dialogHandle;
    const showNetworkDialog=async (ev)=>{
        const rt=await api.showDialog({
            text: htm`<${NetworkDialog} api=${api}/>`,
            onClose:()=>{
                api.setStoreData(KVISIBLE,false);
                dialogHandle=undefined;
            },
            fullscreen: true,
            className: 'nwmplugin WifiDialog'
        },ev);
        api.setStoreData(KVISIBLE,true);
        return rt;
    }
    api.registerUserButton({
        name:'network',
        icon:'wifi.svg',
        onClick:async (ev)=>{
            if (dialogHandle){
                dialogHandle();
                return;
            }
            dialogHandle=await showNetworkDialog(ev);
        },
        storeKeys: {
                toggle:KVISIBLE
            },
    },'statuspage');
 }