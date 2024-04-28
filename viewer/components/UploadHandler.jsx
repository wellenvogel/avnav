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
import React from 'react';
import PropTypes from 'prop-types';
import {stateHelper} from "../util/GuiHelpers";
import Button from "./Button";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import Requests from "../util/requests";
import Toast from "./Toast";
import AndroidEventHandler from "../util/androidEventHandler";

const MAXUPLOADSIZE=100000;

class UploadHandler extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            uploadSequence:0,
            lastClickSequence:0
        }
        this.stateHelper=stateHelper(this,{},'upload');
        this.uploadServer=this.uploadServer.bind(this);
        this.fileChange=this.fileChange.bind(this);
        this.androidSubscriptions=[];

    }

    /**
     * check the filename if an external check function has been provided
     * @param name
     * @returns a Promise
     *      resolves withe an object with name, uploadParameters (object)
     *      or rejects
     */
    checkName(name){
        if (! this.props.checkNameCallback) {
            return new Promise((resolve, reject) => {
                resolve({name: name});
            });
        }
        return this.props.checkNameCallback(name);
    }
    upload(file){
        let self=this;
        if (! file || ! this.props.type) return;
        this.checkName(file.name)
            .then((res)=>{
                if (!this.props.local){
                    this.uploadServer(file,res.name,res.type||this.props.type,res.uploadParameters,res)
                }
                else{
                    this.uploadFileReader(file,res.name,res)
                }
            })
            .catch((err)=>{
                this.props.errorCallback(err);
            });
    }

    uploadFileReader(file, name,param) {
        this.stateHelper.setState({}, true);
        if (file.size) {
            if (file.size > MAXUPLOADSIZE) {
                let error = "file is to big, max allowed: " + MAXUPLOADSIZE;
                this.props.errorCallback(error)
                return;
            }
        }
        if (!window.FileReader) {
            this.props.errorCallback("your browser does not support FileReader, cannot upload");
            return;
        }
        let reader = new FileReader();
        reader.onloadend = () => {
            let content = reader.result;
            if (!content) {
                this.props.errorCallback("unable to load file " + file.name);
                return;
            }
            this.props.doneCallback({data: content, name: name,param:param});


        };
        reader.readAsText(file);
    }
    uploadServer(file, name,type, opt_options,opt_param) {
        let self=this;
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
        let currentSequence = this.props.uploadSequence;
        Requests.uploadFile(url, file, {
            self: self,
            starthandler: function (param, xhdr) {
                if (self.props.uploadSequence !== currentSequence) {
                    if (xhdr) xhdr.abort();
                    return;
                }
                self.stateHelper.setState({
                    xhdr: xhdr
                });
            },
            errorhandler: function (param, err) {
                if (self.props.uploadSequence !== currentSequence) return;
                self.stateHelper.setState({}, true);
                if (self.props.errorCallback) {
                    self.props.errorCallback(err);
                }
            },
            progresshandler: function (param, ev) {
                if (self.props.uploadSequence !== currentSequence) return;
                if (ev.lengthComputable) {
                    self.stateHelper.setState({
                        total: ev.total,
                        loaded: ev.loaded
                    });
                }
            },
            okhandler: function (param, data) {
                if (self.props.uploadSequence !== currentSequence) return;
                self.stateHelper.setState({}, true);
                if (self.props.doneCallback) {
                    self.props.doneCallback({
                        param:opt_param
                    });
                }
            }
        });
    }
    checkForUpload(){
        if (this.state.uploadSequence === this.props.uploadSequence) return;
        //first stop a running upload if any
        let newUpload={};
        let xhdr=this.stateHelper.getValue('xhdr');
        if (xhdr){
            xhdr.abort();
        }
        this.stateHelper.setState(newUpload,true);
        if (avnav.android){
          let newState= {
              uploadSequence:this.props.uploadSequence,
              androidSequence: (new Date()).getTime()
          }
          this.setState(newState);
          avnav.android.requestFile(this.props.type,newState.androidSequence,this.props.local?true:false);
        }
        //trigger re-render of file input, in it's ref we send the click event
        this.setState({
            uploadSequence:this.props.uploadSequence
        })

    }

    /**
     * called back from android if the file was completely read
     * if we had set the "local" flag
     * @param eventData
     */
    androidUploadHandler(eventData) {
        if (!avnav.android) return;
        let {id} = eventData;
        let requestedId = this.state.androidSequence;
        if (id !== requestedId) return;

        let type = this.props.type;
        let filename = avnav.android.getFileName(id);
        if (!filename) return;
        let data = avnav.android.getFileData(id);
        this.checkName(filename)
            .then((res) => {
                this.props.doneCallback({
                    name: res.name,
                    data: data,
                    param: res
                })
            })
            .catch((err) => {
                Toast(err);
            });
    }

    /**
     * called from android when the file selection is ready
     * @param eventData
     */
    androidCopyHandler(eventData) {
        if (!avnav.android) return;
        let requestedId = this.state.androidSequence;
        let {id} = eventData;
        if (id !== requestedId) return;
        let type = this.props.type
        let fileName = avnav.android.getFileName(id);

        this.checkName(fileName)
            .then((res) => {
                let copyInfo = {
                    xhdr: {
                        abort: () => {
                            avnav.android.interruptCopy(id);
                        }
                    },
                    total: avnav.android.getFileSize(id),
                    loaded: 0,
                    loadedPercent: true,
                    param: res
                };
                this.stateHelper.setState(copyInfo, true);
                if (avnav.android.copyFile(id,res.name)) {
                    //we update the file size as with copyFile it is fetched again
                    this.stateHelper.setValue('total', avnav.android.getFileSize(id));
                } else {
                    this.props.errorCallback("unable to upload");
                    this.stateHelper.setState({}, true);
                }
            })
            .catch((err) => {
                avnav.android.interruptCopy(id)
                if (err)this.props.errorCallback(err);
            });

    }
    androidProgressHandler(eventData){
        let {event,id}=eventData;
        if (event === "fileCopyPercent"){
            let old=this.stateHelper.getState();
            if (!old.total) return; //no upload...
            this.stateHelper.setValue('loaded',id);
        }
        else{
            //done, error already reported from java side
            let param=this.stateHelper.getValue('param')
            this.stateHelper.setState({},true);
            this.props.doneCallback({param:param});
        }
    }

    componentDidMount() {
        this.androidUploadHandler=this.androidUploadHandler.bind(this);
        this.androidCopyHandler=this.androidCopyHandler.bind(this);
        this.androidProgressHandler=this.androidProgressHandler.bind(this);
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("uploadAvailable",this.androidUploadHandler));
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("fileCopyReady",this.androidCopyHandler));
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("fileCopyPercent",this.androidProgressHandler));
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("fileCopyDone",this.androidProgressHandler));
        this.checkForUpload();
    }
    componentWillUnmount() {
        this.androidSubscriptions.forEach((token)=> {
            AndroidEventHandler.unsubscribe(token);
        });
        let xhdr=this.stateHelper.getValue('xhdr');
        if (xhdr){
            xhdr.abort();
        }
    }

    componentDidUpdate() {
        this.checkForUpload();
    }
    fileChange(ev){
        ev.stopPropagation();
        let fileObject=ev.target;
        if (fileObject.files && fileObject.files.length > 0){
            this.upload(fileObject.files[0]);
        }
    }
    render(){
        if (!this.state.uploadSequence) return null;
        let props=this.stateHelper.getState();
        let loaded=props.loaded;
        let percentComplete = props.total ? 100 * loaded / props.total : 0;
        if (props.loadedPercent) {
            percentComplete=props.loaded||0;
            loaded=(props.loaded*props.total)/100;
        }
        let doneStyle = {
            width: percentComplete + "%"
        };
        return (
            <React.Fragment>
                {! avnav.android && <form className="hiddenUpload" method="post">
                    <input type="file"
                           ref={(el) => {
                               if (!el) return;
                               if (this.state.uploadSequence !== this.state.lastClickSequence) {
                                   el.click();
                                   this.setState({lastClickSequence: this.state.uploadSequence})
                               }
                           }}
                           name="file"
                           key={this.state.uploadSequence} onChange={this.fileChange}/>
                </form>}
                {this.stateHelper.getValue('xhdr') && <div className="downloadProgress">
                    <div className="progressContainer">
                        <div className="progressInfo">{(loaded || 0) + "/" + (props.total || 0)}</div>
                        <div className="progressDisplay">
                            <div className="progressDone" style={doneStyle}></div>
                        </div>
                    </div>
                    <Button className="DownloadPageUploadCancel button" onClick={() => {
                        if (props.xhdr) props.xhdr.abort();
                        this.stateHelper.setState({}, true);
                        if (this.props.errorCallback) {
                            this.props.errorCallback("cancelled");
                        }
                    }}
                    />
                </div> }
            </React.Fragment>
        );
    }
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
    checkNameCallback:  PropTypes.func //must resolve an object with name, uploadParameters, type
}
export default UploadHandler;

