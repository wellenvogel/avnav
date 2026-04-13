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
import {getPageTitle, PAGEIDS} from "../util/pageids";
import {PageBaseProps, PageFrame, PageLeft} from "../components/Page";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import StatusView, {ChannelKinds} from "../components/StatusView";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {ButtonDef, updateButtons} from "../components/Button";
import ChartsPageButtons from "./ChartsPageButtons";
import {DownloadItemList, UploadAction} from '../components/DownloadItemList';
import {showDialog} from "../components/OverlayDialog";
import {EditSettingsCategory} from "../components/Settings";
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";
import {UploadHandlerWithActions, useUploadHelper, useUploadHelperHandler} from "../components/UploadHandler";
import {ImporterView} from "../components/ImporterView";
// @ts-ignore
import {createItemActions} from '../components/FileDialog';

const PAGE=PAGEIDS.CHARTS;
const TITLE=getPageTitle(PAGE);
const NUMVIEWS=4
export type ChartsPageProps = Partial<PageBaseProps>;
const ChartsPage=(props:ChartsPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const [uploadCharts]=useStoreState(keys.gui.capabilities.uploadCharts);
     const [uploadImport]=useStoreState(keys.gui.capabilities.uploadImport);
     const [uploadOverlays]=useStoreState(keys.gui.capabilities.uploadOverlays);
     const [connected]=useStoreState(keys.gui.global.connectedMode);
     const [hasImports]=useStoreState(keys.gui.capabilities.uploadImport);
     const history=useHistory();
     const [scrollProps,scrollTo,visible]=useScrollHelper(1);
     const buttonListRef=useRef<ButtonDef[]>();
     const [uploadPropsCharts,uploadActionCharts]=useUploadHelperHandler('chart');
     const [uploadPropsOverlays,uploadActionOverlays]=useUploadHelper('overlay');
     const [uploadedChart,setUploadedChart]=useState(undefined);
     const [uploadedImport,setUploadedImport]=useState(undefined);
     const numViews=hasImports?NUMVIEWS:NUMVIEWS-1;
     const buttonActions={
         ServerView:{
             onClick:()=>scrollTo(0),
             disabled:props.pageColumns >= numViews,
             toggle: visible(0),
         },
         ChartsView:{
             onClick:()=>scrollTo(1),
             disabled:props.pageColumns >= numViews,
             toggle:visible(1),
         },
         ImportsView: {
             onClick:()=>scrollTo(2),
             disabled:props.pageColumns >= numViews,
             toggle:visible(2),
         },
         OverlaysView:{
             onClick:()=>scrollTo(hasImports?3:2),
             disabled:props.pageColumns >= numViews,
             toggle:visible(hasImports?3:2),
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
     const chartActions=createItemActions('chart');
     const usedChartActions=chartActions.copy({
         getUploadAction:()=>{
             const ul=chartActions.getUploadAction();
             ul.doneAction=(userData:{importer?:boolean,name?:string})=>{
                 if (userData.name){
                     if (userData.importer){
                         setUploadedImport(userData.name);
                         scrollTo(2);
                     }
                     else{
                         setUploadedChart(userData.name);
                         scrollTo(1);
                     }
                 }
             }
             return ul;
         }
     })
    return <PageFrame id={PAGE}>
        <PageLeft
            id={PAGE}
            title={TITLE}>
            <MultiView {...scrollProps} views={[
                <React.Fragment key={0}>
                    <MvHeadline title={"Server"}/>
                    <StatusView
                        kinds={[ChannelKinds.CHART]}
                    ></StatusView>
                </React.Fragment>
                ,
                <React.Fragment key={1}>
                    <MvHeadline
                        title={"Charts"}
                    ></MvHeadline>
                    <UploadAction
                        disabled={!uploadCharts || ! connected}
                        onClick={uploadActionCharts}
                        title={'chart'}/>
                    <DownloadItemList
                        type={'chart'}
                        autoreload={3000}
                        scrollSelected={1}
                        selectedName={uploadedChart}
                    />
                </React.Fragment>
                ,
                hasImports ?<React.Fragment key={2}>
                    <MvHeadline title={'Imports'}
                    />
                    <UploadAction
                        disabled={!uploadCharts || ! connected || ! uploadImport}
                        onClick={uploadActionCharts}
                        title={'import'}
                    />
                    <ImporterView
                        selected={uploadedImport}
                    />
                </React.Fragment>:null,
                <React.Fragment key={3}>
                    <MvHeadline title={"Overlays"}
                                />
                    <UploadAction
                        disabled={!uploadOverlays || ! connected}
                        onClick={uploadActionOverlays}
                        title={'overlay'}/>
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
        <UploadHandlerWithActions
            {...uploadPropsCharts}
            itemAction={usedChartActions}
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