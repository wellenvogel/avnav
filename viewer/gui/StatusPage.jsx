/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import Requests from '../util/requests.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import GuiHelpers from '../util/GuiHelpers.js';
import Mob from '../components/Mob.js';
import EditHandlerDialog from "../components/EditHandlerDialog";
import DB from '../components/DialogButton';
import Formatter from '../util/formatter';

class LogDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            log:undefined,
            loading: true
        };
        this.downloadFrame=null;
        this.mainref=null;
        this.getLog=this.getLog.bind(this);
    }
    componentDidMount() {
        this.getLog();
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.mainref) {
            this.mainref.scrollTop = this.mainref.scrollHeight
        }
    }

    getLog(){
        Requests.getHtmlOrText('', {useNavUrl:true},{
            request:'download',
            type:'config',
            maxBytes:100000
        })
            .then((data)=>{
                this.setState({log:data});
            })
            .catch((e)=>Toast(e))
    }
    render(){
    return <div className="selectDialog LogDialog">
        <h3 className="dialogTitle">{this.props.title||'AvNav log'}</h3>
        <div className="logDisplay dialogRow" ref={(el)=>this.mainref=el}>
            {this.state.log||''}
        </div>
        <div className="dialogButtons">
            <DB
                name="download"
                onClick={()=>{
                    let name="avnav-"+Formatter.formatDateTime(new Date()).replace(/[: /]/g,'-').replace(/--/g,'-')+".log";
                    let url=globalStore.getData(keys.properties.navUrl)+"?request=download&type=config&filename="+name;
                    if (this.downloadFrame){
                        this.downloadFrame.src=url;
                    }
                }}
            >
                Download
            </DB>
            <DB name="reload"
                onClick={this.getLog}>
                Reload
            </DB>
            <DB
                name="ok"
                onClick={this.props.closeCallback}
            >
                Ok
            </DB>
        </div>
        <iframe
            className="downloadFrame"
            onLoad={(ev)=>{
                let txt=ev.target.contentDocument.body.textContent;
                if (! txt) return;
                Toast(txt);
            }}
            src={undefined}
            ref={(el)=>this.downloadFrame=el}/>
    </div>
    }
}

const showEditDialog=(handlerId,child)=>{
    EditHandlerDialog.createDialog(handlerId,child);
}
const statusTextToImageUrl=(text)=>{
    let rt=globalStore.getData(keys.properties.statusIcons[text]);
    if (! rt) rt=globalStore.getData(keys.properties.statusIcons.INACTIVE);
    return rt;
};
const EditIcon=(props)=>{
    return <Button
        name="Edit" className="Edit smallButton editIcon" onClick={props.onClick}/>

}
const ChildStatus=(props)=>{
    let canEdit=props.canEdit && props.connected;
    return (
        <div className="childStatus">
            <img src={statusTextToImageUrl(props.status)}/>
            <span className="statusName">{props.name}</span>
            <span className="statusInfo">{props.info}</span>
            {canEdit && <EditIcon onClick={
                ()=>showEditDialog(props.handlerId,props.id)
            }/>}
        </div>
    );
};
const StatusItem=(props)=>{
    let canEdit=props.canEdit && props.connected;
    let isDisabled=props.disabled;
    return(
        <div className="status"  key={props.id}>
            <div className={"statusHeading"+ (isDisabled?" disabled":"")}>
                <span className="statusName">{props.name.replace(/\[.*\]/, '')}</span>
                {isDisabled && <span className="disabledInfo">[disabled]</span> }
                {canEdit && <EditIcon
                    onClick={
                        () => showEditDialog(props.id)
                    }/>}
            </div>
            {props.info && props.info.items && props.info.items.map(function(el){
                return <ChildStatus
                    {...el}
                    key={props.name+el.name}
                    connected={props.connected}
                    handlerId={props.id}/>
            })}
        </div>

    );
};



class StatusPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.state={
            addresses:false,
            wpa:false,
            shutdown:false,
            itemList:[],
            serverError:false,
            canRestart:false
        }
        this.querySequence=1;
        this.doQuery=this.doQuery.bind(this);
        this.queryResult=this.queryResult.bind(this);
        this.errors=0;
        this.timer=GuiHelpers.lifecycleTimer(this,this.doQuery,globalStore.getData(keys.properties.statusQueryTimeout),true);
        this.mainListRef=null;
    }
    queryResult(data){
            let self=this;
            let storeData={
                addresses:false,
                wpa:false,
                shutdown:false,
                itemList:[],
                serverError:false
            };
            self.errors=0;
            if (data.handler) {
                data.handler.forEach(function(el){
                    if (el.configname==="AVNHttpServer"){
                        if (el.properties && el.properties.addresses ) storeData.addresses=true;
                    }
                    if (el.configname === "AVNWpaHandler"){
                        storeData.wpa=true;
                    }
                    if (el.configname==="AVNCommandHandler"){
                        if (el.properties && el.properties.shutdown ) storeData.shutdown=true;
                    }
                    el.key=el.displayKey;
                    storeData.itemList.push(el);
                });
            }
            this.setState(storeData);

    }
    doQuery(){
        let self=this;
        Requests.getJson("?request=status",{checkOk:false,sequenceFunction:this.timer.currentSequence}).then(
            (json)=>{
                self.queryResult(json);
                self.timer.startTimer();
            },
            (error)=>{
                let newState={itemList:[]};
                self.errors++;
                if (self.errors > 5){
                    newState.serverError=true;
                }
                this.setState(newState);
                self.timer.startTimer();
            });
    }
    componentDidMount(){
        if (! globalStore.getData(keys.gui.capabilities.config)) return;
        Requests.getJson('',undefined,{
            request:'api',
            type:'config',
            command:'canRestart'
        })
            .then((data)=>{
                this.setState({canRestart:data.canRestart});
            })
            .catch((e)=>Toast(e))
    }
    componentWillUnmount(){
    }
    getSnapshotBeforeUpdate(prevProps, prevState) {
        if (!this.mainListRef) return null;
        return{
            x:this.mainListRef.scrollLeft,
            y:this.mainListRef.scrollTop
        }
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        if (snapshot && this.mainListRef){
            this.mainListRef.scrollLeft=snapshot.x;
            this.mainListRef.scrollTop=snapshot.y;
        }
    }
    restartServer(){
        OverlayDialog.confirm("really restart the AvNav server?")
            .then((v)=>{
                Requests.getJson('',undefined,{
                    request:'api',
                    type:'config',
                    command:'restartServer'
                })
                    .then(()=>Toast("restart triggered"))
                    .catch((e)=>Toast(e))
            })
            .catch((e)=>{})
    }
    render(){
        let self=this;

        let Rt=Dynamic((props)=>{
            let buttons=[
                {
                    name:'StatusWpa',
                    visible: this.state.wpa && props.connected,
                    onClick:()=>{history.push('wpapage');}
                },
                {
                    name:'StatusAddresses',
                    visible:this.state.addresses,
                    onClick:()=>{history.push("addresspage");}
                },
                {
                    name:'StatusAndroid',
                    visible: props.android,
                    onClick:()=>{avnav.android.showSettings();}
                },

                {
                    name: 'MainInfo',
                    onClick: ()=> {
                        history.push('infopage')
                    },
                    overflow:true
                },
                {
                    name: 'StatusShutdown',
                    visible: !props.android && this.state.shutdown && props.connected,
                    onClick:()=>{
                        OverlayDialog.confirm("really shutdown the server?").then(function(){
                            Requests.getJson("?request=command&start=shutdown").then(
                                (json)=>{
                                    Toast("shutdown started");
                                },
                                (error)=>{
                                    OverlayDialog.alert("unable to trigger shutdown: "+error);
                                });

                        });
                    }
                },
                {
                    name:'StatusRestart',
                    visible: this.state.canRestart,
                    onClick: ()=>this.restartServer()
                },
                {
                    name: 'StatusLog',
                    visible: props.config,
                    onClick: ()=>{
                        OverlayDialog.dialog(LogDialog);
                    },
                    overflow: true
                },
                {
                    name: 'StatusAdd',
                    visible: props.config && props.connected,
                    onClick: ()=>{
                        EditHandlerDialog.createAddDialog();
                    }
                },
                Mob.mobDefinition,
                {
                    name: 'Cancel',
                    onClick: ()=>{history.pop()}
                }
            ];

            let className=props.className;
            if (this.state.serverError) className+=" serverError";
            return(
            <Page
                className={className}
                style={props.style}
                id="statuspage"
                title={this.state.serverError?"Server Connection lost":"Server Status"}
                mainContent={
                    <ItemList
                        itemClass={(iprops)=><StatusItem
                            connected={props.connected}
                            {...iprops}/>}
                        itemList={this.state.itemList}
                        scrollable={true}
                        listRef={(ref)=>this.mainListRef=ref}
                    />
                }
                buttonList={buttons}/>
            )},{
            storeKeys:{
                connected:keys.properties.connectedMode,
                android:keys.gui.global.onAndroid,
                config: keys.gui.capabilities.config
            }
        });
        return <Rt/>
    }
}

export default StatusPage;