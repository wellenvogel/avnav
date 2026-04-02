/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 ###############################################################################
 */

// @ts-ignore
import {createItemActions, FileDialog, ItemActions,Action} from "./FileDialog";
import {avitem, concatsp, setav, valueof} from "../util/helper";
import React, {useCallback, useEffect, useRef, useState} from "react";
// @ts-ignore
import {DEFAULT_OVERLAY_CHARTENTRY} from "./EditOverlaysDialog";
import Toast from "./Toast";
import {DBCancel, DialogButtons, DialogFrame, showDialog, showPromiseDialog} from "./OverlayDialog";
// @ts-ignore
import {checkName} from "./ItemNameDialog";
// @ts-ignore
import {EditDialogWithSave, getTemplate} from "./EditDialog";
import Requests from "../util/requests";
import ItemList from "./ItemList";
import UploadHandler from "./UploadHandler";
import Button, {ButtonEvent} from "./Button";
import keys from "../util/keys";
import {getItemIconProperties, Item, ItemType, listItems} from "../util/itemFunctions";
import {useStateRef, useTimer} from "../util/UiHelper";
import {ListItem, ListMainSlot, ListSlot} from "./ListItems";
import {Icon} from "./Icons";
import {IDialogContext, useDialogContext} from "./DialogContext";

interface SortProps{
    time?:number,
    name?:string
}
const itemSort = (a:SortProps, b:SortProps) => {
    if (a.time !== undefined && b.time !== undefined) {
        return b.time - a.time;
    }
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    return 0;
};
export const DownloadItemInfoMode={
    NO_INFO:0,
    ICONS:1,
    ALL:2
}

interface DownloadItemProps{
    infoMode:valueof<typeof DownloadItemInfoMode>;
    itemActions:ItemActions;
    className?:string;
    selected?:boolean;
    onClick?:(ev:Event)=>void;
}

const DownloadItem = (props:DownloadItemProps) => {
    let infoMode=props.infoMode;
    if (infoMode === undefined) infoMode=DownloadItemInfoMode.ALL;
    const actions = props.itemActions;
    const iconProperties=getItemIconProperties(props);
    return (
        <ListItem
            className={concatsp(actions.getClassName(props),props.className)}
            selected={props.selected}
            onClick={(ev)=>props.onClick && props.onClick(setav(ev, {action: 'select'}))}
            >
            <ListSlot><Icon {...iconProperties}/></ListSlot>
            <ListMainSlot
                primary={actions.getInfoText(props)}
                secondary={(infoMode === DownloadItemInfoMode.ALL)?
                    actions.getTimeText(props):
                    undefined
                }
            ></ListMainSlot>
            <ListSlot>
                {(infoMode === DownloadItemInfoMode.ALL ||
                        infoMode === DownloadItemInfoMode.ICONS) &&
                    <div className="infoImages">
                        <Icon className={actions.showIsServer(props)?"server":"_none"}/>
                        <Icon className={actions.canModify(props)?"edit":"_none"}/>
                        <Icon className={actions.canView(props)?"view":"_none"}/>
                    </div>
                }
            </ListSlot>
        </ListItem>
    );
};
export type DownloadItemListProps = {
    type: ItemType;
    selectCallback?:((ev:ButtonEvent)=>boolean)|((ev:ButtonEvent) => Promise<boolean>);
    uploadFile?: File;
    infoMode?: 0|1|2;
    noExtra?:boolean;
    showCreate?:boolean;
    itemActions?:any;
    autoreload?:number;
    uploadDone?:(done?:boolean|string) => void;
    selectedName?:string;
    immediateSelect?:boolean; //if set and selectedName is set - immediately call the selectCallback if found
    scrollSelected?:number;  //if != 0 scroll selected item, repeat scroll on change

}

export const DownloadItemList = (
    {type, selectCallback, uploadFile,infoMode,noExtra,showCreate,itemActions,
        autoreload,uploadDone,selectedName,scrollSelected,immediateSelect}:DownloadItemListProps) => {
    const [items, setItems] = useState([]);
    const [vselectedName, setVselectedName,vSelectedNameRef] = useStateRef(selectedName);
    const lastSelectedName=useRef(undefined);
    const initialSelectedNameRef = useRef((immediateSelect && selectCallback)?selectedName:undefined);
    const readItems = useCallback(async () => {
        const items = await listItems(type);
        setItems(items);
        if (initialSelectedNameRef.current) {
            if (Array.isArray(items)){
                for (const item of items){
                    if (item.name === initialSelectedNameRef.current){
                        initialSelectedNameRef.current=undefined;
                        await selectCallback(setav(new Event('avnav'),{item:item}));
                    }
                }
            }
            initialSelectedNameRef.current=undefined;
        }
    }, [type])
    const timer=useTimer((seq)=>{
       readItems().then(() => {
           timer.startTimer(seq);
        }, () => {})
    },autoreload,!!autoreload);
    useEffect(() => {
        readItems().then(() => {
        }, (err) => Toast(err));
    }, [type,autoreload])
    const dialogContext = useDialogContext();
    if (!itemActions) itemActions = createItemActions(type);
    const item=useCallback((props:Item)=>{
        return <DownloadItem {...props} infoMode={infoMode}
                             itemActions={itemActions}/>
    },[itemActions,infoMode]);
    const createAction=itemActions.getCreateAction().copy({
        checkName:(name:string,_itemList:Item[],accessor:(item:Item)=>string)=>{
            const rs=itemActions.show({name:name,type:type});
            if (rs !== true){
                if (typeof(rs) === 'string'){
                    return {
                        error:rs
                    }
                }
                return {
                    error: 'invalid name for '+type
                }
            }
            return checkName(name, items, accessor);
        },
        doneAction:async (_action:Action,name:string,dialogContext?:IDialogContext)=>{
            const template = getTemplate(name);
            if (template) {
                await showPromiseDialog(dialogContext, (dprops) => <EditDialogWithSave
                    {...dprops}
                    type={type}
                    fileName={name}
                    data={template}
                />)
                return readItems();
            } else {
                const data = "";
                try {
                    await Requests.postPlain({
                        command: 'upload',
                        type: type,
                        name: name
                    }, data);
                    return readItems();
                } catch (e) {
                    Toast(e + "");
                    return readItems()
                }
            }
        }
    })
    const uploadAction = itemActions.getUploadAction();
    const displayList=[];
    (items||[]).forEach((item) => {
        if (itemActions.show(item) === true){
            displayList.push(item);
        }
    });
    if (type === 'chart' && !noExtra) {
        displayList.push(DEFAULT_OVERLAY_CHARTENTRY)
    }
    if (type !== 'plugins') {
        displayList.sort(itemSort);
    }
    if (scrollSelected || vselectedName){
        lastSelectedName.current=vselectedName;
    }
    useEffect(()=>{
        if (selectedName !== vSelectedNameRef.current){
            setVselectedName(selectedName);
        }
    },[selectedName,scrollSelected]);
    return <React.Fragment>
        <ItemList
            keyFunction={(item:Item)=>item.name}
            className={'DownloadItemList'}
            itemClass={item}
            scrollable={true}
            itemList={displayList}
            selectedKey={vselectedName}
            scrollSelected={scrollSelected}
            onItemClick={async (ev) => {
                const item = avitem(ev);
                if (scrollSelected) {
                    setVselectedName(item.name);
                }
                setav(ev,{dialogContext:dialogContext});
                if (selectCallback) {
                    if (await selectCallback(ev)) return;
                }
                showDialog(dialogContext, () =>
                    <FileDialog
                        current={item}
                    />, () => {
                    readItems();
                });
            }}
        />
        <UploadHandler
            local={uploadAction.hasLocalAction()}
            type={type}
            doneCallback={async (param) => {
                const rs = await uploadAction.afterUpload();
                if (uploadDone) uploadDone(param?param.name:undefined);
                if (param && param.name && scrollSelected) {
                    setVselectedName(param.name);
                }
                if (rs) return;
                readItems();
            }}
            errorCallback={(err) => {
                if (uploadDone) uploadDone();
                if (err) Toast(err);
                readItems();
            }}
            file={uploadFile}
            checkNameCallback={(file, dialogContext) => uploadAction.checkFile(file, dialogContext)}
        />
        {(type === "user" && showCreate) ?
            <Button
                className="fab"
                name="DownloadPageCreate"
                onClick={() => {
                    createAction.action(dialogContext);
                }}
                storeKeys={{visible: keys.properties.connectedMode}}
            />
            :
            null}
    </React.Fragment>
}

export interface DownloadItemSelectDialogProps{
    type:ItemType,
    className?:string,
    title?:string,
    selectedName?:string,
    immediateSelect?:boolean,
    resolveFunction:((item:Item)=>void)|((item:Item)=>Promise<void>)
}

export const DownloadItemSelectDialog = (props:DownloadItemSelectDialogProps)=> {
    const dialogContext = useDialogContext();
    const [hideList,setHideList]=useState(false);
    return <DialogFrame title={props.title || `select ${props.type}`}>

        { ! hideList && <DownloadItemList type={props.type}
                             autoreload={0}
                             noExtra={true}
                             selectedName={props.selectedName}
                             immediateSelect={props.immediateSelect}
                             selectCallback={async (ev: ButtonEvent) => {
                                 const item=avitem(ev);
                                 if (! item) return false;
                                 setHideList(true);
                                 try {
                                     await props.resolveFunction(item);
                                     dialogContext.closeDialog();
                                     return true
                                 }catch(e){
                                     setHideList(false);
                                     throw e;
                                 }
                             }}/> }
        <DialogButtons buttonList={[
            DBCancel()
        ]}/>
    </DialogFrame>
}