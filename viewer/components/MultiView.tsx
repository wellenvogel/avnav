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
import React, {useCallback, useEffect} from "react";
import Helper from "../util/helper";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import {ListSlot} from "./ListItems";


export interface MultiViewProps {
    views: React.ReactNode[];
    maxNumber?: number;
    visibleNumber?:number; //-1 for none
    visibleNumberSequence?:number;
    viewChanged?:(first:number,last:number) => void
}
interface ViewProps{
    className?:string;
    children:React.ReactNode;
    width?:number
    scrollInto?:number;
}
const View=(props:ViewProps) => {
    const className=Helper.concatsp(props.className,'view');
    const viewRef=React.useRef<HTMLDivElement>(null);
    const hasWidth=props.width!=0;
    useEffect(() => {
        if (! props.scrollInto || ! viewRef.current) return;
        viewRef.current.scrollIntoView({
            behavior: "smooth",
            inline: "start"
        });
    }, [props.scrollInto,hasWidth]);
    return <div className={className} ref={viewRef} style={{width:(props.width||0)+"px"}}>
        {props.width?props.children:null}
    </div>;

}
export type ScrollHelper=[
    {
        visibleNumber:number;
        visibleNumberSequence:number;
        viewChanged:(first:number,last:number) => void;
    },
    (nr:number)=>void,
    (nr:number)=>boolean
]
/**
 * helper for scrolling the MultiView
 * const [scrollProps,scrollTo,isVisible]=useScrollHelper(0);
 * ...
 * const button={
 *     ...
 *     toggle: isVisible(1)
 *     onClick:()=>scrollTo(1)
 * }
 * ...
 * return <MultiView
 *    {...scrollProps}
 *    ...
 *    />
 * @param initialScroll
 */

export const useScrollHelper=(initialScroll:number=0):ScrollHelper=>{
    const [scrollItem,setScrollItem]=React.useState(initialScroll);
    const [sequence,setSequence]=React.useState(0);
    const [minVisible,setMinVisible]=React.useState(0);
    const [maxVisible,setMaxVisible]=React.useState(0);
    const updateVis=useCallback((min:number,max:number)=>{
       setMinVisible(min);
       setMaxVisible(max);
    },[]);
    const scrollTo=useCallback((nr:number)=>{
       setScrollItem(nr);
       setSequence((o)=>o+1);
    },[])
    const isVisible=useCallback((nr:number)=>{
        return nr >= minVisible && nr <= maxVisible;
    },[minVisible,maxVisible]);
    return [
        {
            visibleNumber:scrollItem,
            visibleNumberSequence:sequence,
            viewChanged:updateVis,
        },
        scrollTo,
        isVisible
    ]
}

export interface MvHeadlineProps{
    className?:string;
    title?:string;
    leftScroll?:()=>void;
    rightScroll?:()=>void;
}

export const MvHeadline=(props:MvHeadlineProps)=>{
    const className=Helper.concatsp("header",props.className);
    return <div className={className}>
        { (!! props.leftScroll) && <ListSlot
            className={'left'}
            icon={{className:'left'}}
            onClick={()=>props.leftScroll()}
        />}
        <ListSlot text={props.title} className={'main'}/>
        { (!! props.rightScroll) && <ListSlot
            className={'right'}
            icon={{className:'right'}}
            onClick={()=>props.rightScroll()}
        />}
    </div>
}

export const MultiView = (props: MultiViewProps) => {
    const windowDimensions=useStoreState(keys.gui.global.windowDimensions);
    const [itemWidth,setItemWidth]=React.useState(0);
    const [visibleNumber,setVisibleNumber]=React.useState(props.visibleNumber);
    const outerRef = React.useRef<HTMLDivElement>(null);
    const scrollTimerRef = React.useRef<number>(undefined);
    const lastReportedRef = React.useRef([-1,-1]);
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
    useEffect(() => {
        setVisibleNumber(props.visibleNumber);
    }, [props.visibleNumber]);
    const reportVisibility=useCallback(()=>{
        if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = window.setTimeout(()=>{
            if (! outerRef.current || itemWidth === 0) return;
            const { scrollLeft} = outerRef.current;
            const leftView=Math.floor(scrollLeft/itemWidth);
            let max=leftView+maxNumber-1;
            if (max >= numViews) max=numViews-1;
            if (leftView !== lastReportedRef.current[0] || max != lastReportedRef.current[1]) {
                lastReportedRef.current = [leftView,max];
                if (props.viewChanged){
                    props.viewChanged(leftView,max);
                }
            }
        },300);
    },[itemWidth,numViews,maxNumber]);
    useEffect(() => {
        reportVisibility();
    }, [itemWidth,numViews,maxNumber,reportVisibility]);
    const onScroll=useCallback(() => {
        reportVisibility();
    },[reportVisibility]);
    let idx=-1;
    return <div className={Helper.concatsp("multiView","outer",(maxNumber<2)? "single":"multi")}
                ref={outerRef}
                onScroll={onScroll}>
        {props.views.map((view)=> {
            return <View
                key={idx++}
                className="leftView"
                width={itemWidth}
                scrollInto={(idx === visibleNumber)?(props.visibleNumberSequence||1):0}
            >
                {view}
            </View>
        })
        }
    </div>

}

