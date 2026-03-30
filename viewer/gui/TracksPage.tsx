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
import TracksPageButtons from "./TracksPageButtons";
import {DownloadItemList} from '../components/DownloadItemList';
import {showDialog} from "../components/OverlayDialog";
import {EditSettingsCategory} from "../components/Settings";
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";
import {useUploadHelper} from "../components/UploadHandler";

const PAGE=PAGEIDS.TRACKS;
const TITLE=PAGE_TITLES.TRACKS;
const ITEM_TYPE="track";
export type TracksPageProps = Partial<PageBaseProps>;
const TracksPage=(props:TracksPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const history=useHistory();
     const [scrollProps,scrollTo,visible]=useScrollHelper(0);
     const buttonListRef=useRef<ButtonDef[]>();
     const [uploadProps,uploadAction]=useUploadHelper(ITEM_TYPE);
     const buttonActions={
         ServerView:{
             onClick:()=>scrollTo(0),
             disabled:props.pageColumns > 2,
             toggle: visible(0),
         },
         ItemsView:{
             onClick:()=>scrollTo(1),
             disabled:props.pageColumns > 2,
             toggle:visible(1),
         },
         Cancel:{
             onClick:()=>history.pop()
         },
         ShowSettings:{
             onClick:()=>{
                 showDialog(undefined, ()=><EditSettingsCategory
                     category={"Track"}
                     title={'Track Display'}
                 />)
             }
         },
         DownloadPageUpload: {
             onClick:uploadAction,
             disabled:! visible(1),
         }
     }
     buttonListRef.current=updateButtons(TracksPageButtons,buttonActions);
     useInitialButton(buttonListRef);
    return <PageFrame id={PAGE}>
        <PageLeft title={TITLE}>
            <MultiView {...scrollProps} views={[
                <React.Fragment key={0}>
                    <MvHeadline title={"Server"} {...scrollProps} number={0} max={1}/>
                    <StatusView
                        kinds={[ChannelKinds.TRACK]}
                    ></StatusView>
                </React.Fragment>
                ,
                <React.Fragment key={1}>
                    <MvHeadline
                        title={"Tracks & Logs"}
                        {...scrollProps}
                        number={1}
                        max={1}
                    ></MvHeadline>
                    <DownloadItemList
                        {...uploadProps}
                        type={ITEM_TYPE}
                        autoreload={3000}
                        scrollSelected={1}
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

export default TracksPage;