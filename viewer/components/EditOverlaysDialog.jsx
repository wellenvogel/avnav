import React, {useEffect, useMemo, useState} from 'react';
import PropTypes from 'prop-types';
import {
    DialogButtons,
    DialogFrame,
    DialogRow,
    showDialog,
    showPromiseDialog,
    useDialogContext
} from './OverlayDialog.jsx';
import assign from 'object-assign';
import {Checkbox, Input, InputReadOnly, Radio} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import Button from './Button.jsx';
import ItemList from './ItemList.jsx';
import Requests from '../util/requests.js';
import Toast from './Toast.jsx';
import Helper, {avitem, injectav, setav} from '../util/helper.js';
import {editableOverlayParameters} from '../map/chartsourcebase'
import OverlayConfig, {
    DEFAULT_OVERLAY_CONFIG,
    fetchOverlayConfig,
    getKeyFromOverlay,
    OVERLAY_ID, overlayExpandsValue
} from '../map/overlayconfig';
import chartImage from '../images/Chart60.png';
import editableParameterUI, {EditableParameterListUI} from "./EditableParameterUI";
import {moveItem, useAvNavSortable} from "../hoc/Sortable";
import cloneDeep from "clone-deep";
import Mapholder from "../map/mapholder";
import {EditableParameterTypes} from "../util/EditableParameter";
import {fetchItem, fetchItemInfo, listItems} from "../util/itemFunctions";
import {DownloadItemListDialog} from "./DownloadItemList";
import {createItemActions} from "./FileDialog";

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

const SELECT_FILTERS={
    track: (item)=>{
        if (KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(item.name)) < 0) return "no overlay";
    },
    overlay:(item)=>{
        if (KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(item.name)) < 0) return "no overlay";
    },
    route:(item)=>{
      if (! item.server) return "only server routes";
    }
}
const KNOWN_ICON_FILE_EXTENSIONS=['zip'];
const TYPE_LIST=[
    {label: 'overlay', value: 'overlay'},
    {label: 'chart', value: 'chart'},
    {label: 'route', value: 'route'},
    {label: 'track', value: 'track'},
    ]
const OverlayItemDialog = (props) => {
    const [iconFiles, setIconFiles] = useState(0);
    const [itemInfo, setItemInfo] = useState({});
    const [loading, setLoading] = useState(false);
    const [changed, setChanged] = useState(false);
    const [current, setCurrent] = useState(props.current || {});
    let iconsReadOnly = Helper.getExt(current.name) === 'kmz';
    let currentType = current.type;
    const itemActions=createItemActions(currentType).copy({
        show:(item)=>{
            const cf=SELECT_FILTERS[currentType];
            if (!cf) return true;
            return cf(item)||true;
        }
    });
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
                    else{
                        addOn={
                            list:iconFiles
                        }
                    }
                }
                const param=editableParameterUI.createEditableParameterUI({...setting,...addOn});
                rt.push(param);
            })
        }
        return rt;
    },[itemInfo,iconFiles,iconsReadOnly])
    useEffect(() => {
        if (props.current  && props.current.type !== 'chart' && ! props.current.nonexistent) {
            analyseOverlay(props.current);
        }
        listItems('overlay').then((ovlitems)=>{
            const ifiles=[{label:'--None--',value:undefined}];
            ovlitems.forEach((ovlitem)=>{
                if (KNOWN_ICON_FILE_EXTENSIONS.indexOf(Helper.getExt(ovlitem.name))< 0){
                    return;
                }
                ifiles.push({label:ovlitem.displayName||ovlitem.name,value:ovlitem.url})
            })
            setIconFiles(ifiles);
        },()=>{})
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
        setItemInfo({});
    }
    const analyseOverlay = async (item, initial) => {
        setItemInfo({});
        if (item.type ==='chart'){
            return;
        }
        if (!item.name) return;
        setLoading(true);
        try {
            const OverlayClass = Mapholder.findChartSourceForItem(item);
            if (!OverlayClass) throw new Error("unknown overlay "+item.name);
            let featureInfo = {};
            if (typeof (OverlayClass.analyzeOverlay) === 'function') {
                featureInfo = await OverlayClass.analyzeOverlay(item);
            }
            if (!featureInfo.hasAny) {
                Toast(" no valid overlay file");
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
            Toast(" no valid overlay: " + e.message);
            setLoading(false);
            setItemInfo({});
            updateCurrent({name: undefined});
        }
    }

    let dataValid=true;
    parameters.forEach((parameter)=>{
        if (parameter.hasError(current||{})) dataValid=false;
    })
    const dialogContext=useDialogContext();
    return (
        <DialogFrame className="selectDialog editOverlayItemDialog" title={props.title || 'Edit Overlay'}>
            <DialogRow className="info"><span
                className="inputLabel">Overlay</span>{current.displayName||current.name}</DialogRow>
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
                    <React.Fragment>
                        <InputReadOnly
                            label={'name'}
                            value={current.displayName||current.name}
                            onClick={(ev)=>{
                                dialogContext.showDialog((dp)=><DownloadItemListDialog
                                    {...dp}
                                    type={currentType}
                                    showUpload={false}
                                    noInfo={true}
                                    noExtra={true}
                                    itemActions={itemActions}
                                    selectCallback={async (ev)=>{
                                        const item = avitem(ev);
                                        let newState = {
                                            ...overlayExpandsValue(),
                                            url:undefined,
                                            chartKey:undefined,
                                            name: item.name,
                                            displayName:item.displayName,
                                            type: currentType
                                        };
                                        if (Helper.getExt(item.name) === 'kmz') {
                                            newState[editableOverlayParameters.icon.name] = item.name;
                                        }
                                        let initial = current.name === undefined;
                                        updateCurrent(newState);
                                        await analyseOverlay(newState, initial);
                                        const dc=avitem(ev,'dialogContext');
                                        if (dc) dc.closeDialog();
                                       return true;
                                    }}
                                />);
                            }}/>
                            <ErrorRow item={current}/>
                            <EditableParameterListUI
                                values={current}
                                parameters={parameters}
                                onChange={updateCurrent}
                                initialValues={props.current}
                            />
                        </React.Fragment>
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
                        disabled={(!changed && !props.forceOk) || !current.name||!dataValid || !!getItemError(current)}
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
const getItemError=(props)=>{
    if (!props) return;
    return props.error || (props.nonexistent?"not found":undefined);
}
const ErrorRow=({item})=>{
    const error=getItemError(item);
    if (!error)return null;
    return <div className="infoRow errorText">
        <span className="inputLabel"></span><span className="valueText">{error}</span>
    </div>
}
const OverlayElement=(props)=>{
    const dd=useAvNavSortable(props.dragId);
    const onClick=(ev,action)=>{
        if (props.onClick){
            props.onClick(setav(ev,{item:props,action:action}));
        }
    }
    return (
        <div className={Helper.concatsp("listEntry","overlayElement",
                props.selected?"activeEntry":undefined,
                props.enabled?undefined:" disabled",
                props.isDefault?"defaultOverlay":undefined,
                getItemError(props)?"withError":undefined
        )}
             onClick={(ev)=>onClick(ev,'select')} {...dd}>
            <div className="itemInfo">
                <div className="infoRow">
                    <span className="inputLabel">Name</span><span className="valueText">{props.displayName||props.name}</span>
                </div>
                <div className="infoRow">
                    <span className="inputLabel">Type</span><span className="valueText">{props.type+(props.isDefault?"   [default]":"")}</span>
                </div>
                <ErrorRow item={props}/>
            </div>
            <div className="actions">
                {props.type !== 'base' &&
                <Checkbox
                    className="overlayEnabled"
                    value={props.enabled || false}
                    onChange={(nv) => {
                        onClick({},nv ? "enable" : "disable");
                    }}
                />
                }
                {props.type !== 'base' &&
                <Button name="Edit"
                        className={"smallButton " + ((props.isDefault || props.preventEdit) ? "disabled" : "")}
                        onClick={(ev) => {
                            ev.stopPropagation();
                            onClick(ev,'edit');
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
            onItemClick={(ev)=>{
                const avevent=injectav(ev);
                props.onClick(avevent);
            }}
            />
    );
}

const HiddenOverlayElement=(props)=>{
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
    const [isChanged, setIsChanged] = useState(0);
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
        setIsChanged(isChanged+1);
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
            setIsChanged(isChanged+1);
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
    useEffect(() => {
        const requests=[];
        list.forEach(item => {
            if (item.type === 'base') {
                requests.push(Promise.resolve());
                return;
            }
            requests.push(fetchItemInfo(item)
                .then((info) => {
                  if (! info || !info.url){
                      return {
                          nonexistent: true
                      }
                  }
                },
                (err) => {
                    return {
                        error: err
                    };
                })
                .then((result)=>{
                    const nv={
                        nonexistent:undefined,
                        error:undefined
                    }
                    Object.assign(nv,result);
                    if (item.error !== nv.error || item.nonexistent !== nv.nonexistent) {
                        return nv;
                    }
                })
            );
            Promise.all(requests)
                .then((results)=>{
                    const nlist=cloneDeep(list);
                    let hasChanges=false;
                    for (let i=0;i<results.length;i++){
                        const nv=results[i];
                        if (nv){
                            hasChanges=true;
                            Object.assign(nlist[i],nv);
                        }
                    }
                    if (hasChanges){
                        setList(nlist);
                    }
                })
        })
    },[isChanged])
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
        setIsChanged(isChanged+1);
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
        setIsChanged(isChanged+1);
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
        <DialogFrame className={Helper.concatsp(
            "selectDialog",
                 "editOverlaysDialog",
                 props.preventEdit ? "preventEdit" : undefined,
                 props.preventEdit && props.hideErrors ? "hideErrors" : undefined)}
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
                    setIsChanged(isChanged+1);
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
                        else return HiddenOverlayElement
                    } else return OverlayElement;
                }}
                selectedIndex={props.preventEdit ? undefined : selectedIndex}
                onItemClick={(ev) => {
                    const data=avitem(ev,'action')
                    const item=avitem(ev);
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
                    close={!!props.resetCallback}
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
    addEntry: PropTypes.object, //if this is set, immediately start with appending this entry
    hideErrors: PropTypes.bool //if set do not show items with errors (only with preventEdit = true)
};

/**
 *
 * @param chartItem
 * @param opt_callback if set - callback when done
 * @param opt_addEntry if set (itemInfo) start with adding this item
 * @return {boolean}
 */
EditOverlaysDialog.createDialog = (chartItem, opt_callback, opt_addEntry) => {
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
    const requestItem=(chartItem && chartItem.name !== DEFAULT_OVERLAY_CONFIG)?chartItem:undefined;
    fetchOverlayConfig(requestItem,false)
        .then((overlayConfig) => {
                showDialog(undefined, (props) => {
                    return <EditOverlaysDialog
                        {...props}
                        chartName={requestItem ? (requestItem.displayName || requestItem.name) : 'Default'}
                        current={overlayConfig}
                        updateCallback={(newConfig) => {
                            if (newConfig.isEmpty()) {
                                //we can tell the server to delete the config
                                let param = {
                                    request: 'api',
                                    command: 'deleteConfig',
                                    type: 'chart',
                                    name: requestItem ? requestItem.name : undefined,
                                }
                                Requests.getJson(param)
                                    .then(() => {
                                        if (opt_callback) opt_callback(newConfig.getWriteBackData());
                                    })
                                    .catch((err) => {
                                        Toast("unable to save overlay config: " + err);
                                        if (opt_callback) opt_callback();
                                    })
                            } else {
                                let postParam = {
                                    request: 'api',
                                    command: 'saveConfig',
                                    type: 'chart',
                                    name: requestItem ? requestItem.name : undefined,
                                    overwrite: true
                                };
                                Requests.postPlain(postParam, JSON.stringify(newConfig.getWriteBackData(), undefined, 2))
                                    .then((res) => {
                                        if (opt_callback) opt_callback(newConfig.getWriteBackData());
                                    })
                                    .catch((error) => {
                                        Toast("unable to save overlay config: " + error);
                                        if (opt_callback) opt_callback();
                                    });
                            }
                        }}
                        noDefault={!chartItem}
                        addEntry={opt_addEntry}
                    />
                });
        })
        .catch((error) => {
            Toast("unable to get config: " + error);
        });

    return true;
};
export const DEFAULT_OVERLAY_CHARTENTRY = {
    type: 'chart',
    displayName: 'DefaultOverlays',
    name: DEFAULT_OVERLAY_CONFIG,
    canDelete: false,
    canDownload: false,
    time: (new Date()).getTime() / 1000,
    icon: chartImage
};


export default EditOverlaysDialog;