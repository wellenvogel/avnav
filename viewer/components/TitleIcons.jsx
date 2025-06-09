/**
 *###############################################################################
 # Copyright (c) 2012-2024 Andreas Vogel andreas@wellenvogel.net
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
 */

import React from 'react';
import {anchorWatchDialog, AnchorWatchKeys} from "./AnchorWatchDialog";
import keys from '../util/keys';
import {useStore} from "../hoc/Dynamic";
import globalstore from "../util/globalstore";
import {showPromiseDialog, useDialogContext} from "./OverlayDialog";
import globalStore from "../util/globalstore";
import {ConfirmDialog} from "./BasicDialogs";
import PropTypes from "prop-types";

export const DynamicTitleIcons=({rightOffset})=>{
    const dialogContext=useDialogContext();
    const props=useStore({rightOffset},{storeKeys: {...AnchorWatchKeys,show:keys.properties.titleIcons,measure: keys.map.activeMeasure }})
    if (! props.show) return null;
    let cl="iconContainer ";
    if (props.className) cl+=props.className;
    let anchorWatch=props.watchDistance !== undefined;
    const style={};
    if (rightOffset){
        style.paddingRight=rightOffset+"px";
    }
    return <div className={cl} style={style} onClick={(ev)=>ev.stopPropagation()}>
        {props.measure && <span className="measureIcon" onClick={()=>{
            globalStore.storeData(keys.map.activeMeasure,undefined);
        }}/> }
        {anchorWatch && <span className="anchorWatchIcon" onClick={() => anchorWatchDialog(dialogContext)}/>}
        {!props.connected && <span className="disconnectedIcon" onClick={()=>{
            if (globalstore.getData(keys.gui.global.onAndroid) ||  !globalStore.getData(keys.gui.capabilities.canConnect)) return;
            showPromiseDialog(dialogContext,(props)=><ConfirmDialog {...props} text={"End disconnected mode?"}/>)
                .then(()=>globalStore.storeData(keys.properties.connectedMode,true))
                .catch(()=>{});
        }}/>}
    </div>
}
DynamicTitleIcons.propTypes={
    rightOffset: PropTypes.number
}