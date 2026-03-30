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
import {ButtonDef, ButtonEventHandler, updateButtons} from "../components/Button";
import ChartsPageButtons from "./ChartsPageButtons";
import {DownloadItemList} from '../components/DownloadItemList';
import {showDialog} from "../components/OverlayDialog";
import {EditSettingsCategory} from "../components/Settings";
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";
import {useUploadHelper} from "../components/UploadHandler";
import {ListItem, ListMainSlot, ListSlot} from "../components/ListItems";
import DialogButton from "../components/DialogButton";
import Helper from "../util/helper";
import {ImporterView} from "../components/ImporterView";

const PAGE=PAGEIDS.CHARTS;
const TITLE=PAGE_TITLES.CHARTS;
const NUMVIEWS=4
export type ChartsPageProps = Partial<PageBaseProps>;
interface UploadActionProps{
    onClick:ButtonEventHandler,
    className?:string
    title:string
}
const UploadAction=(props:UploadActionProps)=>{
    return <ListItem className={Helper.concatsp('uploadAction',props.className)}
                     onClick={props.onClick}
    >
        <ListMainSlot primary={`Upload ${props.title}`}/>
        <ListSlot>
            <DialogButton
                name={'DownloadPageUpload'}
                displayName={`upload ${props.title}`}
            />
        </ListSlot>
    </ListItem>
}
const ChartsPage=(props:ChartsPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const history=useHistory();
     const [scrollProps,scrollTo,visible]=useScrollHelper(1);
     const buttonListRef=useRef<ButtonDef[]>();
     const [uploadPropsCharts,uploadActionCharts]=useUploadHelper('chart',true);
    const [uploadPropsOverlays,uploadActionOverlays]=useUploadHelper('overlay',true);
     const buttonActions={
         ServerView:{
             onClick:()=>scrollTo(0),
             disabled:props.pageColumns >= NUMVIEWS,
             toggle: visible(0),
         },
         ChartsView:{
             onClick:()=>scrollTo(1),
             disabled:props.pageColumns >= NUMVIEWS,
             toggle:visible(1),
         },
         ImportsView: {
             onClick:()=>scrollTo(2),
             disabled:props.pageColumns >= NUMVIEWS,
             toggle:visible(2),
         },
         OverlaysView:{
             onClick:()=>scrollTo(3),
             disabled:props.pageColumns >= NUMVIEWS,
             toggle:visible(3),
         },
         Cancel:{
             onClick:()=>history.pop()
         },
         ShowSettings:{
             onClick:()=>{
                 showDialog(undefined, ()=><EditSettingsCategory
                     category={["Map","Navigation"]}
                     title={'Map & Nav Display'}
                 />)
             }
         }
     }
     buttonListRef.current=updateButtons(ChartsPageButtons,buttonActions);
     useInitialButton(buttonListRef);
    return <PageFrame id={PAGE}>
        <PageLeft title={TITLE}>
            <MultiView {...scrollProps} views={[
                <React.Fragment key={0}>
                    <MvHeadline title={"Server"} {...scrollProps} number={0} max={NUMVIEWS - 1}/>
                    <StatusView
                        kinds={[ChannelKinds.CHART]}
                    ></StatusView>
                </React.Fragment>
                ,
                <React.Fragment key={1}>
                    <MvHeadline
                        title={"Charts"}
                        {...scrollProps}
                        number={1}
                        max={NUMVIEWS - 1}
                    ></MvHeadline>
                    <UploadAction onClick={uploadActionCharts} title={'chart'}/>
                    <DownloadItemList
                        {...uploadPropsCharts}
                        type={'chart'}
                        autoreload={3000}
                        scrollSelected={1}
                    />
                </React.Fragment>
                ,
                <React.Fragment key={2}>
                    <MvHeadline title={'Imports'}
                                {...scrollProps}
                                number={2}
                                max={NUMVIEWS - 1}
                    />
                    <ImporterView/>
                </React.Fragment>,
                <React.Fragment key={3}>
                    <MvHeadline title={"Overlays"}
                                {...scrollProps}
                                number={3}
                                max={NUMVIEWS - 1}/>
                    <UploadAction onClick={uploadActionOverlays} title={'overlay'}/>
                    <DownloadItemList
                        {...uploadPropsOverlays}
                        type={'overlay'}
                        autoreload={3000}
                        scrollSelected={3}
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

export default ChartsPage;