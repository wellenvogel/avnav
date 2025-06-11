import React, {useEffect, useMemo, useState} from 'react';
import PropTypes from 'prop-types';
import {
    DialogButtons,
    DialogFrame,
    DialogRow, showDialog, showPromiseDialog,
    useDialogContext
} from './OverlayDialog.jsx';
import assign from 'object-assign';
import {Input,Checkbox,InputSelect,Radio} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import Button from './Button.jsx';
import ItemList from './ItemList.jsx';
import Requests from '../util/requests.js';
import Toast from './Toast.jsx';
import Helper from '../util/helper.js';
import GuiHelpers from '../util/GuiHelpers.js';
import {editableOverlayParameters, getOverlayConfigName} from '../map/chartsourcebase'
import globalStore from "../util/globalstore";
import keys from '../util/keys';
import OverlayConfig, {getKeyFromOverlay,OVERLAY_ID} from '../map/overlayconfig';
import DefaultGpxIcon from '../images/icons-new/DefaultGpxPoint.png'
import chartImage from '../images/Chart60.png';
import editableParameterUI, {EditableParameterListUI} from "./EditableParameterUI";
import {moveItem, useAvNavSortable} from "../hoc/Sortable";
import cloneDeep from "clone-deep";
import base from "../base";
import Mapholder from "../map/mapholder";
import {EditableParameterTypes} from "../util/EditableParameter";

const filterOverlayItem=(item)=>{
    const rt={...item};
    delete rt.selected;
    delete rt.dragId;
    delete rt.index;
    delete rt.disabled;
    for (let k in rt){
        if (typeof rt[k] === 'function'){
            delete rt[k];
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
const useItemList=(initial)=>{
    const [list,setList]=useState(initial);
    return {
        list:list,
        setList:setList
    }
}
const pushHelper=(dict,key,value)=>{
    if (dict[key] === undefined) dict[key]=[];
    dict[key].push(value);
}
const OverlayItemDialog = (props) => {
    const [itemsFetchCount, setItemsFetchCount] = useState(0);
    const [itemInfo, setItemInfo] = useState({});
    const [loading, setLoading] = useState(false);
    const [changed, setChanged] = useState(false);
    const sortLists = ['icons', 'chart', 'overlay', 'images', 'user', 'knownOverlays', 'iconFiles', 'route', 'track']
    const [current, setCurrent] = useState(props.current || {});
    const itemLists = {
        icons: useItemList([{label: "--none--"}, {label: "--DefaultGpxIcon--", value: DefaultGpxIcon}]),
        chart: useItemList([]),
        overlay: useItemList([]),
        images: useItemList([]),
        user: useItemList([]),
        knownOverlays: useItemList([]),
        iconFiles: useItemList([{label: "--none--",value:undefined}]),
        route: useItemList([]),
        track: useItemList([])
    };
    let iconsReadOnly = Helper.getExt(current.name) === 'kmz';
    const parameters=useMemo(()=>{
        const rt=[];
        if (itemInfo.settings){
            itemInfo.settings.forEach((setting)=>{
                let addOn=undefined;
                if (setting.name === editableOverlayParameters.icon.name){
                    if (iconsReadOnly){
                        addOn={
                            type: EditableParameterTypes.STRING,
                            readOnly: true,
                            default: current[editableOverlayParameters.icon.name]
                        }
                    }
                    else {
                        //fill icon list
                        addOn = {
                            list: itemLists.iconFiles.list
                        }
                    }
                }
                const param=editableParameterUI.createEditableParameterUI({...setting,...addOn});
                rt.push(param);
            })
        }
        return rt;
    },[itemInfo,itemsFetchCount,iconsReadOnly])

    const getItemList = (type) => {
        const filledLists={};
        Requests.getJson("", {}, {
            request: 'listdir',
            type: type
        })
            .then((data) => {
                filledLists[type] = data.items;
                if (type === 'user' || type === 'images' || type === 'overlay') {
                    data.items.forEach((item) => {
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(item.name)) >= 0) {
                            let el = assign({}, item);
                            el.label = el.url;
                            el.value = el.url;
                            pushHelper(filledLists,'icons',el);
                        }
                    })
                }
                if (type === 'chart') {
                    //prepare select list
                    data.items.forEach((item) => {
                        item.label = item.name;
                        item.value = item.chartKey;
                    });
                }
                if (type === 'overlay' || type === 'route' || type === 'track') {
                    data.items.forEach((item) => {
                        item.type = type;
                        if (type === 'route') {
                            if (!item.url) item.url = globalStore.getData(keys.properties.navUrl) +
                                "?request=download&type=route&name=" + encodeURIComponent(item.name) + "&extension=.gpx";
                            if (!item.name.match(/\.gpx/)) item.name += ".gpx";
                        }
                        item.label = item.name;
                        item.value = item.url;
                        if (KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(item.name)) >= 0) {
                            pushHelper(filledLists,'knownOverlays',item);
                        }
                        if (KNOWN_ICON_FILE_EXTENSIONS.indexOf(Helper.getExt(item.name)) >= 0) {
                            pushHelper(filledLists,'iconFiles',{...item, label: item.url});
                        }
                    });
                }
                for (let k in filledLists){
                    if(itemLists[k]) {
                        itemLists[k].setList((old)=>{
                            let rt=old?old.concat(filledLists[k]):filledLists[k];
                            if (sortLists.indexOf(k)>=0){
                                rt.sort(itemSort);
                            }
                            return rt;
                        });
                    }
                    else{
                        base.log("invalid structure: "+k);
                    }
                }
                setItemsFetchCount((old) => old + 1)
            })
            .catch((error) => {
                Toast("error fetching list of " + type + ": " + error);
            })
    }
    //we make them only a variable as we consider them to be static


    useEffect(() => {
        getItemList('chart');
        getItemList('overlay');
        getItemList('images');
        getItemList('user');
        getItemList('route');
        getItemList('track');
    }, []);

    useEffect(() => {
        if (props.current && props.current.url && props.current.type !== 'chart') {
            analyseOverlay(props.current.url);
        }
    }, []);

    const updateCurrent = (values, force) => {
        if (force) {
            setCurrent(values);
        } else {
            setCurrent((old) => {
                return {...old, ...values}
            });
        }
        setChanged(true);
    }


    const changeType = (newType) => {
        if (newType === current.type) return;
        let newState = {
            type: newType,
            name: undefined,
            opacity: current.opacity,
            enabled: current.enabled
        };
        newState[OVERLAY_ID]=current[OVERLAY_ID];
        updateCurrent(newState, true);
    }
    const analyseOverlay = (url, initial) => {
        setLoading(true);
        setItemInfo(    {});
        Requests.getHtmlOrText(url)
            .then((data) => {
                try {
                    let featureInfo={};
                    try {
                        const OverlayClass=Mapholder.findChartSource('overlay',url);
                        if (typeof(OverlayClass.analyzeOverlay) === 'function'){
                            featureInfo=OverlayClass.analyzeOverlay(data);
                        }
                    }catch (e){}
                    if (!featureInfo.hasAny) {
                        Toast(url + " is no valid overlay file");
                        setLoading(false);
                        setItemInfo({});
                        updateCurrent({name: undefined})
                    } else {
                        setLoading(false);
                        setItemInfo(featureInfo);
                        if (initial) {
                            let newItemState = {};
                            updateCurrent({...newItemState});
                        }
                    }
                } catch (e) {
                    Toast(url + " is no valid overlay: " + e.message);
                    setLoading(false);
                    setItemInfo({});
                    updateCurrent({name: undefined});
                }
            })
            .catch((error) => {
                Toast("unable to load " + url + ": " + error)
                setLoading(false);
                setItemInfo({});
                updateCurrent({name: undefined});
            })
    }
    const filteredNameList = () => {
        let currentType = current.type;
        let rt = [];
        itemLists.knownOverlays.list.forEach((item) => {
            if (item.type === currentType) rt.push(item);
        })
        if (currentType === 'track') {
            rt.sort(trackSort);
        }
        return rt;
    }
    let currentType = current.type;

    let dataValid=true;
    parameters.forEach((parameter)=>{
        if (parameter.hasError(current||{})) dataValid=false;
    })
    return (
        <DialogFrame className="selectDialog editOverlayItemDialog" title={props.title || 'Edit Overlay'}>
            <DialogRow className="info"><span
                className="inputLabel">Overlay</span>{current.name}</DialogRow>
            {loading ?
                <div className="loadingIndicator">Analyzing...</div>
                :
                <React.Fragment>
                    <Checkbox
                        className="enabled"
                        dialogRow={true}
                        label="enabled"
                        onChange={(nv) => updateCurrent({enabled: nv})}
                        value={current.enabled || false}/>
                    <Radio
                        className="type"
                        dialogRow={true}
                        label="type"
                        value={currentType}
                        itemList={TYPE_LIST}
                        onChange={(nv) => changeType(nv)}
                    />
                    <Input
                        className="opacity"
                        dialogRow={true}
                        label="opacity"
                        value={current.opacity}
                        onChange={(nv) => updateCurrent({opacity: parseFloat(nv)})}
                        type="number"
                    />
                    {(currentType === 'chart') ?
                        <React.Fragment>
                            <InputSelect
                                dialogRow={true}
                                label="chart name"
                                value={{
                                    value: current.chartKey,
                                    label: current.name
                                }}
                                list={itemLists.chart.list}
                                fetchCount={itemsFetchCount}
                                onChange={(nv) => {
                                    updateCurrent({chartKey: nv.chartKey, name: nv.name});
                                }}
                            />
                        </React.Fragment> :
                        <React.Fragment>
                            <InputSelect
                                dialogRow={true}
                                label="overlay name"
                                value={current.name}
                                list={filteredNameList()}
                                fetchCount={itemsFetchCount}
                                onChange={(nv) => {
                                    let newState = {url: nv.url, name: nv.name};
                                    if (Helper.getExt(nv.name) === 'kmz') {
                                        newState[editableOverlayParameters.icon.name] = nv.url;
                                        newState.url += "/doc.kml";
                                    }
                                    let initial = current.name === undefined;
                                    updateCurrent(newState);
                                    analyseOverlay(newState.url, initial);
                                }}
                            />
                            <EditableParameterListUI
                                values={current}
                                parameters={parameters}
                                onChange={updateCurrent}
                                initialValues={props.current}
                            />
                        </React.Fragment>
                    }
                </React.Fragment>
            }
            <DialogButtons>
                <DB name="cancel">Cancel</DB>
                {props.resolveFunction ?
                    <DB
                        name="ok"
                        onClick={() => {
                            let changes = {...current};
                            changes.opacity = parseFloat(changes.opacity);
                            if (changes.opacity < 0) changes.opacity = 0;
                            if (changes.opacity > 1) changes.opacity = 1;
                            props.resolveFunction(changes);
                        }}
                        disabled={(!changed && !props.forceOk) || !current.name||!dataValid}
                    >Ok</DB>
                    : null}

            </DialogButtons>
        </DialogFrame>)
}
OverlayItemDialog.propTypes={
    resolveFunction: PropTypes.func.isRequired,
    forceOk: PropTypes.func,
    title: PropTypes.element,
    current: PropTypes.object
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
const EditOverlaysDialog = (props) => {
    const dialogContext = useDialogContext();
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const currentConfig = props.current.copy();
    const [list, setList] = useState(displayListFromOverlays(props.current.getOverlayList(true)));
    const [addEntry, setAddEntry] = useState(props.addEntry);
    const [useDefault, setUseDefault] = useState(props.current.getUseDefault());
    const [isChanged, setIsChanged] = useState(false);
    const updateList = (updatedList) => {
        let newList=updatedList.slice(0);
        let idx = selectedIndex;
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
        setList(newList);
        setIsChanged(true);
        setSelectedIndex(idx);
    }
    const showItemDialog = (item, opt_forceOk) => {
        return showPromiseDialog(dialogContext,(dprops) => {
            return <OverlayItemDialog
                {...dprops}
                resolveFunction={(changed) => {
                    if (changed.name && changed.type) dprops.resolveFunction(changed);
                }}
                current={item}
                title={item ? "Edit Overlay" : "New Overlay"}
                forceOk={opt_forceOk}
            />
        })
    }

    const insert = (before, opt_item) => {
        if (props.preventEdit) return;
        if (before) {
            if (selectedIndex < 0 || selectedIndex >= list.length) return;
        }
        let idx = selectedIndex;
        if (idx < 0) {
            //we can only have this for after - so we always add on top
            idx = list.length;
        }
        let newItem = currentConfig.createNewOverlay(opt_item || {type: 'overlay', opacity: 1});
        showItemDialog(newItem, opt_item !== undefined)
            .then((overlay) => {
                let overlays = list.slice();
                overlays.splice(before ? idx : idx + 1, 0, overlay);
                updateList(overlays);
            })
            .catch((reason) => {
                if (reason) Toast(reason);
            });
    }
    useEffect(() => {
        if (addEntry) {
            let entry = addEntry;
            setAddEntry(undefined);
            setIsChanged(true);
            insert(false, entry);
        }
    }, []);
    useEffect(() => {
        for (let i = 0; i < list.length; i++) {
            if (list[i].type !== undefined && list[i].type !== 'base') {
                setSelectedIndex(i);
                break;
            }
        }
    }, []);
    const updateItem = (item, newValues) => {
        let overlays = cloneDeep(list);
        let hasChanged = false;
        overlays.forEach((element) => {
            if (element.items) {
                //combined...
                element.items.forEach((elitem) => {
                    if (isSameItem(item, elitem)) {
                        assign(elitem, newValues);
                        hasChanged = true;
                    }
                });
            } else {
                if (isSameItem(element, item)) {
                    assign(element, newValues);
                    hasChanged = true;
                }
            }
        })
        if (hasChanged) {
            updateList(overlays);
        }
    }
    const deleteItem = (item) => {
        if (props.preventEdit) return;
        if (item.disabled) return;
        if (getKeyFromOverlay(item) === undefined) return;
        let overlays = list.slice();
        for (let i = 0; i < overlays.length; i++) {
            //not allowed for combined...
            if (isSameItem(overlays[i], item)) {
                overlays.splice(i, 1);
                updateList(overlays);
            }
        }
    }
    const moveItemF = (oldIndex, newIndex) => {
        const next = moveItem(oldIndex, newIndex, list);
        if (next !== undefined) updateList(next);
    }
    const reset = () => {
        if (props.resetCallback) {
            props.resetCallback();
            return;
        }
        currentConfig.reset();
        setUseDefault(currentConfig.getUseDefault());
        setSelectedIndex(0);
        setIsChanged(true);
        updateList(displayListFromOverlays(currentConfig.getOverlayList()))
    }
    const editItem = (item) => {
        if (props.preventEdit) return;
        if (item.disabled) return;
        showItemDialog(item)
            .then((changedItem) => {
                updateItem(item, changedItem);
            })
            .catch((reason) => {
                if (reason) Toast(reason);
            })
    }

    const enableDisableAll = (enabled) => {
        currentConfig.setAllEnabled(enabled);
        setIsChanged(true);
        updateList(displayListFromOverlays(currentConfig.getOverlayList()))
    }
    if (!props.current) {
        dialogContext.closeDialog();
        return null;
    }
    let hasOverlays = true; //TODO
    let hasDefaults = props.current.hasDefaults();
    let selectedItem;
    if (selectedIndex >= 0 && selectedIndex <= list.length && !props.preventEdit) {
        selectedItem = list[selectedIndex];
    }
    let isEditingDefault = props.current.getName() === DEFAULT_OVERLAY_CONFIG;
    let title = props.title || (isEditingDefault ? 'Edit Default Overlays' : 'Edit Overlays');
    return (
        <DialogFrame className={"selectDialog editOverlaysDialog" + (props.preventEdit ? " preventEdit" : "")}
                     title={title}>
            {!isEditingDefault &&
                <DialogRow className="info"><span className="inputLabel">Chart</span>{props.chartName}
                </DialogRow>
            }
            {(!props.noDefault && !props.preventEdit && hasDefaults) && <Checkbox
                className="useDefault"
                dialogRow={true}
                label="use default"
                onChange={(nv) => {
                    setUseDefault(nv);
                    setIsChanged(true);
                }}
                value={useDefault || false}/>}
            <ItemList
                dragdrop={!props.preventEdit}
                onSortEnd={(oldIndex, newIndex) => {
                    moveItemF(oldIndex, newIndex);
                    setSelectedIndex(newIndex);
                }}
                className="overlayItems"
                itemCreator={(item) => {
                    if (item.type === 'base') return BaseElement;
                    if (item.itemClass === CombinedOverlayElement) {
                        if (useDefault) return CombinedOverlayElement
                        else return HiddenCombinedOverlayElement
                    } else return OverlayElement;
                }}
                selectedIndex={props.preventEdit ? undefined : selectedIndex}
                onItemClick={(item, data) => {
                    if (data === 'select') {
                        setSelectedIndex(item.index);
                        return;
                    }
                    if (data === 'edit') {
                        editItem(item);
                        return;
                    }
                    if (data === 'disable') {
                        updateItem(item, {enabled: false});
                        return;
                    }
                    if (data === 'enable') {
                        updateItem(item, {enabled: true});
                        return;
                    }
                    //the combined items will give us the action as an object
                    if (typeof data === 'object') {
                        if (!data.item) return;
                        if (data.data === 'enable') {
                            updateItem(data.item, {enabled: true});
                            return;
                        }
                        if (data.data === 'disable') {
                            updateItem(data.item, {enabled: false});
                            return;
                        }
                    }
                }}
                itemList={list}
            />
            <DialogButtons className="insertButtons">
                <DB name="show"
                    onClick={()=>enableDisableAll(true)}
                    close={false}
                >
                    ShowAll
                </DB>
                <DB name="hide"
                    onClick={()=>enableDisableAll(false)}
                    close={false}
                >
                    HideAll
                </DB>
                {selectedItem ?
                    <DB name="delete" close={false} onClick={() => deleteItem(selectedItem)}>Delete</DB> : null}
                {selectedItem || props.editCallback ?
                    <DB name="edit" close={false} onClick={() => {
                        if (props.editCallback) {
                            if (props.editCallback(selectedItem)) {
                                dialogContext.closeDialog();
                            }
                        } else {
                            editItem(selectedItem);
                        }
                    }}>Edit</DB>
                    : null
                }
                {(hasOverlays && !props.preventEdit && selectedItem) ?
                    <DB name="before" close={false} onClick={() => insert(true)}>Insert Before</DB> : null}
                {!props.preventEdit && <DB name="after" close={false} onClick={() => insert(false)}>Insert After</DB>}
            </DialogButtons>
            <DialogButtons>
                <DB
                    name="reset"
                    onClick={reset}
                    close={false}
                >Reset
                </DB>
                <DB name="cancel">Cancel</DB>
                {props.updateCallback ?
                    <DB
                        name="ok"
                        onClick={() => {
                            let updatedOverlays = currentConfig;
                            updatedOverlays.writeBack(displayListToOverlays(list));
                            updatedOverlays.setUseDefault(useDefault);
                            props.updateCallback(updatedOverlays);
                        }}
                        disabled={!isChanged}
                    >{props.preventEdit ? "Ok" : "Save"}</DB>
                    : null}
            </DialogButtons>
        </DialogFrame>
    );
}

EditOverlaysDialog.propTypes = {
    title: PropTypes.string,
    current: PropTypes.instanceOf(OverlayConfig), //the current config
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
EditOverlaysDialog.createDialog = (chartItem, opt_callback, opt_addEntry) => {
    if (!getOverlayConfigName(chartItem)) return false;
    if (opt_addEntry) {
        //check for an allowed item that we can add
        if (!opt_addEntry.type) return false;
        let typeOk = false;
        TYPE_LIST.forEach((type) => {
            if (type.value === opt_addEntry.type) typeOk = true;
        })
        if (!typeOk) return false;
        opt_addEntry = assign({opacity: 1, enabled: true}, opt_addEntry);
    }
    let noDefault = getOverlayConfigName(chartItem) === DEFAULT_OVERLAY_CONFIG;
    let getParameters = {
        request: 'api',
        type: 'chart',
        overlayConfig: getOverlayConfigName(chartItem),
        command: 'getConfig',
        expandCharts: true,
        mergeDefault: !noDefault
    };
    Requests.getJson("", {}, getParameters)
        .then((config) => {
            if (!config.data) return;
            if (config.data.useDefault === undefined) config.data.useDefault = true;
            let overlayConfig = new OverlayConfig(config.data);
            showDialog(undefined,(props) => {
                return <EditOverlaysDialog
                    {...props}
                    chartName={chartItem.name}
                    current={overlayConfig}
                    updateCallback={(newConfig) => {
                        if (newConfig.isEmpty()) {
                            //we can tell the server to delete the config
                            let param = {
                                request: 'delete',
                                type: 'chart',
                                name: overlayConfig.getName()
                            }
                            Requests.getJson('', {}, param)
                                .then(() => {
                                    if (opt_callback) opt_callback(newConfig.getWriteBackData());
                                })
                                .catch((err) => {
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
                    noDefault={noDefault || false}
                    addEntry={opt_addEntry}
                />
            });
        })
        .catch((error) => {
            Toast("unable to get config: " + error);
        });

    return true;
};
const DEFAULT_OVERLAY_CONFIG = "default.cfg";
export const DEFAULT_OVERLAY_CHARTENTRY = {
    type: 'chart',
    name: 'DefaultOverlays',
    chartKey: DEFAULT_OVERLAY_CONFIG,
    overlayConfig: DEFAULT_OVERLAY_CONFIG,
    canDelete: false,
    canDownload: false,
    time: (new Date()).getTime() / 1000,
    icon: chartImage
};


export default EditOverlaysDialog;