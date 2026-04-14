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
 import {fetchData,nested} from './helper.mjs';

 const InterfaceItem=({intf})=>{
    const driver=nested(intf,'driver');
    const ipv4=nested(intf,'ip4config.addressdata')||[];
    const ipv6=nested(intf,'ip6config.addressdata')||[];
    const wifimode=nested(intf,'activeconnection.connection.802-11-wireless.mode');
    const ssid=nested(intf,'activeconnection.connection.802-11-wireless.ssid');
    return html`
        <${ListItem} className="InterfaceItem">
            <${ListMainSlot}>
            <div className="row base">
                <span className="name">${nested(intf,'interface')}<//>
                <span className="props">${nested(intf,'devicetype')}<//>
                <span className="props">${nested(intf,'state')}<//>
                ${ (driver && driver != 'unknown') && html`<span className="props">${driver}<//>`}
            </div>
            <div className="row hwaddr">
                <span className="label">hwaddr<//>
                <span className="props">${nested(intf,'hwaddress')}<//>
            <//>
            ${wifimode && html`
                <div className="row wifi">
                <span className="label">wifi<//>
                <span className="props">${wifimode}<//>
                <span className="props">${ssid}<//>
            <//>
                `}
            ${ipv4.map(ip=>html`
                <div className="row ip">
                    <span className="label">ipv4<//>
                    <span className="props">
                        ${nested(ip,'address')+"/"+nested(ip,'prefix')}
                    <//>
                <//>
                `)}
            ${ipv6.map(ip=>html`
                <div className="row ip">
                    <span className="label">ipv6<//>
                    <span className="props">
                        ${nested(ip,'address')+"/"+nested(ip,'prefix')}
                    <//>
                <//>
                `)}
            <//>
        <//>
    `
 }

 export const IpInfoDialog=({api})=>{
    const [interfaces,setInterfaces]=useState([]);
    const [error,setError]=useState();
    const [loading,setLoading]=useState(true);
    useEffect(()=>{
        const url=api.getBaseUrl()+"api/devices?full=true&includeIpConfig=true&includeConnection=true";
        fetchData(url)
            .then((res)=>{
                setInterfaces(res.data);
                setLoading(false);
            })
            .catch((e)=>setError(e));
    },[])
    if (error){
        return html`<div className="dialogRow error">${error+""}<//>`
    }
    if (loading){
        return html`<div className="spinner"/>`
    }
    return html`
        <div className="networkInfo">
            ${interfaces.map(intf=>html`<${InterfaceItem} intf=${intf}/>`)}
        <//>    
    `;
 }