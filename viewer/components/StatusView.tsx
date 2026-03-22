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
import React, {useCallback, useEffect, useRef, useState} from 'react';
import ItemList from "./ItemList";
// @ts-ignore
import Requests from '../util/requests';
import {StatusItem} from './StatusItems';
import {createDialog} from './EditHandlerDialog';
import {ScrollExeMode, scrollInContainer, useTimer} from '../util/UiHelper';
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import base from "../base";
import Helper from "../util/helper";

export interface StatusViewProps{
    className?: string;
    kinds?:ChannelKinds[];
    allowEdit?:boolean;
    focusItem?:number|string,
    callback?:(handlerList?:any[])=>void
}
const queryStatus= async ():Promise<any[]>=>{
    return Requests.getJson({
        request:'api',
        type:'config',
        command:'status'
    }).then(
        (json:any)=>{
            return json.handler as any[]
        });
}
const ACTIVE_CLASS='activeEntry';
// eslint-disable-next-line react/display-name
export default (props:StatusViewProps)=>{
    const [statusList, setStatusList] = useState<any[]>([]);
    const connected=globalstore.getData(keys.properties.connectedMode);
    const allowEdit=Helper.unsetorTrue(props.allowEdit);
    const [focusItem,setFocusItem]=useState(props.focusItem);
    const lastFocusItem=useRef(null);
    const listRef=useRef(null);
    const timer=useTimer((sequence)=>{
        queryStatus().then((data)=>{
            let displayData=[];
            if (props.kinds){
                for (const handler of data){
                    if (props.kinds.indexOf(handler.kind) >= 0){
                        displayData.push(handler);
                    }
                }
            }
            else{
                displayData=data
            }
            setStatusList(displayData);
            if (props.callback){
                props.callback(displayData);
            }
            timer.startTimer(sequence);
        },
            (error)=>{
                base.log('StatusView error',error);
                if (props.callback){
                    props.callback();
                }
            })
    },3000);
    useEffect(()=>{
        setFocusItem(props.focusItem);
        timer.restart(true);
    },[props.focusItem,props.kinds]);
    useEffect(() => {
        if (lastFocusItem.current === focusItem || ! focusItem) return;
        if (!listRef.current) return;
        const itemElement=listRef.current.querySelector('.'+ACTIVE_CLASS);
        if (itemElement){
            lastFocusItem.current=focusItem;
            scrollInContainer(listRef.current,itemElement,ScrollExeMode.vertical);
        }
    },[focusItem,statusList]);
    const itemClass=useCallback((iprops:any)=><StatusItem
            className={iprops.id === focusItem ? ACTIVE_CLASS: ""}
            connected={connected}
            allowEdit={allowEdit}
            finishCallback={
                () => {
                    window.setTimeout(() => {
                            timer.restart(true);
                        }
                        , 1000);
                }
            }
            showEditDialog={
                (handlerId: string | number,
                 child?: string,
                 opt_doneCallback?: () => void) => {
                    setFocusItem(handlerId);
                    createDialog(handlerId, child, opt_doneCallback)
                }
            }
            {...iprops}/>
        ,[focusItem,props.allowEdit,connected]);
    return <ItemList
        listRef={(el)=>listRef.current=el}
        className={Helper.concatsp('StatusView',props.className)}
        itemList={statusList}
        keyFunction={(item)=>item.displayKey||item.id}
        itemClass={itemClass}
        scrollable={true}
    />
}

export enum ChannelKinds {
    CHART = 'chart',
    TRACK = 'track',
    ROUTE = 'route',
    LAYOUT = 'layout',
    SETTINGS = 'settings',
    PLUGINS = 'plugins',
    CHANNEL = 'channel',
    USER = 'user',
    ADDON = 'addon',
    OTHER = 'other'
}
