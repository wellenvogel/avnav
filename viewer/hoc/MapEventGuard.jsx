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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * prevents onClick to pass through for a guard time after the last map "onclick"
 * openLayers triggers it's click event on pointerUp - but normally the browser
 * will fire a "click" shortly afterwards
 * so with this monitor we can stop click events from passing for a certain time
 */


import globalStore from "../util/globalstore.jsx";
import React, {useEffect, useState} from 'react';
import keys from '../util/keys.jsx';
import MapHolder from '../map/mapholder';
import Helper from "../util/helper";

let lastMapClickTime=undefined;
MapHolder.registerEventGuard((eventName)=>{
    if (eventName === 'click'){
        lastMapClickTime=(new Date()).getTime();
    }
});
/**
 * HOC to wrap other components when called from within a map environment to avoid
 * immediate clicks that are created after the map "click" event
 * It checks for the time of the last map click event event and if within 300ms after it (keys.properties.mapClickWorkaroundTime)
 * it will add a "noEvents" class to the component.
 * Additionally a timer will be started to remove this class when the workaroundTime has passed.
 * If the properties contian an onClick handler this will be replaced by a handler that first checks if the
 * workaroundTime has passed before it triggers.
 * @param Component
 * @returns {React.ForwardRefExoticComponent<React.PropsWithoutRef<{}> & React.RefAttributes<unknown>>}
 */
export default  (Component)=>{
    return React.forwardRef((props,ref)=>{
        let {onClick,className,...forwards}=props;
        const allowTime=allowClickTime();
        const [allow,setAllow]=useState(allowTime === undefined);
        useEffect(() => {
            if (allowTime === undefined) return;
            const timer=window.setTimeout(()=>{
                setAllow(true);
            },allowTime);
            return ()=>window.clearTimeout(timer)
        }, []);
        let clickHandler=onClick?function() {
            if (isMapDeadTime()) return;
            if (props.onClick) {
                props.onClick.apply(this, [...arguments]);
            }
        }:undefined;
        let cl=Helper.concatsp(className,allow?undefined:'noEvents');
        return <Component
                ref={ref}
                className={cl}
                onClick={clickHandler}
            {...forwards}
            />
    })
};

const allowClickTime=()=>{
    let timeDiff = globalStore.getData(keys.properties.mapClickWorkaroundTime, 300);
    let now=Helper.now();
    if (lastMapClickTime !== undefined){
        let diff=lastMapClickTime+timeDiff-now;
        if (diff <= 0) return;
        return diff;
    }
}

export const isMapDeadTime=()=>{
    let timeDiff = globalStore.getData(keys.properties.mapClickWorkaroundTime, 300);
    if (lastMapClickTime !== undefined) {
        let now = (new Date()).getTime();
        if ((now - timeDiff) <= lastMapClickTime) return true;
    }
    return false;
}
