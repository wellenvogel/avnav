/**
 * Created by andreas on 02.05.14.
 */

import {UpdateFunction, useStore, useStoreState} from '../hoc/Dynamic';
import ItemList, {ItemListProps} from '../components/ItemList';
import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React, {SyntheticEvent, useRef} from 'react';
import PropertyHandler from '../util/propertyhandler';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
// @ts-ignore
import AisFormatter, {aisproxy} from '../nav/aisformatter';
import {
    showDialog,
    showPromiseDialog
} from '../components/OverlayDialog';
import Compare from "../util/compare";
import {AisInfoWithFunctions, aisNearestAction} from "../components/AisInfoDisplay";
import Helper, {avitem} from "../util/helper";
import ButtonList from "../components/ButtonList";
import {SelectDialog, ValueDialog} from "../components/BasicDialogs";
import {useHistory} from "../components/HistoryProvider";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import {IDialogContext, useDialogContext} from "../components/DialogContext";
import {scrollInContainer} from "../util/UiHelper";
// @ts-ignore
import cloneDeep from "clone-deep";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import AisPageButtons from "./AisPageButtons";
import {ButtonDef, updateButtons} from "../components/Button";
import { AisProxyItem } from '../nav/aistypes';
import {StoreKeys} from "../api/api.interface";

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

const fieldToLabel=(field:string)=>{
    let rt;
    sortFields.forEach((e)=>{ if(e.value==field) rt=e.label; });
    return rt||field;
};

const aisSortCreator=(sortField:string)=>{
    return (a:any,b:any)=> {
        if (sortField==='prio') {
            return a.priority - b.priority;
        }
        const useFmt=sortField === 'shipname';
        let fa = useFmt?AisFormatter.format(sortField,a):a[sortField];
        let fb = useFmt?AisFormatter.format(sortField,b):b[sortField];
        if (sortField.includes('cpa')) {
            // pull warnings up
            if (b.warning && !a.warning) return 1;
            if (a.warning && !b.warning) return -1;
            // push down passed CPAs
            const ta = a.tcpa, tb = b.tcpa;
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

const pad=(val:any,len:number)=>{
    let str = (''+val).trim();
    str = ' '.repeat(Math.max(0,len-str.length)) + str;
    return str;
}

interface AisItemProps extends AisProxyItem {
    addClass?: string;
    initialTarget?:boolean;
    warning?:boolean;
    hidden?:boolean;
    lost?:boolean;
    onClick?:(ev:SyntheticEvent) => void;
}

const AisItem=(props:AisItemProps)=>{
    const reduceDetails=globalStore.getData(keys.properties.aisReducedList,false);
    const fmt=AisFormatter;
    const fb=fmt.format('passFront',props)+"";
    const style={
        color:PropertyHandler.getAisColor(props)
    };
    const cl=Helper.concatsp(
        "aisListItem",
        props.addClass,
        props.initialTarget?"initialTarget":undefined,
        props.warning?WARNING_CLASS:undefined,
        props.hidden?HIDDEN_CLASS:undefined,
        props.lost?HIDDEN_CLASS:undefined);
    let clazz=fmt.format('clazz',props);
    if (clazz !== '') clazz="["+clazz+"]";
    let txt="";
    const infos=reduceDetails?reducedAisInfos:aisInfos;
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
            const unit=fmt.getUnit(info);
            if(!reduceDetails && unit) val+=unit;
            val=pad(val,reduceDetails?1:6);
            txt+=val;
            newLine=true;
        })
    })
    txt=txt.replace(/ /g,'\u2003');
    return ( <div className={cl} onClick={props.onClick}>
            <div className="aisItemFB" style={style}>
                <span className="fb1">{fb.substring(0,1)}</span>{fb.substr(1)}
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

const itemCompare=(oldValues:any,newValues:any)=>{
    return Compare(oldValues,newValues);
}

const MemoAisItem=React.memo(AisItem,itemCompare);

const WARNING_CLASS='aisWarning';
const HIDDEN_CLASS='aisHidden';
interface SummaryProps{
    numTargets?:number;
    warning?:boolean;
    scrollWarning?:(ev:SyntheticEvent) => void;
    searchValue?:string;
    storeKeys?:StoreKeys,
    sortField?:string,
    onClick:(ev:SyntheticEvent) => void;
    updateFunction?:UpdateFunction;
}
const Summary=(iprops:SummaryProps)=>{
    const sprops=useStore(iprops,{minTime:globalStore.getData(keys.properties.aisListUpdateTime,1)*1000})
    const color=PropertyHandler.getAisColor({
        warning: true
    });
    return (
        <div className="aisSummary" onClick={(ev)=>iprops.onClick(ev)}>
            <span className="aisNumTargets">{sprops.numTargets} Targets</span>
            {(sprops.warning) && <span className={WARNING_CLASS} style={{backgroundColor:color}}
                                      onClick={iprops.scrollWarning}/>}
            <span>sorted by {fieldToLabel(sprops.sortField)}</span>
            {(sprops.searchValue !== undefined) && <span>[{sprops.searchValue}]</span>}
        </div>
    );
};

const AisList=(iprops:Partial<ItemListProps>)=> {
    const props = useStore(iprops, {minTime: globalStore.getData(keys.properties.aisListUpdateTime, 1) * 1000});
    return <ItemList {...props}/>
}
interface ComputeSummaryProps{
    sortField:string;
    aisList:any[]
}
const computeSummary=({sortField,aisList}:ComputeSummaryProps)=>{
    const empty:{
      sortField:string;
      numTargets:number;
      warning?:number|string|undefined;
    }={sortField:sortField,numTargets:0,warning:undefined};
    if (! aisList || aisList.length === 0) return empty;
    const rt=empty;
    for( const aisidx in aisList){
        const ais=aisList[aisidx];
        if (ais.warning) rt.warning=ais.mmsi;
    }
    rt.numTargets=aisList.length;
    return rt;
};



interface ComputeListProps{
    aisList:any[];
    trackingTarget?:number|string;
    sortField?:string;
    searchActive?:boolean;
    searchValue?:string;
    initialMmsi?:string|number
}

const computeList=(
    {aisList,trackingTarget,sortField,searchActive,searchValue,initialMmsi}:ComputeListProps):{itemList:any[]}=>{
    if (! aisList) return {itemList:[]};
    const items=[];
    const sortFunction=aisSortCreator(sortField||sortFields[0].value);
    for( const aisidx in aisList){
        let ais={...aisList[aisidx]};
        ais=aisproxy(ais,true);
        if (! ais.mmsi) continue;
        if (searchActive){
            let found=false;
            ['name','mmsi','callsign','shipname'].forEach((n)=>{
                const v=ais[n];
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

const scrollWarning=(ev:SyntheticEvent)=>{
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const el=document.querySelector('.aisList .'+WARNING_CLASS);
    if (el) el.scrollIntoView();
}
export interface CompleteAisListProps{
    sortField?:string,
    searchActive?:boolean,
    searchValue?:string
    sortCallback?:()=>void,
    mmsi?:number|string,
    listLock?:boolean
}
export const CompleteAisList=(iprops:CompleteAisListProps)=>{
    const dialogContext=useDialogContext();
    const history=useHistory();
    const initialMmsi=useRef(iprops.mmsi)
    const sortField=iprops.sortField||sortFields[0].value;
    const aisListProps = iprops.listLock ?
        computeList(
            {
                sortField: sortField,
                searchActive: iprops.searchActive,
                searchValue: iprops.searchValue,
                initialMmsi: initialMmsi.current || '',
                aisList: globalStore.getData(keys.nav.ais.list),
                trackingTarget: globalStore.getData(keys.nav.ais.trackedMmsi)
            }
        )
        :
        {
            storeKeys: {
                updateCount: keys.nav.ais.updateCount,
                aisList: keys.nav.ais.list,
                trackingTarget: keys.nav.ais.trackedMmsi,
            },
            updateFunction: (state:{
                updateCount:number,
                aisList:any[],
                trackingTarget?:string|number
            }) => computeList({
                ...state,
                sortField: sortField,
                searchActive: iprops.searchActive,
                searchValue: iprops.searchValue,
                initialMmsi: initialMmsi.current
            })
        };
    return <React.Fragment>
    <Summary numTargets={0}
                    storeKeys={{
                        updateCount:keys.nav.ais.updateCount,
                        aisList:keys.nav.ais.list
                    }}
                    updateFunction={(state:{updateCount:number,aisList:any[]})=>computeSummary({...state,sortField:iprops.sortField})}
                    sortField={iprops.sortField}
                    searchValue={iprops.searchActive?iprops.searchValue:undefined}
                    scrollWarning={(el)=>scrollWarning(el)}
                    onClick={iprops.sortCallback}
    />
    <AisList
        itemClass={MemoAisItem}
        onItemClick={(ev)=> {
            const item=avitem(ev);
            const accessor=aisproxy(item);
            showDialog(dialogContext,()=>{
                return <AisInfoWithFunctions
                    mmsi={accessor.mmsi}
                    actionCb={(action:string)=>{
                        if (action === 'AisNearest' || action === 'AisInfoLocate'){
                            history.push(PAGEIDS.NAV);
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
            const selected=list.querySelector('.initialTarget');
            if (! selected) return;
            initialMmsi.current=undefined;
            const mode=scrollInContainer(list,selected as HTMLElement);
            if (mode < 1 || mode > 2) return;
            selected.scrollIntoView(mode===1);
        }}
    />
    </React.Fragment>
}

export interface CompleteAisListWithStoreProps{
    className?:string;
    sortField?:string;
    mmsi?:string|number;
    hidden?:boolean;
}

export const CompleteAisListWithStore=(props:CompleteAisListWithStoreProps)=>{
    const [sortField,]=useStoreState(keys.gui.aispage.sortField,props.sortField||sortFields[0].value);
    const [searchActive,]=useStoreState(keys.gui.aispage.searchActive,false);
    const [searchValue,]=useStoreState(keys.gui.aispage.searchValue,"");
    const [listLock,]=useStoreState( keys.properties.aisListLock, false)
    return <CompleteAisList
        sortField={sortField}
        searchActive={searchActive}
        searchValue={searchValue}
        sortCallback={sortDialog}
        listLock={listLock||props.hidden}
        mmsi={props.mmsi}
    />
}

export const sortDialog=(dialogContext?:IDialogContext)=>{
    const fields=cloneDeep(sortFields);
    const sortField=globalStore.getData(keys.gui.aispage.sortField);
    for (const i in fields) {
        fields[i].selected = fields[i].value === sortField;
    }
    showPromiseDialog(dialogContext,SelectDialog,{title:'Sort Order',list:fields})
        .then((selected:{value:string})=>{
            globalStore.storeData(keys.gui.aispage.sortField,selected.value);
        })
        .catch(()=>{})
};

export const searchActiveChange=(dialogContext?:IDialogContext)=>{
    const searchActive=globalStore.getData(keys.gui.aispage.searchActive);
    const setSearchActive=(searchActive:boolean)=> {
        globalStore.storeData(keys.gui.aispage.searchActive,searchActive);
    }
    if (searchActive){
        setSearchActive(false);
    }
    else{
        showPromiseDialog(dialogContext,(props)=><ValueDialog
            {...props}
            title={"filter"}
            value={globalStore.getData(keys.gui.aispage.searchValue)}
            clear={true}
        />)
            .then((value:string)=>{
                setSearchActive(true);
                globalStore.storeData(keys.gui.aispage.searchValue,value.toUpperCase());
            })
            .catch(()=>{});
    }
}
export interface AisButtonActionParam{
    nearestAction?:()=>void
}
export const AisButtonActions = ({nearestAction}:AisButtonActionParam) => {
    return {
        AisNearest: {
            onClick: () => {
                aisNearestAction();
                if (nearestAction) nearestAction();
            }
        },
        AisSort: {
            onClick: sortDialog

        },
        AisLock: {
            onClick: () => {
                globalStore.storeData(keys.properties.aisListLock, !globalStore.getData(keys.properties.aisListLock, false))
            },
            storeKeys: {toggle: keys.properties.aisListLock}

        },
        AisSearch: {
            onClick: () => {
                searchActiveChange();
            }
        }
    }
}

export interface AisPageProps extends PageProps{}
const AisPage =(props:AisPageProps)=>{
        const options=props.options||{};
        const currentButtons=useRef<ButtonDef[]>();
        const history=useHistory();
    useDialogContext();
    currentButtons.current=InjectMainMenu(props.id,
        updateButtons(AisPageButtons,AisButtonActions({
            nearestAction: ()=>history.push(PAGEIDS.NAV)
        })));
    useInitialButton(currentButtons);
        return (
            <PageFrame
                {...props}
                id={props.id}
                >
                <PageLeft id={props.id} title={getPageTitle(props.id)}>
                    <CompleteAisListWithStore
                        sortField={options.sortField}
                        mmsi={options.mmsi}
                    />
                </PageLeft>
                <ButtonList page={props.id} itemList={currentButtons.current}/>
            </PageFrame>
        );
}
export default AisPage;
