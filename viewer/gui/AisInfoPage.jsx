/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import Page from '../components/Page.jsx';
import AisFormatter from '../nav/aisformatter.jsx';
import MapHolder from '../map/mapholder.js';
import GuiHelpers from '../util/GuiHelpers.js';
import Mob from '../components/Mob.js';
import {Drawing} from '../map/drawing.js';
import MapEventGuard from "../hoc/MapEventGuard";
import NavData from '../nav/navdata';


const displayItems = [
    {name: 'mmsi'},
    {name: 'shipname'},
    {name: 'callsign'},
    {name: 'shiptype'},
    {name: 'aid_type'},
    {name: 'clazz'},
    {name: 'status'},
    {name: 'destination'},
    {name: 'position'},
    {name: 'headingTo'},
    {name: 'distance'},
    {name: 'course'},
    {name: 'speed'},
    {name: 'heading'},
    {name: 'turn'},
    {name: 'cpa'},
    {name: 'tcpa'},
    {name: 'bcpa'},
    {name: 'passFront', addClass: 'aisFront'},
    {name: 'length'},
    {name: 'beam'},
    {name: 'draught'},
    {name: 'age'},
];

const createUpdateFunction=(config,mmsi)=>{
    return (state)=>{
        if (!mmsi) return {current:undefined,...config};
        return {current:NavData.getAisHandler().getAisByMmsi(mmsi),...config};
    }
};
const storeKeys={
    aisSequence:keys.nav.ais.updateCount
};
const createItem=(config,mmsi)=>{
    let cl="aisData";
    if (config.addClass)cl+=" "+config.addClass;
    return Dynamic((props)=> {
        let key = props.name;
        if (! AisFormatter.shouldShow(key,props.current)){
            return null;
        }
        let target = props.current;
        if (typeof(target) == 'undefined') { return null; }
        let unit = AisFormatter.getUnit(props.name);
        let clazz = 'aisInfoRow';
        let warning = target.warning && (key.includes('cpa') || key.includes('pass'));
        let warningDist = globalStore.getData(keys.properties.aisWarningCpa);
        let warningTime = globalStore.getData(keys.properties.aisWarningTpa);
        if((key.includes('pass') && warning)
            || (0 < target.tcpa && target.cpa < warningDist && (key=='cpa' || (key=='tcpa' && target.tcpa < warningTime)))
        ){
          clazz += ' warning';
        }
        return (
          <div className={clazz}>
              <div className='label'>{AisFormatter.getHeadline(key)}</div>
              <div className={cl}>{AisFormatter.format(key, props.current)}{unit && <span className='unit'>&thinsp;{unit}</span>}</div>
          </div>
        );
    },{
        storeKeys:storeKeys,
        updateFunction:createUpdateFunction(config,mmsi)
    });
};
const GuardedList=MapEventGuard(ItemList);
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
                    if (!this.props.options || ! this.props.options.mmsi) return;
                    if (globalStore.getData(keys.gui.aisinfopage.hidden)){
                        NavData.getAisHandler().unsetHidden(this.props.options.mmsi);
                    }
                    else {
                        NavData.getAisHandler().setHidden(this.props.options.mmsi);
                    }
                    this.props.history.pop();
                },
                storeKeys: {
                    toggle: keys.gui.aisinfopage.hidden
                }

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
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.backFromReplace(true)}
            }
        ];
        this.checkNoTarget=this.checkNoTarget.bind(this);
        this.drawIcon=this.drawIcon.bind(this);
        this.timer=GuiHelpers.lifecycleTimer(this,this.checkNoTarget,5000,true);
        let mmsi=(this.props.options||{}).mmsi;
        if (mmsi) {
            GuiHelpers.storeHelper(this, () => {
                globalStore.storeData(keys.gui.aisinfopage.hidden,NavData.getAisHandler().isHidden(mmsi));
            }, storeKeys, true)
        }
    }

    checkNoTarget(timerSequence){
        let mmsi=this.props.options?this.props.options.mmsi:undefined;
        if (! mmsi || ! NavData.getAisHandler().getAisByMmsi(mmsi)){
            this.props.history.pop();
            return;
        }
        this.timer.startTimer(timerSequence);
    }
    drawIcon(canvas,current){
        if (! canvas) return;
        if (! current) return;
        let drawing=new Drawing({
            coordToPixel:(p)=>{return p;},
            pixelToCoord:(p)=>{return p;}
        },globalStore.getData(keys.properties.style.useHdpi,false));
        let ctx=canvas.getContext('2d');
        drawing.setContext(ctx);
        let rect=canvas.getBoundingClientRect();
        canvas.width=rect.width;
        canvas.height=rect.height;
        MapHolder.aislayer.drawTargetSymbol(
            drawing,
            [rect.width/2,rect.height/2],
            current,
            (xy,rotation,distance)=>{
                rotation=rotation/180*Math.PI;
                return [
                    rect.width/2*(1+Math.sin(rotation)),
                    rect.height/2*(1-Math.cos(rotation))
                ]
            });
    }

    render(){
        const Status = (props)=> {
            return <canvas className="status" ref={(ctx)=>{this.drawIcon(ctx,props.current)}}/>
        };
        const RenderStatus=Dynamic(Status);
        //gets mmsi
        const MainContent=(props)=> {
            return(
            <React.Fragment>
                <RenderStatus
                    storeKeys={storeKeys}
                    updateFunction={createUpdateFunction({},props.mmsi)}
                    />
                <GuardedList
                    itemCreator={(config)=>{return createItem(config,props.mmsi)}}
                    itemList={displayItems}
                    scrollable={true}
                    className="infoList"
                    onClick={()=>{
                        if (! this.props.history.backFromReplace()) {
                            this.props.history.pop();
                        }
                    }}
                    />

            </React.Fragment>
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
