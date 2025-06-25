/**
 *###############################################################################
 # Copyright (c) 2012-2024 Andreas Vogel andreas@wellenvogel.net
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

import React, {useCallback, useEffect, useRef, useState} from 'react';
import Page, {PageFrame, PageLeft} from '../components/Page.jsx';
import Requests from '../util/requests.js';
import Mob from '../components/Mob.js';
import ItemList from "../components/ItemList";
import {useTimer} from "../util/GuiHelpers";
import {ChildStatus, statusTextToImageUrl} from "../components/StatusItems";
import globalstore from "../util/globalstore";
import keys from '../util/keys';
import DB from "../components/DialogButton";
import {DialogButtons, DialogFrame, showDialog, showPromiseDialog, useDialogContext} from "../components/OverlayDialog";
import Toast from "../components/Toast";
import globalStore from "../util/globalstore";
import LogDialog from "../components/LogDialog";
import UploadHandler from "../components/UploadHandler";
import ImportDialog, {checkExt, readImportExtensions} from "../components/ImportDialog";
import Helper from "../util/helper";
import EditHandlerDialog from "../components/EditHandlerDialog";
import DownloadButton from "../components/DownloadButton";
import ButtonList from "../components/ButtonList";

const HANDLER_NAME='AVNImporter';
export const IMPORTERPAGE='importerpage';

const MainStatus=(props)=>{
    let canEdit=globalstore.getData(keys.properties.connectedMode);
    return <div className="status" >
        <span className="itemLabel">Converter</span>
        {props.main && <ChildStatus
            {...props.main}
            name='scanner'
            forceEdit={true}
            sub={true}
            showEditDialog={props.showScannerDialog}
        />}
        {props.converter && <ChildStatus
            {...props.converter}
            connected={true}
            forceEdit={canEdit}
            showEditDialog={props.showConverterDialog}
            sub={true}
        />}
    </div>
}
const ImporterItem=(props)=>{
    let canEdit=globalstore.getData(keys.properties.connectedMode);
    return <div className="status" >
        <ChildStatus
            {...props}
            canEdit={canEdit}
            connected={true}
            id={props.name}
            name={props.name.replace(/^conv:/,'')}
        />
        <div className="itemInfo">{props.basename}</div>
        {props.converter &&
        <div className="itemInfo">
            <span className="label">converter:</span>
            <span className="value">{props.converter}</span>
        </div>
        }
        {(props.realname !== undefined) &&
        <div className="itemInfo">
            <span className="label">linked name:</span>
            <span className="value">{props.realname}</span>
        </div>

        }
    </div>
};

const ImportStatusDialog=(props)=>{
    const dialogContext=useDialogContext();
    let isRunning=props.status === 'NMEA';
    return <DialogFrame className="importStatusDialog" title={props.name}>
        <div className="dialogRow">
            <span className="itemInfo">{props.info}</span>
        </div>
        <div className="dialogRow">
            <span className="inputLabel">file</span>
            <span className="itemInfo">{props.basename}</span>
        </div>
        <DialogButtons >
            <DB name="delete"
                onClick={() => {
                    Requests.getJson({
                        type:'import',
                        request:'delete',
                        name:props.name
                    })
                        .then((res)=>{
                            dialogContext.closeDialog()
                        })
                        .catch((e)=>Toast("unable to delete "+e,5000));
                }}
                close={false}
            >
                Delete
            </DB>
            {!isRunning && <DB name="disable"
                               onClick={() => {
                                   Requests.getJson({
                                       type:'import',
                                       request:'api',
                                       command:'disable',
                                       name: props.name
                                   })
                                       .then((res)=>{
                                           dialogContext.closeDialog()
                                       })
                                       .catch((e)=>Toast("unable to disable "+e,5000));
                               }}
                               close={false}
            >
                Disable
            </DB>}
            {isRunning && <DB name="stop"
                              onClick={() => {
                                  Requests.getJson({
                                      type:'import',
                                      request:'api',
                                      command:'cancel',
                                      name: props.name
                                  })
                                      .then((res)=>{
                                          dialogContext.closeDialog()
                                      })
                                      .catch((e)=>Toast("unable to stop "+e,5000));
                              }}
                              close={false}
            >
                Stop
            </DB>}
            {!isRunning && <DB name="restart"
                              onClick={() => {
                                  Requests.getJson({
                                      type:'import',
                                      request:'api',
                                      command:'restart',
                                      name: props.name
                                  })
                                      .then((res)=>{
                                          dialogContext.closeDialog()
                                      })
                                      .catch((e)=>Toast("unable to restart "+e,5000));
                              }}
                               close={false}
            >
                Restart
            </DB>}
            {props.canDownload && <DownloadButton name="download"
                                                  close={false}
                                                  useDialogButton={true}
                                                  url={globalStore.getData(keys.properties.navUrl)+"?request=download&type=import&name="+encodeURIComponent(props.name)}
                                >Download</DownloadButton>
            }
            {props.hasLog &&
            <DB name="log"
                onClick={() => {
                    let url=globalStore.getData(keys.properties.navUrl)+"?request=api&type=import&command=getlog&name="+encodeURIComponent(props.name);
                    dialogContext.replaceDialog((dlprops)=>{
                        return <LogDialog
                            baseUrl={url}
                            title={props.name}
                            {...dlprops}
                        />
                    })
                }}
                close={false}
            >Log</DB>
            }
            <DB name="cancel"
            >Cancel</DB>
        </DialogButtons>
    </DialogFrame>
}

const ConverterDialog=(props)=>{
    const dialogContext=useDialogContext();
    let isRunning=props.status === 'NMEA';
    return <DialogFrame className="importConverterDialog" title={'Converter'}>
        <div className="dialogRow childStatus">
            <img src={statusTextToImageUrl(props.status)}/>
            <span className="itemInfo">{props.info}</span>
        </div>

        <div className="dialogButtons">
            {isRunning && <DB name="stop"
                onClick={() => {
                    Requests.getJson({
                        type:'import',
                        request:'api',
                        command:'cancel'
                    })
                        .then((res)=>{
                            dialogContext.closeDialog();
                        })
                        .catch((e)=>Toast("unable to stop "+e,5000));
                }}
                              close={false}
            >
                Stop
            </DB>}
            {isRunning &&
            <DB name="log"
                onClick={() => {
                    let url=globalStore.getData(keys.properties.navUrl)+"?request=api&type=import&command=getlog&name=_current";
                    dialogContext.replaceDialog((dlprops)=>{
                        return <LogDialog
                            baseUrl={url}
                            title={"Converter"}
                            {...dlprops}
                        />
                    })
                }}
                close={false}
            >Log</DB>
            }
            <DB name="cancel"
            >Cancel</DB>
        </div>
    </DialogFrame>
}

const ScannerDialog=(props)=>{
    const dialogContext=useDialogContext();
    return <DialogFrame className="importScannerDialog" title={'Scanner'}>
        <div className="dialogRow childStatus">
            <img src={statusTextToImageUrl(props.status)}/>
            <span className="itemInfo">{props.info}</span>
        </div>

        <DialogButtons >
            <DB name="reload"
                onClick={()=>{
                    Requests.getJson({
                        type:'import',
                        request:'api',
                        command:'rescan'
                    })
                        .then((res)=>{
                            dialogContext.closeDialog()
                        })
                        .catch((e)=>Toast("unable to trigger rescan "+e,5000));
                }}
                close={false}
            >Rescan</DB>
            <DB name="cancel"
            >Cancel</DB>
        </DialogButtons>
    </DialogFrame>
}
const PageContent=(({showEditDialog,showConverterDialog,showScannerDialog,changeActive})=>{
    const [items,setItems]=useState([]);
    const [disabled, setDisabled] = useState(true);
    const [mainStatus,setMainStatus]=useState({});
    const lastActive=useRef(false);
    const handleStatus=(items,error)=>{
        let mainStatus = {};
        setItems(items||[]);
        (items || []).forEach((st) => {
            if (st.name === 'main' || st.name === 'converter') {
                mainStatus[st.name] = st;
            }
        })
        setMainStatus(mainStatus);
        setDisabled(error)
        const isActive=!error && !!mainStatus.main;
        if (isActive !== lastActive.current){
            if (changeActive) changeActive(isActive);
            lastActive.current=isActive;
        }
    }
    const timer = useTimer((seq) => {
        Requests.getJson({
            request: 'list',
            type: 'import'
        }).then((json) => {
            handleStatus(json.items);
            timer.startTimer(seq);
        })
            .catch((e) => {
                handleStatus(undefined,true);
                timer.startTimer(seq)
            })
    }, 1000, true);

    let isActive=!disabled && !!mainStatus.main;
    if(!isActive) return <div className="importerInfo">Importer inactive</div>;
        return <React.Fragment>
        <MainStatus
            {...mainStatus}
            showConverterDialog={() => showConverterDialog(mainStatus.converter)}
            showScannerDialog={() => showScannerDialog(mainStatus.main)}
        />
        <ItemList
            scrollable={true}
            itemList={items}
            itemCreator={(item) => {
                if (!item.name || !item.name.match(/^conv:/)) return null;
                return (iprops) => {
                    return <ImporterItem
                        {...iprops}
                        showEditDialog={(handlerId, id)=>{
                            if (!items) return;
                            for (let k = 0; k < items.length; k++) {
                                if (items[k].name === id) {
                                    showEditDialog(items[k]);
                                    return;
                                }
                            }
                        }}
                    />
                }
            }}
        />
    </React.Fragment>
})

const ImporterPage = (props) => {
    const [uploadSequence, setUploadSequence] = useState(0);
    const [isActive,setIsActive]=useState(false);
    const chartImportExtensions=useRef([]);
    const importSubDir=useRef((props.options && props.options.subdir)?props.options.subdir:undefined);
    const dialogContext = useRef();
    const activeButtons = [
        {
            name: 'DownloadPageUpload',
            visible: globalStore.getData(keys.properties.connectedMode, true),
            onClick: () => {
                setUploadSequence(uploadSequence + 1);
            }
        }
    ]
    const buttons = [
        {
            name: 'Edit',
            onClick: () => {
                showEditHandlerDialog()
            }
        },
        Mob.mobDefinition(props.history),
        {
            name: 'Cancel',
            onClick: () => {
                props.history.pop()
            }
        }
    ];

    useEffect(() => {
        readImportExtensions()
            .then((extList) => {
                chartImportExtensions.current=extList || [];
            });
    }, []);

    const showEditHandlerDialog = useCallback(() => {
        showDialog(dialogContext,(dprops) => <EditHandlerDialog
            {...dprops}
            title="Edit Importer Settings"
            handlerName={HANDLER_NAME}
        />);
    }, []);
    const showConverterDialog = useCallback((converter) => {
        showDialog(dialogContext, (dprops) => {
                return <ConverterDialog
                    {...dprops}
                    {...converter}
                />
            }
        )
    }, []);
    const showScannerDialog = useCallback((scanner) => {
        showDialog(dialogContext,(dprops) => <ScannerDialog
                {...dprops}
                {...scanner}
            />
        )
    }, []);
    const showImportDialog = useCallback((item) => {
        showDialog(dialogContext,(dprops) => <ImportStatusDialog
            {...dprops}
            {...item}
        />);
    }, []);
    const checkNameForUpload = useCallback((name) => {
        let ext = Helper.getExt(name);
        let importConfig = checkExt(ext, chartImportExtensions.current);
        if (!importConfig.allow) return Promise.reject("unknown chart type " + ext);
        return showPromiseDialog(dialogContext, (dprops) => <ImportDialog
                {...dprops}
                allowNameChange={true}
                resolveFunction={(oprops, subdir) => {
                    if (subdir !== importSubDir.current) {
                        importSubDir.current=subdir;
                    }
                    dprops.resolveFunction({name: oprops.name, type: 'import', uploadParameters: {subdir: subdir}});
                }}
                name={name}
                allowSubDir={importConfig.subdir}
                subdir={importSubDir.current}
            />
        );

    }, [])
    return <PageFrame id={IMPORTERPAGE}>
        <PageLeft title={"Chart Converter"} dialogCtxRef={dialogContext} >
            <PageContent
                showEditDialog={showImportDialog}
                showConverterDialog={showConverterDialog}
                showScannerDialog={showScannerDialog}
                changeActive={(newActive)=>{
                    if (isActive !== newActive) setIsActive(newActive);
                }}
            />
            <UploadHandler
                local={false}
                type={'chart'}
                doneCallback={() => {

                }}
                errorCallback={
                    (err) => {
                        if (err) Toast(err);
                    }}
                uploadSequence={uploadSequence}
                checkNameCallback={(name)=>checkNameForUpload(name)}
            />
        </PageLeft>
        <ButtonList itemList={isActive ? activeButtons.concat(buttons) : buttons}/>
    </PageFrame>
}

ImporterPage.propTypes=Page.propTypes;
export default ImporterPage;