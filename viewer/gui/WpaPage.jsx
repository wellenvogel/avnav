/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.tsx';
import ItemList from '../components/ItemList.tsx';
import React, {useCallback, useState} from 'react';
import PropTypes from 'prop-types';
import Page, {PageFrame, PageLeft} from '../components/Page.jsx';
import Toast from '../components/Toast.tsx';
import GuiHelpers from '../util/GuiHelpers.js';
import Requests from '../util/requests.js';
import Helper, {avitem} from '../util/helper.ts';
import {DBCancel, DialogButtons, DialogFrame, showDialog} from '../components/OverlayDialog.jsx';
import {Input,Checkbox} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.tsx';
import Mob from '../components/Mob.ts';
import Store from "../util/store";
import {PAGEIDS} from "../util/pageids";
import ButtonList from "../components/ButtonList";

const ListEntry=(props)=>{
    let level=props.level;
    try {
        level = parseInt(level);
    }catch(e){}
    if (level >= 0) level=level+"%";
    else level=level+"dBm";
    let disabled=(props.flags !== undefined && props.flags.match(/DISABLED/));
    let addClass=props.activeItem?'activeEntry':'';
    return(
        <div className={'listEntry wpaNetwork '+addClass} onClick={props.onClick} >
            <span className='ssid'>{props.ssid}</span>
            <div className='detailsContainer'>
                <span className='detail'>Signal:{level}</span>
                <span className='detail'>{props.id >=0?'configured':''}</span>
                { disabled && <span className='detail'>disabled</span>}
                { (props.allowAccess && props.showAccess)  && <span className='detail'>ext access</span>}
                { props.activeItem  && <span className='detail'>active</span>}
            </div>
        </div>
    );
};


const Interface = (props)=> {
    let status = props.interface || {};
    if (!status.wpa_state) {
        return (
            <div>Waiting for interface...</div>
        );
    }
    let info = status.ssid ? "[" + status.ssid + "]" : "";
    let showAccess = props.showAccess;
    if (status.ip_address) {
        info += ", IP: " + status.ip_address;
        if (status.allowAccess && showAccess) {
            info += ", ext access"
        }
        if (showAccess) {
            info += ", firewall " + ((status.fwStatus === 0) ? "ok" : "failed");
        }
    }
    else info += " waiting for IP...";
    return (
        <div className="wpaInterface">
            <div>Interface: {status.wpa_state}</div>
            { (status.wpa_state == "COMPLETED") &&
            <div className='detail'>{info}</div>
            }
        </div>
    );

};

const Dialog = (props) => {
    const [psk, setPsk] = useState('');
    const [allowAccess, setAllowAccess] = useState(false);
    const result = useCallback((button) => {
        props.resultCallback(button, psk, allowAccess);
    }, [props.id, psk, allowAccess]);

    const buttons = [
        DBCancel(),
        {
            name: 'remove',
            visible: props.id >= 0,
            onClick: () => {
                result('remove')
            }
        },
        {
            name: 'enable',
            visible: props.id >= 0,
            onClick: () => {
                result('enable')
            }
        },
        {
            name: 'disable',
            visible: props.id >= 0,
            onClick: () => {
                result('disable')
            }
        },
        {
            name:'connect',
            onClick: () => {result('connect')}
        }
    ]
    return (
        <DialogFrame className="wpaDialog inner" title={props.ssid}>
            <Input
                dialogRow={true}
                label="Password"
                type="password"
                name="psk"
                onChange={(value) => setPsk(value)}
                value={psk}/>
            {props.showAccess ?
                <Checkbox
                    dialogRow={true}
                    onChange={(newVal) => setAllowAccess(newVal)}
                    label="External access"
                    value={allowAccess}/>
                : null
            }

            <DialogButtons buttonList={buttons}/>
        </DialogFrame>
    );
};
Dialog.propTypes={
    resultCallback: PropTypes.func.isRequired,
    showAccess: PropTypes.bool,
    id: PropTypes.any,
    ssid: PropTypes.string,

};
const LISTKEY='list';
const timeout=4000;
class WpaPageContent extends React.Component{
    constructor(props){
        super(props);
        this.state={
            interface:undefined,
            showAccess: undefined
        }
        this.itemClick=this.itemClick.bind(this);
        this.timer=GuiHelpers.lifecycleTimer(this,this.doQuery,timeout,true);
        this.numErrors=0;
        this.listItemStore=new Store('wpaList');
        this.listItemStore.storeData(LISTKEY,[]);
        this.ItemList=Dynamic(ItemList,undefined,this.listItemStore);
        this.listRef=undefined
    }

    getSnapshotBeforeUpdate(prevProps, prevState) {
        if (! this.listRef) return null;
        return this.listRef.scrollTop;
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (snapshot != null ){
            if (!this.listRef) return;
            this.listRef.scrollTop = snapshot;
        }
    }

    doQuery(timerSequence){
        Requests.getJson({
            request:'api',
            type:'wpa',
            command:"all"
        },{
            sequenceFunction:this.timer.currentSequence,
            timeout: timeout*0.9,
            checkOk: false
        }).then((json)=>{
            this.numErrors=0;
            this.setState({
                interface: json.status,
                showAccess: json.showAccess
            });
            let itemList=[];
            if (json.status && json.list) {
                for (let i in json.list) {
                    let item = json.list[i];
                    let ssid = item.ssid;
                    if (ssid === undefined) continue;
                    let displayItem = {};
                    displayItem.ssid = ssid;
                    displayItem.key=ssid;
                    displayItem.name = ssid;
                    displayItem.allowAccess = item.allowAccess;
                    displayItem.showAccess=json.showAccess;
                    displayItem.id = item['network id'];
                    displayItem.level = item['signal level'];
                    displayItem.flags = item.flags + ' ' + item['network flags'];
                    if (displayItem.id === undefined) displayItem.id = -1;
                    if (json.status.ssid && item.ssid == json.status.ssid) {
                        displayItem.activeItem = true;
                    }
                    itemList.push(displayItem);
                }
            }
            this.listItemStore.storeData(LISTKEY,itemList);
            this.timer.startTimer(timerSequence);

        }).catch((error)=>{
            this.numErrors++;
            if (this.numErrors > 3){
                this.numErrors=0;
                Toast("Status query error: "+Helper.escapeHtml(error));
            }
            this.timer.startTimer(timerSequence);
        })
    }
    wpaRequest(request,message,param){
        Toast("sending "+message);
        Requests.getJson({
                request:'api',
                type:'wpa',
                command:request
            },{},
            param
        ).then((json)=>{

        }).catch((error)=>{
            Toast(message+"...Error");
        })
    }
    itemClick(ev){
        const item=avitem(ev);
        if (!item || ! item.ssid || item.id === undefined) return;
        const resultCallback=(type,psk,allowAccess)=>{
            let data={
                id: item.id,
                ssid: item.ssid
            };
            if (type== 'connect') {
                data.psk=psk;
                if (allowAccess){
                    data.allowAccess=allowAccess;
                }
                this.wpaRequest('connect', 'connect to ' + Helper.escapeHtml(data.ssid), data);
                return;
            }
            if (type == 'enable'){
                if (allowAccess){
                    data.allowAccess=allowAccess;
                }
                if (psk && psk != ""){
                    //allow to change the PSK with enable
                    data.psk=psk;
                }
                this.wpaRequest(type,type+' '+Helper.escapeHtml(data.ssid),data);
                return;
            }
            if (type == 'remove' || type == 'disable'){
                this.wpaRequest(type,type+' '+Helper.escapeHtml(data.ssid),data);
                return;
            }
        };
        showDialog(undefined,(props)=>{
            return <Dialog
                resultCallback={resultCallback}
                {...props}
                {...item}
            />
        });
    }
    componentDidMount(){
    }
    componentWillUnmount(){
    }
    render(){
            return(
            <React.Fragment>
                <Interface
                        showAccess={this.state.showAccess}
                        interface={this.state.interface}
                    />
                <this.ItemList
                    itemClass={ListEntry}
                    scrollable={true}
                    storeKeys={{
                        itemList:LISTKEY
                    }}
                    onItemClick={this.itemClick}
                    listRef={(node)=>this.listRef=node}
                    />
            </React.Fragment>
            );
    }
}

export default (props)=>{
    const buttons=[
        Mob.mobDefinition(props.history),
        {
            name: 'Cancel',
            onClick: ()=>{props.history.pop()}
        }
    ];
    return <PageFrame id={PAGEIDS.WPA} className={props.className}>
        <PageLeft title="Wifi Client connection">
            <WpaPageContent></WpaPageContent>
        </PageLeft>
        <ButtonList
                page={PAGEIDS.WPA}
                itemList={buttons}
                widthChanged={props.buttonWidthChanged}
            />
    </PageFrame>
};