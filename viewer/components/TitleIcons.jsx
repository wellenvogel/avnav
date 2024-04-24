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
import PropTypes from 'prop-types';
import {anchorWatchDialog, AnchorWatchKeys} from "./AnchorWatchDialog";
import keys from '../util/keys';
import Dynamic from "../hoc/Dynamic";
import globalstore from "../util/globalstore";
import OverlayDialog from "./OverlayDialog";
import globalStore from "../util/globalstore";

const TitleIcons=(props)=>{
    if (! props.show) return null;
    let cl="iconContainer ";
    if (props.className) cl+=props.className;
    let anchorWatch=props.watchDistance !== undefined;
    return <div className={cl}>
        {anchorWatch && <span className="anchorWatchIcon" onClick={() => anchorWatchDialog()}/>}
        {!props.connected && <span className="disconnectedIcon" onClick={()=>{
            if (globalstore.getData(keys.gui.global.onAndroid) ||  !globalStore.getData(keys.gui.capabilities.canConnect)) return;
            OverlayDialog.confirm("End disconnected mode?")
                .then(()=>globalStore.storeData(keys.properties.connectedMode,true))
                .catch(()=>{});
        }}/>}
    </div>
}
export default TitleIcons;
TitleIcons.propTypes={
    watchDistance: PropTypes.number,
    connected: PropTypes.bool,
    show: PropTypes.bool
}
TitleIcons.storeKeys=Object.assign({},AnchorWatchKeys,{show:keys.properties.titleIcons});

export const DynamicTitleIcons=Dynamic(TitleIcons,{storeKeys:TitleIcons.storeKeys});