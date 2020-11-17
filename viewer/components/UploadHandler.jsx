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
import {stateHelper} from "./OverlayDialog";
import Button from "./Button";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import Requests from "../util/requests";
import Toast from "./Toast";



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
        this.fileRef=null;

    }
    uploadServer(file){
        let self=this;
        if (! file || ! this.props.type) return;
        let url=globalStore.getData(keys.properties.navUrl)
            + "?request=upload&type="+this.props.type
            +"&name=" + encodeURIComponent(file.name);
        let currentSequence=this.props.uploadSequence;
        Requests.uploadFile(url, file, {
            self: self,
            starthandler: function(param,xhdr){
                if (self.props.uploadSequence !== currentSequence){
                    if (xhdr) xhdr.abort();
                    return;
                }
                self.stateHelper.setState({
                    xhdr:xhdr
                });
            },
            errorhandler: function (param, err) {
                if (self.props.uploadSequence !== currentSequence) return;
                self.stateHelper.setState({},true);
                Toast("upload failed: " + err);
                if (self.props.errorCallback){
                    self.props.errorCallback(err);
                }
            },
            progresshandler: function (param, ev) {
                if (self.props.uploadSequence !== currentSequence) return;
                if (ev.lengthComputable) {
                    self.stateHelper.setState({
                            total:ev.total,
                            loaded: ev.loaded
                        });
                }
            },
            okhandler: function (param, data) {
                if (self.props.uploadSequence !== currentSequence) return;
                self.stateHelper.setState({},true);
                if (self.props.doneCallback){
                    self.props.doneCallback();
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
        //trigger re-render of file input, in it's ref we send the click event
        this.setState({
            uploadSequence:this.props.uploadSequence
        })

    }
    componentDidMount() {
        this.checkForUpload();
    }

    componentDidUpdate() {
        this.checkForUpload();
    }
    fileChange(ev){
        ev.stopPropagation();
        let fileObject=ev.target;
        if (fileObject.files && fileObject.files.length > 0){
            this.uploadServer(fileObject.files[0]);
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
                <form className="hiddenUpload" method="post">
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
                </form>
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
                            this.props.errorCallback();
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
    doneCallback:       PropTypes.func, //will be called with the data for local=true, otherwise
                                  //with true
    errorCallback:      PropTypes.func //called with error text (or undefined for cancel)
}
export default UploadHandler;

