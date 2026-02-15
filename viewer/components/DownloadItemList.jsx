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

import {createItemActions, FileDialog, ItemActions} from "./FileDialog";
import Helper, {avitem, setav} from "../util/helper";
import React, {useCallback, useEffect, useState} from "react";
import {DEFAULT_OVERLAY_CHARTENTRY} from "./EditOverlaysDialog";
import Toast from "./Toast";
import {showDialog, showPromiseDialog, useDialogContext} from "./OverlayDialog";
import {checkName} from "./ItemNameDialog";
import {EditDialogWithSave, getTemplate} from "./EditDialog";
import Requests from "../util/requests";
import ItemList from "./ItemList";
import UploadHandler from "./UploadHandler";
import {DynamicButton} from "./Button";
import keys from "../util/keys";
import PropTypes from "prop-types";
import {getItemIconProperties, getUrlWithBase, listItems} from "../util/itemFunctions";
import {useTimer} from "../util/GuiHelpers";
import {ListFrame, ListItem, ListMainSlot, ListSlot} from "./ListItems";
import {Icon} from "./Icons";

const itemSort = (a, b) => {
    if (a.time !== undefined && b.time !== undefined) {
        return b.time - a.time;
    }
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    return 0;
};
export const DownloadItemInfoMode={
    NO_INFO:1,
    ICONS:1,
    ALL:2
}

const DownloadItem = (props) => {
    let infoMode=props.infoMode;
    if (infoMode === undefined) infoMode=DownloadItemInfoMode.ALL;
    let actions = props.itemActions;
    const iconProperties=getItemIconProperties(props);
    return (
        <ListItem
            className={actions.getClassName(props)}
            selected={props.selected}
            onClick={(ev)=>props.onClick(setav(ev, {action: 'select'}))}
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
export const DownloadItemList = ({type, selectCallback, uploadSequence,infoMode,noExtra,showUpload,itemActions,autoreload}) => {
    const [items, setItems] = useState([]);
    const readItems = useCallback(async () => {
        const items = await listItems(type);
        setItems(items);
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
    const item=useCallback((props)=>{
        return <DownloadItem {...props} infoMode={infoMode}
                             itemActions={itemActions}/>
    },[itemActions,infoMode]);
    const createAction=itemActions.getCreateAction().copy({
        checkName:(name,itemList,accessor)=>{
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
        doneAction:async (action,name,dialogContext)=>{
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
                let data = "";
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
    let displayList=[];
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
    return <React.Fragment>
        <ItemList
            className={'DownloadItemList'}
            itemClass={item}
            scrollable={true}
            itemList={displayList}
            onItemClick={async (ev) => {
                const item = avitem(ev);
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
                const rs = await uploadAction.afterUpload()
                if (rs) return;
                readItems();
            }}
            errorCallback={(err) => {
                if (err) Toast(err);
                readItems();
            }}
            uploadSequence={uploadSequence}
            checkNameCallback={(file, dialogContext) => uploadAction.checkFile(file, dialogContext)}
        />
        {(type === "user" && showUpload) ?
            <DynamicButton
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

DownloadItemList.propTypes = {
    type: PropTypes.string,
    selectCallback: PropTypes.func,
    uploadSequence: PropTypes.number,
    infoMode: PropTypes.number,
    noExtra: PropTypes.bool,
    showUpload: PropTypes.bool,
    itemActions: PropTypes.instanceOf(ItemActions),
    autoreload: PropTypes.number
}