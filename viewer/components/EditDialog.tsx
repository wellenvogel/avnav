import React, {useEffect, useRef, useState} from "react";
import {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame,
    promiseResolveHelper,
    showPromiseDialog
} from "./OverlayDialog";
// @ts-ignore
import CodeFlask from 'codeflask';
// @ts-ignore
import Prism from "prismjs";
import UploadHandler, {uploadClick} from "./UploadHandler";
import Toast from "./Toast";
import DownloadButton from "./DownloadButton";
import {ConfirmDialog} from "./BasicDialogs";
import Requests from "../util/requests";
import Helper from "../util/helper";
import {useDialogContext} from "./DialogContext";
import {fetchItem, IMAGES, ItemType} from "../util/itemFunctions";
import {ViewDialog} from "./ViewDialog";
import ButtonDefs from "./ButtonDefs";
import {DialogButtonProps} from "./DialogButton";
// @ts-ignore
import ColorDialog from './ColorDialog';

export interface EditDialogProps {
    data:string
    title?:string
    language?:string
    resolveFunction:(data:string) => Promise<void>|void
    saveFunction?:(data:string) => Promise<void>
    fileName?:string,
    showCollapse?:boolean,
    fullscreen?:boolean,
    showColorDialog?:boolean,
}
export const EditDialog = ({data, title, language, resolveFunction,
                               saveFunction, fileName,showCollapse,fullscreen,showColorDialog}:EditDialogProps) => {
    const flask = useRef<typeof CodeFlask>();
    const editElement = useRef();
    const [changed, setChanged] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const everChanged=useRef(false);
    if (changed)everChanged.current=true;
    const dialogContext = useDialogContext();
    const [uploadFile, setUploadFile] = useState(undefined);
    const languageImpl=language||languageMap[Helper.getExt(fileName)]||'markup';
    useEffect(() => {
        flask.current = new CodeFlask(editElement.current, {
            language: languageImpl,
            lineNumbers: true,
            defaultTheme: false,
            noInitialCallback: true,
            highLighter: Prism.highlightElement
        });
        //this.flask.addLanguage(language,Prism.languages[language]);
        if (flask.current) {
            flask.current.updateCode(data||'\n', true);
            flask.current.onUpdate(() => setChanged(true));
        }
    }, [data]);
    const buttonList:DialogButtonProps[]=[
        {
            ...ButtonDefs.Upload,
            onClick: () => {
                setCollapsed(false);
                uploadClick((ev)=>{
                    setUploadFile(ev.target.files[0]);
                })
            },
            close: false
        },
        () => <DownloadButton
            useDialogButton={true}
            localData={() => flask.current.getCode()}
            fileName={fileName}
            close={false}
        ></DownloadButton>,
        {
          ...ButtonDefs.DBPreview,
          onClick: () => {
            dialogContext.showDialog(()=><ViewDialog
                html={flask.current.getCode()}
                title={fileName}
            />)
          },
          visible: languageImpl === 'markup',
          close: false
        },
        {
            ...ButtonDefs.DBSave,
            close: false,
            onClick: () => {
                setChanged(false);
                setCollapsed(false);
                promiseResolveHelper({
                    ok: ()=>{
                        setChanged(false);
                    },
                    err: (e) => {
                        if (e) Toast(e);
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
    ];
    if (showCollapse) {
        const def=collapsed?ButtonDefs.DBShow:ButtonDefs.DBHide;
        buttonList.splice(0,0,{
            ...def,
            close: false,
            onClick: () => {
                setCollapsed(!collapsed);
            }
        })
    }
    if (showColorDialog){
        buttonList.splice(0,0,
            {
                ...ButtonDefs.DBColor,
                onClick:() => {
                    if (! flask.current) return;
                    const el=flask.current.elTextarea;
                    const [start, end] = [el.selectionStart, el.selectionEnd];
                    const current=flask.current.getCode();
                    const selected=current.substring(start, end);
                    dialogContext.showDialog(()=><ColorDialog
                        value={selected}
                        resolveFunction={(color:string)=>{
                            if (!color) return;
                            const newString=current.substring(0,start)+color+current.substring(end);
                            flask.current.updateCode(newString,true);
                        }}
                    ></ColorDialog>)
                },
                close: false
            })
    }
    return <DialogFrame fullscreen={Helper.unsetorTrue(fullscreen)} title={title || fileName } className={Helper.concatsp("editFileDialog",collapsed?"collapsed":undefined)}>
        <UploadHandler
            file={uploadFile}
            local={true}
            type={'user'}
            doneCallback={(data) => {
                setUploadFile(undefined);
                showPromiseDialog(dialogContext, ConfirmDialog,{text:"overwrite with " + data.name + " ?"})
                    .then(() => {
                        flask.current.updateCode(data.data, true);
                        setChanged(true);
                    }, () => {
                    })
            }}
            checkNameCallback={(file) => {
                return {name: (file||{}).name}
            }}
            errorCallback={(err) => {
                setUploadFile(undefined);
                Toast(err)
            }}
        />
        <div className={"edit"} ref={editElement}></div>
        <DialogButtons buttonList={buttonList}></DialogButtons>
    </DialogFrame>
}


export const uploadFromEdit = async (name:string, data:string, overwrite:boolean,type:string) => {
    try {
        await Requests.postPlain({
            request: 'api',
            command: 'upload',
            type: type,
            name: name,
            overwrite: overwrite,
            completeName: true
        }, data);
    } catch (e) {
        Toast(e);
        throw e;
    }
}

export interface EditDialogWithSaveProps extends EditDialogProps{
    type:string
}

export const EditDialogWithSave=(props:EditDialogWithSaveProps)=>{
    return <EditDialog
        {...props}
        resolveFunction={async (data)=>{
            await uploadFromEdit(props.fileName,data,true,props.type);
            await props.resolveFunction(data);
        }}
        saveFunction={async (data)=> await uploadFromEdit(props.fileName,data,true,props.type)}
    />

}
export const EditDialogWithSaveAndDownload=(props:Omit<EditDialogWithSaveProps,'data'>)=>{
    const [data,setData]=useState('');
    useEffect(() => {
        fetchItem({type:props.type as ItemType,name:props.fileName})
            .then((itemData)=>setData(itemData))
            .catch((e)=>Toast(e));
    }, [props.fileName,props.type]);
    return <EditDialogWithSave {...props} data={data}/>
}


export const getTemplate=(name:string)=>{
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
export const languageMap:Record<string, string> = {
    js: 'js',
    mjs:'js',
    json: 'json',
    html: 'markup',
    css: 'css',
    xml: 'markup',
    gpx: 'markup',
    txt: undefined
};
export const VIEWABLES = Object.keys(languageMap).concat(IMAGES);
export const EDITABLES = Object.keys(languageMap);
export const MAXEDITSIZE = 1000000;