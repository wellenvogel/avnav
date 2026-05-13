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
import React, {createContext, useCallback, useContext, useEffect, useRef} from "react";
import Helper from "../util/helper";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import {ListSlot} from "./ListItems";
import {iconClasses} from './Icons';
import {useKeyEventHandlerPlain} from "../util/UiHelper";
import {KeyComponents} from "../util/keyhandler";


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
        scrollTo:(nr:number)=>void;
        isVisible:(nr:number)=>boolean;
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
 * @param viewChanged if set call this when the view is changing
 */

export const useScrollHelper=(
    initialScroll:number=0,
    viewChanged?:(first:number,last:number) => void
):ScrollHelper=>{
    const [scrollItem,setScrollItem]=React.useState(initialScroll);
    const [sequence,setSequence]=React.useState(0);
    const [minVisible,setMinVisible]=React.useState(0);
    const [maxVisible,setMaxVisible]=React.useState(0);
    const viewChangedRef=useRef(null);
    viewChangedRef.current=viewChanged;
    const updateVis=useCallback((min:number,max:number)=>{
       setMinVisible(min);
       setMaxVisible(max);
       if (viewChangedRef.current){viewChangedRef.current(min,max);}
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
            scrollTo:scrollTo,
            isVisible:isVisible
        },
        scrollTo,
        isVisible
    ]
}
interface MvContextProps{
    minVisible:number;
    maxVisible:number;
    numViews:number;
    currentView:number;
    scrollTo:(nr:number)=>void;
}
const defaultMvConext:MvContextProps={
    currentView: 0,
    maxVisible: 0,
    minVisible: 0,
    numViews: 0,
    scrollTo:()=>{}
}

const MvContext=createContext<MvContextProps>(defaultMvConext);

export const useMvContext=()=>{
    const mvContext=useContext(MvContext);
    return {
        visible: mvContext.currentView >= mvContext.minVisible && mvContext.currentView <= mvContext.maxVisible,
        currentView: mvContext.currentView,
        showLeftScroll:mvContext.currentView === mvContext.minVisible && mvContext.minVisible > 0,
        showRightScroll: mvContext.currentView === mvContext.maxVisible && mvContext.maxVisible < (mvContext.numViews-1),
        scrollTo:(nr:number)=>mvContext.scrollTo(nr),
    }
}

export interface MvHeadlineProps{
    className?:string;
    title?:string;
    showScroll?:boolean  //default: true
}

export const MvHeadline=(props:MvHeadlineProps)=>{
    const className=Helper.concatsp("header",props.className);
    const mvContext=useMvContext();
    const showScroll = Helper.unsetorTrue(props.showScroll);
    return <div className={className}>
        <ListSlot
            className={'left'}
            icon={{className:(showScroll && mvContext.showLeftScroll)?iconClasses.Left:iconClasses.Empty}}
            onClick={()=>showScroll && mvContext.showLeftScroll && mvContext.scrollTo(mvContext.currentView-1)}
        />
        <ListSlot text={props.title} className={'main'}/>
        <ListSlot
            className={'right'}
            icon={{className:showScroll && mvContext.showRightScroll?iconClasses.Right:iconClasses.Empty}}
            onClick={()=>showScroll && mvContext.showRightScroll && mvContext.scrollTo(mvContext.currentView+1)}
        />
    </div>
}

export const MultiView = (props: MultiViewProps) => {
    const windowDimensions=useStoreState(keys.gui.global.windowDimensions);
    const [itemWidth,setItemWidth]=React.useState(0);
    const [visibleNumber,setVisibleNumber]=React.useState(props.visibleNumber);
    const [,setChanged]=React.useState(0);
    const [minVisible,setMinVisible]=React.useState(-1);
    const [maxVisible,setMaxVisible]=React.useState(-1);
    const outerRef = React.useRef<HTMLDivElement>(null);
    const scrollTimerRef = React.useRef<number>(undefined);
    const lastReportedRef = React.useRef([-1,-1]);
    let numViews=0;
    if(props.views && props.views.length){
        for (const v of props.views){
            if (v) numViews += 1;
        }
    }
    let maxNumber=(props.maxNumber>0)?props.maxNumber:1;
    if (maxNumber>numViews) { maxNumber=numViews;}
    const scrollTo=useCallback((nr:number)=>{
        if (nr >= 0 && nr < numViews) {
            setVisibleNumber(nr);
            setChanged((old)=>old+1)
        }
    },[numViews])
    const keyActions:Record<string,(action?:string)=>void>={
        left: ()=>{
            if (minVisible > 0) scrollTo(minVisible-1)
        },
        right:()=>{
            if (maxVisible < (numViews-1)) scrollTo(maxVisible+1)
        },
        first:()=>scrollTo(0),
        last:()=>scrollTo(numViews-1),
    }
    const keyHandler=(action:string)=>{
        const actionFunction=keyActions[action];
        if (! actionFunction) return;
        actionFunction(action);
    }
    useKeyEventHandlerPlain(Object.keys(keyActions),KeyComponents.MULTIVIEW,(_comp:string,action:string)=>{keyHandler(action)});
    useEffect(() => {
        if (! outerRef.current) {
            setItemWidth(0);
            return;
        }
        const rect=outerRef.current.getBoundingClientRect();
        setItemWidth(Math.round(rect.width/maxNumber));
    },[maxNumber,windowDimensions]);
    useEffect(() => {
        return ()=>{
            if (scrollTimerRef.current !== undefined) clearTimeout(scrollTimerRef.current);
        }
    }, []);
    useEffect(() => {
        setVisibleNumber(props.visibleNumber);
        setChanged((old)=>old+1);
    }, [props.visibleNumber]);
    const reportVisibility=useCallback(()=>{
        if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = window.setTimeout(()=>{
            if (! outerRef.current || itemWidth === 0) return;
            const { scrollLeft} = outerRef.current;
            const leftView=Math.round(scrollLeft/itemWidth);
            let max=leftView+maxNumber-1;
            if (max >= numViews) max=numViews-1;
            if (leftView !== lastReportedRef.current[0] || max != lastReportedRef.current[1]) {
                lastReportedRef.current = [leftView,max];
                setMinVisible(leftView);
                setMaxVisible(max);
                if (props.viewChanged){
                    props.viewChanged(leftView,max);
                }
            }
        },300);
    },[itemWidth,numViews,maxNumber]);
    useEffect(() => {
        reportVisibility();
        return ()=>{
            if (props.viewChanged){
                props.viewChanged(-1,-1);
            }
        }
    }, [itemWidth,numViews,maxNumber,reportVisibility]);
    const onScroll=useCallback(() => {
        reportVisibility();
    },[reportVisibility]);
    let idx=-1;
    return <div className={Helper.concatsp("multiView","outer",(maxNumber<2)? "single":"multi")}
                ref={outerRef}
                onScroll={onScroll}>
        {props.views.map((view)=> {
            if (!view) return null;
            return <View
                key={idx++}
                className="leftView"
                width={itemWidth}
                scrollInto={(idx === visibleNumber)?(props.visibleNumberSequence||1):0}
            >
                <MvContext.Provider value={{
                    numViews:numViews,
                    minVisible:minVisible,
                    maxVisible:maxVisible,
                    currentView:idx,
                    scrollTo:scrollTo
                }}>
                {view}
                </MvContext.Provider>
            </View>
        })
        }
    </div>

}

