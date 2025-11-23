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

import {createItemActions, FileDialog} from "./FileDialog";
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
const DownloadItem = (props) => {

    let actions = createItemActions(props);
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
                    { ! props.noInfo && <div className="date">{actions.getTimeText(props)}</div>}
                    <div className="info">{actions.getInfoText(props)}</div>
                </div>
                {! props.noInfo &&
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
export const DownloadItemList = ({type, selectCallback, uploadSequence,noInfo,noExtra,showUpload,filter}) => {
    const [items, setItems] = useState([]);
    const readItems = useCallback(async () => {
        const items = await listItems(type);
        if (type === 'chart' && !noExtra) {
            items.push(DEFAULT_OVERLAY_CHARTENTRY)
        }
        if (type !== 'plugins') {
            items.sort(itemSort);
        }
        if (filter) {
            const filtered = [];
            items.forEach(item => {
                const ferr = filter(item.name);
                if (!ferr) filtered.push(item);
            })
            setItems(filtered);
        } else {
            setItems(items);
        }
    }, [type])
    useEffect(() => {
        readItems().then(() => {
        }, (err) => Toast(err));
    }, [type])
    const dialogContext = useDialogContext();
    const itemActions = createItemActions(type);
    const createItem = useCallback(async () => {
        const actions = itemActions;
        const accessor = (data) => actions.nameForCheck(data);
        const checker = (name) => {
            if (filter){
                const ferr=filter(name);
                if (ferr){
                    return {
                        error:ferr
                    }
                }
            }
            checkName(name, items, accessor);
        }
        const res = await showPromiseDialog(undefined, (dprops) => <ItemNameDialog
            {...dprops}
            title={'enter filename'}
            checkName={checker}
            mandatory={true}
        />);
        const name = (res || {}).name;
        if (!name) return;
        const template = getTemplate(name);
        if (template) {
            await showPromiseDialog(undefined, (dprops) => <EditDialogWithSave
                {...dprops}
                type={'user'}
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
    }, [type, items])
    const uploadAction = itemActions.getUploadAction();
    return <React.Fragment>
        <ItemList
            itemClass={(ip)=><DownloadItem
                {...ip}
                noInfo={noInfo}
            />}
            scrollable={true}
            itemList={items}
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
                    createItem();
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
    noInfo: PropTypes.bool,
    noExtra: PropTypes.bool,
    showUpload: PropTypes.bool,
    filter: PropTypes.func,
}

export const DownloadItemListDialog=({type,selectCallback,showUpload,noInfo,noExtra,filter})=>{
    const actions=createItemActions(type);
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
            filter={filter}
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
    filter:PropTypes.func
}