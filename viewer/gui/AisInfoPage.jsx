/**
 * Created by andreas on 02.05.14.
 */

import React from 'react';
import Page from '../components/Page.jsx';
import MapHolder from '../map/mapholder.js';
import GuiHelpers from '../util/GuiHelpers.js';
import Mob from '../components/Mob.js';
import MapEventGuard from "../hoc/MapEventGuard";
import NavData from '../nav/navdata';
import {AisInfoWithFunctions, ShowAisItemInfo, storeKeys} from "../components/AisInfoDisplay";
import Dialogs from "../components/OverlayDialog";

const GuardedInfo=MapEventGuard(ShowAisItemInfo);
class AisInfoPage extends React.Component{
    constructor(props){
        super(props);
        this.buttons=[
            {
                name: 'AisNearest',
                onClick:()=>{
                    NavData.getAisHandler().setTrackedTarget(0);
                    let pos=NavData.getAisHandler().getAisPositionByMmsi(NavData.getAisHandler().getTrackedTarget());
                    if (pos) MapHolder.setCenter(pos);
                    this.props.history.pop();
                }
            },
            {
                name: 'AisInfoLocate',
                onClick:()=>{
                    if (!this.props.options || ! this.props.options.mmsi) return;
                    NavData.getAisHandler().setTrackedTarget(this.props.options.mmsi);
                    let pos=NavData.getAisHandler().getAisPositionByMmsi(this.props.options.mmsi);
                    if (pos) {
                        MapHolder.setCenter(pos);
                        MapHolder.setGpsLock(false);
                    }
                    this.props.history.pop();
                }
            },
            {
                name: 'AisInfoHide',
                onClick: ()=>{
                    let target=this.getTarget();
                    if (! target) return;
                    if (target.hidden){
                        NavData.getAisHandler().unsetHidden(target.mmsi);
                    }
                    else {
                        NavData.getAisHandler().setHidden(target.mmsi);
                    }
                    this.props.history.pop();
                },
                storeKeys: storeKeys
                ,
                updateFunction: ()=>{
                    let target=this.getTarget()||{};
                    return {toggle:target.hidden};
                },
                disabled: !this.props.options || ! this.props.options.mmsi

            },
            {
                name: 'AisInfoList',
                onClick:()=>{
                    let mmsi=(this.props.options||{}).mmsi;
                    if (! this.props.history.backFromReplace()) {
                        this.props.history.replace('aispage', {mmsi: mmsi});
                    }
                }
            },
            {
                name:'Test',
                onClick: ()=>{
                    let mmsi=(this.props.options||{}).mmsi;
                    if (mmsi){
                        Dialogs.showDialog(undefined,()=>{
                            return <AisInfoWithFunctions
                                mmsi={mmsi}
                                actionCb={(action,m)=>{
                                    if (action === 'AisInfoList'){
                                        if (! this.props.history.backFromReplace()) {
                                            this.props.history.replace('aispage', {mmsi: m});
                                        }
                                    }
                                }}
                            />;
                        })
                    }
                }
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.backFromReplace(true)}
            }
        ];
        this.checkNoTarget=this.checkNoTarget.bind(this);
        this.timer=GuiHelpers.lifecycleTimer(this,this.checkNoTarget,5000,true);
    }

    getTarget(){
        let mmsi=this.props.options?this.props.options.mmsi:undefined;
        if (! mmsi) return;
        return NavData.getAisHandler().getAisByMmsi(mmsi);
    }
    checkNoTarget(timerSequence){
        if (! this.getTarget()){
            this.props.history.pop();
            return;
        }
        this.timer.startTimer(timerSequence);
    }

    render(){
        //gets mmsi
        const MainContent=(props)=> {
            return (
                    <GuardedInfo
                        {...props}
                        onClick={()=>{
                        if (! this.props.history.backFromReplace()) {
                            this.props.history.pop();
                        }}}
                    />
                );
        };

        return (
            <Page
                {...this.props}
                id="aisinfopage"
                title="AIS Info"
                mainContent={
                            <MainContent
                                mmsi={this.props.options?this.props.options.mmsi:undefined}
                            />
                        }
                buttonList={this.buttons}/>
        );
    }
}

export default AisInfoPage;
