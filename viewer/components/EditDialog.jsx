import React, {useEffect, useRef, useState} from "react";
import OverlayDialog, {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame, promiseResolveHelper,
    showPromiseDialog,
    useDialogContext
} from "./OverlayDialog";
import CodeFlask from 'codeflask';
import Prism from "prismjs";
import UploadHandler from "./UploadHandler";
import Toast from "./Toast";
import DownloadButton from "./DownloadButton";
import PropTypes from "prop-types";
import {ConfirmDialog} from "./BasicDialogs";

export const EditDialog = ({data, title, language, resolveFunction, saveFunction, fileName}) => {
    const flask = useRef();
    const editElement = useRef();
    const [changed, setChanged] = useState(false);
    const everChanged=useRef(false);
    if (changed)everChanged.current=true;
    const dialogContext = useDialogContext();
    const [uploadSequence, setUploadSequence] = useState(0);
    useEffect(() => {
        flask.current = new CodeFlask(editElement.current, {
            language: language || 'html',
            lineNumbers: true,
            defaultTheme: false,
            noInitialCallback: true,
            highLighter: Prism.highlightElement
        });
        //this.flask.addLanguage(language,Prism.languages[language]);
        flask.current.updateCode(data, true);
        flask.current.onUpdate(() => setChanged(true));
    }, []);
    return <DialogFrame title={title || fileName } className={"editFileDialog"}>
        <UploadHandler
            uploadSequence={uploadSequence}
            local={true}
            type={'user'}
            doneCallback={(data) => {
                showPromiseDialog(dialogContext, ConfirmDialog,{text:"overwrite with " + data.name + " ?"})
                    .then(() => {
                        flask.current.updateCode(data.data, true);
                        setChanged(true);
                    }, () => {
                    })
            }}
            checkNameCallback={(name) => {
                return {name: name}
            }}
            errorCallback={(err) => Toast(err)}
        />
        <div className={"edit"} ref={editElement}></div>
        <DialogButtons buttonList={[
            {
                name: 'upload',
                label: 'Import',
                onClick: () => setUploadSequence((old) => old + 1),
                close: false
            },
            () => <DownloadButton
                useDialogButton={true}
                localData={() => flask.current.getCode()}
                fileName={fileName}
                name={"download"}
                close={false}
            >Download</DownloadButton>,
            {
                name: 'save',
                close: false,
                onClick: () => {
                    setChanged(false);
                    promiseResolveHelper({
                        err: () => {
                            setChanged(true)
                        }
                    }, saveFunction, flask.current.getCode())
                },
                visible: !!saveFunction,
                disabled: !changed
            },
            DBCancel(),
            DBOk(() => {
                    promiseResolveHelper({ok: dialogContext.closeDialog}, resolveFunction, flask.current.getCode());
                }, {disabled: !everChanged.current, close: false}
            )
        ]}></DialogButtons>
    </DialogFrame>
}

EditDialog.propTypes={
    data: PropTypes.string,
    title: PropTypes.string,
    language: PropTypes.string,
    resolveFunction: PropTypes.func,
    saveFunction: PropTypes.func,
    fileName: PropTypes.string
}