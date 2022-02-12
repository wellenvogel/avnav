/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropTypes from 'prop-types';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import GuiHelpers from '../util/GuiHelpers.js';
import Requests from '../util/requests.js';
import Helper from '../util/helper.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import {Input,Checkbox} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.jsx';
import Mob from '../components/Mob.js';

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

const DynamicList=Dynamic(ItemList);

const Interface = Dynamic((props)=> {
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

});

class Dialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            psk: '',
            allowAccess: props.allowAccess||false
        };
        this.buttonClick=this.buttonClick.bind(this);
    }
    buttonClick(event){
        let button=event.target.name;
        this.props.closeCallback();
        if (button != "cancel")  this.props.resultCallback(button,this.state.psk,this.state.allowAccess);
    }
    render(){
        let id=this.props.id;
        let self=this;
        return (
            <div className="wpaDialog inner">
                <div>
                    <h3><span >{this.props.ssid}</span></h3>

                        <Input
                            dialogRow={true}
                            label="Password"
                            type="password"
                            name="psk"
                            onChange={(value)=>self.setState({psk:value})}
                            value={this.state.psk}/>
                        {this.props.showAccess?
                            <Checkbox
                                dialogRow={true}
                                onChange={(newVal)=>self.setState({allowAccess:newVal})}
                                label="External access"
                                value={this.state.allowAccess}/>
                            :null
                        }
                    <div className="dialogButtons">
                        <DB name="cancel" onClick={this.buttonClick}>Cancel</DB>
                        {id >= 0 && <DB name="remove" onClick={this.buttonClick}>Remove</DB>}
                        {id >= 0 && <DB name="enable" onClick={this.buttonClick}>Enable</DB>}
                        {id >= 0 && <DB name="disable" onClick={this.buttonClick}>Disable</DB>}
                        <DB name="connect" onClick={this.buttonClick}>Connect</DB>
                    </div>
                </div>
            </div>
        );
    }
};
Dialog.propTypes={
    closeCallback:PropTypes.func.isRequired,
    resultCallback: PropTypes.func.isRequired,
    showAccess: PropTypes.bool,

};

const timeout=4000;
class WpaPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        this.itemClick=this.itemClick.bind(this);
        this.timer=GuiHelpers.lifecycleTimer(this,this.doQuery,timeout,true);
        this.numErrors=0;

    }

    doQuery(timerSequence){
        let self=this;
        Requests.getJson("?request=wpa&command=all",{
            sequenceFunction:this.timer.currentSequence,
            timeout: timeout*0.9,
            checkOk: false
        }).then((json)=>{
            self.numErrors=0;
            globalStore.storeData(keys.gui.wpapage.interface,json.status);
            globalStore.storeData(keys.gui.wpapage.showAccess,json.showAccess);
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
            globalStore.storeData(keys.gui.wpapage.wpaItems,itemList);
            self.timer.startTimer(timerSequence);

        }).catch((error)=>{
            self.numErrors++;
            if (self.numErrors > 3){
                self.numErrors=0;
                Toast("Status query error: "+Helper.escapeHtml(error));
            }
            self.timer.startTimer(timerSequence);
        })
    }
    wpaRequest(request,message,param){
        let self=this;
        Toast("sending "+message);
        Requests.getJson("?request=wpa&command="+request,{},
            param
        ).then((json)=>{

        }).catch((error)=>{
            Toast(message+"...Error");
        })
    }
    itemClick(item,itemData){
        let self=this;
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
                self.wpaRequest('connect', 'connect to ' + Helper.escapeHtml(data.ssid), data);
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
                self.wpaRequest(type,type+' '+Helper.escapeHtml(data.ssid),data);
                return;
            }
            if (type == 'remove' || type == 'disable'){
                self.wpaRequest(type,type+' '+Helper.escapeHtml(data.ssid),data);
                return;
            }
        };
        OverlayDialog.dialog((props)=>{
            return <Dialog
                resultCallback={resultCallback}
                {...props}
                {...item}
            />
        });
    }
    componentDidMount(){
    }
    componentDidUpdate(){
    }
    componentWillUnmount(){
    }
    render(){
        let self=this;

        const MainContent=(props)=> {
            return(
            <React.Fragment>
                <Interface
                    storeKeys={{
                        showAccess:keys.gui.wpapage.showAccess,
                        interface: keys.gui.wpapage.interface
                    }}
                    />
                <DynamicList
                    itemClass={ListEntry}
                    scrollable={true}
                    storeKeys={{
                        itemList:keys.gui.wpapage.wpaItems
                    }}
                    onItemClick={self.itemClick}
                    />
            </React.Fragment>
            );
        };

        return (
            <Page
                {...this.props}
                id="wpapage"
                title="Wifi Client connection"
                mainContent={
                            <MainContent
                            />
                        }
                buttonList={self.buttons}/>
        );
    }
}

export default WpaPage;