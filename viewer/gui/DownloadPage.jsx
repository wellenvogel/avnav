/**
 * Created by andreas on 02.05.14.
 */

import {useStoreState} from '../hoc/Dynamic.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useState} from 'react';
import {PageFrame, PageLeft} from '../components/Page.jsx';
import Mob from '../components/Mob.js';
import {createItemActions} from '../components/FileDialog';
import {useHistory} from "../components/HistoryProvider";
import ButtonList from "../components/ButtonList";
import {DownloadItemList} from "../components/DownloadItemList";

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