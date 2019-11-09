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
import Toast from '../util/overlay.js';
import AisHandler from '../nav/aisdata.js';
import AisFormatter from '../nav/aisformatter.jsx';
import MapHolder from '../map/mapholder.js';

const displayItems = [
    {name: 'mmsi', label: 'MMSI'},
    {name: 'shipname', label: 'Name'},
    {name: 'callsign', label: 'Callsign'},
    {name: 'distance', label: 'Distance'},
    {name: 'heading', label: 'HeadingTo'},
    {name: 'cpa', label: 'CPA(nm)'},
    {name: 'tcpa', label: 'TCPA(h:min:sec)'},
    {name: 'speed', label: 'SOG(kn)'},
    {name: 'course', label: 'COG'},
    {name: 'destination', label: 'Destination'},
    {name: 'shiptype', label: 'Type'},
    {name: 'passFront', label: 'we pass', addClass: 'avn_ais_front'},
    {name: 'position', label: 'Position'}
];

const createItem=(config,current)=>{
    let cl="aisData";
    if (config.addClass)cl+=" "+config.addClass;
    let currentData=current;
    return  (props)=> {
        return (
        <div className="row">
            <div className='label '>{props.label}</div>
            <div className={cl}>{AisFormatter.format(props.name, currentData)}</div>
        </div>
        );
    };
};
class AisInfoPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            {
                name: 'AisNearest',
                onClick:()=>{
                    AisHandler.setTrackedTarget(0);
                    let pos=AisHandler.getAisPositionByMmsi(AisHandler.getTrackedTarget());
                    if (pos) MapHolder.setCenter(pos);
                    history.pop();
                }
            },
            {
                name: 'AisInfoLocate',
                onClick:()=>{
                    if (!self.props.options || ! self.props.options.mmsi) return;
                    let pos=AisHandler.getAisPositionByMmsi(self.props.mmsi);
                    if (pos) {
                        MapHolder.setCenter(pos);
                        MapHolder.setGpsLock(false);
                    }
                    history.pop();
                }
            },
            {
                name: 'AisInfoList',
                onClick:()=>{
                    history.replace('aispage');
                }
            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.checkNoTarget=this.checkNoTarget.bind(this);

    }

    checkNoTarget(){
        let mmsi=this.props.options?this.props.options.mmsi:undefined;
        if (! mmsi || ! AisHandler.getAisByMmsi(mmsi)){
            history.pop();
        }
    }

    componentDidMount(){
        this.checkNoTarget();
    }
    componentDidUpdate(){
        this.checkNoTarget();
    }
    render(){
        let self=this;
        const Status = function (props) {
            return <img src={props.src} style={{transform:'rotate('+props.rotation+'deg)'}} className="status"/>
        };
        //gets current
        const MainContent=(props)=> {
            let status="normal";
            let src="";
            let rotation=0;
            if (props.current){
                if (props.current.warning) status="warning";
                else {
                    if (props.current.nearest) status="nearest";
                }
                rotation=props.current.course||0;
            }
            src=MapHolder.getAisIcon(status);
            return(
            <React.Fragment>
                <Status
                    src={src}
                    rotation={rotation}/>
                <ItemList
                    itemCreator={(config)=>{return createItem(config,props.current)}}
                    itemList={displayItems}
                    scrollable={true}
                    className="infoList"
                    />

            </React.Fragment>
            );
        };

        const MainRender=Dynamic(MainContent);

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="aisinfopage"
                title="AIS Info"
                mainContent={
                            <MainRender
                                storeKeys={{
                                    aisSequence:keys.nav.ais.updateCount,
                                }}
                                updateFunction={(state)=>{
                                    let empty={current:undefined};
                                    if (!self.props.options || ! self.props.options.mmsi) return empty;
                                    return {current:AisHandler.getAisByMmsi(self.props.options.mmsi)};
                                }}
                            />
                        }
                buttonList={self.buttons}/>
        );
    }
}

module.exports=AisInfoPage;