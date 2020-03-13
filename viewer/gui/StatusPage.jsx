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

const statusTextToImageUrl=(text)=>{
    let rt=globalStore.getData(keys.properties.statusIcons[text]);
    if (! rt) rt=globalStore.getData(keys.properties.statusIcons.INACTIVE);
    return rt;
};
const ChildStatus=(props)=>{
    return (
        <div className="childStatus">
            <img src={statusTextToImageUrl(props.status)}/>
            <span className="statusName">{props.name}</span>
            <span className="statusInfo">{props.info}</span>
        </div>
    );
};
const StatusItem=(props)=>{
    return(
        <div className="status" >
            <span className="statusName">{props.name.replace(/\[.*\]/,'')}</span>
            {props.info && props.info.items && props.info.items.map(function(el){
                return <ChildStatus {...el} key={el.name}/>
            })}
        </div>

    );
};

const MainContent=Dynamic((props)=>{
    return(
        <ItemList
            itemClass={StatusItem}
            itemList={props.itemList}
            scrollable={true}
            />
    );
});



class StatusPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;

        this.querySequence=1;
        this.doQuery=this.doQuery.bind(this);
        this.queryResult=this.queryResult.bind(this);
        this.errors=0;
        globalStore.storeData(keys.gui.statuspage.serverError,false);
        globalStore.storeData(keys.gui.statuspage.statusItems,[]);
        this.timer=GuiHelpers.lifecycleTimer(this,this.doQuery,globalStore.getData(keys.properties.statusQueryTimeout),true);

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
                    if (el.configname=="AVNHttpServer"){
                        if (el.properties && el.properties.addresses ) storeData.addresses=true;
                    }
                    if (el.configname == "AVNWpaHandler"){
                        storeData.wpa=true;
                    }
                    if (el.configname=="AVNCommandHandler"){
                        if (el.properties && el.properties.shutdown ) storeData.shutdown=true;
                    }
                    storeData.itemList.push(el);
                });
            }
            globalStore.storeMultiple(storeData,{
                wpa:keys.gui.statuspage.wpa,
                addresses:keys.gui.statuspage.addresses,
                shutdown:keys.gui.statuspage.shutdown,
                itemList:keys.gui.statuspage.statusItems,
                serverError:keys.gui.statuspage.serverError
            });
    }
    doQuery(){
        let self=this;
        Requests.getJson("?request=status",{checkOk:false,sequenceFunction:this.timer.currentSequence}).then(
            (json)=>{
                self.queryResult(json);
                self.timer.startTimer();
            },
            (error)=>{
                globalStore.storeData(keys.gui.statuspage.statusItems,[]);
                self.errors++;
                if (self.errors > 5){
                    globalStore.storeData(keys.gui.statuspage.serverError,true);
                }
                self.timer.startTimer();
            });
    }
    componentDidMount(){
    }
    componentWillUnmount(){
        let self=this;
    }
    render(){
        let self=this;

        let Rt=Dynamic((props)=>{
            let buttons=[
                {
                    name:'StatusWpa',
                    visible: props.wpa && props.connected,
                    onClick:()=>{history.push('wpapage');}
                },
                {
                    name:'StatusAddresses',
                    visible:props.addresses,
                    onClick:()=>{history.push("addresspage");}
                },
                {
                    name:'StatusAndroid',
                    visible: props.android,
                    onClick:()=>{avnav.android.showSettings();}
                },
                {
                    name: 'StatusShutdown',
                    visible: !props.android && props.shutdown && props.connected,
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
                Mob.mobDefinition,
                {
                    name: 'Cancel',
                    onClick: ()=>{history.pop()}
                }
            ];

            let className=props.className;
            if (props.serverError) className+=" serverError";
            return(
            <Page
                className={className}
                style={props.style}
                id="statuspage"
                title={props.serverError?"Server Connection lost":"Server Status"}
                mainContent={
                            <MainContent
                                storeKeys={{itemList:keys.gui.statuspage.statusItems}}
                            />
                        }
                buttonList={buttons}/>
            )},{
            storeKeys:{
                wpa:keys.gui.statuspage.wpa,
                connected:keys.properties.connectedMode,
                addresses:keys.gui.statuspage.addresses,
                shutdown:keys.gui.statuspage.shutdown,
                android:keys.gui.global.onAndroid,
                serverError: keys.gui.statuspage.serverError
            }
        });
        return <Rt/>
    }
}

module.exports=StatusPage;