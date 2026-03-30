/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
import Button, {ButtonEvent, ButtonEventHandler} from "./Button";
// @ts-ignore
import Requests, {prepareUrl} from "../util/requests";
import AndroidEventHandler from "../util/androidEventHandler";
import {IDialogContext, useDialogContext} from "./DialogContext";
import base from "../base";
// @ts-ignore
import {createItemActions} from './FileDialog';
import {ItemType} from "../util/itemFunctions";
import Toast from "./Toast";


const MAXUPLOADSIZE=100000;

export const readTextFile=async (file:File) => {
    if (file.size) {
        if (file.size > MAXUPLOADSIZE) {
            return Promise.reject("file is to big, max allowed: " + MAXUPLOADSIZE);
        }
    }
    if (!window.FileReader) {
        return Promise.reject("your browser does not support FileReader, cannot upload");
    }
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const content = reader.result;
            if (!content) {
                reject("unable to load file " + file.name);
                return;
            }
            resolve(content);
        };
        reader.onerror = (e) => {
            reject(e);
        }
        reader.readAsText(file);
    });
};
const FI_ID="___uploadInput";
export const uploadClick=(callback:(e:Event)=>void,type?:string)=>{
    let fi=document.getElementById(FI_ID);
    if (fi) {
        fi.remove();
    }
    fi = document.createElement('input');
    fi.setAttribute('type', 'file');
    fi.setAttribute('id',FI_ID);
    if (type) {
        fi.setAttribute('accept', type);
    }
    document.body.appendChild(fi);
    fi.addEventListener('change', e => {
        callback(e);
    })
    fi.click();
}
export const extensionListToAccept=(extList?:string[])=>{
    if (! extList) return;
    let rt="";
    for (let ext of extList){
        if (! ext.startsWith('.')){ext="."+ext;}
        if (rt) rt+=","+ext;
        else rt=ext;
    }
    return rt;
}
export interface CheckNameReturn{
    error?:string;
    name?:string;
    options?:Record<string, string>;
    file?:File;
    type?:string;
}
export interface UploadHandlerProps{
   doneCallback?: (p:{name:string,data?:any,options?:Record<string, any>}|void)=>void,
   errorCallback?:(e:any) => void;
   checkNameCallback?:(file:File,dialogContext?:IDialogContext) => Promise<CheckNameReturn>;
   type:string;
   local?:boolean;
   file?:File
}
const UploadHandler = (props:UploadHandlerProps) => {
    const dialogContext=useDialogContext();
    const xhdrRef = useRef<Partial<XMLHttpRequest>>();
    const androidSequence = useRef(0);
    const androidCopyParam=useRef<Record<string, string>>();
    const uploadSequenceRef = useRef(0);
    const [stateHelper, setStateHelper] = useState<{
        loaded?:number;
        loadedPercent?:boolean;
        total?:number;
    }>({});
    const error = useCallback((err:any) => {
        props.errorCallback && props.errorCallback(err);
        setStateHelper({});
    }, [props.errorCallback]);
    const checkName= async (file:File):Promise<CheckNameReturn>=>{
        if (! props.checkNameCallback){
            return {
                name:file.name,
                file: file
            }
        }
        const rt=await props.checkNameCallback(file,dialogContext);
        if (rt && rt.error) return Promise.reject(rt.error);
        return rt;
    }
    const uploadServer = useCallback((
        file:File,
        name:string,
        type:string,
        opt_options?:Record<string,any>) => {
        const url = prepareUrl({
            ...opt_options,
            type:type,
            command:'upload',
            name:name
        })
        const currentSequence = uploadSequenceRef.current;
        Requests.uploadFile(url, file, {
            starthandler: (_param:any, xhdr:XMLHttpRequest)=> {
                if (uploadSequenceRef.current !== currentSequence) {
                    if (xhdr) xhdr.abort();
                    return;
                }
                xhdrRef.current=xhdr;
                setStateHelper({total:0});
            },
            errorhandler: function (_param:any, err:any) {
                if (uploadSequenceRef.current !== currentSequence) return;
                error(err);
            },
            progresshandler: function (_param:any, ev:ProgressEvent) {
                if (uploadSequenceRef.current !== currentSequence) return;
                if (ev.lengthComputable) {
                    setStateHelper((old)=>{return {...old, total: ev.total, loaded: ev.loaded}})
                }
            },
            okhandler: function () {
                if (uploadSequenceRef.current !== currentSequence) return;
                setStateHelper({});
                if (props.doneCallback) {
                    props.doneCallback({
                        name:name
                    });
                }
            }
        });
    }, [props.doneCallback]);
    const upload = useCallback((file:File) => {
        if (!file || !props.type) return;
        xhdrRef.current=undefined;
        checkName(file)
            .then((res) => {
                if (res) {
                    if (!props.local) {
                        // @ts-ignore
                        if (window.avnavAndroid) {
                            androidSequence.current = (new Date()).getTime();
                            const overwrite=(res.options||{}).overwrite;
                            // @ts-ignore
                            if (window.avnavAndroid.startFileUpload(res.type || props.type,res.name,!!overwrite,androidSequence.current)){
                                xhdrRef.current = {
                                    abort: () => {
                                        // @ts-ignore
                                        window.avnavAndroid.interruptCopy(androidSequence.current);
                                    }
                                };
                                androidCopyParam.current = {
                                    name: res.name
                                }
                                const copyInfo = {
                                    // @ts-ignore
                                    total: window.avnavAndroid.getFileSize(androidSequence.current),
                                    loaded: 0,
                                    loadedPercent: true
                                };
                                setStateHelper((old) => {
                                    return {...old, ...copyInfo}
                                });
                            }
                            else{
                                throw new Error("internal Error: upload not ready on Android")
                            }
                        }
                        else {
                            uploadServer(file, res.name, res.type || props.type, res.options)
                        }
                    } else {
                        return readTextFile(file)
                            .then((data) => {
                                if (props.doneCallback) {
                                    props.doneCallback({
                                        name: res.name,
                                        data: data,
                                        options: res.options
                                    })
                                }
                            })
                    }
                }
                else{
                    if (props.doneCallback){
                        props.doneCallback();
                    }
                }
            })
            .catch((err) => {
                error(err);
            });
    }, [props.type]);
    useEffect(() => {
        base.log("retrigger upload, current=",xhdrRef.current);
        if (xhdrRef.current) {
            xhdrRef.current.abort();
            xhdrRef.current = undefined;
        }
        if (! props.file) {
            //cleanup??
            return;
        }
        uploadSequenceRef.current = uploadSequenceRef.current+1;
        base.log("start upload",props.file,uploadSequenceRef.current);
        setStateHelper({});
        upload(props.file);
    },[props.file,props.type,props.local]);

    const androidHandlers=useRef<Record<string,any>>();
    androidHandlers.current= {
        fileCopyPercent: (eventData:{event:string,id:number}) => {
            const {event, id} = eventData;
            if (event === "fileCopyPercent") {
                if (!androidCopyParam.current) return;
                setStateHelper((old) => {
                    return {...old, loaded: id}
                });
            } else {
                //done, error already reported from java side
                setStateHelper({});
                props.doneCallback && props.doneCallback({name: androidCopyParam.current.name});
                androidCopyParam.current = undefined;
            }
        }
    };
    androidHandlers.current.fileCopyDone=androidHandlers.current.fileCopyPercent;
    const androidEventHandler=useCallback((eventData:{event:string,id:string})=>{
        const {event} = eventData;
        const handler=androidHandlers.current[event];
        if (! handler) return;
        return handler(eventData);
    },[]);
    useEffect(() => {
        const subscriptions:string[] = [];
        for (const k in androidHandlers.current) {
            subscriptions.push(AndroidEventHandler.subscribe(k, androidEventHandler));
        }
        return () => {
            subscriptions.forEach((s) => AndroidEventHandler.unsubscribe(s));
            if (xhdrRef.current) xhdrRef.current.abort();

        }
    }, []);

    if (!xhdrRef.current) return null;
    let loaded = stateHelper.loaded;
    let percentComplete = stateHelper.total ? 100 * loaded / stateHelper.total : 0;
    if (stateHelper.loadedPercent) {
        percentComplete = stateHelper.loaded || 0;
        loaded = (stateHelper.loaded * stateHelper.total) / 100;
    }
    const doneStyle = {
        width: percentComplete + "%"
    };
    return (
        <React.Fragment>
            {loaded !== undefined && <div className="downloadProgress">
                <div className="progressContainer">
                    <div className="progressInfo">{(loaded || 0) + "/" + (stateHelper.total || 0)}</div>
                    <div className="progressDisplay">
                        <div className="progressDone" style={doneStyle}></div>
                    </div>
                </div>
                <Button name="Cancel" className="DownloadPageUploadCancel button" onClick={() => {
                    if (xhdrRef.current) xhdrRef.current.abort();
                    setStateHelper({});
                    error("cancelled");
                }}
                />
            </div>}
        </React.Fragment>
    );
}

export interface UploadPropsList{
    type: ItemType,
    uploadFile: File,
    uploadDone: (name?:string) => void
}
export interface UploadPropsHandler{
    type: ItemType,
    file: File,
    doneCallback: (name?:string) => void
}

export const useUploadHelperHandler =(
    type?: ItemType,
    doneCallback?: (name?:string) => void
): [
    UploadPropsHandler,
    ButtonEventHandler,
    (file?: File) => void
] => {
    const actions = createItemActions(type);
    const [uploadFile, setUploadFile] = useState(undefined);
    const clickHandler = async () => {
        const allowed = extensionListToAccept(await actions.getAllowedExtensions());
        uploadClick((ev: ButtonEvent) => {
            ev.preventDefault();
            setUploadFile(ev.target.files[0]);
        }, allowed);
    };
        return [
            {
                type: type,
                file: uploadFile,
                doneCallback: (param?:{name?:string}|string) => {
                    setUploadFile(undefined);
                    let name=param;
                    if (name && typeof name === 'object'){
                        name=name.name;
                    }
                    if (doneCallback) doneCallback(name as string);
                }
            },
            clickHandler,
            setUploadFile
        ]
}

export const useUploadHelper=
        (type?: ItemType,
         doneCallback?: (name?:string) => void):
        [UploadPropsList,
        ButtonEventHandler,
        (file?: File) => void] =>{
    const [props,action,setUploadFile]=useUploadHelperHandler(type,doneCallback);
    return [
        {
            type: type,
            uploadFile:props.file,
            uploadDone:props.doneCallback
        },
        action,
        setUploadFile,
    ]

}

export interface UploadHandlerWithActionProps{
    type: ItemType;
    itemAction?:any;
    file:File,
    doneCallback?: (name?:string,rs?:any) => void;
    errorCallback?: (error?:string) => void;
}

export const UploadHandlerWithActions=(props: UploadHandlerWithActionProps) => {
    const itemActions=props.itemAction||createItemActions(props.type);
    if (! itemActions) {
        return null
    }
    const uploadAction=itemActions.getUploadAction();
    return <UploadHandler
        type={props.type}
        doneCallback={async (param) => {
            const rs = await uploadAction.afterUpload();
            if (props.doneCallback) props.doneCallback(param?param.name:undefined,rs);
        }}
        errorCallback={(err) => {
            if (props.doneCallback) props.doneCallback();
            if (err) Toast(err);
        }}
        file={props.file}
        checkNameCallback={(file, dialogContext) => uploadAction.checkFile(file, dialogContext)}

    />
}

export default UploadHandler;

