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
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import Requests from "../util/requests";
import Toast from "./Toast";
import AndroidEventHandler from "../util/androidEventHandler";
import {showPromiseDialog, useDialogContext} from "./OverlayDialog";
import {ItemNameDialog} from "./ItemNameDialog";
import Helper from "../util/helper";
import androidEventHandler from "../util/androidEventHandler";

const MAXUPLOADSIZE=100000;

const showNameDialog=({result,name,checkName,dialogContext})=>{
    if (! result ) return Promise.reject(result);
    if (name){
        if (result.fixedExt && Helper.endsWith(name,"."+result.fixedExt)){
            name=name.substring(0,name.length-result.fixedExt.length-1);
        }
        if (result.fixedPrefix && Helper.startsWith(name,result.fixedPrefix)){
            name=name.substring(result.fixedPrefix.length);
        }
    }
    return showPromiseDialog(dialogContext,(dprops)=><ItemNameDialog
        {...dprops}
        iname={name}
        title={`select new name for ${name}`}
        checkName={checkName}
        fixedPrefix={result.fixedPrefix}
        fixedExt={result.fixedExt}
    />)
        .then((res)=>Promise.resolve(res))
        .catch((err)=>Promise.reject({error:err||'cancelled'}))
}

const UploadHandler = (props) => {
    const dialogContext=useDialogContext();
    const xhdrRef = useRef();
    const androidSequence = useRef(0);
    const androidCopyParam=useRef();
    const uploadSequenceRef=useRef(props.uploadSequence);
    const [lastClickSequence, setLastClickSequence] = useState(0);
    const [stateHelper, setStateHelper] = useState({});

    const error = useCallback((err) => {
        props.errorCallback && props.errorCallback(err);
        setStateHelper({});
    }, [props.errorCallback]);
    /**
     * check the filename if an external check function has been provided
     * @param name
     * @returns a Promise
     *      resolves withe an object with name, uploadParameters (object)
     *      or rejects
     */
    const checkName = useCallback((name) => {
        if (!props.checkNameCallback) {
            return Promise.resolve({name:name});
        }
        let rt = props.checkNameCallback(name);
        if (rt instanceof Promise) return rt.then(
            (res)=>res,
            (err)=>{
            if (err instanceof Object) return Promise.reject(err);
            return Promise.reject({error:err});
        });
        return new Promise((resolve, reject) => {
            if (typeof (rt) === 'object') {
                if (!rt.error) resolve(rt);
                else reject(rt);
            } else reject({error:rt});
        })
    }, [props.checkNameCallback]);
    const checkNameWithDialog=useCallback((name,fixedPrefix)=>{
        return checkName((fixedPrefix||'')+name)
            .then((res)=>res)
            .catch((err)=>{
                if (err.proposal || err.dialog){
                    return showNameDialog({name:name,result:err,checkName,dialogContext})
                }
                else return Promise.reject(err)
            })
    },[checkName,dialogContext])
    const upload = useCallback((file,fixedPrefix) => {
        if (!file || !props.type) return;
        checkNameWithDialog(file.name,fixedPrefix)
            .then((res) => {
                if (!props.local) {
                    uploadServer(file, res.name, res.type || props.type, res.uploadParameters, res)
                } else {
                    uploadFileReader(file, res.name, res)
                }
            })
            .catch((err) => {
                error(err.error);
            });
    }, [props.type]);

    const uploadFileReader = useCallback((file, name, param) => {
        setStateHelper({});
        if (file.size) {
            if (file.size > MAXUPLOADSIZE) {
                let err = "file is to big, max allowed: " + MAXUPLOADSIZE;
                error(err)
                return;
            }
        }
        if (!window.FileReader) {
            error("your browser does not support FileReader, cannot upload");
            return;
        }
        let reader = new FileReader();
        reader.onloadend = () => {
            let content = reader.result;
            if (!content) {
                error("unable to load file " + file.name);
                return;
            }
            props.doneCallback && props.doneCallback({data: content, name: name, param: param});


        };
        reader.readAsText(file);
    }, [props.doneCallback, error]);
    const uploadServer = useCallback((file, name, type, opt_options, opt_param) => {
        let url = globalStore.getData(keys.properties.navUrl)
            + "?request=upload&type=" + type
            + "&name=" + encodeURIComponent(name);
        if (opt_options) {
            for (let k in opt_options) {
                if (opt_options[k] !== undefined) {
                    url += "&" + k + "=" + encodeURIComponent(opt_options[k]);
                }
            }
        }
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
                        param: opt_param
                    });
                }
            }
        });
    }, [props.doneCallback]);
    const checkForUpload = useCallback(() => {
        if (uploadSequenceRef.current === props.uploadSequence) return;
        //first stop a running upload if any
        if (xhdrRef.current) {
            xhdrRef.current.abort();
            xhdrRef.current = undefined;
        }
        if (avnav.android) {
            androidSequence.current = (new Date()).getTime();
            androidCopyParam.current=undefined;
            avnav.android.requestFile(props.type, androidSequence.current, props.local ? true : false);
        }
        uploadSequenceRef.current=props.uploadSequence;
        setStateHelper({}); //trigger render

    }, [props.uploadSequence,props.type,props.local]);
    const androidHandlers=useRef();
    androidHandlers.current= {
        /**
         * called back from android if the file was completely read
         * if we had set the "local" flag
         * @param eventData
         */
        uploadAvailable: (eventData) => {
            if (!avnav.android) return;
            let {id} = eventData;
            let requestedId = androidSequence.current;
            if (id !== requestedId) return;
            let filename = avnav.android.getFileName(id);
            if (!filename) return;
            let data = avnav.android.getFileData(id);
            checkNameWithDialog(filename, props.fixedPrefix)
                .then((res) => {
                    props.doneCallback({
                        name: res.name,
                        data: data,
                        param: res
                    })
                })
                .catch((err) => {
                    Toast(err.error);
                });
        },

        /**
         * called from android when the file selection is ready
         * @param eventData
         */
        fileCopyReady: (eventData) => {
            if (!avnav.android) return;
            let requestedId = androidSequence.current;
            let {id} = eventData;
            if (id !== requestedId) return;
            let fileName = avnav.android.getFileName(id);

            checkNameWithDialog(fileName, props.fixedPrefix)
                .then((res) => {
                    xhdrRef.current = {
                        abort: () => {
                            avnav.android.interruptCopy(id);
                        }
                    };
                    let copyInfo = {
                        total: avnav.android.getFileSize(id),
                        loaded: 0,
                        loadedPercent: true
                    };
                    androidCopyParam.current = res || {};
                    setStateHelper((old) => {
                        return {...old, ...copyInfo}
                    });
                    if (avnav.android.copyFile(id, res.name)) {
                        //we update the file size as with copyFile it is fetched again
                        setStateHelper((old) => {
                            return {...old, total: avnav.android.getFileSize(id)}
                        });
                    } else {
                        error("unable to upload");
                        setStateHelper({});
                    }
                })
                .catch((err) => {
                    avnav.android.interruptCopy(id)
                    if (err) error(err.error);
                });

        },
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
                props.doneCallback && props.doneCallback({param: androidCopyParam.current});
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
    useEffect(() => {
        checkForUpload();
    });
    const fileChange = useCallback((ev,fixedPrefix) => {
        ev.stopPropagation();
        let fileObject = ev.target;
        if (fileObject.files && fileObject.files.length > 0) {
            upload(fileObject.files[0],fixedPrefix);
        }
    }, [props.type,upload]);
    if (!uploadSequenceRef.current) return null;
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
            {!avnav.android && <form className="hiddenUpload" method="post">
                <input type="file"
                       ref={(el) => {
                           if (!el) return;
                           if (uploadSequenceRef.current !== lastClickSequence) {
                               el.click();
                               setLastClickSequence(uploadSequenceRef.current);
                           }
                       }}
                       name="file"
                       key={uploadSequenceRef.current}
                       onChange={(ev) => fileChange(ev,props.fixedPrefix)}/>
            </form>}
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
    uploadSequence:     PropTypes.number, //whenever this changes to anything different from last
                                          //a new uplaod will trigger - except for a change to 0
                                          //which will abort
    type:               PropTypes.string,
    local:              PropTypes.bool,
    doneCallback:       PropTypes.func, //will be called with and object with name,data for local=true, otherwise
                                        //with no parameter
    errorCallback:      PropTypes.func, //called with error text (or undefined for cancel)
    checkNameCallback:  PropTypes.func, //must resolve an object with name, uploadParameters, type
    fixedPrefix:        PropTypes.string
}
export default UploadHandler;

