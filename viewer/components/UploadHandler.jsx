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
import PropTypes from 'prop-types';
import Button from "./Button";
import Requests, {prepareUrl} from "../util/requests";
import AndroidEventHandler from "../util/androidEventHandler";
import Helper from "../util/helper";
import {useDialogContext} from "./DialogContext";
import base from "../base";

const MAXUPLOADSIZE=100000;

export const readTextFile=async (file) => {
    if (file.size) {
        if (file.size > MAXUPLOADSIZE) {
            return Promise.reject("file is to big, max allowed: " + MAXUPLOADSIZE);
        }
    }
    if (!window.FileReader) {
        return Promise.reject("your browser does not support FileReader, cannot upload");
    }
    return await new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onloadend = () => {
            let content = reader.result;
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
export const uploadClick=(callback,type)=>{
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
export const extensionListToAccept=(extList)=>{
    if (! extList) return;
    let rt="";
    for (let ext of extList){
        if (! ext.startsWith('.')){ext="."+ext;}
        if (rt) rt+=","+ext;
        else rt=ext;
    }
    return rt;
}

const UploadHandler = (props) => {
    const dialogContext=useDialogContext();
    const xhdrRef = useRef();
    const androidSequence = useRef(0);
    const androidCopyParam=useRef();
    const uploadSequenceRef = useRef(0);
    const [stateHelper, setStateHelper] = useState({});
    const error = useCallback((err) => {
        props.errorCallback && props.errorCallback(err);
        setStateHelper({});
    }, [props.errorCallback]);
    const checkName= async (file)=>{
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
    const uploadServer = useCallback((file, name, type, opt_options, opt_param) => {
        let url = prepareUrl({
            ...opt_options,
            type:type,
            command:'upload',
            name:name
        })
        let currentSequence = uploadSequenceRef.current;
        Requests.uploadFile(url, file, {
            starthandler: function (param, xhdr) {
                if (uploadSequenceRef.current !== currentSequence) {
                    if (xhdr) xhdr.abort();
                    return;
                }
                xhdrRef.current=xhdr;
                setStateHelper({total:0});
            },
            errorhandler: function (param, err) {
                if (uploadSequenceRef.current !== currentSequence) return;
                error(err);
            },
            progresshandler: function (param, ev) {
                if (uploadSequenceRef.current !== currentSequence) return;
                if (ev.lengthComputable) {
                    setStateHelper((old)=>{return {...old, total: ev.total, loaded: ev.loaded}})
                }
            },
            okhandler: function (param, data) {
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
    const upload = useCallback((file) => {
        if (!file || !props.type) return;
        xhdrRef.current=undefined;
        checkName(file)
            .then((res) => {
                if (res) {
                    if (!props.local) {
                        if (window.avnavAndroid) {
                            androidSequence.current = (new Date()).getTime();
                            const overwrite=(res.options||{}).overwrite;
                            if (window.avnavAndroid.startFileUpload(res.type || props.type,res.name,!!overwrite,androidSequence.current)){
                                xhdrRef.current = {
                                    abort: () => {
                                        window.avnavAndroid.interruptCopy(androidSequence.current);
                                    }
                                };
                                androidCopyParam.current = {
                                    name: res.name
                                }
                                let copyInfo = {
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
                            uploadServer(file, res.name, res.type || props.type, res.options, res)
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

    const androidHandlers=useRef();
    androidHandlers.current= {
        fileCopyPercent: (eventData) => {
            let {event, id} = eventData;
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
    const androidEventHandler=useCallback((eventData)=>{
        let {event, id} = eventData;
        const handler=androidHandlers.current[event];
        if (! handler) return;
        return handler(eventData);
    },[]);
    useEffect(() => {
        const subscriptions = [];
        for (let k in androidHandlers.current) {
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
    let doneStyle = {
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

UploadHandler.propTypes={
    file:     PropTypes.instanceOf(File), //whenever this changes to anything different from last
                                          //a new uplaod will trigger - except for a change to 0
                                          //which will abort
    type:               PropTypes.string,
    local:              PropTypes.bool, //do not prepare for server uploads
    doneCallback:       PropTypes.func, //will be called when a server upload is done with an object
                                        //with name,type (also includes data if local is set)
    errorCallback:      PropTypes.func, //called with error text (or undefined for cancel)
    checkNameCallback:  PropTypes.func, //must resolve an object with name, options and potentially error
                                        //if it rejects or resolves to undefined the operation is cancelled
                                        //if a local upload should be done this could be handled within
                                        //and undefined should be returned
    fixedPrefix:        PropTypes.string
}
export default UploadHandler;

