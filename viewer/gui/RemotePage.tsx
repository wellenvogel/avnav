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
import React, {useRef} from "react";
import {PageFrame, PageLeft, PageProps} from "../components/Page";
import {useHistory} from "../components/HistoryProvider";
import {ButtonDef, updateButtons} from "../components/Button";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import RemotePageButtons from "./RemotePageButtons";
import {getPageTitle} from "../util/pageids";
import ButtonList from "../components/ButtonList";
import StatusView, {ChannelKinds} from "../components/StatusView";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import {ListItem, ListMainSlot, useDialogContext} from "../components/exports";
import {ChildStatus} from "../components/StatusItems";
import {showDialog} from "../components/OverlayDialog";
import {EditSettingsCategory} from "../components/Settings";
// @ts-ignore
import {showRemoteChannelDialog} from '../components/RemoteChannelDialog';

const RemoteStatus=()=>{
    const dialogContext = useDialogContext();
    const [status]=useStoreState(keys.gui.global.remoteChannelState);
    const [read]=useStoreState(keys.properties.remoteChannelRead);
    const [write]=useStoreState(keys.properties.remoteChannelWrite);
    const connected=status.connected && (status.read||status.write);
    const rw= (read && write)?"read/write":(read?"read":(write?"write":""));
    const info=`${connected?'Connected':'Disconnected'}, Channel ${status.channel||""}, ${rw}`
    return <ListItem
        className= "StatusView"
        onClick={()=>{
            showRemoteChannelDialog(dialogContext);
        }}
    >
        <ListMainSlot
            primary={<ChildStatus
                id={'dummy'}
                handlerId={-1}
                status={connected?'NMEA':'INACTIVE'}
                info={info}
                />}/>
    </ListItem>
}

export const RemotePage=(props:PageProps) => {
     const history=useHistory();
     const dialogContext=useDialogContext();
     const currentButtons=useRef<ButtonDef[]>()
     const buttonActions={
         Cancel:{
             onClick:()=>{history.pop()}
         },
         ShowSettings:{
             onClick:()=>{showDialog(dialogContext,()=><EditSettingsCategory category={'Remote'}/>)}
         }
     }
     currentButtons.current=InjectMainMenu(props.id,updateButtons(RemotePageButtons,buttonActions));
     useInitialButton(currentButtons);
     return <PageFrame id={props.id}>
         <PageLeft id={props.id} title={getPageTitle(props.id)}>
             <RemoteStatus />
             <div className={'header'}>Server</div>
             <StatusView kinds={[ChannelKinds.REMOTE]}/>
         </PageLeft>
         <ButtonList page={props.id} itemList={currentButtons.current}/>
     </PageFrame>
 }
