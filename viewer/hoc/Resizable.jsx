/*
# Copyright (c) 2025, Andreas Vogel andreas@wellenvogel.net

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
*/

import {createContext, useContext, useEffect, useRef} from "react";
import React from "react";
import GuiHelpers from "../util/GuiHelpers";
import PropTypes from "prop-types";

const ResizeableImpl = createContext({
    triggerResize: ()=>{}
})
export const useResize=()=>{
    const context=useContext(ResizeableImpl);
    return {trigger:context.triggerResize};
}
export const ResizeFrame=(props)=>{
    const frame=useRef();
    const resizeFunction=()=>{
        GuiHelpers.resizeElementFont(frame.current);
    }
    useEffect(() => {
        resizeFunction()
    }, [props.resizeSequence]);
    return <div className={'resize'} ref={frame}>
        <ResizeableImpl.Provider value={{
            triggerResize: resizeFunction
        }}>
            {props.children}
        </ResizeableImpl.Provider>
    </div>
}
ResizeFrame.propTypes={
    resizeSequence: PropTypes.number
}

export const usePrevious=(item)=>{
    const ref=useRef();
    useEffect(() => {
        ref.current=item;
    });
    return ref.current;
}
const isChanged=(previous,items)=>{
    try {
        if (previous === undefined && items !== undefined) return true;
        if (items === undefined && previous !== undefined) return true;
        if (items === undefined) return false;
        if (Object.keys(previous).length !== Object.keys(items).length) return true;
        for (let k in items){
            if ((items[k]+"").length !== (previous[k]+"").length) return true;
        }
    }catch(e){ //ignore error
    }
    return false;
}
/**
 * return a number that can be used as resizeSequence
 * @param items
 * @param canResize {boolean|Object} - you can simply provide the widget props here
 * @returns {boolean}
 */
export const useStringsChanged=(items,canResize)=>{
    const previous=usePrevious(items);
    const sequence=useRef(0);
    if (typeof(canResize) === 'object'){
        //we just provided the props here
        canResize=canResize.mode === 'gps';
    }
    if (canResize === false) return sequence.current;
    let changed=isChanged(previous,items);
    if (changed){
        sequence.current++;
    }
    return sequence.current;
}

