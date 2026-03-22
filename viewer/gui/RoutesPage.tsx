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
import {PageBaseProps, PageFrame, PageLeft} from "../components/Page";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import StatusView, {ChannelKinds} from "../components/StatusView";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {ButtonDef, updateButtons} from "../components/Button";
import RoutesPageButtons from "./RoutesPageButtons";
import {CombinedView} from "../components/CombinedView";
import {DownloadItemList} from '../components/DownloadItemList';

const PAGE=PAGEIDS.NROUTE;
const TITLE=PAGE_TITLES.NROUTE;
export type RoutesPageProps = Partial<PageBaseProps>;
const RoutesPage=(props:RoutesPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const mustSplit=! props.windowDimensions ||
         props.windowDimensions.width < 800; //TODO
     const history=useHistory();
     const [leftVisible, setLeftVisible] = useState<boolean>(true);
     const buttonListRef=useRef<ButtonDef[]>();
     const buttonActions={
         ServerView:{
             onClick:()=>setLeftVisible(true),
             disabled:!mustSplit,
             toggle: leftVisible||!mustSplit,
         },
         ItemsView:{
             onClick:()=>setLeftVisible(false),
             disabled:!mustSplit,
             toggle:!leftVisible||!mustSplit,
         },
         Cancel:{
             onClick:()=>history.pop()
         }
     }
     buttonListRef.current=updateButtons(RoutesPageButtons,buttonActions);
     useInitialButton(buttonListRef);
    return <PageFrame id={PAGE}>
        <PageLeft title={TITLE}>
            <CombinedView leftView={
                <StatusView
                    kinds={[ChannelKinds.ROUTE]}
                ></StatusView>
            }
                          rightView={
                              <DownloadItemList
                                  type={"route"}
                                  autoreload={3000}
                              />
                          }
                          leftActive={leftVisible || ! mustSplit}
                          rightActive={! leftVisible || ! mustSplit}/>

        </PageLeft>
        <ButtonList
            page={PAGE}
            itemList={InjectMainMenu(PAGE,
                buttonListRef.current,
            )}
        ></ButtonList>
    </PageFrame>
}

export default RoutesPage;