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
import {DBCancel, DialogButtons, DialogFrame, showDialog, showPromiseDialog, useDialogContext} from "./OverlayDialog";
import {checkName, ItemNameDialog} from "./ItemNameDialog";
import {EditDialogWithSave, getTemplate} from "./EditDialog";
import Requests from "../util/requests";
import ItemList from "./ItemList";
import UploadHandler from "./UploadHandler";
import {DynamicButton} from "./Button";
import keys from "../util/keys";
import PropTypes from "prop-types";
import {listItems} from "../util/itemFunctions";

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
    let cls = Helper.concatsp("listEntry", actions.getClassName(props));
    let dataClass = "downloadItemData";
    return (
        <div className={cls} onClick={function (ev) {
            props.onClick(setav(ev, {action: 'select'}));
        }}>
            {(props.icon) ?
                <span className="icon" style={{backgroundImage: "url('" + (props.icon) + "')"}}/>
                :
                <span className={Helper.concatsp('icon', actions.getIconClass(props))}/>
            }
            <div className="itemMain">
                <div className={dataClass}>
                    { (infoMode === DownloadItemInfoMode.ALL) && <div className="date">{actions.getTimeText(props)}</div>}
                    <div className="info">{actions.getInfoText(props)}</div>
                </div>
                {(infoMode === DownloadItemInfoMode.ALL ||
                        infoMode === DownloadItemInfoMode.ICONS) &&
                <div className="infoImages">
                    {actions.canModify(props) && <span className="icon edit"></span>}
                    {actions.showIsServer(props) && <span className="icon server"></span>}
                    {actions.canView(props) && <span className="icon view"></span>}
                </div>
                }
            </div>
        </div>
    );
};
export const DownloadItemList = ({type, selectCallback, uploadSequence,infoMode,noExtra,showUpload,itemActions}) => {
    const [items, setItems] = useState([]);
    const readItems = useCallback(async () => {
        const items = await listItems(type);
        setItems(items);
    }, [type])
    useEffect(() => {
        readItems().then(() => {
        }, (err) => Toast(err));
    }, [type])
    const dialogContext = useDialogContext();
    if (!itemActions) itemActions = createItemActions(type);
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
            itemClass={(ip)=><DownloadItem
                {...ip}
                infoMode={infoMode}
                itemActions={itemActions}
            />}
            scrollable={true}
            itemList={displayList}
            onItemClick={async (ev) => {
                const item = avitem(ev);
                setav(ev,{dialogContext:dialogContext});
                if (selectCallback) {
                    if (await Helper.awaitHelper(selectCallback(ev))) return;
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
}

export const DownloadItemListDialog=({type,selectCallback,showUpload,noInfo,noExtra,itemActions})=>{
    const actions=itemActions||createItemActions(type);
    const [uploadSequence, setUploadSequence] = useState(0);
    const buttons=[];
    if (showUpload && actions.showUpload()) {
        buttons.push({
            name: 'upload',
            label: 'Upload',
            onClick: () => {()=>setUploadSequence(uploadSequence+1);},
            close:false
        })
    }
    buttons.push(DBCancel());
    return <DialogFrame title={actions.headline} className={'DownloadItemListDialog'}>
        <DownloadItemList
            type={type}
            selectCallback={selectCallback}
            uploadSequence={uploadSequence}
            showUpload={showUpload}
            noInfo={noInfo}
            noExtra={noExtra}
            itemActions={itemActions}
        />
        <DialogButtons buttonList={
            buttons
        }/>
    </DialogFrame>

}
DownloadItemListDialog.propTypes = {
    type: PropTypes.string,
    selectCallback: PropTypes.func,
    showUpload: PropTypes.bool,
    noInfo: PropTypes.bool,
    noExtra: PropTypes.bool,
    itemActions: PropTypes.instanceOf(ItemActions),
}