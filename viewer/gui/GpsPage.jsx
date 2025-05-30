/**
 * Created by andreas on 02.05.14.
 */

import Dynamic, {useStore, useStoreState} from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import Page, {PageFrame, PageLeft} from '../components/Page.jsx';
import MapHolder from '../map/mapholder.js';
import GuiHelpers from '../util/GuiHelpers.js';
import WidgetFactory from '../components/WidgetFactory.jsx';
import EditWidgetDialog, {EditWidgetDialogWithFunc} from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import anchorWatch from '../components/AnchorWatchDialog.jsx';
import Mob from '../components/Mob.js';
import Dimmer from '../util/dimhandler.js';
import FullScreen from '../components/Fullscreen';
import remotechannel, {COMMANDS} from "../util/remotechannel";
import RemoteChannelDialog from "../components/RemoteChannelDialog";
import {DynamicTitleIcons} from "../components/TitleIcons";
import Dialogs, {showDialog} from "../components/OverlayDialog";
import {AisInfoWithFunctions} from "../components/AisInfoDisplay";
import ButtonList from "../components/ButtonList";
const MINPAGE=1;
const MAXPAGE=5;
const PANEL_LIST=['left','m1','m2','m3','right'];
//from https://stackoverflow.com/questions/16056591/font-scaling-based-on-width-of-container
function resizeFont() {
    GuiHelpers.resizeByQuerySelector('#gpspage .resize');
}
const widgetCreator=(widget,weightSum)=>{
    let {weight,...widgetProps}=widget;
    if (weight === undefined) weight=1;
    let height=weight/weightSum*100;
    return WidgetFactory.createWidget(widget,{style:{height:height+"%"},mode:'gps'});
};

const getLayoutPage=(pageNum)=>{
    const base="gpspage";
    return{
        location: base,
        layoutPage: base+pageNum,
        options: {pageNumber: pageNum}
    }
}

const getPanelList=(panel,pageNum)=>{
    let page=getLayoutPage(pageNum);
    let rt=LayoutHandler.getPanelData(page,panel,LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.ANCHOR]));
    rt.page=page;
    return rt;

};

const hasPageEntries=(pageNum)=>{
    let layoutPage=getLayoutPage(pageNum);
    let page=LayoutHandler.getPageData(layoutPage);
    if (! page) return false;
    let panels=PANEL_LIST;
    for (let p in panels){
        let panel=panels[p];
        let panelData=LayoutHandler.getPanelData(layoutPage,panel,LayoutHandler.getAllOptions());
        if (panelData.list && panelData.list.length > 0) return true;
    }
    return false;
};

const getWeightSum=(list)=>{
    let sum=0;
    if (! list ) return sum;
    list.forEach((el)=>{
        if (el.weight !== undefined) sum+=parseFloat(el.weight||0);
        else sum+=1;
    });
    return sum;
};
const findPageWithWidget=(name)=>{
    let panels=PANEL_LIST;
    if (! name) return ;
    for (let pnum=MINPAGE;pnum<=MAXPAGE;pnum++){
        for (let idx in panels){
            let list=getPanelList(panels[idx],pnum);
            if (! list || ! list.list) continue;
            for (let li in list.list){
                if (! list.list[li]) continue;
                if (list.list[li].name == name){
                    return pnum;
                }
            }
        }
    }
};


const layoutBaseParam={
    layoutWidth: 600, //the widgets are prepared for this width, others will scale the font
    layoutHeight: 600,
    baseWidgetFontSize: 21, //font size for 600x600
};

const GpsPage = (props) => {
    const [pageNumber, setPageNumberImpl] = useStoreState(keys.gui.gpspage.pageNumber, (currentNumber) => {
        if (props.options && props.options.widget && !props.options.returning) {
            let pagenNum = findPageWithWidget(props.options.widget);
            if (pagenNum !== undefined) {
                return pagenNum;
            }
        }
        if (props.options && props.options.pageNumber !== undefined) {
            if (hasPageEntries(props.options.pageNumber)) return props.options.pageNumber
        }
        if (currentNumber >= MINPAGE && currentNumber <= MAXPAGE && hasPageEntries(currentNumber)) return currentNumber;
        return 1;
    }, true);
    const dialogCtxRef = useRef();
    const setPageNumber = useCallback((num, opt_noRemote) => {
        setPageNumberImpl(num);
        if (!opt_noRemote) {
            remotechannel.sendMessage(COMMANDS.gpsNum, num);
        }
    }, []);
    useEffect(() => {
        const remoteToken = remotechannel.subscribe(COMMANDS.gpsNum, (number) => {
            let pn = parseInt(number);
            if (pn < MINPAGE || pn > MAXPAGE) return;
            if (!hasPageEntries(pn)) return;
            if (pn === pageNumber) return;
            setPageNumber(pn, true);
        })
        return () => remotechannel.unsubscribe(remoteToken);
    }, []);
    useEffect(() => {
        remotechannel.sendMessage(COMMANDS.gpsNum, pageNumber);
    }, []);
    const createNumButtons = useCallback((min, max) => {
        let rt = [];
        for (let i = min; i <= max; i++) {
            rt.push({
                name: "Gps" + i,
                storeKeys: {
                    layoutSequence: keys.gui.global.layoutSequence,
                    isEditing: keys.gui.global.layoutEditing
                },
                updateFunction: (state) => {
                    return {
                        toggle: pageNumber == i,
                        visible: hasPageEntries(i) || state.isEditing
                    }
                },
                onClick: () => {
                    setPageNumber(i);
                },
                overflow: true
            });
        }
        return rt;
    }, [pageNumber])
    const buttons = [
        {
            name: 'GpsCenter',
            onClick: () => {
                MapHolder.centerToGps();
                props.history.pop();
            },
            editDisable: true
        }]
        .concat(createNumButtons(MINPAGE, MAXPAGE))
        .concat([
            anchorWatch(false, dialogCtxRef),
            RemoteChannelDialog({overflow: true}, dialogCtxRef),
            Mob.mobDefinition(props.history),
            EditPageDialog.getButtonDef(
                getLayoutPage(pageNumber).layoutPage,
                PANEL_LIST,
                [LayoutHandler.OPTIONS.ANCHOR],
                dialogCtxRef),
            LayoutFinishedDialog.getButtonDef(undefined, dialogCtxRef),
            LayoutHandler.revertButtonDef((pageWithOptions) => {
                let current = getLayoutPage(pageNumber);
                if (pageWithOptions.location !== current.location) {
                    props.history.replace(pageWithOptions.location, pageWithOptions.options);
                    return;
                }
                if (current.layoutPage !== pageWithOptions.layoutPage) {
                    if (pageWithOptions.options && pageWithOptions.options.pageNumber !== undefined) {
                        setPageNumber(pageWithOptions.options.pageNumber);
                    }
                }
            }),
            FullScreen.fullScreenDefinition,
            Dimmer.buttonDef(),
            {
                name: 'Cancel',
                onClick: () => {
                    props.history.pop();
                }
            }
        ]);
    const onItemClick = useCallback((item, data, panelInfo) => {
        if (LayoutHandler.isEditing()) {
            showDialog(dialogCtxRef, () => <EditWidgetDialogWithFunc
                widgetItem={item}
                pageWithOptions={getLayoutPage(pageNumber)}
                panelname={panelInfo.name}
                opt_options={{
                    beginning: false,
                    weight: true,
                    types: ["!map"]
                }}
            />);
            return;
        }
        if (item && item.name === "AisTarget") {
            let mmsi = (data && data.mmsi) ? data.mmsi : item.mmsi;
            if (mmsi === undefined) return;
            showDialog(dialogCtxRef, () => {
                return <AisInfoWithFunctions
                    mmsi={mmsi}
                    hidden={{
                        AisNearest: true,
                        AisInfoLocate: true,
                    }}
                    actionCb={(action, m) => {
                        if (action === 'AisInfoList') {
                            props.history.push('aispage', {mmsi: m});
                        }
                    }}
                />;
            })
            return;
        }
        props.history.pop();
    }, [pageNumber]);
    let autohide = undefined;
    if (globalStore.getData(keys.properties.autoHideGpsPage)) {
        autohide = globalStore.getData(keys.properties.hideButtonTime, 30) * 1000;
    }

    let fontSize = layoutBaseParam.baseWidgetFontSize;
    let dimensions = props.windowDimensions;
    if (dimensions) {
        /* we just compute a first guess for the font size
           the resizing stuff will enlarge/shrink the font later
         */
        let width = dimensions.width - 60; //TODO: correct button dimensions...
        if (width > 0 && dimensions.height > 0) {
            let fw = width / layoutBaseParam.layoutWidth || 0;
            let fh = dimensions.height / layoutBaseParam.layoutHeight || 0;
            if (fw > 0 && fh > 0) {
                fontSize = fontSize * Math.min(fh, fw);
            }
        }
    }
    let panelList = [];
    PANEL_LIST.forEach((panelName) => {
        let panelData = getPanelList(panelName, pageNumber);
        if (!panelData.list) return;
        let sum = getWeightSum(panelData.list);
        let prop = {
            name: panelData.name,
            dragFrame: panelData.name,
            allowOther: true,
            className: 'widgetContainer',
            itemCreator: (widget) => {
                return widgetCreator(widget, sum);
            },
            itemList: panelData.list,
            fontSize: fontSize,
            onItemClick: (item, data) => {
                onItemClick(item, data, panelData);
            },
            onClick: () => {
                if (LayoutHandler.isEditing()) {
                    showDialog(dialogCtxRef, () => <EditWidgetDialogWithFunc
                        pageWithOptions={getLayoutPage(pageNumber)}
                        panelname={panelData.name}
                        widgetItem={undefined}
                        opt_options={{beginning: false, weight: true, types: ["!map"]}}
                    />);
                }
            },
            dragdrop: LayoutHandler.isEditing(),
            onSortEnd: (oldIndex, newIndex, frameId, targetFrameId) => {
                LayoutHandler.withTransaction(getLayoutPage(pageNumber),
                    (handler) => handler.moveItem(panelData.page, frameId, oldIndex, newIndex, targetFrameId));
            }
        };
        panelList.push(prop);
    });
    let panelWidth = 100;
    if (panelList.length) {
        panelWidth = panelWidth / panelList.length;
    }
    let titleIcons = globalStore.getData(keys.properties.titleIconsGps);
    return (
        <PageFrame
            id={"gpspage"}
            autoHideButtons={autohide}
        >
            <PageLeft dialogCtxRef={dialogCtxRef}>
                {titleIcons && <DynamicTitleIcons/>}
                {panelList.map((panelProps) => {
                    return (
                        <div className="hfield" style={{width: panelWidth + "%"}} key={panelProps.name}>
                            <ItemList {...panelProps}/>
                        </div>
                    )
                })}
            </PageLeft>
            <ButtonList itemList={buttons} widthChanged={() => resizeFont()}/>
        </PageFrame>
    )
}

GpsPage.propTypes={
    ...Page.pageProperties,
    pageNum: PropTypes.number
};

export default GpsPage;