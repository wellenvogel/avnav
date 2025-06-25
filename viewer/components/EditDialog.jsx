import React, {useEffect, useRef, useState} from "react";
import {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame,
    promiseResolveHelper,
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
import Requests from "../util/requests";
import Helper from "../util/helper";

export const EditDialog = ({data, title, language, resolveFunction, saveFunction, fileName}) => {
    const flask = useRef();
    const editElement = useRef();
    const [changed, setChanged] = useState(false);
    const everChanged=useRef(false);
    if (changed)everChanged.current=true;
    const dialogContext = useDialogContext();
    const [uploadSequence, setUploadSequence] = useState(0);
    const languageImpl=language||languageMap[Helper.getExt(fileName)];
    useEffect(() => {
        flask.current = new CodeFlask(editElement.current, {
            language: languageImpl || 'html',
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
export const uploadFromEdit = async (name, data, overwrite,type) => {
    try {
        await Requests.postPlain({
            request: 'upload',
            type: type,
            name: name,
            overwrite: overwrite
        }, data);
    } catch (e) {
        Toast(e);
        throw e;
    }
}

export const EditDialogWithSave=(props)=>{
    return <EditDialog
        {...props}
        resolveFunction={async (data)=>{
            await uploadFromEdit(props.fileName,data,true,props.type);
            props.resolveFunction(data);
        }}
        saveFunction={async (data)=> await uploadFromEdit(props.fileName,data,true,props.type)}
    />

}
EditDialogWithSave.propTypes={...EditDialog.propTypes,
    type: PropTypes.string.isRequired
}

export const getTemplate=(name)=>{
    if (! name) return;
    const ext=Helper.getExt(name);
    if (ext === 'html'){
        return `<html>\n<head>\n</head>\n<body>\n<p>Template ${name}</p>\n</body>\n</html>`;
    }
    if (ext === 'json'){
        return JSON.stringify({});
    }
    if (ext === 'gpx'){
        return `
<?xml version="1.0" encoding="UTF-8"?>
<gpx>
<!--<rte>
    <name>default</name>
    <rtept lon="13.540864957547065" lat="54.29884367794568">
    <name>WP 1</name>
    </rte
</rte> -->
<!--<trk>
    <name>avnav-track-2025-04-08</name>
    <trkseg>
        <trkpt lat="54.340983000" lon="13.507483000" ><time>2025-04-08T04:38:57Z</time><course>141.6</course><speed>1.76</speed></trkpt>
    </trkseg>
    </trk> -->
</gpx>
        `
    }
} //add all extensions here that we can edit
//if set to undefined we will edit them but without highlighting
export const languageMap = {
    js: 'js',
    json: 'json',
    html: 'markup',
    css: 'css',
    xml: 'markup',
    gpx: 'markup',
    txt: undefined
};