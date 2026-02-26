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

 import html from '/modules/htm.js';
 import {useState,useEffect,useCallback,useRef} from '/modules/react.js';
 import {useDialogContext,ListItem,ListSlot,ListMainSlot,Icon} from '/modules/avnavui.js';


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
    let zoneClass='_none';
    const zone=nested(intf,'condata.connection.connection.zone');
    if (zone == ZONE_B) zoneClass='zblocked';
    if (zone == ZONE_T) zoneClass='ztrusted';
    return html`
    <${ListItem} className=${className} selected=${selected} onClick=${(ev)=>onClick(ev)}>
        <${ListMainSlot}
            primary=${intf.interface}
            secondary=${html`<span className="ipaddr">${nested(intf,'condata.ip4config.addressdata.0.address')}</span>
            ${!!intf.condata && html` 
            <span className="bssid">${nested(intf,"condata.hwaddress")}</span>
            <span className="freq">${nested(intf,'condata.frequency')}MHz</span>
            <span className="ssid">${nested(intf,'condata.connection.802-11-wireless.ssid')}</span>
            `}
            `}
            />
        <${ListSlot} icon=${{className:zoneClass}}/>
    <//> `;
 }
 const netNeedsPw=(net)=>{
    return !!((net.flags||"").match(/PRIVACY/));
 }
 const strengthToClass=(strength)=>{
    if (isNaN(strength)) return '';
    if (strength< 25) return 'wifi1';
    if (strength < 50) return 'wifi2';
    if (strength < 75) return 'wifi3';
    return 'wififull';
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
        <${ListSlot} icon=${{className: strengthToClass(net.strength)}}/>
        <${ListSlot} icon=${{className:net.condata?'configured':'_none'}}/>
        <${ListSlot} icon=${{className:needsPw?"encrypted":"open"}}/>
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
 const InterfaceList=({selectedPath,items,scanning,onChange})=>{
    return html`
    <${ListItem} className="heading">
        <${ListMainSlot} primary="Available Interfaces"/>
        <${ListSlot}>
        ${scanning && html`<span className="spinner"/>`}
        <//>
    <//>
    ${(items.length < 1)? html`
        <div className="interfaceList nointf">no available interfaces</div>`
        :
    html`
    <div className="interfaceList">
        <div className="itemList">
        ${items.map((item)=>{
            const path=nested(item,'path');
            const isSel=path == selectedPath;
            return html`<${Interface} intf=${item} selected=${isSel} onClick=${(ev)=>onChange(path)} key=${path}/>`
            }
        )}
        </div>
    </div>`
    }`
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
 const showConnectionMonitor=({api,dialogContext,intf,activeConnection,onClose})=>{
    api.showDialog({
        onClose: onClose,
        className:"nwmplugin connectionMonitor",
        title:'Connecting...',
        html: html`<${ConnectionMonitor} api=${api} activeConnection=${activeConnection} intf=${intf}/>`,
        buttons: [{name:'cancel'}]
    },dialogContext);
 }

 const undefOrTrue=(v)=>{
    if (v === undefined) return true;
    return !!v;
 }
 const sleep=async (ms)=>{
    return new Promise((resolve)=>{
        window.setTimeout(()=>resolve(true),ms);
    })
 }
 const showConnectDialog=async ({api,dialogContext,network,intf,onClose,onConnect})=>{
    const connection=network.condata;
    const needsPw=netNeedsPw(network);
    const hasPw=connection && connection.haspsk;
    const hasExternalAccess=connection && (nested(connection,'connection.zone') == ZONE_T);
    const hasAutoconnect=! connection || undefOrTrue(nested(connection,'connection.autoconnect'))
    const initialValues={
            ext: hasExternalAccess,
            autoconnect: hasAutoconnect
        };
    const parameters=[
        {name:'ext',
            displayName:'externalAccess',
            type:'BOOLEAN',
            default:false,
            description:'If not enabled all access from external systems to the AvNav server on this connection is blocked.'+
             ' Use this when you connect to an insecure Wifi network. If you enable this there is no protection on the AvNav server for this connection.'
        },
        {
            name:'autoconnect',
            type:'BOOLEAN',
            default: true,
            description:'Automatically connect to the network when it is available.'
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
        values:initialValues,
        onClose: onClose,
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
                        let mustSleep=false;
                        let zone=values.ext?ZONE_T:ZONE_B;
                        let conPath;
                        if (! connection){
                            mustSleep=true;
                            if (needsPw && (! values.psk || hasPw)){
                                api.showToast("network needs a password");
                                return;
                            }
                            let url=api.getBaseUrl()+'api/addConnection?ssid='+
                                encodeURIComponent(ssid)+
                                "&zone="+encodeURIComponent(zone)+
                                "&autoconnect="+encodeURIComponent(values.autoconnect);
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
                            if (nested(connection,'connection.autoconnect') !== values.autoconnect){
                                mustUpdate=true;
                            }
                            if (mustUpdate){
                                mustSleep=true;
                                let url=api.getBaseUrl()+"api/updateConnection?path="+
                                    encodeURIComponent(conPath)+
                                    "&zone="+encodeURIComponent(zone)+
                                    "&autoconnect="+encodeURIComponent(values.autoconnect);
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
                        if (mustSleep){
                            await sleep(500);
                        }
                        const res=await fetchData(url);
                        d3();
                        if (! res.data){
                            api.showToast("no connection created");
                            return;
                        }
                        close();
                        onConnect(res.data);
                        
                    }catch (e){
                        api.showToast(e+"");
                        return;
                    }
                }
            }
        ]
    },dialogContext)
 }

 const itemFromPath=(items,path)=>{
    if (! path || ! items) return;
    for (let item of items){
        if (nested(item,'path') == path) return item;
    }
 }
 const NetworkDialog=({api})=>{
    const dialogContext=useDialogContext();
    const [interfaces,setInterfaces]=useState([]);
    const [activeConnections,setActiveConnections]=useState([]);
    const [connections,setConnections]=useState([]);
    const [networks,setNetworks]=useState([]);
    const [fetchState,setFetchState]=useState(1);
    const [selected,setSelected]=useState(); //path of selected interface
    const disableFetch=useRef(false);
    const timer=useRef(undefined);
    const fetchItems=useCallback((url,setter,key)=>{
        if (disableFetch.current) return;
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
        if (disableFetch.current) return;
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
        const device=itemFromPath(interfaces,selected);
        if (! device) return;
        let current;
        scan(selected,true);
        current=window.setInterval(()=>{
            if (timer.current !== current) return;
            scan(selected);
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
    const ownAps={}; //key: hwaddress-ssid, value: activeConnection
    (interfaces||[]).forEach((intf)=>{
        if (intf.activeconnection){
            //find the connection
            for (let con of activeConnections){
                if (con.path !== intf.activeconnection) continue;
                const mode=nested(con,'connection.802-11-wireless.mode');
                if (mode !== 'infrastructure'){
                    if (mode === 'ap'){
                        //remember hwaddress+ssid of our hotspots
                        //to omit them from the list
                        const ssid=nested(con,'connection.802-11-wireless.ssid');
                        const hwaddr=con.hwaddress;
                        ownAps[hwaddr+"-"+ssid]=con.path;
                    }
                    return;
                }
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
    if (! selected && availableInterfaces.length > 0 && fetchState == 0){
        const path=availableInterfaces[0].path;
        window.setTimeout(()=>{
            selectChange(path)
        },10);
    }
    let selectedInterface=itemFromPath(availableInterfaces,selected);
    if (selected && ! selectedInterface){
        window.setTimeout(()=>{
            selectChange('');
        },10);
    }
    const seenNetworks=[];
    if (selectedInterface){
        const path=nested(selectedInterface,"path");
        if (path){
            (networks||[]).forEach((network)=>{
                if (connectedAps[network.hwaddress]) return;
                if (ownAps[network.hwaddress+"-"+network.ssid]) return;
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
     const selectChange = (path) => {
         if (path === selected && selectedInterface) {
             if (selectedInterface.activeconnection) {
                 const ssid = nested(selectedInterface, 'condata.connection.802-11-wireless.ssid')
                 disableFetch.current=true;
                 api.showDialog({
                     title: 'Disconnect?',
                     text: `${ssid} on ${selectedInterface.interface}`,
                     onClose: ()=>disableFetch.current=false,
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
                setSelected(path);
             }

         }
         else {
             setSelected(path);
         }
     }
    return html`
    <${InterfaceList} 
        selectedPath=${selected} 
        items=${availableInterfaces} 
        onChange=${(path)=>selectChange(path)}
        scanning=${fetchState != 0}
        />
    <${NetworkList} items=${seenNetworks} onClick=${(ev,network)=>{
        disableFetch.current=1;
        const intf=itemFromPath(availableInterfaces,selected);
        showConnectDialog({
            api,
            dialogContext,
            network,
            intf,
            onClose: ()=>{
                if (disableFetch.current == 1){
                    disableFetch.current=false
                }
            },
            onConnect: (activeConnection)=>{
                disableFetch.current=2;
                showConnectionMonitor({api,
                    dialogContext,
                    intf,
                    activeConnection,
                    onClose: ()=>disableFetch.current=false})
            }
        })
    }}/>
    `
 }

 export default async (api)=>{
    const KVISIBLE=api.getStoreBaseKey()+".visible";
    api.setStoreData(KVISIBLE,false);
    let dialogHandle;
    const showNetworkDialog=async (ev)=>{
        const rt=await api.showDialog({
            html: html`<${NetworkDialog} api=${api}/>`,
            onClose:()=>{
                api.setStoreData(KVISIBLE,false);
                dialogHandle=undefined;
            },
            fullscreen: true,
            title: 'Wifi',
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