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

import React from 'react';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import Mob from '../components/Mob.js';
import ItemList from "../components/ItemList";
import GuiHelpers from "../util/GuiHelpers";
import {ChildStatus, StatusItem, statusTextToImageUrl} from "../components/StatusItems";
import globalstore from "../util/globalstore";
import keys from '../util/keys';
import DB from "../components/DialogButton";
import Dialogs from "../components/OverlayDialog";
import Toast from "../components/Toast";
import globalStore from "../util/globalstore";
import LogDialog from "../components/LogDialog";
import UploadHandler from "../components/UploadHandler";
import ImportDialog from "../components/ImportDialog";
import OverlayDialog from "../components/OverlayDialog";
import Helper from "../util/helper";

const ImporterItem=(props)=>{
    return <div className="status">
        <ChildStatus
            {...props}
            connected={globalstore.getData(keys.properties.connectedMode)}
            canEdit={props.canEdit || props.name === 'converter' || props.name.match(/^conv:/)}
            id={props.name}
        />
    </div>
};

const ImportStatusDialog=(props)=>{
    return <div className="importStatusDialog flexInner">
        <h3 className="dialogTitle">{props.name}</h3>
        <div className="dialogRow">
            <span className="itemInfo">{props.info}</span>
        </div>
        <div className="dialogRow">
            <span className="inputLabel">file</span>
            <span className="itemInfo">{props.basename}</span>
        </div>
        <div className="dialogButtons">
            <DB name="delete"
                onClick={() => {
                    Requests.getJson({
                        type:'import',
                        request:'delete',
                        name:props.name
                    })
                        .then((res)=>{
                            props.closeCallback()
                        })
                        .catch((e)=>Toast("unable to delete "+e,5000));
                }}
            >
                Delete
            </DB>
            {props.canDownload && <DB name="download"
                                      onClick={() => {
                                          props.download(props.name);
                                          props.closeCallback();
                                      }}
                                >Download</DB>
            }
            {props.hasLog &&
            <DB name="log"
                onClick={() => {
                    props.logCallback(props.name);
                    props.closeCallback();
                }}
            >Log</DB>
            }
            <DB name="cancel"
                onClick={() => {
                    props.closeCallback();
                }}
            >Cancel</DB>
        </div>
    </div>
}

const ConverterDialog=(props)=>{
    let isRunning=props.status === 'NMEA';
    return <div className="importConverterDialog flexInner">
        <h3 className="dialogTitle">Converter</h3>
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
                            props.closeCallback()
                        })
                        .catch((e)=>Toast("unable to stop "+e,5000));
                }}
            >
                Stop
            </DB>}
            {isRunning &&
            <DB name="log"
                onClick={() => {
                    props.logCallback();
                    props.closeCallback();
                }}
            >Log</DB>
            }
            <DB name="cancel"
                onClick={() => {
                    props.closeCallback();
                }}
            >Cancel</DB>
        </div>
    </div>
}

class ImporterPage extends React.Component{
    constructor(props){
        super(props);
        this.buttons=[
            {
                name:'DownloadPageUpload',
                visible: globalStore.getData(keys.properties.connectedMode,true),
                onClick:()=>{
                    this.setState({uploadSequence:this.state.uploadSequence+1});
                }
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        this.state={
            items:[],
            uploadSequence:0,
            chartImportExtensions:[]
        };
        this.timer=GuiHelpers.lifecycleTimer(this,(seq)=>{
            Requests.getJson({
            request:'list',
            type:'import'
        }).then((json)=>{
                this.setState({items:json.items||[]});
                this.timer.startTimer(seq);
            })
                .catch((e)=>this.timer.startTimer(seq))
        },1000,true)
        this.showEditDialog=this.showEditDialog.bind(this);
        this.checkNameForUpload=this.checkNameForUpload.bind(this);
        this.downloadFrame=undefined;
    }
    componentDidMount(){
        if (!globalStore.getData(keys.gui.capabilities.uploadImport)) return;
        Requests.getJson({
            request:'api',
            type:'import',
            command:'extensions'
        })
            .then((data)=>{
                let extensions=[]
                data.items.forEach((e)=>extensions.push(e.toLowerCase().replace(/^\./,'')))
                this.setState({chartImportExtensions:extensions});
            })
            .catch();

    }
    showConverterDialog(converter){
        Dialogs.dialog((props)=>
            <ConverterDialog
                {...props}
                {...converter}
                logCallback={()=>{
                    if (!this.downloadFrame) return;
                    let url=globalStore.getData(keys.properties.navUrl)+"?request=api&type=import&command=getlog&name=_current";
                    Dialogs.dialog((dlprops)=>{
                        return <LogDialog
                            baseUrl={url}
                            title={"Converter"}
                            {...dlprops}
                        />
                    })
                }}
            />
        )

    }
    showImportDialog(item){
        Dialogs.dialog((props)=>
            <ImportStatusDialog
                {...props}
                {...item}
                logCallback={(id)=>{
                  if (!this.downloadFrame) return;
                  let url=globalStore.getData(keys.properties.navUrl)+"?request=api&type=import&command=getlog&name="+encodeURIComponent(id);
                  Dialogs.dialog((dlprops)=>{
                      return <LogDialog
                          baseUrl={url}
                          title={item.name}
                          {...dlprops}
                      />
                  })
                }}
                download={(id)=>{
                    if (!this.downloadFrame) return;
                    let url=globalStore.getData(keys.properties.navUrl)+"?request=download&type=import&name="+encodeURIComponent(id);
                    this.downloadFrame.src=url;
                }}
            />);
    }
    showEditDialog(handlerId,id,finishCallback){
        if (! this.state.items) return;
        for (let k=0;k<this.state.items.length;k++){
            if (this.state.items[k].name === id){
                if (id === 'converter'){
                    this.showConverterDialog(this.state.items[k]);
                }
                else{
                    this.showImportDialog(this.state.items[k]);
                }
                return;
            }
        }
    }

    checkNameForUpload(name) {
        return new Promise((resolve, reject) => {
                let ext = Helper.getExt(name);
                let importExtensions = this.state.chartImportExtensions;
                if (importExtensions.indexOf(ext) >= 0 && !avnav.android) {
                    OverlayDialog.dialog((props) => {
                        return (
                            <ImportDialog
                                {...props}
                                okFunction={(props, subdir) => {
                                    if (subdir !== this.state.importSubDir) {
                                        this.setState({importSubDir: subdir});
                                    }
                                    resolve({name: name, type: 'import', uploadParameters: {subdir: subdir}});
                                }}
                                cancelFunction={() => reject("canceled")}
                                name={name}
                                allowSubDir={ext!=="zip"}
                                subdir={this.state.importSubDir}
                            />
                        );
                    });
                    return;
                } else reject("unknown chart type " + ext);
            }
        );
    }
    render(){
        let self=this;
        let MainContent=<React.Fragment>
            <ItemList
                itemList={this.state.items}
                itemCreator={(item)=> {
                    return (props)=>{
                        return <ImporterItem
                            {...props}
                            showEditDialog={this.showEditDialog}
                        />
                    }
                }}
                />
            <iframe
                className="downloadFrame"
                onLoad={(ev)=>{
                    let txt=ev.target.contentDocument.body.textContent;
                    if (! txt) return;
                    Toast(txt);
                }}
                src={undefined}
                ref={(el)=>this.downloadFrame=el}/>
            </React.Fragment>;

        return (
            <React.Fragment>
            <Page
                {...self.props}
                id="importerpage"
                title="Chart Converter"
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
                <UploadHandler
                    local={false}
                    type={'chart'}
                    doneCallback={()=>{

                    }}
                    errorCallback={(err)=>{if (err) Toast(err);}}
                    uploadSequence={this.state.uploadSequence}
                    checkNameCallback={this.checkNameForUpload}
                />
            </React.Fragment>
        );
    }
}

export default ImporterPage;