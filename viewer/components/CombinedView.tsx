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
import React, {useEffect} from "react";
import Helper from "../util/helper";
import {ScrollType} from "../util/UiHelper";

export interface CombinedViewProps {
    leftView: React.ReactNode;
    rightView: React.ReactNode;
    single?:boolean
    scrollType?:ScrollType
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
    useEffect(() => {
        if (! outerRef.current) {
            setItemWidth(0);
            return;
        }
        const rect=outerRef.current.getBoundingClientRect();
        if (props.single) setItemWidth(rect.width);
        else setItemWidth(rect.width/2);
    });
    return <div className="combinedView outer" ref={outerRef}>
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

