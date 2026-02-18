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

 import html from 'htm';
 import {useState,useEffect,useCallback,useRef} from 'react';
 import {useDialogContext,ListItem,ListSlot,ListMainSlot} from 'avnav';

 const ZONE_T='trusted';
 const ZONE_B='block';

 const fetchData=async (url)=>{
    const response=await fetch(url);
    if (! response.ok) throw new Error(`error fetching ${url}: ${response.status}`);
    const data=await response.json();
    if (data.status != 'OK') throw new Error(`error fetching ${url}: ${data.status} ${data.error}`);
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

 const Interface=({intf,selected,onClick})=>{
    let className="interface";
    return html`
    <${ListItem} className=${className} selected=${selected} onClick=${(ev)=>onClick(ev)}>
        <${ListMainSlot}
            primary=${intf.interface}
            secondary=${html`<span className="ipaddr">${nested(intf,'condata.ip4config.addressdata.0.address')}</span>
            ${!!intf.condata && html` 
            <span className="bssid">${nested(intf,"condata.hwaddress")}</span>
            <span className="zone">${nested(intf,'condata.connection.connection.zone')}</span>
            <span className="freq">${nested(intf,'condata.frequency')}MHz</span>
            <span className="ssid">${nested(intf,'condata.connection.802-11-wireless.ssid')}</span>
            `}
            `}
            />
    <//> `;
 }
 const netNeedsPw=(net)=>{
    return !!((net.flags||"").match(/PRIVACY/));
 }
 const Network=({net,onClick})=>{
    const mbr=(net.maxbitrate||0)/1000;
    const secondary=html`
        <span className="bssid">${net.hwaddress}<//>
        <span className="strength">${net.strength}%<//>
        <span className="bitrate">${mbr.toFixed()}Mbit/s<//>
        <span className="freq">${net.frequency}MHz<//>
    `;
    const needsPw=netNeedsPw(net);
    return html`<${ListItem} className="network" onClick=${(ev)=>onClick(ev)}>
        <${ListMainSlot} primary=${net.ssid} secondary=${secondary}/>
        <${ListSlot}> ${net.condata?"configured":"unknown"},${needsPw?"encr":"open"}<//>
        <//>`
 }

 const NetworkList=({items,onClick})=>{
    return html`
    <div className="networkList">
        <div className="heading">Available Networks<//>
        <div className="itemList">
        ${items.map((item)=>{
            return html`<${Network} net=${item} onClick=${(ev)=>onClick(ev,item)} key=${item.path}/>`
            }
        )}
        </div>
    </div>` 
 }
 const InterfaceList=({selectedIdx,items,onChange})=>{
    let idx=0;
    if (items.length < 1){
        return html`<div className="interfaceList nointf">no free network interfaces</div>`
    }
    return html`
    <div className="interfaceList">
        <div className="heading">Available Interfaces<//>
        <div className="itemList">
        ${items.map((item)=>{
            const ourIdx=idx;
            const isSel=ourIdx === selectedIdx;
            idx++;
            return html`<${Interface} intf=${item} selected=${isSel} onClick=${(ev)=>onChange(ourIdx)} key=${item.path}/>`
            }
        )}
        </div>
    </div>`
 }
 const ConnectionMonitor=({api,intf,activeConnection})=>{
    const [conState,setConState]=useState("Connecting");
    const dialogContext=useDialogContext();
    useEffect(()=>{
        const url=api.getBaseUrl()+"api/getItem?path="+encodeURIComponent(activeConnection);
        const timer=window.setInterval(()=>{
            fetchData(url).then((res)=>{
                const state=nested(res,"data.state");
                if (state === 'Activated'){
                    dialogContext.closeDialog();
                }
                setConState(state);
            })
            .catch((e)=>{
                api.log(`unable to connect: ${e}`)
                setConState("Error");
            });
        },2000);
        return ()=>{
            window.clearInterval(timer);
        }
    })
    return html`
        <div className="conState">
        <span className="intf">${intf.interface}<//>
        <span className="state">${conState}<//>
        <//>
    `;
 }
 const showConnectionMonitor=({api,dialogContext,intf,activeConnection})=>{
    api.showDialog({
        className:"nwmplugin connectionMonitor",
        title:'Connecting...',
        text: html`<${ConnectionMonitor} api=${api} activeConnection=${activeConnection} intf=${intf}/>`,
        buttons: [{name:'cancel'}]
    },dialogContext);
 }

 const showConnectDialog=async ({api,dialogContext,network,intf})=>{
    const connection=network.condata;
    const needsPw=netNeedsPw(network);
    const hasPw=connection && connection.haspsk;
    const hasExternalAccess=connection && (nested(connection,'connection.zone') == ZONE_T);
    const parameters=[
        {name:'ext',
            displayName:'externalAccess',
            type:'BOOLEAN',
            default:hasExternalAccess,
            description:'If not enabled all access from external systems to the AvNav server on this connection is blocked.'+
             ' Use this when you connect to an insecure Wifi network. If you enable this there is no protection on the AvNav server for this connection.'
        }
    ]
    if (needsPw){
        parameters.splice(0,0,
            {name:'psk',
                displayName:'password',
                type:'STRING',
                default:'',
                checker:(v)=>{
                if (! v) {
                    if(! hasPw) throw new Error("must not be empty");
                    return true;
                }
                if (v.length < 8 || v.length > 64) throw new Error("invalid len (8...63 or 64 hex)")
                if (v.length == 64){
                    //must be hex
                    if (!v.match(/^[0-9A-Fa-f]*$/)) throw new Error("invalid hex");
                }
                else{
                    if (! v.match(/^[\u0020-\u007e]*$/)) throw new Error("invalid character");
                }
                return true;
                },
                description: 'The password for the Wifi network. 8...63 characters or 64 hex characters.'+
                    (hasPw?' Leave it empty to use the already configured password.':' Required')
        })
    }
    const ssid=nested(network,'ssid');
    const close=await api.showDialog({
        className:'nwmplugin connectDialog',
        parameters: parameters,
        title: 'Connect',
        text: `${ssid} via ${intf.interface}`,
        values:{},
        buttons: [
            {name: 'delete',
                visible: !!network.condata,
                onClick: async (ev)=>{
                    const path=nested(network,'condata.path');
                    if (! path) return;
                    const d1=await api.showDialog({
                        text:'Removing Connection'
                    },ev)
                    const url=api.getBaseUrl()+'api/removeConnection?path='+encodeURIComponent(path);
                    await fetchData(url);
                    d1();
                    close();
                },
                close:false
            },
            {name:'cancel'},
            {name:'ok',
                close:false,
                onClick:async (ev,values)=>{
                    try{
                        let zone=values.ext?ZONE_T:ZONE_B;
                        let conPath;
                        if (! connection){
                            if (needsPw && (! values.psk || hasPw)){
                                api.showToast("network needs a password");
                                return;
                            }
                            let url=api.getBaseUrl()+'api/addConnection?ssid='+encodeURIComponent(ssid);
                            if (needsPw && !! values.psk) url+="&psk="+encodeURIComponent(values.psk);
                            const d1= await api.showDialog({
                                text:'Creating Connection'
                            },ev);
                            const res=await fetchData(url);
                            conPath=res.data;
                            d1();
                        }
                        else{
                            conPath=connection.path;
                            let mustUpdate=false;
                            if (needsPw && values.psk){
                                //must update connection
                                //TODO: check if connection has a password
                                mustUpdate=true;
                            }
                            if (nested(connection,'connection.zone') !== zone){
                                mustUpdate=true;
                            }
                            if (mustUpdate){
                                let url=api.getBaseUrl()+"api/updateConnection?path="+
                                    encodeURIComponent(conPath)+
                                    "&zone="+encodeURIComponent(zone);
                                if (values.psk){
                                    url+="&psk="+encodeURIComponent(values.psk);
                                }
                                const d2=await api.showDialog({text:'Updating Connection'},ev)
                                const res=await fetchData(url);
                                d2();
                            }
                        }
                        const url=api.getBaseUrl()+"api/activateConnection?path="+
                            encodeURIComponent(conPath)+
                            "&ap="+encodeURIComponent(network.path)+
                            "&device="+encodeURIComponent(intf.path);
                        const d3=await api.showDialog({text:'Triggering Connection'},ev);
                        const res=await fetchData(url);
                        d3();
                        if (! res.data){
                            api.showToast("no connection created");
                            return;
                        }
                        close();
                        showConnectionMonitor({api,dialogContext,intf,activeConnection:res.data});
                        
                    }catch (e){
                        api.showToast(e+"");
                        return;
                    }
                }
            }
        ]
    },dialogContext)
 }

 const NetworkDialog=({api})=>{
    const dialogContext=useDialogContext();
    const [interfaces,setInterfaces]=useState([]);
    const [activeConnections,setActiveConnections]=useState([]);
    const [connections,setConnections]=useState([]);
    const [networks,setNetworks]=useState([]);
    const [fetchState,setFetchState]=useState(1);
    const [selected,setSelected]=useState(-1);
    const timer=useRef(undefined);
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
    const fetchAll=useCallback(()=>{
        const intfUrl=api.getBaseUrl()+"api/devices?full=true&deviceType=Wi-Fi";
        fetchItems(intfUrl,(intf)=>{
            setInterfaces(intf);
            if (intf.length > 0){
                setSelected((old)=>(old<0)?0:(old>=intf.length)?old=intf.length-1:old);
            }
            }
            ,1);
        const acUrl=api.getBaseUrl()+"api/activeConnections?includeIpConfig=true&type=802-11-wireless";
        fetchItems(acUrl,setActiveConnections,4);
        const conUrl=api.getBaseUrl()+"api/connections?type=802-11-wireless";
        fetchItems(conUrl,setConnections,2);
    },[fetchItems]);
    useEffect(()=>{
        fetchAll();
        const timer=window.setInterval(()=>{
            fetchAll()
        },10000);
        return ()=>window.clearInterval(timer);
    },[])
    const scan=useCallback((intf,rescan)=>{
        const key=8;
        setFetchState(key);
        let url=api.getBaseUrl()+"api/scan?path="+encodeURIComponent(intf);
        if (rescan) url+="&rescan=true";
        fetchData(url)
            .then ((response)=>{
                setNetworks(response.data)
                setFetchState((old)=>old & (0xff ^ key));
            })
            .catch((error)=>{
                setNetworks([]);
                api.showToast(error);
                setFetchState((old)=>old & (0xff ^ key));
            }
            );

    },[api,setFetchState])
    useEffect(()=>{
        if (timer.current !== undefined) window.clearInterval(timer.current);
        timer.current=undefined;
        const device=nested(interfaces[selected],'path');
        if (! device) return;
        let current;
        scan(device,true);
        current=window.setInterval(()=>{
            if (timer.current !== current) return;
            scan(device);
        },5000)
        timer.current=current;
        return ()=>{
            if (timer.current !== undefined) window.clearTimeout(timer.current);
        }
    },[selected])
    //filter interfaces that we can use
    //these need to have state "Activated" and either no active connection 
    //or an connection of type infrastructure
    const availableInterfaces=[];
    const connectionsInUse={};
    const connectedAps={}; 
    (interfaces||[]).forEach((intf)=>{
        if (intf.activeconnection){
            //find the connection
            for (let con of activeConnections){
                if (con.path !== intf.activeconnection) continue;
                if (nested(con,'connection.802-11-wireless.mode') !== 'infrastructure') return;
                intf.condata=con;
                const configured=nested(con,'connection.path');
                if (configured) connectionsInUse[configured]=con;
                const ap=nested(con,'hwaddress')
                if (ap) connectedAps[ap]=con;
                break;
            }
        }
        availableInterfaces.push(intf);
    });
    const selectedInterface=interfaces[selected];
    const seenNetworks=[];
    if (selectedInterface){
        const path=nested(selectedInterface,"path");
        if (path){
            (networks||[]).forEach((network)=>{
                if (connectedAps[network.hwaddress]) return;
                network={...network};
                if (network.device !== path) return;
                const ssid=network.ssid;
                if (! ssid) return;
                for (let con of connections){
                    if (ssid !== nested(con,"802-11-wireless.ssid") || 
                    nested(con,'802-11-wireless.mode') !== 'infrastructure' ) continue;
                    network.condata=con;
                }
                seenNetworks.push(network);
            })
        }
    }
     const selectChange = (id) => {
         if (id === selected && selectedInterface) {
             if (selectedInterface.activeconnection) {
                 const ssid = nested(selectedInterface, 'condata.connection.802-11-wireless.ssid')
                 api.showDialog({
                     title: 'Disconnect?',
                     text: `${ssid} on ${selectedInterface.interface}`,
                     buttons: [
                         { name: 'cancel' },
                         {
                             name: 'ok',
                             onClick: async (ev) => {
                                 const path = selectedInterface.activeconnection;
                                 if (!path) return;
                                 const url = api.getBaseUrl() + 'api/deactivateConnection?path=' + encodeURIComponent(path);
                                 await fetchData(url);
                             }
                         }
                     ]
                 }, dialogContext)
             }
             else{
                setSelected(id);
             }

         }
         else {
             setSelected(id);
         }
     }
    return html`
    <${ListItem} className="headline">
        <${ListMainSlot} primary="Wifi"/>
        <${ListSlot}>
        ${fetchState && html`<span className="spinner"/>`}
        <//>
    <//>
    <${InterfaceList} selectedIdx=${selected} items=${availableInterfaces} onChange=${(id)=>selectChange(id)}/>
    <${NetworkList} items=${seenNetworks} onClick=${(ev,network)=>{
        showConnectDialog({api,dialogContext,network,intf:availableInterfaces[selected]})
    }}/>
    `
 }

 export default async (api)=>{
    const KVISIBLE=api.getStoreBaseKey()+".visible";
    api.setStoreData(KVISIBLE,false);
    let dialogHandle;
    const showNetworkDialog=async (ev)=>{
        const rt=await api.showDialog({
            text: html`<${NetworkDialog} api=${api}/>`,
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