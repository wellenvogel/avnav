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
import Page, {PageFrame, PageLeft} from '../components/Page.tsx';
import Requests, {prepareUrl} from '../util/requests.js';
import Mob from '../components/Mob.ts';
import ItemList from "../components/ItemList";
import {useTimer} from "../util/UiHelper";
import {ChildStatus, statusTextToImageUrl} from "../components/StatusItems";
import globalstore from "../util/globalstore";
import keys from '../util/keys';
import DB from "../components/DialogButton";
import {DialogButtons, DialogFrame, showDialog, showPromiseDialog} from "../components/OverlayDialog";
import Toast from "../components/Toast";
import globalStore from "../util/globalstore";
import LogDialog from "../components/LogDialog";
import UploadHandler, {extensionListToAccept, uploadClick} from "../components/UploadHandler";
import ImportDialog, {
    checkExt,
    getAcceptedExtensions,
    getAcceptFromExtensions,
    readImportExtensions
} from "../components/ImportDialog";
import Helper from "../util/helper";
import EditHandlerDialog from "../components/EditHandlerDialog";
import DownloadButton from "../components/DownloadButton";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {useDialogContext} from "../components/DialogContext";



const ImporterPage = (props) => {
    return <PageFrame {...props} title={"old importer"}></PageFrame>
    /*
    const history=useHistory();
    const [uploadFile, setUploadFile] = useState(undefined);
    const [isActive,setIsActive]=useState(false);
    const chartImportExtensions=useRef([]);
    const importSubDir=useRef((props.options && props.options.subdir)?props.options.subdir:undefined);
    const dialogContext = useDialogContext();
    const activeButtons = [
        {
            name: 'DownloadPageUpload',
            visible: globalStore.getData(keys.properties.connectedMode, true),
            onClick: () => {
                uploadClick((ev)=>setUploadFile(ev.target.files[0]),
                    extensionListToAccept(getAcceptedExtensions(chartImportExtensions.current))
                );
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
        Mob.mobDefinition(history),
        {
            name: 'Cancel',
            onClick: () => {
                history.pop()
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
                resolveFunction={(oprops) => {
                    const subdir=(oprops||{}).subdir;
                    if (subdir !== importSubDir.current) {
                        importSubDir.current=subdir;
                    }
                    dprops.resolveFunction({name: oprops.name, type: 'import', options: {subdir: subdir}});
                }}
                name={name}
                allowSubDir={importConfig.subdir}
                subdir={importSubDir.current}
            />
        );

    }, [])
    return <PageFrame id={props.id}>
        <PageLeft title={"Chart Converter"} >
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
                    setUploadFile(undefined);
                }}
                errorCallback={
                    (err) => {
                        setUploadFile(undefined);
                        if (err) Toast(err);
                    }}
                file={uploadFile}
                checkNameCallback={(file)=>checkNameForUpload(file.name)}
            />
        </PageLeft>
        <ButtonList page={props.id} itemList={isActive ? activeButtons.concat(buttons) : buttons}/>
    </PageFrame>
     */
}

ImporterPage.propTypes=Page.propTypes;
export default ImporterPage;