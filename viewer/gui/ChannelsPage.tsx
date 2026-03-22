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
import React, {useRef, useState} from "react";
import {PAGE_TITLES, PAGEIDS} from "../util/pageids";
import {PageFrame, PageLeft} from "../components/Page";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import StatusView, {ChannelKinds} from "../components/StatusView";
import {createAddDialog} from "../components/EditHandlerDialog";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import ChannelsPageButtons from "./ChannelsPageButtons";
import {ButtonDef, updateButtons} from "../components/Button";

const ChannelsPage=()=>{
     useStoreState(keys.gui.global.reloadSequence);
     const history=useHistory();
     const [foucsId,setFoucsId]=useState<string|number>();
     const buttonListRef=useRef<ButtonDef[]>();
     const buttonActions={
         StatusAdd:{
             onClick:()=>createAddDialog(
                 (id:string|number)=>{setFoucsId(id)}
             )
         },
         Cancel:{
             onClick:()=>history.pop()
         }

     }
     buttonListRef.current=updateButtons(ChannelsPageButtons,buttonActions);
     useInitialButton(buttonListRef);
     return <PageFrame id={PAGEIDS.CHANNELS}>
        <PageLeft title={PAGE_TITLES.CHANNELS}>
            <StatusView
                focusItem={foucsId}
                kinds={[ChannelKinds.CHANNEL]}
            ></StatusView>
        </PageLeft>
         <ButtonList
             page={PAGEIDS.CHANNELS}
             itemList={InjectMainMenu(PAGEIDS.CHANNELS,
                 buttonListRef.current,
                 )}
         ></ButtonList>
     </PageFrame>
 }

export default ChannelsPage;