/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 Widget Base data
 */

import React, {SyntheticEvent} from "react";
import {useKeyEventHandler} from "../util/UiHelper";
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
// @ts-ignore
import {ResizeFrame} from "../hoc/Resizable";
import Helper from "../util/helper";
import PropTypes from "prop-types";

export interface IWidgetProps extends SortableProps {
    onClick?: (ev: SyntheticEvent) => void,
    style?: Record<string, any>,
    className?: string,
    name: string,
    mode?: string, //display info side by side if small
    caption?: string,
    nightMode?: boolean,
}
export interface WidgetHeadProps{
    unit?: string,
    caption?: string,
    infoMiddle?: React.ReactNode,
    disconnect?: boolean,
}
export const WidgetHead=(props:WidgetHeadProps)=> {
    if (! Helper.isset(props.unit,true) &&
        ! Helper.isset(props.caption,true)
        && ! Helper.isset(props.infoMiddle,true))return null;
    const infoMiddle = (Helper.isset(props.infoMiddle,true)) ? props.infoMiddle : props.disconnect ?
        <div className={'disconnectedIcon'}/>
        :undefined;
    return (
        <div className="widgetHead">
            {Helper.isset(props.caption, true) && <div className='infoLeft'>{props.caption}</div>}
            {infoMiddle !== undefined && <div className={'infoMiddle'}>{infoMiddle}</div>}
            {Helper.isset(props.unit,true) ?
                <div className='infoRight'>{props.unit}</div>
                : <div className='infoRight'></div>
            }
        </div>
    )
}

export interface WidgetFrameProps extends IWidgetProps,WidgetHeadProps{
    resize?: boolean,
    resizeSequence?: number,
    addClass?: string
    isAverage?:boolean,
    children?:React.ReactNode,
}


export const WidgetFrame=(props:WidgetFrameProps)=> {
    useKeyEventHandler(props, "widget");
    const sortableProps = useAvNavSortable(props.dragId)
    const classes = Helper.concatsp(
        "widget ",
        (props.isAverage)?"average":undefined,
        props.className,
        props.addClass,
        (props.mode === 'horizontal')?"horizontal":undefined);
    const resize=!(props.resize === false) && props.mode === 'gps';
    return <div className={classes} onClick={props.onClick} {...sortableProps} style={props.style}>
        <WidgetHead {...props}/>
        {resize &&
            <ResizeFrame resizeSequence={props.resizeSequence}>
                {props.children}
            </ResizeFrame>
        }
        {!resize &&
            <div className="noresize">
                {props.children}
            </div>
        }
    </div>
}
export type InternalWidgetDefinition = Record<string,any>
export const WidgetProps:Record<keyof IWidgetProps,any>= {
    dragId: PropTypes.any,
    name: PropTypes.any,
    onClick: PropTypes.any,
    style: PropTypes.any,
    className: PropTypes.any,
    mode: PropTypes.any,
    caption: PropTypes.any,
    nightMode: PropTypes.any
}



