/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import Page from '../components/Page.jsx';
import AisFormatter from '../nav/aisformatter.jsx';
import AisData from '../nav/aisdata.js';
import assign from 'object-assign';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Mob from '../components/Mob.js';
import ShallowCompare from "../util/shallowcompare";
import GuiHelper from "../util/GuiHelpers";

const aisInfos=[
    [
        {name:'distance',label:'Dst ',unit:'nm',len:6},
        {name:'cpa',label:'Cpa ',unit:'nm',len:6},
        {name:'tcpa',label:'Tcpa',unit:'h',len:8}
    ],
    [
        {name:'course',label:'Cog ',unit:'°',len:6},
        {name:'speed',label:'Sog ',unit:'kn',len:6},
        {name:'heading',label:'Hdg ',unit:'°',len:8}
    ],
    [
        {name:'shiptype',label:'Type'},
        {name:'callsign',label:'Call'},
        {name:'destination',label:'Dest'}
    ]
];
const reducedAisInfos=[
    aisInfos[0]
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

const formatFixed=(val,len)=>{
    let str=new Array(len+1).join(' ')+val;
    return str.substr(str.length-len);

}





const sortDialog=(sortField)=>{
    let list=[
        {label:'CPA', value:'cpa'},
        {label:'TCPA',value:'tcpa'},
        {label:'DST',value:'distance'}
    ];
    for (let i in list){
        if (list[i].value === sortField) list[i].selected=true;
    }
    return OverlayDialog.selectDialogPromise('Sort Order',list);
};

const AisItem=(props)=>{
    let reduceDetails=globalStore.getData(keys.properties.aisReducedList,true);
    let fmt=AisFormatter;
    let fb=fmt.format('passFront',props);
    let style={
        color:props.color
    };
    let cl=props.addClass||'';
    if (props.initialTarget) cl+=" initialTarget";
    if (props.warning) cl+=" "+WARNING_CLASS;
    let aisInfoKey=1;
    let clazz=fmt.format('clazz',props);
    if (clazz !== '') clazz="["+clazz+"]";
    let txt="";
    let infos=reduceDetails?reducedAisInfos:aisInfos;
    infos.forEach((infoLine)=>{
        if (txt !== "") txt+="\n";
        infoLine.forEach((info)=>{
            txt+=(info.label+": ").replace(/ /g,'\xa0');
            let val=(fmt.format(info.name,props)||'');
            if (info.len){
                val=formatFixed(val,info.len);
            }
            txt+=val.replace(/ /g,'\xa0');
            txt+="  ";
        })
    })
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
                <div className="aisData2">{txt}</div>
            </div>
        </div>
    );
};

const itemCompare=(oldValues,newValues)=>{
    return ShallowCompare(oldValues,newValues);
}

const MemoAisItem=React.memo(AisItem,itemCompare);

const WARNING_CLASS='aisWarning';
class AisPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        if (props.options && props.options.mmsi){
            this.initialMmsi=props.options.mmsi;
        }
        let sortField='cpa';
        if (props.options && props.options.sortField){
            sortField=props.options.sortField;
        }
        this.state={
            sortField: sortField
        }
        this.buttons=[
            {
                name:"AisNearest",
                onClick:()=>{
                    AisData.setTrackedTarget(0);
                    self.props.history.pop();
                }
            },
            {
                name:"AisSort",
                onClick:this.sortDialog

            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{self.props.history.pop()}
            }
        ];
        this.scrollWarning=this.scrollWarning.bind(this);
        this.computeList=this.computeList.bind(this);
        this.sortDialog=this.sortDialog.bind(this);
        this.computeSummary=this.computeSummary.bind(this);
    }
    computeSummary(state){
        let empty={sortField:this.state.sortField||'cpa',numTargets:0,warning:undefined};
        let aisList=state.list;
        if (! aisList || aisList.length === 0) return empty;
        let rt=empty;
        for( let aisidx in aisList){
            let ais=aisList[aisidx];
            if (ais.warning) rt.warning=ais.mmsi;
        }
        rt.numTargets=aisList.length;
        return rt;
    };
    computeList(state){
        let aisList=state.list;
        if (! aisList) return {itemList:[]};
        let trackingTarget=state.tracked;
        let items=[];
        let sortFunction=aisSortCreator(this.state.sortField||'cpa');
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
            if (this.initialMmsi && item.mmsi ===  this.initialMmsi){
                item.initialTarget=true;
            }
            items.push(item);
        }
        return {itemList:items};
    };
    scrollWarning(ev){
        if (ev && ev.stopPropagation) ev.stopPropagation();
        let el=document.querySelector('.aisList .'+WARNING_CLASS);
        if (el) el.scrollIntoView();
    }
    sortDialog(){
        sortDialog(this.state.sortField)
            .then((selected)=>{
                this.setState({sortField:selected.value});
                this.props.history.setOptions({sortField:selected.value});
            })
            .catch(()=>{})
    }
    componentDidMount(){
    }
    render(){
        let self=this;
        let updateTime=globalStore.getData(keys.properties.aisListUpdateTime,1)*1000;
        const AisList=Dynamic(ItemList,{minTime:updateTime});
        const Summary=Dynamic(function(props){
            let color=PropertyHandler.getAisColor({
                warning: true
            });
            return (
                <div className="aisSummary" onClick={self.sortDialog}>
                    <span className="aisNumTargets">{props.numTargets} Targets</span>
                    {(props.warning) && <span className={WARNING_CLASS} style={{backgroundColor:color}}
                                              onClick={self.scrollWarning}/>}
                    <span>sorted by {fieldToLabel(self.state.sortField)}</span>
                </div>
            );
        },{minTime:updateTime});
        let MainContent=<React.Fragment>
            <Summary numTargets={0}
                     storeKeys={{
                        updateCount:keys.nav.ais.updateCount,
                        list:keys.nav.ais.list
                        }}
                     updateFunction={this.computeSummary}
                     sortField={this.state.sortField}
                />
                <AisList
                    itemClass={MemoAisItem}
                    onItemClick={function (item) {
                        self.props.history.setOptions({mmsi:item.mmsi});
                        self.props.history.replace('aisinfopage', {mmsi: item.mmsi});
                        }}
                    className="aisList"
                    storeKeys={{
                        updateCount:keys.nav.ais.updateCount,
                        list:keys.nav.ais.list,
                        tracked: keys.nav.ais.trackedMmsi,
                        }}
                    updateFunction={this.computeList}
                    scrollable={true}
                    listRef={(list)=>{
                        if (!list) return;
                        if (! this.initialMmsi) return;
                        let selected=list.querySelector('.initialTarget');
                        if (! selected) return;
                        this.initialMmsi=undefined;
                        let mode=GuiHelper.scrollInContainer(list,selected);
                        if (mode < 1 || mode > 2) return;
                        selected.scrollIntoView(mode===1);
                    }}
                    />
            </React.Fragment>;

        return (
            <Page
                {...this.props}
                id="aispage"
                title="Ais"
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}
AisPage.propTypes= Page.pageProperties;
export default AisPage;