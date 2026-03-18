/**
 * Created by andreas on 02.05.14.
 */

import {useStoreState} from '../hoc/Dynamic';
import globalStore from '../util/globalstore';
// @ts-ignore
import keys from '../util/keys.jsx';
import React, {useCallback, useState} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
// @ts-ignore
import {createItemActions} from '../components/FileDialog';
import {useHistory} from "../components/HistoryProvider";
// @ts-ignore
import ButtonList from "../components/ButtonList";
// @ts-ignore
import {DownloadItemList} from "../components/DownloadItemList";
import {PAGEIDS} from "../util/pageids";
import base from "../base";
// @ts-ignore
import {extensionListToAccept, uploadClick} from "../components/UploadHandler";
import {ButtonEvent, DynamicButtonProps, updateButtons} from "../components/Button";
import Helper from "../util/helper";
import DownloadPageButtons from "./DownloadPageButtons";
import {HistoryEntry} from "../util/history";

export interface DownloadPageProps extends PageProps {
    options: {
        allowChange?: boolean;
        downloadtype?:string;
        allowedTypes?: string[];
    }
}


const DownloadPage=(props:DownloadPageProps)=>{
    useStoreState(keys.gui.global.reloadSequence)
    const options=props.options||{};
    const [type,setType]=useState(()=>{
        let initialType='chart';
        if (options.downloadtype){ initialType=options.downloadtype; }
        else if (options.allowedTypes && options.allowedTypes.length){
                initialType=options.allowedTypes[0];
        }
        return initialType;
    });
    const [uploadFile,setUploadFile]=useState(undefined);
    const history=useHistory();
    const changeType=useCallback((newType:string)=>{
        if (newType === type) return;
        if (!Helper.unsetorTrue(options.allowChange)) return;
        setUploadFile(undefined);
        setType(newType);
        //store the new type to have this available if we come back
        const current:HistoryEntry=history.currentLocation(true) as HistoryEntry;
        history.replace(
            current.location,
            {
                ...current.options,
                downloadtype:newType
            }
        )
    },[type,history])
    const actions=createItemActions(type);
    useCallback((bName:string,bType:string,overflow?:boolean, opt_capability?: string)=>{
        let visible=type === bType || (
            Helper.unsetorTrue(options.allowChange)
            && (! options.allowedTypes || ! options.allowedTypes.length || options.allowedTypes.includes(bType))
        )
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
    const updateButton=(
        config:Partial<DynamicButtonProps>,
        onClick?:(ev:ButtonEvent) => void,
        ):
        Partial<DynamicButtonProps>=>{
        const update:Partial<DynamicButtonProps>={};
        if (config.visible !== false){
            update.visible=(type === config.type) || (
                Helper.unsetorTrue(options.allowChange)
                && (! options.allowedTypes || ! options.allowedTypes.length || options.allowedTypes.includes(config.type))
            )
        }
        if (config.type){
            update.onClick=()=>changeType(config.type);
            update.toggle=type==config.type;
        }
        else{
            update.onClick=onClick;
        }
        return update;
    }
    const getButtons=()=>{
        const rt=updateButtons(DownloadPageButtons, {
            DownloadPageCharts: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageImporter: (config: Partial<DynamicButtonProps>) => updateButton(config,
                () => history.push('importerpage')),
            DownloadPageTracks: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageRoutes: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageLayouts: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageSettings: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageUser: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageImages: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageOverlays: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPagePlugins: (config: Partial<DynamicButtonProps>) => updateButton(config),
            DownloadPageUpload: {
                onClick: async () => {
                    base.log("upload click");
                    const allowed = extensionListToAccept(await actions.getAllowedExtensions());
                    uploadClick((ev: ButtonEvent) => {
                        ev.preventDefault();
                        setUploadFile(ev.target.files[0]);
                    }, allowed);
                },
                visible: actions.showUpload()
            },
            Cancel: {
                onClick: () => {
                    history.pop()
                }
            }
        })
        return rt;
    }
        return (
            <PageFrame id={PAGEIDS.DOWNLOAD}>
                <PageLeft title={actions.headline}>
                    <DownloadItemList
                        type={type}
                        uploadFile={uploadFile}
                        autoreload={5000}
                        uploadDone={()=>setUploadFile(undefined)}
                        showCreate={true}
                    />
                </PageLeft>
                <ButtonList
                    page={PAGEIDS.DOWNLOAD}
                    itemList={getButtons()}
                />
            </PageFrame>
        )
}

export default DownloadPage;