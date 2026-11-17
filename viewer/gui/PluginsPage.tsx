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
 
import React, {ReactElement, useCallback, useEffect, useRef, useState,Fragment} from 'react';
import {PageFrame, PageLeft, PageProps} from "../components/Page";
import {ButtonDef, updateButtons} from "../components/Button";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import PluginsPageButtons from "./PluginsPageButtons";
import ButtonList from "../components/ButtonList";
import {DownloadItemList} from "../components/DownloadItemList";
import {UploadProgress, useUploadHelper} from "../components/UploadHandler";
import ItemList, {Item} from "../components/ItemList";
import {ChildStatus, ChildStatusProps} from "../components/StatusItems";
import {useTimer} from "../util/UiHelper";
import Requests, {buildProxyUrl} from "../util/requests";
import {shallowEqual} from "shallow-equal";
import {useHistory} from "../components/HistoryProvider";
import ButtonDefs from "../components/ButtonDefs";
import {getPageTitle} from "../components/pagetitles";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import Toast from "../components/Toast";
import {load as yamlLoad} from 'js-yaml';
import {ListItem, ListMainSlot, ListSlot, useDialogContext} from "../components/exports";
import {
    DBCancel,
    DialogButtons,
    DialogFrame,
    DialogRow,
    showPromiseDialogTrue
} from "../components/OverlayDialog";
import {listItems} from "../util/itemFunctions";
import DialogButton from "../components/DialogButton";
import {ConfirmDialog} from "../components/BasicDialogs";
import base from "../base";
interface InfoCacheEntry{
    status:ChildStatusProps;
    element: ReactElement,
    item:Item
}
interface PluginCatalogProps{
    url: string|URL,
    selectCallback?:(name:string)=>void
}

//those should be better move to the item actions
const USER_PREFIX="user-";
const SYS_PREFIX="system-";
//const BUILTIN_PREFIX="builtin-";


/**
 * update options:
 * found user - catalog zip : can update
 * found nothing - catalog zip: can update
 *
 * found nothing - catalog package: if catalog available -> updater
 * found package - catalog package: if catalog available -> updater
 */

interface UpdateOptions{
    can?: boolean;
    should?: boolean; //catalog version higher
    updater?:boolean;
    isNew?: boolean;
}
const sortPrio=(u:UpdateOptions):number=>{
    if (! u) return 0;
    if (! u.can) return 1;
    return 2+(u.should?2:0)+(u.isNew?1:0);
}
interface CatalogEntry extends Record<string, any> {
    name:string;
    version:string|number;
    type?:string;
    platform?:string[];
    available?:Record<string, any>;
    _localItem?:Item,
    _updateOptions:UpdateOptions;
    _selectCallback?:(name:string)=>void;
}
const versionCompare=(a:string|number,b:string|number)=>{
    if (a == null ) return false;
    if (b == null ) return true;
    return a> b;
}

const buildUpdateOptions=(catalogEntry:CatalogEntry,localEntry?:Item)=>{
    const updateOptions:UpdateOptions={};
    if (catalogEntry.type == 'zip'){
        if (! localEntry){
            updateOptions.can=true;
            updateOptions.isNew=true;
        }
        else {
            updateOptions.can=true;
            if (versionCompare(catalogEntry.version,localEntry.version)) updateOptions.should=true;
        }
    }
    else{
        //package
        const hasAvailable=!!catalogEntry.available;
        if (! localEntry){
            updateOptions.isNew=true;
            updateOptions.updater=hasAvailable;
            updateOptions.can=hasAvailable;
        }
        else {
            updateOptions.updater=hasAvailable;
            updateOptions.can=hasAvailable;
            updateOptions.should=versionCompare(catalogEntry.version,localEntry.version);
        }
    }
    return updateOptions;
}

const startDownload= async (name:string,url:string)=>{
    const rs=await Requests.getJson({
        type:'plugins',
        command:'externalDownload',
        url:url,
        name:name,
        overwrite:true
    });
    return rs.id;
}

const CatalogItem = (props: CatalogEntry) => {
    const dialogContext = useDialogContext();
    const nv:[string,string|number][] = [];
    let platform="unknown";
    if (props.platform){
        if (props.platform instanceof Array){
            platform=props.platform.join(",")
        }
        else{
            platform=`${props.platform}`;
        }
    }
    if (props.version != null) nv.push(["CatalogVersion",props.version])
    nv.push(["Type",props.type])
    nv.push(["Platform",platform])
    const updateState=buildUpdateOptions(props,props._localItem);
    if (props._localItem != null){
        nv.push(["LocalVersion",(props._localItem.version != null)?props._localItem.version:"[installed]"])
    }
    const bt=updateState.isNew?ButtonDefs.DBPluginInstall: ButtonDefs.DBPluginUpdate
    const prfx=(props.type == 'zip')?USER_PREFIX:SYS_PREFIX;
    return <ListItem className={'catalogItem'}>
        <ListMainSlot primary={prfx+props.name}>
        <dl>
        {nv.map((el)=><Fragment key={el[0]}>
            <dt>{el[0]}</dt>
            <dd>{el[1]}</dd>
        </Fragment>)}
        </dl>
        </ListMainSlot>
        {updateState.can && (updateState.should || updateState.isNew)  && ! updateState.updater && <ListSlot>
            <DialogButton
            {...bt}
            close={false}
            onClick={async ()=>{
                const up=updateState.isNew?"Install":"Update";
                const txt=`${up} ${props.name} with ${props.version}?`;
                const rs=await showPromiseDialogTrue(dialogContext,(dp)=><ConfirmDialog text={txt} {...dp}/>);
                if (rs){
                    dialogContext.closeDialog();
                    if (props._selectCallback) props._selectCallback(USER_PREFIX+props.name)
                    try{
                        const id=await startDownload(props.name,props.download_url);
                        base.log("plugin download started",props.name,id);
                    }catch (e){
                        if (e) Toast(e);
                    }

                }
            }}
        />
        </ListSlot>}
    </ListItem>
}
const PluginCatalog=(props:PluginCatalogProps)=>{
    const LD_CAT=1;
    const LD_PI=2;
    const LD_PF=4;
    //const dialogContext=useDialogContext();
    const [loading,setLoading]=useState(LD_CAT|LD_PI);
    const [catalog,setCatalog]=useState<CatalogEntry[]>([])
    const [existing,setExisting]=useState<Record<string,Item>>({})
    const [platform,setPlatform]=useState<string>('unknown')
    useEffect(()=>{
        setLoading(LD_CAT | LD_PI|LD_PF);
        const proxyUrl=buildProxyUrl(props.url,undefined,undefined,{'a:notime':true});
        Requests.getHtmlOrText(proxyUrl).then((data:string)=>{
            const catalog=yamlLoad(data);
            setLoading((old)=>old & ~LD_CAT);
            console.log(catalog);
            setCatalog(catalog as CatalogEntry[]);
        })
            .catch((err)=>{
                setLoading((old)=>old & ~LD_CAT);
                if (err) Toast(err)
            })
        Requests.getJson({
            type:'plugins',
            command:'getPlatform',
        })
            .then((data)=>{
                setPlatform(data.platform);
                setLoading((old)=>old & ~LD_PF);
            })
            .catch((err)=>{
                setLoading((old)=>old & ~LD_PF);
                if (err) Toast(err);
            })
        listItems('plugins').then((plugins:Item[])=>{
            setLoading((old)=>old & ~LD_PI);
            const newExisting:Record<string,Item>={};
            for (const item of plugins){
                newExisting[item.name]=item;
            }
            setExisting(newExisting);
        })
            .catch((err)=>{
                setLoading((old)=>old & ~LD_PI);
                if (err) Toast(err)
            })
    },[props.url])
    const displayItems:Item[]=[];
    for (const citem of catalog){
        const cplatform=citem.platform;
        if (!cplatform) continue;
        if (cplatform instanceof Array){
            if (cplatform.indexOf(platform) < 0 && cplatform.indexOf('all') <0) continue;
        }
        else{
            if (cplatform != platform && cplatform != "all") continue;
        }
        const item={...citem};
        const prfx=(item.type == 'zip')?USER_PREFIX:SYS_PREFIX;
        const localItem=existing[prfx+item.name];
        if (localItem){
                item._localItem=localItem;
        }
        item._updateOptions=buildUpdateOptions(item,localItem);
        item._selectCallback=props.selectCallback;
        displayItems.push(item);
    }
    displayItems.sort((a,b)=>{
        const ma=sortPrio(a._updateOptions);
        const mb=sortPrio(b._updateOptions);
        return mb-ma;
    })
    return <DialogFrame title={"Plugin Catalog"}>
        {
            loading?<div>Loading...</div>:
                <Fragment>
                <DialogRow className="catalogItem">
                    <dl>
                    <dt className={'label'}>Platform</dt>
                    <dd className={'value'}>{platform}</dd>
                    </dl>
                </DialogRow>
                <ItemList itemList={displayItems} itemClass={CatalogItem} scrollable={true}/>
                </Fragment>
        }
        <DialogButtons buttonList={
            DBCancel()
        }/>
    </DialogFrame>
}
interface DownloadProgressProps{
    id?:number
}
interface ExternalDownloadStatus{
    totalBytes?:number,
    fetchedBytes?:number,
    percent?:number,
    error?:string,
    done?:boolean,
    info?:string,
    id?:string|number,
    phase?:string
}
const DownloadProgress=(props:DownloadProgressProps)=>{
    const timeOut=(props.id != null)?500:1000
    const [progress,setProgress]=useState<ExternalDownloadStatus|undefined>(undefined);
    const timer=useTimer((seq)=>{
        Requests.getJson({
            type:'plugins',
            command:'downloadStatus',
            id:props.id
        })
            .then((rs)=>{
                setProgress(rs.data);
                if (rs.data == null) {
                    timer.setTimeout(1000);
                }
                else{
                    timer.setTimeout(500);
                }
                timer.startTimer(seq);
            })
            .catch((err)=>{
                base.log(err);
                timer.setTimeout(1000);
                timer.startTimer(seq);
            })
    },timeOut,true,true)
    if (! progress || progress.done) return null;
    return <UploadProgress
        heading={"plugin "+progress?.info}
        loaded={progress?.fetchedBytes||0}
        total={progress?.totalBytes||0}
        percentComplete={progress?.percent}
        onCancel={async ()=>{
            await Requests.getJson({
                type:'plugins',
                command:'cancelDownload',
                id:progress.id,
            })
        }}
    />
}

export const PluginsPage = (props:PageProps) => {
    const history=useHistory();
    const dialogContext = useDialogContext();
    const [selectedName, setSelectedName] = useState<string>();
    const [selectSequence,setSelectSequence]=useState<number>(1);
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
        },()=>{
            timer.startTimer(seq);
        })
    },1000,true,true)
    const [uploadProps,uploadAction]=useUploadHelper("plugins");
    const syncAction=useCallback(()=>{
        const url=globalstore.getData(keys.properties.pluginCatalog);
        dialogContext.showDialog(()=><PluginCatalog url={url} selectCallback={
            (name:string)=>{
                setSelectedName(name);
                setSelectSequence((old)=>old+1)
                }
        }/>)
    },[])
    const buttonActions={
        [ButtonDefs.Upload.name]:{
            onClick:uploadAction,
        },
        [ButtonDefs.SyncPlugins.name]:{
            onClick:syncAction,
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
                if (current && shallowEqual(current.status,st) && shallowEqual(current.item,item)) {
                    return current.element;
                }
                const rt= <div>
                    <ChildStatus hideName={true} id={st.name} handlerId={-1} {...st}/>
                    {(item.version != null) &&
                        <div className="childStatus">
                        <span className="label">Version:&nbsp;</span>
                            <span className="value">{item.version}</span>
                        </div>
                    }
                </div>
                infoCache.current[st.name]={
                    status:st,
                    element:rt,
                    item:item
                }
                return rt;
            }
        }
        return null;
    },[]);
    currentButtons.current=InjectMainMenu(props.id,updateButtons(PluginsPageButtons,buttonActions));
    useInitialButton(currentButtons);
    return <PageFrame id={props.id}>
        <PageLeft id={props.id} title={getPageTitle(props.id)} >
            <DownloadItemList
                selectedName={selectedName}
                className={'StatusView'}
                itemInfoFunction={ItemStatus}
                {...uploadProps}
                type={'plugins'}
                autoreload={3000}
                scrollSelected={selectSequence}
            >

            </DownloadItemList>
            <DownloadProgress id={undefined}/>
        </PageLeft>
        <ButtonList page={props.id} itemList={currentButtons.current}/>
    </PageFrame>
}