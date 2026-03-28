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
import React, {UIEvent, useCallback, useEffect} from "react";
import Helper from "../util/helper";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";

export interface MultiViewProps {
    views: React.ReactNode[];
    maxNumber?: number;
    visibleNumber?:number; //-1 for none
    viewChanged?:(first:number,last:number) => void
}
interface ViewProps{
    className?:string;
    children:React.ReactNode;
    width?:number
    scrollInto?:boolean;
}
const View=(props:ViewProps) => {
    const className=Helper.concatsp(props.className,'view');
    const viewRef=React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (! props.scrollInto || ! viewRef.current) return;
        viewRef.current.scrollIntoView({
            behavior: "smooth",
            inline: "start"
        });
    }, [props.scrollInto]);
    return <div className={className} ref={viewRef} style={{width:(props.width||0)+"px"}}>
        {props.width?props.children:null}
    </div>;

}

export const MultiView = (props: MultiViewProps) => {
    const windowDimensions=useStoreState(keys.gui.global.windowDimensions);
    const [itemWidth,setItemWidth]=React.useState(0);
    const outerRef = React.useRef<HTMLDivElement>(null);
    const scrollTimerRef = React.useRef<number>(undefined);
    const lastReportedLeftRef = React.useRef<number>(undefined);
    const numViews=props.views?props.views.length:0;
    const maxNumber=(props.maxNumber>0)?props.maxNumber:1;
    useEffect(() => {
        if (! outerRef.current) {
            setItemWidth(0);
            return;
        }
        const rect=outerRef.current.getBoundingClientRect();
        setItemWidth(rect.width/maxNumber);
    },[props.maxNumber,windowDimensions]);
    useEffect(() => {
        return ()=>{
            if (scrollTimerRef.current !== undefined) clearTimeout(scrollTimerRef.current);
        }
    }, []);
    const onScroll=useCallback((ev:UIEvent<HTMLDivElement>) => {
        if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = window.setTimeout(()=>{
            const { scrollLeft} = ev.target as HTMLElement;
            const leftView=Math.floor(scrollLeft/itemWidth);
            if (leftView !== lastReportedLeftRef.current) {
                lastReportedLeftRef.current = leftView;
                if (props.viewChanged){
                    let max=leftView+maxNumber-1;
                    if (max >= numViews) max=numViews-1;
                    props.viewChanged(leftView,max);
                }
            }
        },500)
    },[itemWidth,numViews])
    let idx=-1;
    return <div className={Helper.concatsp("multiView","outer",(maxNumber<2)? "single":"multi")} ref={outerRef} onScroll={onScroll}>
        {props.views.map((view)=> {
            return <View
                key={idx++}
                className="leftView"
                width={itemWidth}
                scrollInto={idx === props.visibleNumber}
            >
                {view}
            </View>
        })
        }
    </div>

}

