/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import AisFormatter from '../nav/aisformatter.jsx';
import AisData from '../nav/aisdata.js';
import assign from 'object-assign';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Mob from '../components/Mob.js';

const aisInfos=[
    [
        {name:'distance',label:'Dst',unit:'nm'},
        {name:'cpa',label:'Cpa',unit:'nm'},
        {name:'tcpa',label:'Tcpa',unit:'h'}
    ],
    [
        {name:'course',label:'Cog',unit:'°'},
        {name:'speed',label:'Sog',unit:'kn'},
        {name:'heading',label:'Hdg',unit:'°'}
    ],
    [
        {name:'shiptype',label:'Type'},
        {name:'callsign',label:'Call'},
        {name:'destination',label:'Dest'}
    ]
];
const fieldToLabel=(field)=>{
    let rt;
    aisInfos.map(function(l1){
        l1.map(function(l2){
            if (l2.name == field) rt=l2.label;
        })
    });
    return rt||field;
};

const aisSortCreator=(sortField)=>{
    return (a,b)=> {
        let fa = a[sortField];
        let fb = b[sortField];
        if (sortField == 'tcpa') {
            if (fa < 0 && fb >= 0) return 1;
            if (fb < 0 && fa >= 0) return -1;
            if (fa < 0 && fb < 0) {
                if (fa < fb) return 1;
                if (fa > fb) return -1;
                return 0;
            }
        }
        if (fa < fb) return -1;
        if (fa > fb) return 1;
        if (fa == fb) return 0;
    };
};



const computeList=(state)=>{
    let aisList=state.list;
    if (! aisList) return {itemList:[]};
    let trackingTarget=state.tracked;
    let items=[];
    let sortFunction=aisSortCreator(state.sortField||'cpa');
    aisList.sort(sortFunction);
    for( let aisidx in aisList){
        let ais=aisList[aisidx];
        if (! ais.mmsi) continue;
        let color=PropertyHandler.getAisColor({
            nearest: ais.nearest,
            warning: ais.warning,
            //tracking: hasTracking && ais.tracking
        });
        let item=assign({},ais,{color:color,key:ais.mmsi});
        if (item.mmsi == trackingTarget){
            item.selected=true;
        }
        items.push(item);
    }
    return {itemList:items};
};

const computeSummary=(state)=>{
    let empty={sortField:state.sortField||'cpa',numTargets:0,warning:undefined};
    let aisList=state.list;
    if (! aisList || aisList.length == 0) return empty;
    let rt=empty;
    for( let aisidx in aisList){
        let ais=aisList[aisidx];
        if (ais.warning) rt.warning=ais.mmsi;
    }
    rt.numTargets=aisList.length;
    return rt;
};

const sortDialog=()=>{
    let sortField=globalStore.getData(keys.gui.aispage.sortField,'cpa');
    let list=[
        {label:'CPA', value:'cpa'},
        {label:'TCPA',value:'tcpa'},
        {label:'DST',value:'distance'}
    ];
    for (let i in list){
        if (list[i].value == sortField) list[i].selected=true;
    }
    let p=OverlayDialog.selectDialogPromise('Sort Order',list);
    p.then(function(selected){
        globalStore.storeData(keys.gui.aispage.sortField,selected.value);
    });
};

const WARNING_CLASS='aisWarning';
class AisPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            {
                name:"AisNearest",
                onClick:()=>{
                    AisData.setTrackedTarget(0);
                    history.pop();
                }
            },
            {
                name:"AisSort",
                onClick:sortDialog

            },
            Mob.mobDefinition,
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.scrollWarning=this.scrollWarning.bind(this);
    }

    scrollWarning(ev){
        if (ev && ev.stopPropagation) ev.stopPropagation();
        let el=document.querySelector('.aisList .'+WARNING_CLASS);
        if (el) el.scrollIntoView();
    }

    componentDidMount(){
    }
    render(){
        let self=this;
        const AisItem=(props)=>{
            let fmt=AisFormatter;
            let fb=fmt.format('passFront',props);
            let style={
                color:props.color
            };
            let cl=props.addClass;
            if (props.warning) cl+=" "+WARNING_CLASS;
            let aisInfoKey=1;
            let clazz=fmt.format('clazz',props);
            if (clazz !== '') clazz="["+clazz+"]";
            return ( <div className={"aisListItem "+cl} onClick={props.onClick}>
                    <div className="aisItemFB" style={style}>
                        <span className="fb1">{fb.substr(0,1)}</span>{fb.substr(1)}
                    </div>
                    <div className="aisData">
                        <div className="aisData1">
                            {fmt.format('mmsi',props)}&nbsp;
                            {fmt.format('shipname',props)}&nbsp;
                            {clazz}
                        </div>
                        { aisInfos.map(function(info1){
                            aisInfoKey++;
                            return <div className="infoLine" key={aisInfoKey}>
                                {
                                    info1.map(function(info) {
                                        aisInfoKey++;
                                        return (
                                            <span className="aisInfoElement" key={aisInfoKey}>
                                                <span className="label">{info.label}: </span>
                                                <span className="info">{fmt.format(info.name,props)}{info.unit !== undefined && info.unit}</span>
                                            </span>
                                        );
                                    })
                                }
                            </div>
                        })}

                    </div>
                </div>
            );
        };
        const AisList=Dynamic(ItemList);
        const Summary=Dynamic(function(props){
            let color=PropertyHandler.getAisColor({
                warning: true
            });
            return (
                <div className="aisSummary" onClick={sortDialog}>
                    <span className="aisNumTargets">{props.numTargets} Targets</span>
                    {(props.warning) && <span className={WARNING_CLASS} style={{backgroundColor:color}}
                                              onClick={self.scrollWarning}/>}
                    <span>sorted by {fieldToLabel(props.sortField)}</span>
                </div>
            );
        });

        let MainContent=<React.Fragment>
            <Summary numTargets={0}
                     storeKeys={{
                        sortField:keys.gui.aispage.sortField,
                        updateCount:keys.nav.ais.updateCount,
                        list:keys.nav.ais.list
                        }}
                     updateFunction={computeSummary}
                />
                <AisList
                    itemClass={AisItem}
                    onItemClick={function (item) {
                                    history.replace('aisinfopage', {mmsi: item.mmsi});
                                }}
                    className="aisList"
                    storeKeys={{
                        updateCount:keys.nav.ais.updateCount,
                        list:keys.nav.ais.list,
                        tracked: keys.nav.ais.trackedMmsi,
                        sortField: keys.gui.aispage.sortField
                        }}
                    updateFunction={computeList}
                    scrollable={true}
                    />
            </React.Fragment>;

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="aispage"
                title="Ais"
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}

export default AisPage;