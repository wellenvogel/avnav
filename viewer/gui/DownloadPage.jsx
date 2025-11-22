/**
 * Created by andreas on 02.05.14.
 */

import Dynamic, {useStoreState} from '../hoc/Dynamic.jsx';
import Button, {DynamicButton} from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useEffect, useState} from 'react';
import Page, {PageFrame, PageLeft} from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import Requests from '../util/requests.js';
import NavHandler from '../nav/navdata.js';
import {showDialog, showPromiseDialog, useDialogContext} from '../components/OverlayDialog.jsx';
import Helper, {avitem, setav} from '../util/helper.js';
import Mob from '../components/Mob.js';
import Addons from '../components/Addons.js';
import UploadHandler  from "../components/UploadHandler";
import {
    createItemActions, listItems, FileDialog
} from '../components/FileDialog';
import {DEFAULT_OVERLAY_CHARTENTRY} from '../components/EditOverlaysDialog';
import {checkName, ItemNameDialog} from "../components/ItemNameDialog";
import {EditDialogWithSave, getTemplate} from "../components/EditDialog";
import {useHistory} from "../components/HistoryProvider";
import ButtonList from "../components/ButtonList";
import PropTypes from "prop-types";
const itemSort=(a,b)=>{
    if (a.time !== undefined && b.time !== undefined){
        return b.time - a.time;
    }
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    return 0;
};

const DownloadItem=(props)=>{

    let actions=createItemActions(props);
    let  cls=Helper.concatsp("listEntry",actions.getClassName(props));
    let dataClass="downloadItemData";
    return(
        <div className={cls} onClick={function(ev){
            props.onClick(setav(ev,{action:'select'}));
        }}>
            {(props.icon)?
                <span className="icon" style={{backgroundImage:"url('"+(props.icon)+"')"}}/>
                :
                <span className={Helper.concatsp('icon',actions.getIconClass(props))}/>
            }
            <div className="itemMain">
                <div className={dataClass}>
                    <div className="date">{actions.getTimeText(props)}</div>
                    <div className="info">{actions.getInfoText(props)}</div>
                </div>
                <div className="infoImages">
                    { actions.canModify(props) && <span className="icon edit"></span>}
                    { actions.showIsServer(props) && <span className="icon server"></span>}
                    { actions.canView(props) && <span className="icon view"></span>}
                </div>
            </div>
        </div>
    );
};

export const DownloadItemList=({type,selectCallback,uploadSequence})=>{
    const [items,setItems]=useState([]);
    const readItems=useCallback(async ()=>{
        if (type !== 'user'){
            const items=await listItems(type);
            if (type === 'chart'){
                items.push(DEFAULT_OVERLAY_CHARTENTRY)
            }
            if (type !== 'plugins') {
                items.sort(itemSort);
            }
            setItems(items);
            return;
        }
        const actions=[listItems(type),Addons.readAddOns()];
        const result=await Promise.allSettled(actions);
        const items=result[0].status==='fulfilled'?
            result[0].value:[];
        if (result[1].status==='fulfilled'){
            items.forEach(item=>{
                if (item.url){
                    if (Addons.findAddonByUrl(result[1].value,item.url)){
                        item.isAddon=true;
                    }
                }
            })
        }
        items.sort(itemSort);
        setItems(items);
    },[type])
    useEffect(()=>{
        readItems().then(()=>{},(err)=>Toast(err));
    },[type])
    const dialogContext=useDialogContext();
    const itemActions=createItemActions(type);
    const createItem = useCallback(async () => {
        const actions = itemActions;
        const accessor = (data) => actions.nameForCheck(data);
        const checker = (name) => checkName(name, items, accessor);
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
    const uploadAction=itemActions.getUploadAction();
    return <React.Fragment>
    <ItemList
    itemClass={DownloadItem}
    scrollable={true}
    itemList={items}
    onItemClick={async (ev)=>{
        const item=avitem(ev);
        if (selectCallback){
            return selectCallback(ev);
        }
        showDialog(dialogContext,()=>
            <FileDialog
                current={item}
            />,()=>{
                readItems();
        });
    }}
    />
    <UploadHandler
        local={uploadAction.hasLocalAction()}
        type={type}
        doneCallback={async (param)=>{
            const rs=await uploadAction.afterUpload()
            if (rs) return;
            readItems();
        }}
        errorCallback={(err)=>{if (err) Toast(err);readItems();}}
        uploadSequence={uploadSequence}
        checkNameCallback={(file,dialogContext)=>uploadAction.checkFile(file,dialogContext)}
    />
    {(type === "user")?
        <DynamicButton
            className="fab"
            name="DownloadPageCreate"
            onClick={()=>{
                createItem();
            }}
            storeKeys={{visible:keys.properties.connectedMode}}
        />
        :
        null}
</React.Fragment>
}

DownloadItemList.propTypes = {
    type: PropTypes.string,
    selectCallback: PropTypes.func,
    uploadSequence: PropTypes.number,
}
const DownloadPage=(props)=>{
    useStoreState(keys.gui.global.reloadSequence)
    const [type,setType]=useState(
        (props.options && props.options.downloadtype)?
                    props.options.downloadtype:'chart');
    const [uploadSequence,setUploadSequence]=useState(0);
    const history=useHistory();
    const changeType=useCallback((newType)=>{
        if (newType === type) return;
        setType(newType);
        //store the new type to have this available if we come back
        history.replace(
            history.currentLocation(),
            {
                downloadtype:newType
            }
        )
    },[type,history])
    const actions=createItemActions(type);
    const getButtonParam=useCallback((bName,bType,overflow, opt_capability)=>{
        let visible=type === bType || ! (props.options && props.options.allowChange === false);
        if (opt_capability){
            visible = visible && globalStore.getData(opt_capability,false);
        }
        return {
            name: bName,
            toggle:  type === bType,
            visible:  visible,
            onClick: () => changeType(bType),
            overflow: overflow === true
        };
    },[type]);
    const getButtons=()=>{
        let rt=[
            getButtonParam('DownloadPageCharts','chart'),
            {
                name: 'DownloadPageImporter',
                onClick: ()=>this.props.history.push('importerpage'),
                storeKeys: {
                    visible: keys.gui.capabilities.uploadImport
                }
            },
            getButtonParam('DownloadPageTracks','track'),
            getButtonParam('DownloadPageRoutes','route'),
            getButtonParam('DownloadPageLayouts','layout'),
            getButtonParam('DownloadPageSettings','settings',true,keys.gui.capabilities.uploadSettings),
            getButtonParam('DownloadPageUser','user',true),
            getButtonParam('DownloadPageImages','images',true),
            getButtonParam('DownloadPageOverlays','overlay',true),
            getButtonParam('DownloadPagePlugins','plugins',true,keys.gui.capabilities.uploadPlugins),
            {
                name:'DownloadPageUpload',
                visible: actions.showUpload(),
                onClick:()=>{
                    setUploadSequence(uploadSequence+1);
                }
            },
            Mob.mobDefinition(history),
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        return rt;
    }
        return (
            <PageFrame id={'downloadpage'}>
                <PageLeft title={actions.headline}>
                    <DownloadItemList
                        type={type}
                        uploadSequence={uploadSequence}
                    />
                </PageLeft>
                <ButtonList
                    itemList={getButtons()}
                />
            </PageFrame>
        )
}

export default DownloadPage;