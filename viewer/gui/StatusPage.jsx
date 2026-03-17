/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.tsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.ts';
import keys from '../util/keys.jsx';
import React, {useEffect} from 'react';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import Requests, {prepareUrl} from '../util/requests.js';
import {
    DBCancel, DBOk,
    DialogButtons,
    DialogFrame,
    showDialog,
    showPromiseDialog
} from '../components/OverlayDialog.jsx';
import GuiHelpers from '../util/GuiHelpers.js';
import Mob from '../components/Mob.ts';
import EditHandlerDialog from "../components/EditHandlerDialog";
import DB from '../components/DialogButton';
import {Checkbox, Input} from "../components/Inputs";
import LogDialog from "../components/LogDialog";
import assign from "object-assign";
import Compare from "../util/compare";
import PropTypes from 'prop-types';
import Helper from "../util/helper";
import GuiHelper from "../util/GuiHelpers";
import {StatusItem} from '../components/StatusItems';
import {AlertDialog, ConfirmDialog} from "../components/BasicDialogs";
import {useDialogContext} from "../components/exports";

class Notifier{
    constructor() {
        this.callbacks={}
    }
    register(cb){
        if (cb) this.callbacks[cb]=cb;
        else delete this.callbacks[cb];
    }
    trigger(timeout,data){
        const run=()=>{for (let k in this.callbacks){
            if (this.callbacks[k]) this.callbacks[k](data);
        }};
        if (timeout){
            window.setTimeout(run,timeout);
        }
        else{
            run();
        }
    }
}

const DebugDialog=(props)=> {
    const [isDebug,setDebug]=React.useState(false);
    const [pattern,setPattern]=React.useState('');
    const [timeout,setTimeout]=React.useState(60);
    const dialogContext=useDialogContext();
    useEffect(()=> {
        Requests.getJson({
            request: 'api',
            type: 'config',
            command: 'currentLogLevel'
        })
            .then((data) => {
                setDebug(data.level && data.level.match(/debug/i));
                setPattern(data.filter || '');
            })
            .catch((e) => Toast(e))
    },[]);

    const save=()=> {
        Requests.getJson({
            request: 'api',
            type: 'config',
            command: 'loglevel',
            level: isDebug ? 'debug' : 'info',
            timeout: timeout,
            filter: pattern || ''
        })
            .then(() => dialogContext.closeDialog())
            .catch((e) => Toast(e));
    }
        return <DialogFrame className="selectDialog DebugDialog" title={props.title||'Enable/Disable Debug'}>
            <Checkbox
                dialogRow={true}
                label={'debug'}
                value={isDebug}
                onChange={(nv)=>setDebug(nv)}
                />
            <Input
                type={'number'}
                label={'timeout(s)'}
                dialogRow={true}
                value={timeout}
                onChange={(nv)=>setTimeout(nv)}/>
            <Input
                label={'pattern'}
                dialogRow={true}
                value={pattern}
                onChange={(nv)=>setPattern(nv)}/>
            <DialogButtons buttonList={[
                DBCancel(),
                DBOk(()=>save())
                ]}/>
        </DialogFrame>
}


const showEditDialog=(handlerId,child,opt_doneCallback)=>{
    EditHandlerDialog.createDialog(handlerId,child,opt_doneCallback);
}

class StatusList extends React.Component{
    constructor(props) {
        super(props);
        this.querySequence=1;
        this.doQuery=this.doQuery.bind(this);
        this.queryResult=this.queryResult.bind(this);
        this.errors=0;
        this.timer=GuiHelpers.lifecycleTimer(this,this.doQuery,globalStore.getData(keys.properties.statusQueryTimeout),true);
        this.mainListRef=null;
        this.state={
            itemList:[]
        }
        this.defaults={
            addresses:false,
            wpa:false,
            shutdown:false,
            serverError:false
        };
        if (this.props.reloadNotifier){
            this.props.reloadNotifier.register((data)=>this.retriggerQuery(data))
        }
        this.focusItem=undefined;
    }
    componentWillUnmount() {
        if (this.props.reloadNotifier) this.props.reloadNotifier.register(undefined);
    }

    queryResult(data,focusItem){
        let self=this;
        let itemList=[];
        let storeData=assign({},this.defaults);
        self.errors=0;
        if (data.handler) {
            data.handler.forEach(function(el){
                if (el.properties && el.properties.addresses ) storeData.addresses=true;
                if (el.configname === "AVNWpaHandler"){
                    storeData.wpa=true;
                }
                if (el.configname==="AVNCommandHandler"){
                    if (el.properties && el.properties.shutdown ) storeData.shutdown=true;
                }
                el.key=el.displayKey||el.id;
                if (focusItem !== undefined && focusItem === el.id){
                    el.requestFocus=true;
                }
                itemList.push(el);
            });
        }
        if (this.props.onChange){
            this.props.onChange(storeData);
        }
        this.setState({itemList:itemList});

    }
    retriggerQuery(data){
        this.timer.stopTimer();
        this.doQuery(undefined,data);
    }
    doQuery(sequence,focusItem){
        Requests.getJson({
            request:'api',
            type:'config',
            command:'status'
        }).then(
            (json)=>{
                this.timer.guardedCall(sequence,()=> {
                    this.queryResult(json,focusItem)
                    this.timer.startTimer(sequence);
                });
            },
            (error)=>{
                this.timer.guardedCall(sequence,()=> {
                    this.errors++;
                    if (this.errors > 4) {
                        let newState = {itemList: []};
                        newState.serverError = true;
                        if (this.props.onChange) {
                            this.props.onChange({serverError: true});
                        }
                        this.setState(newState);
                    }
                    this.timer.startTimer(sequence);
                });
            });
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
        if (this.mainListRef){
            let focusItem=this.mainListRef.querySelector(".requestFocus");
            if (focusItem){
                let mode=GuiHelper.scrollInContainer(this.mainListRef,focusItem);
                if (mode >= 1 && mode <=2 ) {
                    focusItem.scrollIntoView(mode === 1);
                }
            }
        }
    }
    render(){
        return <ItemList
            itemClass={(iprops)=><StatusItem
                connected={this.props.connected}
                allowEdit={this.props.allowEdit}
                finishCallback={
                    ()=>{
                        window.setTimeout(()=>
                            this.retriggerQuery()
                            ,1000);
                    }
                }
                showEditDialog={showEditDialog}
                {...iprops}/>}
            itemList={this.state.itemList}
            scrollable={true}
            listRef={(ref)=>this.mainListRef=ref}
        />
    }

}

StatusList.propTypes={
    onChange: PropTypes.func,
    connected: PropTypes.bool,
    allowEdit: PropTypes.bool,
    reloadNotifier: PropTypes.instanceOf(Notifier)
}

class StatusPage extends React.Component{
    constructor(props){
        super(props);
        this.state={
            addresses:false,
            wpa:false,
            shutdown:false,
            serverError:false,
            canRestart:false
        }
        this.reloadHelper=GuiHelpers.storeHelperState(this,{reload:keys.gui.global.reloadSequence});
        this.reloadNotifier=new Notifier();
    }
    componentDidMount(){
        if (! globalStore.getData(keys.gui.capabilities.config)) return;
        Requests.getJson({
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
    restartServer(){
        showPromiseDialog(undefined,(props)=><ConfirmDialog {...props} text={"really restart the AvNav server software?"}/>)
            .then((v)=>{
                Requests.getJson({
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
                    onClick:()=>{this.props.history.push('wpapage');}
                },
                {
                    name:'StatusAddresses',
                    visible:this.state.addresses,
                    onClick:()=>{this.props.history.push("addresspage");}
                },
                {
                    name:'StatusAndroid',
                    visible: props.android,
                    onClick:()=>{window.avnavAndroid.showSettings();}
                },
                {
                    name:'AndroidBrowser',
                    visible: props.android && this.state.addresses,
                    onClick:()=>{window.avnavAndroid.launchBrowser();}
                },

                {
                    name: 'MainInfo',
                    onClick: ()=> {
                        this.props.history.push('infopage')
                    },
                    overflow:true
                },
                {
                    name: 'StatusShutdown',
                    visible: !props.android && this.state.shutdown && props.connected,
                    onClick:()=>{
                        showPromiseDialog(undefined, (props)=><ConfirmDialog {...props} text={"really shutdown the server computer?"}/>).then(function(){
                            Requests.getJson({
                                request:'api',
                                type:'command',
                                command:'runCommand',
                                name:'shutdown'
                            }).then(
                                (json)=>{
                                    Toast("shutdown started");
                                },
                                (error)=>{
                                    showDialog(undefined,()=><AlertDialog text={"unable to trigger shutdown: "+error}/>);
                                });

                        })
                            .catch(()=>{});
                    }
                },
                {
                    name:'StatusRestart',
                    visible: this.state.canRestart && props.connected,
                    onClick: ()=>this.restartServer()
                },
                {
                    name: 'StatusLog',
                    visible: props.log,
                    onClick: ()=>{
                        showDialog(undefined,(props)=>{
                            return <LogDialog
                                {...props}
                                baseUrl={prepareUrl({
                                    type:'config',
                                    command:'download',
                                }) }
                                title={'AvNav Log'}
                            />
                        });
                    },
                    overflow: true
                },
                {
                    name: 'StatusDebug',
                    visible: props.debugLevel && props.connected,
                    onClick: ()=>{
                        showDialog(undefined,DebugDialog);
                    },
                    overflow: true
                },
                {
                    name: 'StatusAdd',
                    visible: props.config && props.connected,
                    onClick: ()=>{
                        EditHandlerDialog.createAddDialog((id)=>this.reloadNotifier.trigger(1000,id));
                    }
                },
                Mob.mobDefinition(this.props.history),
                {
                    name: 'Cancel',
                    onClick: ()=>{this.props.history.pop()}
                }
            ];

            let className=props.className;
            if (this.state.serverError) className+=" serverError";
            let pageProperties=Helper.filteredAssign(Page.pageProperties,this.props);
            return(
            <Page
                {...pageProperties}
                className={className}
                id="statuspage"
                title={this.state.serverError?"Server Connection lost":"Server Status"}
                mainContent={
                    <StatusList
                        connected={props.connected}
                        allowEdit={props.config}
                        onChange={(nv)=>window.setTimeout(()=>this.setState((state,props)=>{
                            let comp=Helper.filteredAssign(nv,state);
                            if (Compare(nv,comp)) return null;
                            return nv;
                        }),1)}
                        reloadNotifier={this.reloadNotifier}
                    />
                }
                buttonList={buttons}/>
            )},{
            storeKeys:{
                connected:keys.properties.connectedMode,
                android:keys.gui.global.onAndroid,
                config: keys.gui.capabilities.config,
                log: keys.gui.capabilities.log,
                debugLevel: keys.gui.capabilities.debugLevel
            }
        });
        return <Rt/>
    }
}

export default StatusPage;