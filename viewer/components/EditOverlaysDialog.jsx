import React from 'react';
import PropTypes from 'prop-types';
import OverlayDialog,{dialogHelper} from './OverlayDialog.jsx';
import assign from 'object-assign';
import {ParamValueInput} from './ParamValueInput';
import {Input,Checkbox,InputReadOnly,InputSelect,ColorSelector,Radio} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import Button from './Button.jsx';
import ItemList from './ItemList.jsx';
import Requests from '../util/requests.js';
import Toast from './Toast.jsx';
import Helper from '../util/helper.js';
import GuiHelpers, {stateHelper} from '../util/GuiHelpers.js';
import {readFeatureInfoFromGpx} from '../map/gpxchartsource';
import {readFeatureInfoFromKml} from '../map/kmlchartsource';
import {getOverlayConfigName} from '../map/chartsourcebase'
import globalStore from "../util/globalstore";
import keys from '../util/keys';
import OverlayConfig, {getKeyFromOverlay,OVERLAY_ID} from '../map/overlayconfig';
import DefaultGpxIcon from '../images/icons-new/DefaultGpxPoint.png'
import {readFeatureInfoFromGeoJson} from "../map/geojsonchartsource";
import featureFormatters from '../util/featureFormatter';
import chartImage from '../images/Chart60.png';
import {createEditableParameter,EditableParameter} from "./EditableParameters";
import {getKnownStyleParam} from "../map/chartsourcebase";
import {moveItem, useAvNavSortable} from "../hoc/Sortable";

const filterOverlayItem=(item,opt_itemInfo)=>{
    let rt=undefined;
    if (item.type === 'chart') {
        let filter={chartKey:true,type:true,opacity:true,enabled:true};
        filter[OVERLAY_ID]=true;
        rt=Helper.filteredAssign(filter,item)
    }
    else {
        rt = assign({}, item);
    }
    for (let k in rt){
        if (typeof rt[k] === 'function'){
            delete rt[k];
        }
    }
    delete rt.selected;
    delete rt.index;
    delete rt.disabled;
    let dstyles=['style.lineWidth','style.lineColor'];
    if (opt_itemInfo){
        dstyles.forEach((st)=> {
            if (!opt_itemInfo[st]) delete rt[st];
        })
        if (! opt_itemInfo.hasSymbols && ! opt_itemInfo.hasLinks){
            delete rt.icons;
        }
    }
    return rt;
};
export const KNOWN_OVERLAY_EXTENSIONS=['gpx','kml','kmz','geojson'];
const KNOWN_ICON_FILE_EXTENSIONS=['zip'];
const TYPE_LIST=[
    {label: 'overlay', value: 'overlay'},
    {label: 'chart', value: 'chart'},
    {label: 'route', value: 'route'},
    {label: 'track', value: 'track'},
    ]
const itemSort=(a,b)=>{
    let na=a.name;
    let nb=b.name;
    if (na === undefined && nb === undefined) return 0;
    if (na === undefined) return -1;
    if (nb === undefined) return 1;
    na=na.toUpperCase();
    nb=nb.toUpperCase();
    if (na < nb) return -1;
    if (na > nb) return 1;
    return 0;
}
const trackSort=(a,b)=>{
    let ta=a.time;
    let tb=b.time;
    if (ta < tb) return 1;
    if (ta > tb) return -1;
    return 0;
}
class OverlayItemDialog extends React.Component{
    constructor(props) {
        super(props);
        this.dialogHelper = dialogHelper(this);
        this.state= {
            itemsFetchCount: 0,
            itemInfo: undefined,
            loading: false
        }
        this.sortLists=['icons','chart','overlay','images','user','knownOverlays','iconFiles','route','track']
        this.stateHelper = stateHelper(this, props.current || {},'item');
        this.state.itemsFetchCount = 0;
        //we make them only a variable as we consider them to be static
        this.itemLists={
            icons:[{label:"--none--"},{label:"--DefaultGpxIcon--",value:DefaultGpxIcon}],
            chart:[],
            overlay:[],
            images:[],
            user:[],
            knownOverlays:[],
            iconFiles:[{label:"--none--"}],
            route:[],
            track:[]};

        this.getItemList('chart');
        this.getItemList('overlay');
        this.getItemList('images');
        this.getItemList('user');
        this.getItemList('route');
        this.getItemList('track');
    }
    componentDidMount() {
        if (this.props.current && this.props.current.url && this.props.current.type !== 'chart') {
            this.analyseOverlay(this.props.current.url);
        }
    }

    getItemList(type){
        Requests.getJson("",{},{
            request: 'listdir',
            type: type
        })
        .then((data)=>{
                this.itemLists[type]=data.items;
                if (type == 'user' || type == 'images' || type == 'overlay') {
                    data.items.forEach((item)=>{
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(item.name)) >= 0) {
                            let el=assign({},item);
                            el.label=el.url;
                            el.value=el.url;
                            this.itemLists.icons.push(el);
                        }
                    })
                }
                if (type == 'chart'){
                    //prepare select list
                    data.items.forEach((item)=>{
                        item.label=item.name;
                        item.value=item.chartKey;
                    });
                }
                if (type === 'overlay'|| type === 'route' || type === 'track'){
                    data.items.forEach((item)=>{
                        item.type=type;
                        if (type === 'route'){
                            if (! item.url) item.url=globalStore.getData(keys.properties.navUrl)+
                                "?request=download&type=route&name="+encodeURIComponent(item.name)+"&extension=.gpx";
                            if (! item.name.match(/\.gpx/)) item.name+=".gpx";
                        }
                        item.label=item.name;
                        item.value=item.url;
                        if (KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(item.name))>=0){
                            this.itemLists.knownOverlays.push(item);
                        }
                        if (KNOWN_ICON_FILE_EXTENSIONS.indexOf(Helper.getExt(item.name))>=0){
                            this.itemLists.iconFiles.push(assign({},item,{label:item.url}));
                        }
                    });
                }
                this.sortLists.forEach((list)=>{
                    this.itemLists[list].sort(itemSort);
                });
                this.setState({itemsFetchCount:this.state.itemsFetchCount+1})
            })
        .catch((error)=>{
                Toast("error fetching list of "+type+": "+error);
            })
    }
    changeType(newType){
        if (newType === this.stateHelper.getValue('type')) return;
        let newState={
            type: newType,
            name: undefined
        };
        this.stateHelper.setState(newState);
    }
    analyseOverlay(url,initial){
        this.setState({loading:true,itemInfo:undefined});
        Requests.getHtmlOrText(url)
            .then((data)=>{
                try {
                    let featureInfo;
                    let ext=Helper.getExt(url);
                    if (ext === 'gpx'){
                        featureInfo= readFeatureInfoFromGpx(data);
                    }
                    if (ext === 'kml') {
                        featureInfo =readFeatureInfoFromKml(data);
                    }
                    if (ext === 'geojson') {
                        featureInfo =readFeatureInfoFromGeoJson(data);
                    }
                    if (! featureInfo.hasAny){
                        Toast(url+" is no valid overlay file");
                        this.setState({loading:false,itemInfo:{}});
                        this.stateHelper.setValue('name',undefined);
                    }
                    let newState={loading:false,itemInfo: featureInfo};
                    this.setState(newState);
                    if (initial) {
                        let newItemState = {};
                        newItemState['style.lineWidth'] = (featureInfo.hasRoute) ? globalStore.getData(keys.properties.routeWidth) :
                            globalStore.getData(keys.properties.trackWidth);
                        newItemState['style.lineColor'] = (featureInfo.hasRoute) ? globalStore.getData(keys.properties.routeColor) :
                            globalStore.getData(keys.properties.trackColor);
                        newItemState['style.fillColor'] = newItemState['style.lineColor'];
                        newItemState['style.circleWidth'] = newItemState['style.lineWidth'] * 3;
                        this.stateHelper.setState(newItemState);
                    }
                }catch (e){
                    Toast(url+" is no valid overlay: "+e.message);
                    this.setState({loading:false,itemInfo:{}});
                    this.stateHelper.setValue('name',undefined);
                }
            })
            .catch((error)=>{
                Toast("unable to load "+url+": "+error)
                this.setState({loading:false,itemInfo:{}});
                this.stateHelper.setValue('name',undefined);
            })
    }
    filteredNameList(){
        let currentType=this.stateHelper.getValue('type');
        let rt=[];
        this.itemLists.knownOverlays.forEach((item)=>{
            if (item.type === currentType) rt.push(item);
        })
        if (currentType === 'track'){
            rt.sort(trackSort);
        }
        return rt;
    }
    render(){
        let hasChanges=this.stateHelper.isChanged();
        let currentType=this.stateHelper.getValue('type');
        let itemInfo=this.state.itemInfo||{ };
        let defaultLineWith=(itemInfo.hasRoute)?globalStore.getData(keys.properties.routeWidth):
            globalStore.getData(keys.properties.trackWidth);
        let defaultColor=(itemInfo.hasRoute)?globalStore.getData(keys.properties.routeColor):
            globalStore.getData(keys.properties.trackColor);
        let iconsReadOnly=Helper.getExt(this.stateHelper.getValue('name')) === 'kmz';
        let formatters=[{label:'-- none --',value:undefined}];
        for (let f in featureFormatters){
            if (typeof(featureFormatters[f]) === 'function'){
                formatters.push({label:f,value:f});
            }
        }
        return(
            <React.Fragment>
                <div className="selectDialog editOverlayItemDialog">
                    <h3 className="dialogTitle">{this.props.title || 'Edit Overlay'}</h3>
                    <div className="dialogRow info"><span
                        className="inputLabel">Overlay</span>{this.stateHelper.getValue('name')}</div>
                    {this.state.isLoading ?
                        <div className="loadingIndicator">Analyzing...</div>
                        :
                        <React.Fragment>
                            <Checkbox
                                className="enabled"
                                dialogRow={true}
                                label="enabled"
                                onChange={(nv) => this.stateHelper.setState({enabled: nv})}
                                value={this.stateHelper.getValue("enabled") || false}/>
                            <Radio
                                className="type"
                                dialogRow={true}
                                label="type"
                                value={currentType}
                                itemList={TYPE_LIST}
                                onChange={(nv) => this.changeType(nv)}
                            />
                            <Input
                                className="opacity"
                                dialogRow={true}
                                label="opacity"
                                value={this.stateHelper.getValue('opacity')}
                                onChange={(nv) => this.stateHelper.setValue('opacity', parseFloat(nv))}
                                type="number"
                            />
                            {(currentType == 'chart') ?
                                <React.Fragment>
                                    <InputSelect
                                        dialogRow={true}
                                        label="chart name"
                                        value={{
                                            value: this.stateHelper.getValue('chartKey'),
                                            label: this.stateHelper.getValue('name')
                                        }}
                                        list={this.itemLists.chart}
                                        fetchCount={this.state.itemsFetchCount}
                                        showDialogFunction={this.dialogHelper.showDialog}
                                        onChange={(nv) => {
                                            this.stateHelper.setState({chartKey: nv.chartKey, name: nv.name});
                                        }}
                                    />
                                </React.Fragment> :
                                <React.Fragment>
                                    <InputSelect
                                        dialogRow={true}
                                        label="overlay name"
                                        value={this.stateHelper.getValue('name')}
                                        list={this.filteredNameList()}
                                        fetchCount={this.state.itemsFetchCount}
                                        showDialogFunction={this.dialogHelper.showDialog}
                                        onChange={(nv) => {
                                            let newState={url: nv.url, name: nv.name};
                                            if (Helper.getExt(nv.name) === 'kmz'){
                                                newState.icons=nv.url;
                                                newState.url+="/doc.kml";
                                            }
                                            let initial=this.stateHelper.getValue('name') === undefined;
                                            this.stateHelper.setState(newState);
                                            this.analyseOverlay(newState.url,initial);
                                        }}
                                    />
                                    {!iconsReadOnly && (itemInfo.hasSymbols || itemInfo.hasLinks) && <InputSelect
                                        dialogRow={true}
                                        label="icon file"
                                        value={this.stateHelper.getValue('icons')}
                                        list={this.itemLists.iconFiles}
                                        fetchCount={this.state.itemsFetchCount}
                                        showDialogFunction={this.dialogHelper.showDialog}
                                        onChange={(nv) => {
                                            this.stateHelper.setState({icons: nv.url});
                                        }}
                                    />
                                    }
                                    {iconsReadOnly &&<InputReadOnly
                                        dialogRow={true}
                                        label="icon file"
                                        value={this.stateHelper.getValue('icons')}
                                        />}
                                    {itemInfo.allowOnline && <Checkbox
                                        dialogRow={true}
                                        label="allow online"
                                        value={this.stateHelper.getValue('allowOnline')||false}
                                        onChange={(nv)=>this.stateHelper.setValue('allowOnline',nv)}
                                    />}
                                    {itemInfo.showText && <Checkbox
                                        dialogRow={true}
                                        label="show text"
                                        value={this.stateHelper.getValue('showText')||false}
                                        onChange={(nv)=>this.stateHelper.setValue('showText',nv)}
                                    />}
                                    {itemInfo.allowHtml && <Checkbox
                                        dialogRow={true}
                                        label="allow html"
                                        value={this.stateHelper.getValue('allowHtml')||false}
                                        onChange={(nv)=>this.stateHelper.setValue('allowHtml',nv)}
                                    />}
                                    {itemInfo.allowFormatter &&
                                        <InputSelect
                                            dialogRow={true}
                                            showDialogFunction={this.dialogHelper.showDialog}
                                            label={"featureFormatter"}
                                            value={this.stateHelper.getValue('featureFormatter')}
                                            onChange={(nv) => {
                                                this.stateHelper.setValue('featureFormatter',nv.value);
                                            }}
                                            list={formatters}
                                            />

                                    }
                                    {getKnownStyleParam().map((param)=>{
                                        if (!itemInfo[param.name]) return null;
                                        return(
                                            <ParamValueInput
                                                param={createEditableParameter(param.name,param.type,param.list,param.displayName,param.default)}
                                                currentValues={this.stateHelper.getValues()||{} }
                                                onChange={(nv)=>this.stateHelper.setState(nv)}
                                                showDialogFunction={this.dialogHelper.showDialog}
                                                onlyOwnParam={true}
                                            />
                                        )
                                    })}
                                    <Input
                                        dialogRow={true}
                                        type="number"
                                        label="min zoom"
                                        value={this.stateHelper.getValue('minZoom') || 0}
                                        onChange={(nv) => this.stateHelper.setValue('minZoom', nv)}
                                    />
                                    <Input
                                        dialogRow={true}
                                        type="number"
                                        label="max zoom"
                                        value={this.stateHelper.getValue('maxZoom') || 0}
                                        onChange={(nv) => this.stateHelper.setValue('maxZoom', nv)}
                                    />
                                    {(itemInfo.hasSymbols || itemInfo.hasWaypoint) && <Input
                                        dialogRow={true}
                                        type="number"
                                        label="min scale"
                                        value={this.stateHelper.getValue('minScale') || 0}
                                        onChange={(nv) => this.stateHelper.setValue('minScale', nv)}
                                    />}
                                    {(itemInfo.hasSymbols || itemInfo.hasWaypoint) && <Input
                                        dialogRow={true}
                                        type="number"
                                        label="max scale"
                                        value={this.stateHelper.getValue('maxScale') || 0}
                                        onChange={(nv) => this.stateHelper.setValue('maxScale', nv)}
                                    />}
                                    {(itemInfo.hasSymbols || itemInfo.allowOnline || itemInfo.hasWaypoint) &&<InputSelect
                                        dialogRow={true}
                                        label="default icon"
                                        value={this.stateHelper.getValue('defaultIcon') || '--none--'}
                                        list={this.itemLists.icons}
                                        fetchCount={this.state.itemsFetchCount}
                                        showDialogFunction={this.dialogHelper.showDialog}
                                        onChange={(nv) => {
                                            this.stateHelper.setState({defaultIcon: nv.value});
                                        }}
                                        >
                                        {this.stateHelper.getValue('defaultIcon') &&
                                            <span className="icon"
                                              style={{backgroundImage: "url('"+this.stateHelper.getValue('defaultIcon')+"')"}}> </span>
                                        }
                                    </InputSelect>}
                                </React.Fragment>
                            }
                        </React.Fragment>
                    }
                    <div className="dialogButtons">
                        <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                        {this.props.updateCallback ?
                            <DB
                                name="ok"
                                onClick={() => {
                                    let changes = this.stateHelper.getValues(true);
                                    changes.opacity=parseFloat(changes.opacity);
                                    if (changes.opacity < 0) changes.opacity = 0;
                                    if (changes.opacity > 1) changes.opacity = 1;
                                    this.props.updateCallback(changes);
                                }}
                                disabled={(!hasChanges && ! this.props.forceOk) || ! this.stateHelper.getValue('name')}
                            >Ok</DB>
                            : null}

                    </div>
                </div>
            </React.Fragment>);
    }


}


const BaseElement=(props)=>{
    const dd=useAvNavSortable(props.dragId,false)
    return(
    <div className={"listEntry overlayElement baseChart"} {...dd}>
        <div className="itemInfo">
            <div className="infoRow">
                <span className="inputLabel"> </span><span className="valueText">---chart---</span>
            </div>
        </div>
    </div>
    );
}

const OverlayElement=(props)=>{
    const dd=useAvNavSortable(props.dragId);
    return (
        <div className={"listEntry overlayElement "+(props.selected?"activeEntry":"")+(props.enabled?"":" disabled")+(props.isDefault?" defaultOverlay":"")} onClick={()=>props.onClick('select')} {...dd}>
            <div className="itemInfo">
                <div className="infoRow">
                    <span className="inputLabel">Name</span><span className="valueText">{props.name}</span>
                </div>
                <div className="infoRow">
                    <span className="inputLabel">Type</span><span className="valueText">{props.type+(props.isDefault?"   [default]":"")}</span>
                </div>
            </div>
            <div className="actions">
                {props.type !== 'base' &&
                <Checkbox
                    className="overlayEnabled"
                    value={props.enabled || false}
                    onChange={(nv) => {
                        props.onClick(nv ? "enable" : "disable")
                    }}
                />
                }
                {props.type !== 'base' &&
                <Button name="Edit"
                        className={"smallButton " + ((props.isDefault || props.preventEdit) ? "disabled" : "")}
                        onClick={(ev) => {
                            ev.stopPropagation();
                            props.onClick('edit')
                        }}
                />
                }
            </div>
        </div>
    );
};

const CombinedOverlayElement=(props)=> {
    const dd=useAvNavSortable(props.dragId,false)
    return(
        <ItemList
            listRef={dd.ref}
            className="defaultOverlayItems"
            itemClass={OverlayElement}
            itemList={props.items}
            onItemClick={(item,data)=>{
                props.onClick({item:item,data:data});
            }}
            />
    );
}

const HiddenCombinedOverlayElement=(props)=>{
    const dd=useAvNavSortable(props.dragId);
    return <div className="empty" {...dd}></div>
}

/**
 * convert the list of overlays into the list for displaying it
 * by grouping default items into a combined item
 * @param overlayList
 * @param updateCallback
 * @returns {[]}
 */
const displayListFromOverlays=(overlayList)=>{
    let rt=[];
    if (! overlayList) return rt;
    let lastBucket=undefined;
    overlayList.forEach((overlay)=>{
        if (overlay.isDefault){
            if (! lastBucket){
                lastBucket={
                    itemClass:CombinedOverlayElement,
                    items:[],
                    disabled:true
                };
            }
            lastBucket.items.push(overlay);
            return;
        }
        if (lastBucket) rt.push(lastBucket);
        lastBucket=undefined;
        rt.push(assign({},overlay,{disabled:overlay.type==='base'}));
    })
    if (lastBucket) rt.push(lastBucket);
    return rt;
}

const displayListToOverlays=(displayList)=>{
    let rt=[];
    if (! displayList) return rt;
    displayList.forEach((element)=>{
        if (element.itemClass === CombinedOverlayElement){
            element.items.forEach((item)=>{
                rt.push(filterOverlayItem(item));
            });
        }
        else{
            rt.push(filterOverlayItem(element));
        }
    });
    return rt;
}

const isSameItem=(item,compare)=>{
    let itemKey=getKeyFromOverlay(item);
    let compareKey=getKeyFromOverlay(compare);
    if (itemKey === undefined || compareKey === undefined) return false;
    if (itemKey !== compareKey) return false;
    return item.isDefault === compare.isDefault;
}
class EditOverlaysDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={};
        this.state.selectedIndex=-1;
        this.currentConfig=this.props.current.copy();
        let itemList=this.props.current.getOverlayList(true);
        this.state.list=displayListFromOverlays(itemList);
        this.state.addEntry=props.addEntry;
        for (let i=0;i<this.state.list.length;i++){
            if (this.state.list[i].type !== undefined && this.state.list[i].type !== 'base'){
                this.state.selectedIndex=i;
                break;
            }
        }
        this.state.useDefault=this.props.current.getUseDefault();
        this.state.isChanged=false;
        this.dialogHelper=dialogHelper(this);
        this.reset=this.reset.bind(this);
        this.updateList=this.updateList.bind(this);
        this.hideAll=this.hideAll.bind(this);
    }
    componentDidMount() {
        if (this.state.addEntry){
            let entry=this.state.addEntry;
            this.setState({addEntry:undefined,isChanged:true});
            this.insert(false,entry);
        }
    }

    updateList(newList) {
        let idx = this.state.selectedIndex;
        if (idx < 0) {
            idx = 0;
        }
        if (idx >= newList.length) {
            idx = 0;
        }
        let count = newList.length;
        while ((newList[idx].type === undefined || newList[idx].type === 'base') && count >= 0) {
            idx++;
            if (idx >= newList.length) idx = 0;
            count--;
        }
        if (count < 0) idx = -1;
        this.setState({list: newList, isChanged: true, selectedIndex: idx});
    }
    showItemDialog(item,opt_forceOk){
        return new Promise((resolve,reject)=>{
            this.dialogHelper.showDialog((props)=>{
                return <OverlayItemDialog
                    {...props}
                    closeCallback={()=>{
                        props.closeCallback();
                        reject(0);
                    }}
                    updateCallback={(changed)=>{
                        if (!changed.name) {
                            reject("missing overlay name");
                        }
                        else resolve(changed);
                        props.closeCallback();
                    }}
                    current={item}
                    title={item?"Edit Overlay":"New Overlay"}
                    forceOk={opt_forceOk}
                    />
            })
        })
    }
    insert(before,opt_item){
        if (this.props.preventEdit) return;
        if (before) {
            if (this.state.selectedIndex < 0 || this.state.selectedIndex >= this.state.list.length) return;
        }
        let idx=this.state.selectedIndex;
        if (idx < 0) {
            //we can only have this for after - so we always add on top
            idx=this.state.list.length;
        }
        let newItem=this.currentConfig.createNewOverlay(opt_item||{type:'overlay',opacity:1});
        this.showItemDialog(newItem,opt_item !== undefined)
            .then((overlay)=>{
                let overlays=this.state.list.slice();
                overlays.splice(before?idx:idx+1,0,overlay);
                this.updateList(overlays);
            })
            .catch((reason)=>{if (reason) Toast(reason);});
    }
    editItem(item){
        if (this.props.preventEdit) return;
        if (item.disabled) return;
        this.showItemDialog(item)
            .then((changedItem)=>{
                this.updateItem(item,changedItem);
            })
            .catch((reason)=>{if (reason) Toast(reason);})
    }
    updateItem(item,newValues){
        let overlays=this.state.list;
        let hasChanged=false;
        overlays.forEach((element)=>{
            if (element.items){
                //combined...
                element.items.forEach((elitem)=>{
                    if (isSameItem(item,elitem)){
                        assign(elitem,newValues);
                        hasChanged=true;
                    }
                });
            }
            else{
                if (isSameItem(element,item)){
                    assign(element,newValues);
                    hasChanged=true;
                }
            }
        })
        if (hasChanged){
            this.updateList(overlays);
        }
    }
    deleteItem(item){
        if (this.props.preventEdit) return;
        if (item.disabled) return;
        if (getKeyFromOverlay(item) === undefined) return;
        let overlays=this.state.list.slice();
        for (let i=0;i<overlays.length;i++) {
            //not allowed for combined...
            if (isSameItem(overlays[i],item)) {
                overlays.splice(i, 1);
                this.updateList(overlays);
            }
        }
    }
    moveItem(oldIndex,newIndex){
        const next=moveItem(oldIndex,newIndex,this.state.list);
        if (next !== undefined) this.updateList(next);
    }
    reset(){
        if (this.props.resetCallback){
            this.props.closeCallback();
            this.props.resetCallback();
            return;
        }
        this.currentConfig.reset();
        this.setState({
            useDefault: this.currentConfig.getUseDefault(),
            selectedIndex:0,
            isChanged:true
        })
        this.updateList(displayListFromOverlays(this.currentConfig.getOverlayList()))
    }
    hideAll(){
        this.currentConfig.setAllEnabled(false);
        this.setState({
            isChanged:true
        })
        this.updateList(displayListFromOverlays(this.currentConfig.getOverlayList()))
    }
    render () {
        let self=this;
        if (! this.props.current){
            this.props.closeCallback();
            return null;
        }
        let hasCurrent=this.props.current.getName() !== undefined;
        let hasOverlays=true; //TODO
        let hasDefaults=this.props.current.hasDefaults();
        let selectedItem;
        if (this.state.selectedIndex >=0 && this.state.selectedIndex <= this.state.list.length && ! this.props.preventEdit){
            selectedItem=this.state.list[this.state.selectedIndex];
        }
        let isEditingDefault=this.props.current.getName() === DEFAULT_OVERLAY_CONFIG;
        let title=this.props.title||(isEditingDefault?'Edit Default Overlays':'Edit Overlays');
        return (
            <React.Fragment>
            <div className={"selectDialog editOverlaysDialog"+(this.props.preventEdit?" preventEdit":"")}>
                <h3 className="dialogTitle">{title}</h3>
                {! isEditingDefault &&
                    <div className="dialogRow info"><span className="inputLabel">Chart</span>{this.props.chartName}
                    </div>
                }
                {(!this.props.noDefault && ! this.props.preventEdit && hasDefaults) && <Checkbox
                    className="useDefault"
                    dialogRow={true}
                    label="use default"
                    onChange={(nv)=>{
                        this.setState({useDefault:nv,isChanged:true});
                        }}
                    value={this.state.useDefault||false}/>}
                <ItemList
                    dragdrop={!this.props.preventEdit}
                    onSortEnd={(oldIndex,newIndex)=>{
                        this.moveItem(oldIndex,newIndex);
                        this.setState({selectedIndex:newIndex});
                    }}
                    className="overlayItems"
                    itemCreator={(item)=>{
                        if (item.type === 'base') return BaseElement;
                        if (item.itemClass === CombinedOverlayElement){
                            if (this.state.useDefault) return CombinedOverlayElement
                            else return HiddenCombinedOverlayElement
                        }
                        else return OverlayElement;
                    }}
                    selectedIndex={this.props.preventEdit?undefined:this.state.selectedIndex}
                    onItemClick={(item,data)=>{
                        if (data === 'select'){
                            this.setState({selectedIndex:item.index});
                            return;
                        }
                        if (data === 'edit'){
                            this.editItem(item);
                            return;
                        }
                        if (data === 'disable'){
                            this.updateItem(item,{enabled:false});
                            return;
                        }
                        if (data === 'enable'){
                            this.updateItem(item,{enabled:true});
                            return;
                        }
                        //the combined items will give us the action as an object
                        if (typeof data === 'object'){
                            if (! data.item) return;
                            if (data.data === 'enable'){
                                this.updateItem(data.item,{enabled:true});
                                return;
                            }
                            if (data.data === 'disable'){
                                this.updateItem(data.item,{enabled:false});
                                return;
                            }
                        }
                     }}
                    itemList={this.state.list}
                    />
                <div className="insertButtons">
                    <DB name="hide"
                        onClick={this.hideAll}>
                        HideAll
                    </DB>
                    {selectedItem?<DB name="delete" onClick={()=>this.deleteItem(selectedItem)}>Delete</DB>:null}
                    {selectedItem || this.props.editCallback?
                        <DB name="edit" onClick={()=>{
                            if (this.props.editCallback){
                                if (this.props.editCallback(selectedItem)){
                                    this.props.closeCallback();
                                }
                            }
                            else {
                                this.editItem(selectedItem);
                            }
                        }}>Edit</DB>
                        :null
                    }
                    {(hasOverlays && ! this.props.preventEdit && selectedItem)?<DB name="before" onClick={()=>this.insert(true)}>Insert Before</DB>:null}
                    {!this.props.preventEdit && <DB name="after" onClick={()=>this.insert(false)}>Insert After</DB>}
                </div>
                <div className="dialogButtons">
                    <DB
                        name="reset"
                        onClick={this.reset}
                    >Reset
                    </DB>
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    {this.props.updateCallback?
                        <DB
                            name="ok"
                            onClick={()=>{
                                this.props.closeCallback();
                                let updatedOverlays=this.currentConfig;
                                updatedOverlays.writeBack(displayListToOverlays(this.state.list));
                                updatedOverlays.setUseDefault(this.state.useDefault);
                                this.props.updateCallback(updatedOverlays);
                                }}
                            disabled={!this.state.isChanged}
                            >{this.props.preventEdit?"Ok":"Save"}</DB>
                    :null}
                </div>
            </div>
            </React.Fragment>
        );
    }
}

EditOverlaysDialog.propTypes={
    title: PropTypes.string,
    current:PropTypes.instanceOf(OverlayConfig), //the current config
    updateCallback: PropTypes.func,
    resetCallback: PropTypes.func,
    editCallback: PropTypes.func,  //only meaningful if preventEdit is set
    closeCallback: PropTypes.func.isRequired,
    preventEdit: PropTypes.bool,
    addEntry: PropTypes.object //if this is set, immediately start with appending this entry
};

/**
 *
 * @param chartItem
 * @param opt_callback if set - callback when done
 * @param opt_addEntry if set (itemInfo) start with adding this item
 * @return {boolean}
 */
EditOverlaysDialog.createDialog=(chartItem,opt_callback,opt_addEntry)=>{
    if (! getOverlayConfigName(chartItem)) return false;
    if (opt_addEntry){
        //check for an allowed item that we can add
        if (! opt_addEntry.type) return false;
        let typeOk=false;
        TYPE_LIST.forEach((type)=>{
            if (type.value === opt_addEntry.type) typeOk=true;
        })
        if (! typeOk) return false;
        opt_addEntry=assign({opacity:1,enabled:true},opt_addEntry);
    }
    let noDefault=getOverlayConfigName(chartItem) === DEFAULT_OVERLAY_CONFIG;
    let getParameters={
        request: 'api',
        type: 'chart',
        overlayConfig: getOverlayConfigName(chartItem),
        command: 'getConfig',
        expandCharts: true,
        mergeDefault: !noDefault
    };
    Requests.getJson("",{},getParameters)
        .then((config)=>{
            if (! config.data) return;
            if (config.data.useDefault === undefined) config.data.useDefault=true;
            let overlayConfig=new OverlayConfig(config.data);
            OverlayDialog.dialog((props)=> {
                return <EditOverlaysDialog
                    {...props}
                    chartName={chartItem.name}
                    current={overlayConfig}
                    updateCallback={(newConfig) => {
                        if (newConfig.isEmpty()) {
                            //we can tell the server to delete the config
                            let param={
                                request:'delete',
                                type:'chart',
                                name:overlayConfig.getName()
                            }
                            Requests.getJson('',{},param)
                                .then(()=>{
                                    if (opt_callback) opt_callback(newConfig.getWriteBackData());
                                })
                                .catch((err)=>{
                                    Toast("unable to save overlay config: " + error);
                                    if (opt_callback) opt_callback();
                                })
                        } else {
                            let postParam = {
                                request: 'upload',
                                type: 'chart',
                                name: overlayConfig.getName(),
                                overwrite: true
                            };
                            Requests.postPlain("", JSON.stringify(newConfig.getWriteBackData(), undefined, 2), {}, postParam)
                                .then((res) => {
                                    if (opt_callback) opt_callback(newConfig.getWriteBackData());
                                })
                                .catch((error) => {
                                    Toast("unable to save overlay config: " + error);
                                    if (opt_callback) opt_callback();
                                });
                        }
                    }}
                    noDefault={noDefault||false}
                    addEntry={opt_addEntry}
                    />
            });
        })
        .catch((error)=>{Toast("unable to get config: "+error);});

    return true;
};
const DEFAULT_OVERLAY_CONFIG="default.cfg";
export const DEFAULT_OVERLAY_CHARTENTRY={
    type: 'chart',
    name: 'DefaultOverlays',
    chartKey: DEFAULT_OVERLAY_CONFIG,
    overlayConfig: DEFAULT_OVERLAY_CONFIG,
    canDelete: false,
    canDownload:false,
    time: (new Date()).getTime()/1000,
    icon: chartImage
};


export default  EditOverlaysDialog;