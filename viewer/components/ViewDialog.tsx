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
import {DBCancel, DialogButtons, DialogFlexInner, DialogFrame} from "./OverlayDialog";
import Helper from "../util/helper";
// @ts-ignore
import {createItemActions} from './FileDialog'
import {IMAGES} from "../util/itemFunctions";
import requests, {prepareUrl} from "../util/requests";
import Toast from "./Toast";

export interface ViewDialogProps{
    title?:React.ReactNode,
    type?:string,
    html?:string,
    url?:string,
    name?:string,
    useIframe?: boolean,
    text?:React.ReactNode,
    ext?:string
    fullscreen?:boolean, //default true
    omitCancel?:boolean,
}

export const ViewDialog=(props:ViewDialogProps)=>{
    const [viewData,setViewData]=React.useState(props.html||props.text||'');
    const getUrl=()=>{
        if (props.url) return props.url;
        return prepareUrl({
            command:'download',
            type:props.type,
            name:props.name
        });
    }
    let ext;
    if (props.ext){
        ext=props.ext;
    }
    else if (props.url){
        ext = Helper.getExt(props.url);
    }
    else if (props.html){
        ext='html'
    }
    else if (props.type){
        const actions=createItemActions(props.type);
        ext=actions.getExtensionForView({name:props.name})
    }
    const isImage=ext?IMAGES.indexOf(ext.toLowerCase())>=0:false;
    let mode=isImage?0:(ext === 'html')?1:2;
    if (props.url && props.useIframe){
        mode=4;
    }
    useEffect(()=>{
        if (props.text || props.html) return;
        if ( props.url &&  props.useIframe) return;
            requests.getHtmlOrText(getUrl(),{noCache:true})
                .then((text)=>setViewData(text))
                .catch((e)=>Toast(e))
    },[props.url,props.useIframe,props.text,props.html]);
    return <DialogFrame fullscreen={Helper.unsetorTrue(props.fullscreen)} title={props.title||`${props.type} ${props.name}`} className={Helper.concatsp('viewDialog')}>
        <DialogFlexInner>
            {(mode === 1) && <div className={"html"} dangerouslySetInnerHTML={{__html: viewData}}></div>}
            {(mode === 0) && <img className="readOnlyImage" src={getUrl()} alt=""/>}
            {(mode === 2) && <div className={"text"}>{viewData}</div>}
            {(mode == 4) &&
                <div className="addOnFrame">
                    <iframe className="viewPageIframe addOn" src={getUrl()}/>
                </div>}
        </DialogFlexInner>
        <DialogButtons buttonList={[
            DBCancel({
                visible:!props.omitCancel
            })
        ]}/>
    </DialogFrame>
}
 
