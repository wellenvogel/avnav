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
    {name: 'mmsi', label: 'MMSI'},
    {name: 'shipname', label: 'Name'},
    {name: 'callsign', label: 'Callsign'},
    {name: 'shiptype', label: 'Type'},
    {name: 'aid_type', label: 'Type'},
    {name: 'clazz', label: 'Class'},
    {name: 'status', label: 'Status'},
    {name: 'destination', label: 'Destination'},
    {name: 'position', label: 'Position'},
    {name: 'course', label: 'COG(°)'},
    {name: 'speed', label: 'SOG(kn)'},
    {name: 'heading', label: 'HDG(°)'},
    {name: 'turn', label: 'ROT(°/min)'},
    {name: 'headingTo', label: 'BRG(°)'},
    {name: 'distance', label: 'Distance(nm)'},
    {name: 'cpa', label: 'CPA(nm)'},
    {name: 'tcpa', label: 'TCPA(h:min:sec)'},
    {name: 'passFront', label: 'we pass', addClass: 'aisFront'},
    {name: 'length', label: 'Length(m)'},
    {name: 'beam',label: 'Beam(m)'},
    {name: 'draught',label: 'Draught(m)'},
    {name: 'age',label: 'Age(s)'}
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
        if (! AisFormatter.shouldShow(props.name,props.current)){
            return null;
        }
        return (
        <div className="aisInfoRow">
            <div className='label '>{props.label}</div>
            <div className={cl}>{AisFormatter.format(props.name, props.current)}</div>
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
        let self=this;
        this.buttons=[
            {
                name: 'AisNearest',
                onClick:()=>{
                    NavData.getAisHandler().setTrackedTarget(0);
                    let pos=NavData.getAisHandler().getAisPositionByMmsi(NavData.getAisHandler().getTrackedTarget());
                    if (pos) MapHolder.setCenter(pos);
                    self.props.history.pop();
                }
            },
            {
                name: 'AisInfoLocate',
                onClick:()=>{
                    if (!self.props.options || ! self.props.options.mmsi) return;
                    NavData.getAisHandler().setTrackedTarget(self.props.options.mmsi);
                    let pos=NavData.getAisHandler().getAisPositionByMmsi(self.props.options.mmsi);
                    if (pos) {
                        MapHolder.setCenter(pos);
                        MapHolder.setGpsLock(false);
                    }
                    self.props.history.pop();
                }
            },
            {
                name: 'AisInfoHide',
                onClick: ()=>{
                    if (!self.props.options || ! self.props.options.mmsi) return;
                    if (globalStore.getData(keys.gui.aisinfopage.hidden)){
                        NavData.getAisHandler().unsetHidden(self.props.options.mmsi);
                    }
                    else {
                        NavData.getAisHandler().setHidden(self.props.options.mmsi);
                    }
                    self.props.history.pop();
                },
                storeKeys: {
                    toggle: keys.gui.aisinfopage.hidden
                }

            },
            {
                name: 'AisInfoList',
                onClick:()=>{
                    let mmsi=(this.props.options||{}).mmsi;
                    if (! self.props.history.backFromReplace()) {
                        self.props.history.replace('aispage', {mmsi: mmsi});
                    }
                }
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{self.props.history.backFromReplace(true)}
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
        let self=this;
        const Status = function (props) {
            return <canvas className="status" ref={(ctx)=>{self.drawIcon(ctx,props.current)}}/>
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
                        if (! self.props.history.backFromReplace()) {
                            self.props.history.pop();
                        }
                    }}
                    />

            </React.Fragment>
            );
        };

        return (
            <Page
                {...self.props}
                id="aisinfopage"
                title="AIS Info"
                mainContent={
                            <MainContent
                                mmsi={this.props.options?this.props.options.mmsi:undefined}
                            />
                        }
                buttonList={self.buttons}/>
        );
    }
}

export default AisInfoPage;
