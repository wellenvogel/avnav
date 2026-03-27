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
import {ScrollType} from "../util/UiHelper";

export interface CombinedViewProps {
    leftView: React.ReactNode;
    rightView: React.ReactNode;
    single?:boolean
    scrollType?:ScrollType,
    viewChanged?:(leftVisible: boolean) => void
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

export const CombinedView = (props: CombinedViewProps) => {
    const [itemWidth,setItemWidth]=React.useState(0);
    const outerRef = React.useRef<HTMLDivElement>(null);
    const scrollTimerRef = React.useRef<number>(undefined);
    const lastReportedVisibleRef = React.useRef<boolean>(undefined);
    useEffect(() => {
        if (! outerRef.current) {
            setItemWidth(0);
            return;
        }
        const rect=outerRef.current.getBoundingClientRect();
        if (props.single) setItemWidth(rect.width);
        else setItemWidth(rect.width/2);
    });
    useEffect(() => {
        return ()=>{
            if (scrollTimerRef.current !== undefined) clearTimeout(scrollTimerRef.current);
        }
    }, []);
    const onScroll=useCallback((ev:UIEvent<HTMLDivElement>) => {
        if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = window.setTimeout(()=>{
            const { scrollLeft} = ev.target as HTMLElement;
            const leftActive=scrollLeft < itemWidth;
            if (leftActive !== lastReportedVisibleRef.current) {
                lastReportedVisibleRef.current = leftActive;
                if (props.viewChanged){
                    props.viewChanged(leftActive);
                }
            }
        },500)
    },[itemWidth])
    return <div className={Helper.concatsp("combinedView","outer",props.single?"single":"multi")} ref={outerRef} onScroll={onScroll}>
            <View
                className="leftView"
                width={itemWidth}
                scrollInto={props.single && props.scrollType === ScrollType.left}
            >
                {props.leftView}
            </View>
            <View
                className="rightView"
                width={itemWidth}
                scrollInto={props.single && props.scrollType === ScrollType.right}
            >
                {props.rightView}
            </View>
    </div>

}

