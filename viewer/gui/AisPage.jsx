/**
 * Created by andreas on 02.05.14.
 */

import {useStore, useStoreState} from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useRef} from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import Page, {PageFrame, PageLeft} from '../components/Page.jsx';
import AisFormatter, {aisproxy} from '../nav/aisformatter.jsx';
import Dialogs, {
    showDialog,
    showPromiseDialog,
    useDialogContext
} from '../components/OverlayDialog.jsx';
import Mob from '../components/Mob.js';
import Compare from "../util/compare";
import GuiHelper from "../util/GuiHelpers";
import navdata from "../nav/navdata";
import {AisInfoWithFunctions} from "../components/AisInfoDisplay";
import Helper, {avitem} from "../util/helper";
import ButtonList from "../components/ButtonList";
import {SelectDialog, ValueDialog} from "../components/BasicDialogs";

const aisInfos=[
    [ 'cpa', 'tcpa', 'bcpa', 'age'],
    [ 'distance', 'headingTo', 'course', 'speed', ],
    [ 'status', ],
    [ 'shiptype', 'aid_type', 'length', ]
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
    return (a,b)=> {
        if (sortField==='prio') {
            return a.priority - b.priority;
        }
        let useFmt=sortField === 'shipname';
        var fa = useFmt?AisFormatter.format(sortField,a):a[sortField];
        var fb = useFmt?AisFormatter.format(sortField,b):b[sortField];
        if (sortField.includes('cpa')) {
            // pull warnings up
            if (b.warning && !a.warning) return 1;
            if (a.warning && !b.warning) return -1;
            // push down passed CPAs
            let ta = a.tcpa, tb = b.tcpa;
            if (ta < 0 && tb >= 0) return 1;
            if (tb < 0 && ta >= 0) return -1;
            // if both passed CPA, sort by distance
            if (ta < 0 && tb < 0) { fa=a.distance; fb=b.distance; }
            return fa-fb;
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


const AisItem=(props)=>{
    let reduceDetails=globalStore.getData(keys.properties.aisReducedList,false);
    let fmt=AisFormatter;
    let fb=fmt.format('passFront',props);
    let style={
        color:PropertyHandler.getAisColor(props)
    };
    let cl=Helper.concatsp(
        "aisListItem",
        props.addClass,
        props.initialTarget?"initialTarget":undefined,
        props.warning?WARNING_CLASS:undefined,
        props.hidden?HIDDEN_CLASS:undefined,
        props.lost?HIDDEN_CLASS:undefined);
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
    txt=txt.replace(/ /g,'\u2003');
    return ( <div className={cl} onClick={props.onClick}>
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
const HIDDEN_CLASS='aisHidden';

const Summary=(iprops)=>{
    const props=useStore(iprops,{minTime:globalStore.getData(keys.properties.aisListUpdateTime,1)*1000})
    let color=PropertyHandler.getAisColor({
        warning: true
    });
    const dialogContext=useDialogContext();
    return (
        <div className="aisSummary" onClick={(ev)=>iprops.onClick(ev,dialogContext)}>
            <span className="aisNumTargets">{props.numTargets} Targets</span>
            {(props.warning) && <span className={WARNING_CLASS} style={{backgroundColor:color}}
                                      onClick={iprops.scrollWarning}/>}
            <span>sorted by {fieldToLabel(props.sortField)}</span>
            {(props.searchValue !== undefined) && <span>[{props.searchValue}]</span>}
        </div>
    );
};

const AisList=(iprops)=> {
    const props = useStore(iprops, {minTime: globalStore.getData(keys.properties.aisListUpdateTime, 1) * 1000});
    return <ItemList {...props}/>
}
const computeSummary=({sortField,aisList})=>{
    let empty={sortField:sortField,numTargets:0,warning:undefined};
    if (! aisList || aisList.length === 0) return empty;
    let rt=empty;
    for( let aisidx in aisList){
        let ais=aisList[aisidx];
        if (ais.warning) rt.warning=ais.mmsi;
    }
    rt.numTargets=aisList.length;
    return rt;
};




const computeList=({aisList,trackingTarget,sortField,searchActive,searchValue,initialMmsi})=>{
    if (! aisList) return {itemList:[]};
    let items=[];
    let sortFunction=aisSortCreator(sortField||sortFields[0]);
    for( let aisidx in aisList){
        let ais={...aisList[aisidx]};
        ais=aisproxy(ais,true);
        if (! ais.mmsi) continue;
        if (searchActive){
            let found=false;
            ['name','mmsi','callsign','shipname'].forEach((n)=>{
                let v=ais[n];
                if (! v) return;
                if ((v+"").toUpperCase().indexOf(searchValue) >= 0) found=true;
            });
            if (! found) continue;
        }
        ais.color=PropertyHandler.getAisColor({
            nearest: ais.nearest,
            warning: ais.warning,
            //tracking: hasTracking && ais.tracking
        });
        if (ais.mmsi == trackingTarget){
            ais.selected=true;
        }
        if (initialMmsi && ais.mmsi ===  initialMmsi){
            ais.initialTarget=true;
        }
        items.push(ais);
    }
    items.sort(sortFunction);
    return {itemList:items};
};

const scrollWarning=(ev)=>{
    if (ev && ev.stopPropagation) ev.stopPropagation();
    let el=document.querySelector('.aisList .'+WARNING_CLASS);
    if (el) el.scrollIntoView();
}
const AisPage =(props)=>{
        const options=props.options||{};
        let initialMmsi=useRef(options.mmsi);
        const [sortField,setSortField]=useStoreState(keys.gui.aispage.sortField,options.sortField||sortFields[0].value);
        const [searchActive,setSearchActive]=useStoreState(keys.gui.aispage.searchActive,false);
        const [searchValue,setSearchValue]=useStoreState(keys.gui.aispage.searchValue,"");
        const dialogContext=useRef();
        const sortDialog=useCallback(()=> {
            for (let i in sortFields) {
                sortFields[i].selected = sortFields[i].value === sortField;
            }
            showPromiseDialog(dialogContext,SelectDialog,{title:'Sort Order',list:sortFields})
                .then((selected)=>{
                     setSortField(selected.value);
                })
                .catch(()=>{})
        },[sortField]);
        const buttons=[
            {
                name:"AisNearest",
                onClick:()=>{
                    navdata.getAisHandler().setTrackedTarget(0);
                    props.history.pop();
                }
            },
            {
                name:"AisSort",
                onClick:sortDialog

            },
            {
                name:"AisLock",
                onClick:()=>{globalStore.storeData(keys.properties.aisListLock,!globalStore.getData(keys.properties.aisListLock,false))},
                storeKeys: {toggle:keys.properties.aisListLock}

            },
            {
                name:'AisSearch',
                onClick: ()=>{
                    if (searchActive){
                        setSearchActive(false);
                    }
                    else{
                        showPromiseDialog(dialogContext.current,(props)=><ValueDialog
                            {...props}
                            title={"filter"}
                            value={searchValue}
                            clear={true}
                        />)
                            .then((value)=>{
                                setSearchActive(true);
                                setSearchValue(value.toUpperCase());
                            })
                            .catch((e)=>{});
                    }
                },
                toggle:()=>searchActive
            },
            Mob.mobDefinition(props.history),
            {
                name: 'Cancel',
                onClick: ()=>{props.history.pop()}
            }
        ];
    let aisListProps = globalStore.getData(keys.properties.aisListLock, false) ?
        computeList(Object.assign(
            {
                sortField: sortField,
                searchActive: searchActive,
                searchValue: searchValue,
                initialMmsi: initialMmsi.current
            },
            globalStore.getMultiple({
                aisList: keys.nav.ais.list,
                trackingTarget: keys.nav.ais.trackedMmsi
            })
        ))
        :
        {
            storeKeys: {
                updateCount: keys.nav.ais.updateCount,
                aisList: keys.nav.ais.list,
                trackingTarget: keys.nav.ais.trackedMmsi,
            },
            updateFunction: (state) => computeList({
                ...state,
                sortField: sortField,
                searchActive: searchActive,
                searchValue: searchValue,
                initialMmsi: initialMmsi.current
            })
        };
        return (
            <PageFrame
                {...props}
                id="aispage"
                title="Ais">
                <PageLeft dialogCtxRef={dialogContext}>
                    <Summary numTargets={0}
                             storeKeys={{
                                 updateCount:keys.nav.ais.updateCount,
                                 aisList:keys.nav.ais.list
                             }}
                             updateFunction={(state)=>computeSummary({...state,sortField:sortField})}
                             sortField={sortField}
                             searchValue={searchActive?searchValue:undefined}
                             scrollWarning={(el)=>scrollWarning(el)}
                             onClick={sortDialog}
                    />
                    <AisList
                        itemClass={MemoAisItem}
                        onItemClick={(ev)=> {
                            const item=avitem(ev);
                            let accessor=aisproxy(item);
                            showDialog(dialogContext.current,()=>{
                                return <AisInfoWithFunctions
                                    mmsi={accessor.mmsi}
                                    actionCb={(action,m)=>{
                                        if (action === 'AisNearest' || action === 'AisInfoLocate'){
                                            props.history.pop();
                                        }
                                    }}
                                />;
                            })
                        }}
                        className="aisList"
                        keyFunction={(item)=>item.mmsi}
                        {...aisListProps}
                        scrollable={true}
                        listRef={(list)=>{
                            if (!list) return;
                            if (! initialMmsi.current) return;
                            let selected=list.querySelector('.initialTarget');
                            if (! selected) return;
                            initialMmsi.current=undefined;
                            let mode=GuiHelper.scrollInContainer(list,selected);
                            if (mode < 1 || mode > 2) return;
                            selected.scrollIntoView(mode===1);
                        }}
                    />
                </PageLeft>
                <ButtonList itemList={buttons}/>
            </PageFrame>
        );
}
AisPage.propTypes= Page.pageProperties;
export default AisPage;
