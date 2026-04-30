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
 
import React, {ReactElement, useCallback, useRef} from 'react';
import {PageFrame, PageLeft, PageProps} from "../components/Page";
import {ButtonDef, updateButtons} from "../components/Button";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import PluginsPageButtons from "./PluginsPageButtons";
import {getPageTitle} from "../util/pageids";
import ButtonList from "../components/ButtonList";
import {DownloadItemList} from "../components/DownloadItemList";
import {useUploadHelper} from "../components/UploadHandler";
import {Item} from "../components/ItemList";
import {ChildStatus, ChildStatusProps} from "../components/StatusItems";
import {useTimer} from "../util/UiHelper";
import Requests from "../util/requests";
import {shallowEqual} from "shallow-equal";
import {useHistory} from "../components/HistoryProvider";
import ButtonDefs from "../components/ButtonDefs";
interface InfoCacheEntry{
    status:ChildStatusProps;
    element: ReactElement
}
export const PluginsPage = (props:PageProps) => {
    const history=useHistory();
    const currentButtons=useRef<ButtonDef[]>();
    const infoCache=useRef<Record<string,InfoCacheEntry>>({});
    const statusRef=useRef<ChildStatusProps[]>([]);
    const timer=useTimer((seq)=>{
        //we do not set a state here as we rely on the reload of the downloaditemlist
        //to fetch again
        Requests.getJson({
            type:'plugins',
            command:'status'
        }).then((json:Record<string, any>)=>{
            statusRef.current=json.data||[];
            timer.startTimer(seq);
        },()=>{})
    },1000,true,true)
    const [uploadProps,uploadAction]=useUploadHelper("plugins");
    const buttonActions={
        [ButtonDefs.Upload.name]:{
            onClick:uploadAction,
        },
        Cancel:{
            onClick:()=>{history.pop()}
        }
    }
    const ItemStatus=useCallback((item:Item)=>{
        //we use a cache to always return the same element to avoid redrawing
        //if there is no change in the status
        for (const st of statusRef.current){
            if (st.name === item.name){
                const current=infoCache.current[st.name];
                if (current && shallowEqual(current.status,st)) {
                    return current.element;
                }
                const rt= <ChildStatus id={st.name} handlerId={-1} {...st}/>
                infoCache.current[st.name]={
                    status:st,
                    element:rt
                }
                return rt;
            }
        }
        return null;
    },[]);
    console.log(ItemStatus);
    currentButtons.current=InjectMainMenu(props.id,updateButtons(PluginsPageButtons,buttonActions));
    useInitialButton(currentButtons);
    return <PageFrame id={props.id}>
        <PageLeft id={props.id} title={getPageTitle(props.id)} >
            <DownloadItemList
                className={'StatusView'}
                itemInfoFunction={ItemStatus}
                {...uploadProps}
                type={'plugins'}
                autoreload={3000}
                scrollSelected={1}
            >

            </DownloadItemList>
        </PageLeft>
        <ButtonList page={props.id} itemList={currentButtons.current}/>
    </PageFrame>
}