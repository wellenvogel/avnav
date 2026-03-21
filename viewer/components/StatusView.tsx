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
import React, {useEffect, useRef} from 'react';
import ItemList from "./ItemList";
// @ts-ignore
import Requests from '../util/requests';
// @ts-ignore
import {StatusItem} from './StatusItems';
// @ts-ignore
import EditHandlerDialog from './EditHandlerDialog';
import {ScrollExeMode, scrollInContainer, useTimer} from '../util/UiHelper';
import globalstore from "../util/globalstore";
import keys from "../util/keys";

export interface StatusViewProps{
    className?: string;
    kinds?:string[];
    allowEdit?:boolean;
    focusItem?:number|string
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
    const [statusList, setStatusList] = React.useState<any[]>([]);
    const connected=globalstore.getData(keys.properties.connectedMode);
    const nextFocusItem=useRef(props.focusItem);
    const listRef=useRef(null);
    const timer=useTimer((sequence)=>{
        queryStatus().then((data)=>{
            setStatusList(data);
            timer.startTimer(sequence);
        })
    },3000);
    useEffect(()=>{
        timer.restart(true);
    },[props.focusItem]);
    useEffect(() => {
        if (!nextFocusItem.current) return;
        nextFocusItem.current = undefined;
        if (!listRef.current) return;
        const itemElement=listRef.current.querySelector('.'+ACTIVE_CLASS);
        if (itemElement){
            scrollInContainer(listRef.current,itemElement,ScrollExeMode.vertical);
        }
    });
    return <ItemList
        listRef={(el)=>listRef.current=el}
        className={props.className}
        itemList={statusList}
        keyFunction={(item)=>item.displayKey||item.id}
        itemClass={(iprops: any) => <StatusItem
            className={iprops.id === props.focusItem ? ACTIVE_CLASS: ""}
            connected={connected}
            allowEdit={props.allowEdit}
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
                 opt_doneCallback?: () => void) =>
                    EditHandlerDialog.createDialog(handlerId, child, opt_doneCallback)
            }
            {...iprops}/>}
        scrollable={true}
    />
}

