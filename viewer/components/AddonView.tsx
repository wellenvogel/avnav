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
 
import React, {useEffect} from 'react';
import {UserApp} from "../api/api.interface";
import {useStore} from "../hoc/Dynamic";
import Helper from "../util/helper";
import Headline from "./Headline";
import {ButtonEvent} from "./Button";
import {DialogFrame, showDialog} from "./OverlayDialog";
// @ts-ignore
import alarmhandler, {LOCAL_TYPES} from "../nav/alarmhandler";
export interface AddonViewProps extends UserApp{
    className?:string;
    visible?:boolean;
    preventConnectionLost?: boolean;
    name:string;
}

export const AddonView = (iprops: AddonViewProps): React.ReactNode => {
    const sprops = useStore(iprops);
    useEffect(() => {
        if (iprops.preventConnectionLost){
            const id=alarmhandler.addBlock(LOCAL_TYPES.preventConnectionLost);
            return ()=>alarmhandler.removeBlock(id);
        }
    }, []);
    if (! Helper.unsetorTrue(sprops.visible)) {
        return null
    }
    return <div className={Helper.concatsp("addOnFrame", sprops.className)}>
        {sprops.title && <Headline dynamicTitleIcons={false} title={sprops.title}/>}
        <div className={'addonInner'}>
            {(!sprops.renderHtml && !sprops.url) && <div>{`no url/html for ${iprops.name}`}</div>}
            {iprops.renderHtml && iprops.renderHtml(iprops)}
            {sprops.url && <iframe className={"addonIframe"} src={sprops.url}/>}
        </div>
    </div>
}

const TOGGLE='toggle'
export const addonButtonAction=async (
    ev:ButtonEvent,
    config:AddonViewProps,
    noToggle?:boolean
    )=>{
    if (config.url && config.newWindow){
        window.open(config.url,config.name);
        return;
    }
    const ctx=ev?.avnav?.context;
    if (!ctx) return
    const handle=ctx.getValue(TOGGLE)
    if (handle){
        await handle();
        ctx.setValue(TOGGLE,undefined);
        if (! noToggle) return;
    }
    const newHandle=await showDialog(ev?.avnav?.dialogContext,()=>{
            return <DialogFrame fullscreen={true}>
                <AddonView {...config}/>
            </DialogFrame>
        },
        ()=>{
            ctx.setValue(TOGGLE,undefined);
        });
    ctx.setValue(TOGGLE,newHandle);
}