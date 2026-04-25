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
import React, {SyntheticEvent} from 'react';
import Helper, {concatsp} from "../util/helper";
export interface IconProps{
    className?: string;
    icon?:string|URL;
    color?:string;
    onClick?: (ev:SyntheticEvent) => void,
    forceClass?:boolean,
}
const removeIconFromClassName=(cl:string)=>{
    if (!cl) return cl;
    if ( typeof cl !== 'string' ) return cl;
    return cl.replace(/\bicon\b/, '').replace(/^ *$/,'');
}
export const IconBody=({className,icon,color,forceClass}:IconProps) => {
    className = removeIconFromClassName(className);
    if (! icon && (! className && ! forceClass) && ! color)return null;
    const style:Record<string, string> = {};
    if (color){style.backgroundColor=color}
    if (icon){style.backgroundImage=`url(${icon})`}
    return <React.Fragment>
        <span className={Helper.concatsp("icon",className)}></span>
        {(color || icon) && <span className={Helper.concatsp('iconFix')} style={style}></span>}
    </React.Fragment>
}
export const Icon=({className,icon,color,onClick,forceClass}:IconProps)=>{
    className = removeIconFromClassName(className);
    if (! icon && ! className && ! color)return null;
    return <div onClick={onClick}
        className={concatsp("iconFrame")}
        >
        <IconBody icon={icon} className={className} color={color} forceClass={forceClass}/>
    </div>
}
 