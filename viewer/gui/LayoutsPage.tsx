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
import {PAGE_TITLES, PAGEIDS} from "../util/pageids";
import {PageBaseProps, PageFrame, PageLeft} from "../components/Page";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import StatusView, {ChannelKinds} from "../components/StatusView";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {ButtonDef, updateButtons} from "../components/Button";
import LayoutsPageButtons from "./LayoutsPageButtons";
import {DownloadItemList} from '../components/DownloadItemList';
import {showDialog} from "../components/OverlayDialog";
import {EditSettingsCategory, SelectLayoutDialog} from "../components/Settings";
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";
import {useUploadHelper} from "../components/UploadHandler";
import {ListItem, ListMainSlot, ListSlot} from "../components/ListItems";
import DialogButton from "../components/DialogButton";

const PAGE=PAGEIDS.LAYOUT;
const TITLE=PAGE_TITLES.LAYOUT;
const ITEM_TYPE='layout';
export type LayoutsPageProps = Partial<PageBaseProps>;
const LayoutsPage=(props:LayoutsPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const [layoutName]=useStoreState(keys.properties.layoutName);
     const history=useHistory();
     const [scrollProps,scrollTo,visible]=useScrollHelper(1);
     const buttonListRef=useRef<ButtonDef[]>();
     const [uploadProps,uploadAction]=useUploadHelper(ITEM_TYPE,true);
     const buttonActions={
         ServerView:{
             onClick:()=>scrollTo(0),
             disabled:props.pageColumns > 1,
             toggle: visible(0),
         },
         ItemsView:{
             onClick:()=>scrollTo(1),
             disabled:props.pageColumns > 1,
             toggle:visible(1),
         },
         Cancel:{
             onClick:()=>history.pop()
         },
         ShowSettings:{
             onClick:()=>{
                 showDialog(undefined, ()=><EditSettingsCategory
                     category={"Layout"}
                     title={'Layout Settings'}
                 />)
             }
         },
         SettingsLayout:{
             onClick:()=>{
                 showDialog(undefined, ()=><SelectLayoutDialog/>)
             }
         },
         DownloadPageUpload:{
             onClick:uploadAction,
             disabled:!visible(1),
         }
     }
     buttonListRef.current=updateButtons(LayoutsPageButtons,buttonActions);
     useInitialButton(buttonListRef);
    return <PageFrame id={PAGE}>
        <PageLeft title={TITLE}>
            <MultiView {...scrollProps} views={[
                <React.Fragment key={0}>
                    <MvHeadline title={"Server"} {...scrollProps} number={0} max={1}/>
                    <StatusView
                        kinds={[ChannelKinds.LAYOUT]}
                    ></StatusView>
                </React.Fragment>
                ,
                <React.Fragment key={1}>
                    <MvHeadline
                        title={"Current"}
                        {...scrollProps}
                        number={1}
                        max={1}
                    ></MvHeadline>
                    <ListItem className={'activeLayout'}
                              onClick={()=>showDialog(undefined, ()=><SelectLayoutDialog/>)}
                    >
                        <ListMainSlot primary={layoutName}/>
                        <ListSlot>
                            <DialogButton
                                name={'SettingsLayout'}
                                displayName={'select/edit layout'}
                            />
                        </ListSlot>
                    </ListItem>
                    <MvHeadline title={"Layouts"}/>
                    <DownloadItemList
                        {...uploadProps}
                        type={"layout"}
                        scrollSelected={1}
                        autoreload={3000}
                    />
                </React.Fragment>
            ]}
                       maxNumber={props.pageColumns}
            />

        </PageLeft>
        <ButtonList
            page={PAGE}
            itemList={InjectMainMenu(PAGE,
                buttonListRef.current,
            )}
        ></ButtonList>
    </PageFrame>
}

export default LayoutsPage;