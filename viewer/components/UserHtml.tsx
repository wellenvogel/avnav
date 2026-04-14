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

import React from "react";
// @ts-ignore
import ReactHtmlParser,{convertNodeToElement} from 'react-html-parser/dist/react-html-parser.min.js';
// @ts-ignore
import base from '../base.ts';
import {ErrorBoundary} from "./ErrorBoundary";

const REACT_EVENTS=('onCopy onCut onPaste onCompositionEnd onCompositionStart onCompositionUpdate onKeyDown onKeyPress onKeyUp'+
    ' onFocus onBlur onChange onInput onInvalid onReset onSubmit onError onLoad onClick onContextMenu onDoubleClick onDrag onDragEnd onDragEnter onDragExit'+
    ' onDragLeave onDragOver onDragStart onDrop onMouseDown onMouseEnter onMouseLeave onMouseMove onMouseOut onMouseOver onMouseUp'+
    ' onPointerDown onPointerMove onPointerUp onPointerCancel onGotPointerCapture onLostPointerCapture onPointerEnter onPointerLeave'+
    ' onPointerOver onPointerOut onSelect onTouchCancel onTouchEnd onTouchMove onTouchStart onScroll onWheel'+
    ' onAbort onCanPlay onCanPlayThrough onDurationChange onEmptied onEncrypted onEnded onError onLoadedData' +
    ' onLoadedMetadata onLoadStart onPause onPlay onPlaying onProgress onRateChange onSeeked onSeeking onStalled onSuspend'+
    ' onTimeUpdate onVolumeChange onWaiting onLoad onError onAnimationStart onAnimationEnd onAnimationIteration onTransitionEnd'+
    ' onToggle').split(/  */);

const EVENT_TRANSLATIONS:Record<string, string>={};
REACT_EVENTS.forEach((name)=>{
    EVENT_TRANSLATIONS[name.toLowerCase()]=name;
})
export type TUSerContext=Record<string, any>|undefined;
const transform=(context:TUSerContext,node:any,index:number):any=>{
    if (node && node.attribs){
        for (const k in node.attribs){
            if (k.match(/^on../)){
                const evstring=node.attribs[k];
                if (!context.eventHandler || ! context.eventHandler[evstring]) {
                    base.log("external widget, no event handler for "+evstring);
                    continue;
                }
                const translated=EVENT_TRANSLATIONS[k];
                let nk;
                if (translated){
                    nk=translated;
                }
                else {
                    nk = "on" + k.substring(2, 1).toUpperCase() + k.substring(3);
                }
                node.attribs[nk]=(ev: Event)=>{
                    ev.stopPropagation();
                    ev.preventDefault();
                    context.eventHandler[evstring].call(context,ev);
                };
                delete node.attribs[k];
            }
        }
    }
    return convertNodeToElement(node,index,(node: any, index: number)=>{transform(context,node,index)});
};
export type TUserHtml=string|React.ReactNode;
export const UserHtml=({userHtml,context}:{userHtml:TUserHtml,context:TUSerContext}):React.ReactNode=>{
    if (! userHtml) return null;
    let innerHtml;
    if (typeof(userHtml)!=='string'){
        innerHtml=userHtml
        if (! React.isValidElement(userHtml)){
            innerHtml="invalid user html";
        }    
    }
    else{
        innerHtml=ReactHtmlParser(userHtml,
            {
                transform: (node:any, index:any) => {
                    transform(context, node, index);
                }
            });
    }
    return <ErrorBoundary>
        {innerHtml}
    </ErrorBoundary>
}