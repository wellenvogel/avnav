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
import assign from 'object-assign';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Mob from '../components/Mob.js';
import Compare from "../util/compare";
import GuiHelper from "../util/GuiHelpers";
import navdata from "../nav/navdata";
import Dialogs from "../components/OverlayDialog.jsx";

const aisInfos=[
    [ 'cpa', 'tcpa', 'bcpa', ],
    [ 'distance', 'headingTo', 'course', 'speed', ],
//     [ 'headingTo', 'distance', ],
//     [ 'course', 'speed', 'heading', 'turn', ],
    [ 'status', ],
//     [ 'status', 'age', ],
    [ 'shiptype', 'aid_type', 'length', ],
//     [ 'shiptype', 'aid_type', 'callsign', 'destination', ],
//     [ 'length', 'beam', 'draught', ],
];
const reducedAisInfos=[
    [ 'cpa', 'tcpa', 'distance', 'course', 'speed', ],
];

const sortFields = [
    {label:'Priority', value:'prio'},
    {label:'DCPA', value:'cpa'},
    {label:'TCPA',value:'tcpa'},
    {label:'DST',value:'distance'},
    {label:'Name',value:'shipname'},
    {label:'MMSI',value:'mmsi'},
];

const fieldToLabel=(field)=>{
    let rt;
    sortFields.forEach((e)=>{ if(e.value==field) rt=e.label; });
    return rt||field;
};

const aisSortCreator=(sortField)=>{
    let warningDist = globalStore.getData(keys.properties.aisWarningCpa); // meter
    let warningTime = globalStore.getData(keys.properties.aisWarningTpa); // seconds
    return (a,b)=> {
        if (sortField=='prio') {
            // combined relative distance of CPA
            var fa = a.tcpa/warningTime + a.cpa/warningDist;
            var fb = b.tcpa/warningTime + b.cpa/warningDist;
        } else {
            let useFmt=sortField === 'shipname';
            var fa = useFmt?AisFormatter.format(sortField,a):a[sortField];
            var fb = useFmt?AisFormatter.format(sortField,b):b[sortField];
        }
        if (sortField.includes('cpa') || sortField=='prio') {
            // pull warnings up
            if (b.warning && !a.warning) return 1;
            if (a.warning && !b.warning) return -1;
            // push passed CPAs down
            let ta = a.tcpa, tb = b.tcpa;
            if (ta < 0 && tb >= 0) return 1;
            if (tb < 0 && ta >= 0) return -1;
            return Math.abs(fa)-Math.abs(fb);
        }
        if (typeof(fa) === 'string') fa=fa.toUpperCase();
        if (typeof(fb) === 'string') fb=fb.toUpperCase();
        if (fa < fb) return -1;
        if (fa > fb) return 1;
        if (fa == fb) return 0;
    };
};

const pad=(val,len)=>{
    let str = (''+val).trim();
    str = ' '.repeat(Math.max(0,len-str.length)) + str;
    return str;
}

const sortDialog=(sortField)=>{
    for (let i in sortFields){
        if (sortFields[i].value === sortField) sortFields[i].selected=true;
    }
    return OverlayDialog.selectDialogPromise('Sort Order',sortFields);
};

const AisItem=(props)=>{
    let reduceDetails=globalStore.getData(keys.properties.aisReducedList,false);
    let fmt=AisFormatter;
    let fb=fmt.format('passFront',props);
    let style={
        color:props.color
    };
    let cl=props.addClass||'';
    if (props.initialTarget) cl+=" initialTarget";
    if (props.warning) cl+=" "+WARNING_CLASS;
    let clazz=fmt.format('clazz',props);
    if (clazz !== '') clazz="["+clazz+"]";
    let txt="";
    let infos=reduceDetails?reducedAisInfos:aisInfos;
    let newLine=false;
    infos.forEach((infoLine)=>{
        if (newLine) txt+="\n";
        newLine=false;
        infoLine.forEach((info)=>{
            if (! fmt.shouldShow(info,props)) return;
            if (newLine) txt+='  ';
            let lbl=fmt.getHeadline(info)+":";
            lbl=pad(lbl,reduceDetails?1:5);
            txt+=lbl+' ';
            let val=(fmt.format(info,props)||'');
            let unit=fmt.getUnit(info);
            if(!reduceDetails && unit) val+=unit;
            val=pad(val,reduceDetails?1:6);
            txt+=val;
            newLine=true;
        })
    })
    txt=txt.replace(/ /g,'\xa0');
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
    return Compare(oldValues,newValues);
}

const MemoAisItem=React.memo(AisItem,itemCompare);

const WARNING_CLASS='aisWarning';
class AisPage extends React.Component{
    constructor(props){
        super(props);
        if (props.options && props.options.mmsi){
            this.initialMmsi=props.options.mmsi;
        }
        let sortField=sortFields[0].value;
        if (props.options && props.options.sortField){
            sortField=props.options.sortField;
        }
        this.state={
            sortField: sortField,
            searchValue:'',
            searchActive:false
        };
        this.searchHandler=GuiHelper.storeHelperState(this,{searchActive:keys.gui.aispage.searchActive,searchValue: keys.gui.aispage.searchValue});
        this.scrollWarning=this.scrollWarning.bind(this);
        this.computeList=this.computeList.bind(this);
        this.sortDialog=this.sortDialog.bind(this);
        this.computeSummary=this.computeSummary.bind(this);
        this.buttons=[
            {
                name:"AisNearest",
                onClick:()=>{
                    navdata.getAisHandler().setTrackedTarget(0);
                    this.props.history.pop();
                }
            },
            {
                name:"AisSort",
                onClick:this.sortDialog

            },
            {
                name:"AisLock",
                onClick:()=>{globalStore.storeData(keys.properties.aisListLock,!globalStore.getData(keys.properties.aisListLock,false))},
                storeKeys: {toggle:keys.properties.aisListLock}

            },
            {
                name:'AisSearch',
                onClick: ()=>{
                    if (this.state.searchActive){
                        this.searchHandler.setMultiple({searchActive:false});
                    }
                    else{
                        Dialogs.valueDialogPromise("filter",this.state.searchValue,undefined,true)
                            .then((value)=>{
                                this.searchHandler.setMultiple({searchValue:value.toUpperCase(),searchActive: true});
                            })
                            .catch((e)=>{});
                    }
                },
                toggle:()=>this.state.searchActive
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        this.listRef=undefined;
    }

    getSnapshotBeforeUpdate(prevProps, prevState) {
        if (! this.listRef) return null;
        return this.listRef.scrollTop;
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (snapshot === undefined || snapshot === null) return;
        if (this.initialMmsi !== undefined) return ;
        if (! this.listRef) return;
        this.listRef.scrollTop=snapshot;
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
            if (this.state.searchActive){
                let found=false;
                ['name','mmsi','callsign','shipname'].forEach((n)=>{
                    let v=ais[n];
                    if (! v) return;
                    if ((v+"").toUpperCase().indexOf(this.state.searchValue) >= 0) found=true;
                });
                if (! found) continue;
            }
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
        let updateTime=globalStore.getData(keys.properties.aisListUpdateTime,1)*1000;
        const AisList=Dynamic(ItemList,{minTime:updateTime});
        const Summary=Dynamic((props)=>{
            let color=PropertyHandler.getAisColor({
                warning: true
            });
            return (
                <div className="aisSummary" onClick={this.sortDialog}>
                    <span className="aisNumTargets">{props.numTargets} Targets</span>
                    {(props.warning) && <span className={WARNING_CLASS} style={{backgroundColor:color}}
                                              onClick={this.scrollWarning}/>}
                    <span>sorted by {fieldToLabel(this.state.sortField)}</span>
                    {(props.searchValue !== undefined) && <span>[{props.searchValue}]</span>}
                </div>
            );
        },{minTime:updateTime});
        let aisListProps = globalStore.getData(keys.properties.aisListLock, false) ?
            this.computeList(globalStore.getMultiple({
                list: keys.nav.ais.list,
                tracked: keys.nav.ais.trackedMmsi,
            }))
            :
            {
                storeKeys: {
                    updateCount: keys.nav.ais.updateCount,
                    list: keys.nav.ais.list,
                    tracked: keys.nav.ais.trackedMmsi,
                },
                updateFunction: this.computeList
            };
        let MainContent=<React.Fragment>
            <Summary numTargets={0}
                     storeKeys={{
                        updateCount:keys.nav.ais.updateCount,
                        list:keys.nav.ais.list
                        }}
                     updateFunction={this.computeSummary}
                     sortField={this.state.sortField}
                     searchValue={this.state.searchActive?this.state.searchValue:undefined}
                />
                <AisList
                    itemClass={MemoAisItem}
                    onItemClick={(item)=> {
                        this.props.history.setOptions({mmsi:item.mmsi});
                        this.props.history.replace('aisinfopage', {mmsi: item.mmsi});
                        }}
                    className="aisList"
                    {...aisListProps}
                    scrollable={true}
                    listRef={(list)=>{
                        this.listRef=list;
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
                buttonList={this.buttons}/>
        );
    }
}
AisPage.propTypes= Page.pageProperties;
export default AisPage;
