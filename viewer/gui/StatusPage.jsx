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
    let canEdit=props.canEdit;
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
    let canEdit=props.canEdit;
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
                return <ChildStatus {...el} key={props.name+el.name} handlerId={props.id}/>
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
            serverError:false
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
                    name: 'MainInfo',
                    onClick: ()=> {
                        history.push('infopage')
                    }
                },
                {
                    name: 'StatusAdd',
                    visible: props.config,
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
                        itemClass={StatusItem}
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