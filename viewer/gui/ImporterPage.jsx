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
import {ChildStatus, StatusItem} from "../components/StatusItems";
import globalstore from "../util/globalstore";
import keys from '../util/keys';
import DB from "../components/DialogButton";
import Dialogs from "../components/OverlayDialog";
import Toast from "../components/Toast";
import globalStore from "../util/globalstore";

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

const ImportDialog=(props)=>{
    return <div className="importerDialog flexInner">
        <h3 className="dialogTitle">{props.name}</h3>
        <div className="dialogRow">
            <span className="itemInfo">{props.info}</span>
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
            <DB name="download"
                onClick={() => {
                    props.download(props.name);
                    props.closeCallback();
                }}
            >Download</DB>
            <DB name="log"
                onClick={() => {
                    props.logCallback(props.name);
                    props.closeCallback();
                }}
            >Log</DB>
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
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        this.state={items:[]};
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
        this.downloadFrame=undefined;
    }
    componentDidMount(){

    }
    showConverterDialog(converter){

    }
    showImportDialog(item){
        Dialogs.dialog((props)=>
            <ImportDialog
                {...props}
                {...item}
                logCallback={(id)=>{
                  if (!this.downloadFrame) return;
                  let url=globalStore.getData(keys.properties.navUrl)+"?request=api&type=import&command=getlog&name="+encodeURIComponent(id);
                  this.downloadFrame.src=url;
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
            <Page
                {...self.props}
                id="importerpage"
                title="Chart Converter"
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}

export default ImporterPage;