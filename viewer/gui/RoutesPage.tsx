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
import {ButtonDef,  updateButtons} from "../components/Button";
import RoutesPageButtons from "./RoutesPageButtons";
import {DownloadItemList} from '../components/DownloadItemList';
// @ts-ignore
import {createItemActions} from '../components/FileDialog';
// @ts-ignore
import NavHandler from '../nav/navdata';
import Toast from "../components/Toast";
import {showDialog} from "../components/OverlayDialog";
// @ts-ignore
import {RouteSyncDialog} from '../components/RouteInfoHelper';
import globalstore from "../util/globalstore";
import {EditSettingsCategory} from "../components/Settings";
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";
import {useUploadHelper} from "../components/UploadHandler";

const PAGE=PAGEIDS.NROUTE;
const TITLE=PAGE_TITLES.NROUTE;
export type RoutesPageProps = Partial<PageBaseProps>;
const RoutesPage=(props:RoutesPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const [selectedName, setSelectedName] = useState<string>();
     const [scrollProps,scrollTo,isVisible]=useScrollHelper(0);
     const [scrollSelected, setScrollSelected] = useState<number>(1);
     const history=useHistory();
     const buttonListRef=useRef<ButtonDef[]>();
     const [uploadProps,uploadAction]=useUploadHelper('route');
     const actions=createItemActions('route');
     const buttonActions={
         ServerView:{
             onClick:()=>scrollTo(0),
             disabled:props.pageColumns>1,
             toggle: isVisible(0),
         },
         ItemsView:{
             onClick:()=>scrollTo(1),
             disabled:props.pageColumns>1,
             toggle:isVisible(1),
         },
         Cancel:{
             onClick:()=>history.pop()
         },
         StatusAdd:{
             onClick:async ()=>{
                 scrollTo(1);
                 try {
                     const route = await actions.getCreateAction().action();
                     const RouteHandler=NavHandler.getRoutingHandler();
                     await RouteHandler.saveRoute(route);
                     setSelectedName(route.name);
                     setScrollSelected(scrollSelected+1);
                 }catch (e){
                     Toast(e);
                 }

             }
         },
         SyncRoutes:{
             onClick:()=>{
                 showDialog(undefined, ()=><RouteSyncDialog
                     deleteLocal={true}
                     showEmpty={true}
                 />)
             }
         },
         Connected: {
             onClick: () => {
                 let con = globalstore.getData(keys.gui.global.connectedMode, false);
                 con = !con;
                 globalstore.storeData(keys.gui.global.connectedMode, con);
             }
         },
         ShowSettings:{
             onClick:()=>{
                 showDialog(undefined, ()=><EditSettingsCategory
                     category={"Route"}
                     title={'Route Display'}
                 />)
             }
         },
         DownloadPageUpload:{
             onClick:uploadAction,
             disabled:!isVisible(1)
         }
     }
     buttonListRef.current=updateButtons(RoutesPageButtons,buttonActions);
     useInitialButton(buttonListRef);
    return <PageFrame id={PAGE}>
        <PageLeft title={TITLE}>
            <MultiView {...scrollProps} views={[
                <React.Fragment key={0}>
                    <MvHeadline title={"Server"}/>
                    <StatusView
                        kinds={[ChannelKinds.ROUTE]}
                    ></StatusView>
                </React.Fragment>
                ,
                <React.Fragment key={1}>
                    <MvHeadline title={"Stored Routes"}/>
                    <DownloadItemList
                        {...uploadProps}
                        type={"route"}
                        autoreload={3000}
                        selectedName={selectedName}
                        scrollSelected={scrollSelected}
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

export default RoutesPage;