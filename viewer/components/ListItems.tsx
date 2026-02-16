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

import React from 'react';
// @ts-ignore
import {concatsp} from "../util/helper";
import {Icon, IconProps} from "./Icons";
// @ts-ignore
import {useAvNavSortable} from "../hoc/Sortable";

export interface ListItemProps {
    selected?: boolean;
    className?: string;
    children?: React.ReactNode;
    onClick?: (ev:any) => void;
    dragId?: string|number;
    noDrag?: boolean;
}
export const ListItem = ({selected,className,children,onClick,dragId,noDrag }: ListItemProps) => {
    const dd=useAvNavSortable(dragId,!!noDrag);
    return <div
        {...dd}
        className={concatsp(className,"listEntry",selected?"activeEntry":undefined)}
        onClick={onClick}
    >
        {children}
    </div>
}
export interface ListSlotProps{
    className?: string;
    icon?: IconProps;
    text?: string|React.ReactNode;
    children?: React.ReactNode;
    onClick?: (ev:any) => void;
}
export const ListSlot=({className,icon,text,children,onClick}: ListSlotProps) => {
    if (! icon && (text == null) && !children) return null;
    return <div
        className={concatsp("listSlot",className)}
        onClick={onClick}
        >
        {icon && <Icon {...icon}/>}
        {(text !== undefined) && <span className="text">{text}</span>}
        {children}
    </div>
}
export interface ListMainSlotProps{
    className?: string;
    primary?: string|React.ReactNode;
    secondary?: string|React.ReactNode;
    children?: React.ReactNode;
    onClick?: (ev:any) => void;
}
export const ListMainSlot=({className,primary,secondary,children,onClick}:ListMainSlotProps) => {
    return <div
        className={concatsp("listMain listSlot",className)}
        onClick={onClick}
        >
        {primary && <div className={"primary"}>{primary}</div>}
        {secondary && <div className={"secondary"}>{secondary}</div>}
        {children}
    </div>
}
export interface ListFrameProps{
    className?: string;
    scrollable?: boolean;
    children?: React.ReactNode;
    onClick?: (ev:any) => void;
}
export const ListFrame=({className,scrollable,onClick,children}:ListFrameProps) => {
    if (scrollable) {
        return <div
            className={concatsp("scrollable","listFrame",className)}
            onClick={onClick}
            >
            <div className={"scrollableInner"}>
                {children}
            </div>
        </div>;
    }
    return <div
            className={concatsp("listFrame",className)}
            onClick={onClick}
            >
            {children}
    </div>;
}
 