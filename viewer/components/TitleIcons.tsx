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
// @ts-ignore
import {anchorWatchDialog, AnchorWatchKeys} from "./AnchorWatchDialog";
import keys from '../util/keys';
import {useStore} from "../hoc/Dynamic";
import globalstore from "../util/globalstore";
import {showDialog, showPromiseDialog} from "./OverlayDialog";
import globalStore from "../util/globalstore";
import {ConfirmDialog} from "./BasicDialogs";
import {reloadPage} from "../util/helper";
// @ts-ignore
import LeaveHandler from "../util/leavehandler"
import {useDialogContext} from "./DialogContext";
import {SaveSettingsDialog} from "./Settings";
import propertyhandler from "../util/propertyhandler";
import {Icon} from "./Icons";
import ButtonDefs from "./ButtonDefs";

export const DynamicTitleIcons=({rightOffset}:{rightOffset?:number})=>{
    const dialogContext=useDialogContext();
    const sprops=useStore({rightOffset},{storeKeys:
            {...AnchorWatchKeys,
                show:keys.properties.titleIcons,
                measure: keys.map.activeMeasure,
                mjsUpdates:keys.gui.global.updatedJsModules,
                unloadedJs:keys.gui.global.unloadedJsChanges,
                settingsChanged:keys.gui.global.settingsChanged
            }})
    if (! sprops.show) return null;
    let cl="iconContainer ";
    if (sprops.className) cl+=sprops.className;
    const anchorWatch=sprops.watchDistance !== undefined;
    const jsChange=sprops.mjsUpdates|| sprops.unloadedJs;
    const settingsChanged=sprops.settingsChanged && globalstore.getData(keys.gui.capabilities.uploadSettings);
    const style:Record<string, any> = {};
    if (rightOffset){
        style.marginRight=rightOffset+"px";
    }
    return <div className={cl} style={style} onClick={(ev)=>ev.stopPropagation()}>
        {sprops.measure && <span className="measureIcon" onClick={()=>{
            globalStore.storeData(keys.map.activeMeasure,undefined);
        }}/> }
        {anchorWatch && <Icon className="anchorWatchIcon" onClick={() => anchorWatchDialog(dialogContext)}/>}
        {jsChange && <Icon className="jsChangeIcon" onClick={()=>{
            let rltext=sprops.unloadedJs?
                "There are changes in plugin java script or user.mjs that are still not loaded.\n"
                :
                "Plugin or user.mjs changes have been loaded. To avoid memory leaks you should reload AvNav soon.\n";
            rltext+="Reload AvNav now?";
            showPromiseDialog(dialogContext,(dp)=><ConfirmDialog
                {...dp}
                title={"Reload?"}
                text={rltext}
                />)
                .then(()=>{
                    LeaveHandler.stop();
                    reloadPage();
                },
                    ()=>{})
        }}/>}
        {!sprops.connected && <Icon className="disconnectedIcon" onClick={()=>{
            if (globalstore.getData(keys.gui.global.onAndroid) ||  !globalStore.getData(keys.gui.capabilities.canConnect)) return;
            showPromiseDialog(dialogContext,(props)=><ConfirmDialog {...props} text={"End disconnected mode?"}/>)
                .then(()=>globalStore.storeData(keys.gui.global.connectedMode,true))
                .catch(()=>{});
        }}/>}
        {settingsChanged && <Icon className="settingsChangedIcon" onClick={()=>{
            showDialog(dialogContext,()=><SaveSettingsDialog
                title={"Settings are changed, select name to save to server"}
                additionalButtons={[
                    {
                        ...ButtonDefs.DBIgnore,
                        onClick: () => {
                            propertyhandler.setChangedFlag(false);
                        }
                    }
                ]}
            />)
        }}/>}
    </div>
}