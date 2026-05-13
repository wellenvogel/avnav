/**
 * Created by andreas on 02.05.14.
 */

import {useStoreState} from '../hoc/Dynamic';
import ItemList, {ItemListProps} from '../components/ItemList';
import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React, {useCallback, useEffect, useRef} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
// @ts-ignore
import MapHolder from '../map/mapholder.js';
// @ts-ignore
import GuiHelpers from '../util/GuiHelpers.js';
// @ts-ignore
import WidgetFactory from '../components/WidgetFactory';
// @ts-ignore
import {EditWidgetDialogWithFunc} from '../components/EditWidgetDialog';
// @ts-ignore
import {createDialog as createEditPageDialog, RawButtonDef as EditPageButton} from '../components/EditPageDialog';
import LayoutHandler, {LAYOUT_OPTIONS, LayoutPage} from '../util/layouthandler';
import {DynamicTitleIcons} from "../components/TitleIcons";
import {showDialog} from "../components/OverlayDialog";
import {AisInfoWithFunctions} from "../components/AisInfoDisplay";
import ButtonList from "../components/ButtonList";
import Helper, {injectav} from "../util/helper";
import {useHistory} from "../components/HistoryProvider";
import {useDialogContext} from "../components/DialogContext";
import {PAGEIDS, PageType} from "../util/pageids";
import layouthandler from "../util/layouthandler";
import remotechannel,{COMMANDS} from '../util/remotechannel';
import {ButtonDef, DynamicButtonProps, updateButtons} from "../components/Button";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import GpsPageButtons from "./GpsPageButtons";
import {MultiView, useScrollHelper} from "../components/MultiView";
const PAGE=PAGEIDS.GPS;
const PANEL_LIST=['left','m1','m2','m3','right'];
//from https://stackoverflow.com/questions/16056591/font-scaling-based-on-width-of-container
function resizeFont() {
    GuiHelpers.resizeByQuerySelector('#gpspage .resize');
}
interface WidgetProps extends Record<string, any>{
    weight?:number;
}
const widgetCreator=(widget:WidgetProps,weightSum:number):React.ElementType=>{
    if (! widget) return ()=>null;
    // eslint-disable-next-line prefer-const
    let {weight,...widgetProps}=widget;
    if (weight === undefined) weight=1;
    const height=weight/weightSum*100;
    const Widget=WidgetFactory.createWidget(widgetProps,{mode:'gps'});
    // eslint-disable-next-line react/display-name
    return (props:WidgetProps)=><div className={'widgetWeight'} style={{height:height+"%"}}>
        <Widget {...props}/>
    </div>
};

const getLayoutPage=(pageNum:number)=>{
    const base:PageType=PAGE;
    return{
        location: base,
        layoutPage: base+pageNum,
        options: {pageNumber: pageNum}
    }
}
interface PanelData{
    name:string,
    list?:WidgetProps[]
}
const getPanelList=(panel:string,pageNum:number):[
    LayoutPage,PanelData
]=>{
    const page=getLayoutPage(pageNum);
    const rt=LayoutHandler.getPanelData(page,panel,LayoutHandler.getOptionValues([LAYOUT_OPTIONS.ANCHOR]));
    return [page,rt];

};

const hasPageEntries=(pageNum:number)=>{
    const layoutPage=getLayoutPage(pageNum);
    const page=LayoutHandler.getPageData(layoutPage);
    if (! page) return false;
    const panels=PANEL_LIST;
    for (const panel of panels){
        const panelData=LayoutHandler.getPanelData(layoutPage,panel,LayoutHandler.getAllOptions());
        if (panelData.list && panelData.list.length > 0) return true;
    }
    return false;
};

const getWeightSum=(list:WidgetProps[])=>{
    let sum=0;
    if (! list ) return sum;
    list.forEach((el)=>{
        if (el.weight !== undefined) sum+=parseFloat((el.weight||0) as unknown as string);
        else sum+=1;
    });
    return sum;
};
const findPageWithWidget=(name:string)=>{
    const panels=PANEL_LIST;
    if (! name) return ;
    for (let pnum=0;pnum<=layouthandler.getDashboardNum();pnum++){
        for (const idx in panels){
            const [,list]=getPanelList(panels[idx],pnum);
            if (! list || ! list.list) continue;
            for (const li in list.list){
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
interface Panel extends ItemListProps{
    name:string;
}
interface DashboardPanelProps{
    visible?:boolean;
    pageNumber:number;
    fontSize:number;
    onItemClick:(ev:Event,panelData:PanelData) => void;
}
const DashboardPanel=(props:DashboardPanelProps)=>{
    if (!Helper.unsetorTrue(props.visible)) {
        return <div className={'GpsPanel hidden'}>
            <div className={'PageNumber'}>{props.pageNumber}</div>
            <div className={'loading spinner'}></div>
        </div>
    }
    const dialogContext = useDialogContext();
    const layoutPage=getLayoutPage(props.pageNumber);
    const panelList:Panel[] = [];
    PANEL_LIST.forEach((panelName) => {
        const [page,panelData] = getPanelList(panelName, props.pageNumber);
        if (!panelData.list) return;
        const sum = getWeightSum(panelData.list);
        const prop:Panel  = {
            name: panelData.name,
            dragFrame: panelData.name,
            allowOther: true,
            className: 'widgetContainer',
            itemCreator: (widget:WidgetProps) => {
                return widgetCreator(widget, sum);
            },
            itemList: panelData.list,
            fontSize: props.fontSize,
            onItemClick: (ev:Event) => {
                props.onItemClick(ev, panelData);
            },
            onClick: () => {
                if (LayoutHandler.isEditing()) {
                    showDialog(dialogContext, () => <EditWidgetDialogWithFunc
                        pageWithOptions={layoutPage}
                        panelname={panelData.name}
                        widgetItem={undefined}
                        opt_options={{beginning: false, weight: true, types: ["!map"]}}
                    />);
                }
            },
            dragdrop: LayoutHandler.isEditing(),
            onSortEnd: (oldIndex:number, newIndex:number, frameId:string, targetFrameId:string) => {
                LayoutHandler.withTransaction(layoutPage,
                    (handler) => handler.moveItem(page, frameId, oldIndex, newIndex, targetFrameId));
            }
        };
        panelList.push(prop);
    });
    let panelWidth = 100;
    if (panelList.length) {
        panelWidth = panelWidth / panelList.length;
    }
    return <div className={'GpsPanel'}>
        {panelList.map((panelProps) => {
            return (
                <div className="hfield" style={{width: panelWidth + "%"}} key={panelProps.name}>
                    <ItemList {...panelProps}/>
                </div>
            )
        })}
    </div>
}

const GpsPage = (props:Partial<PageProps>) => {
    const history=useHistory();
    useStoreState(keys.gui.global.reloadSequence);
    const currentButtons=useRef<ButtonDef[]>(null);
    const maxPage=layouthandler.getDashboardNum();
    const [pageNumber, setPageNumberImpl] = useStoreState(keys.gui.gpspage.pageNumber, (currentNumber:number) => {
        if (props.options && props.options.widget && !props.options.returning) {
            const pagenNum = findPageWithWidget(props.options.widget);
            if (pagenNum !== undefined) {
                return pagenNum;
            }
        }
        if (props.options && props.options.pageNumber !== undefined) {
            if (hasPageEntries(props.options.pageNumber)) return props.options.pageNumber
        }
        if (currentNumber >0 && currentNumber <= maxPage && hasPageEntries(currentNumber)) return currentNumber;
        return 1;
    }, true);
    const dialogContext = useDialogContext();
    const setPageNumber = useCallback((num:number,
                                       opt_noRemote?:boolean,
                                       noScroll?:boolean) => {
        setPageNumberImpl(num);
        if (! noScroll) scrollTo(num-1);
        dialogContext.closeDialog();
        if (!opt_noRemote) {
            remotechannel.sendMessage(COMMANDS.gpsNum, num);
        }
    }, []);
    const [scrollProps,scrollTo,visible]=useScrollHelper(pageNumber>0?pageNumber-1:0,
        (min:number,_max:number)=>{
            if (min !== (pageNumber-1)){
                setPageNumber(min+1,false,true);
            }
        });
    useEffect(() => {
        const remoteToken = remotechannel.subscribe(COMMANDS.gpsNum, (number:string) => {
            const pn = parseInt(number);
            if (pn < 0 || pn > maxPage) return;
            if (!hasPageEntries(pn)) return;
            if (pn === pageNumber) return;
            setPageNumber(pn, true);
        })
        return () => remotechannel.unsubscribe(remoteToken);
    }, []);
    useEffect(() => {
        remotechannel.sendMessage(COMMANDS.gpsNum, pageNumber);
    }, []);
    const buttonActions:Record<string, Partial<DynamicButtonProps>> = {
        GpsCenter: {
            onClick: () => {
                MapHolder.centerToGps();
                history.pop();
            }
        },
        [EditPageButton.name]: {
            onClick: () => {
                createEditPageDialog(
                    getLayoutPage(pageNumber).layoutPage,
                    PANEL_LIST,
                    [LAYOUT_OPTIONS.ANCHOR],
                    dialogContext);
            }
        },
        [LayoutHandler.revertButtonDef().name]: {
            onClick: () => {
                layouthandler.revertAction((pageWithOptions) => {
                    const current = getLayoutPage(pageNumber);
                    if (pageWithOptions.location !== current.location) {
                        history.replace(pageWithOptions.location, pageWithOptions.options);
                        return;
                    }
                    if (current.layoutPage !== pageWithOptions.layoutPage) {
                        if (pageWithOptions.options && pageWithOptions.options.pageNumber !== undefined) {
                            setPageNumber(pageWithOptions.options.pageNumber);
                        }
                    }
                })
            }
        },
        Cancel: {
            onClick: () => {
                history.pop();
            }
        }
    };
    for (let i=1;i<=maxPage;i++){
        buttonActions['Gps' + i]={
            onClick: () => {
                setPageNumber(i);
            }
        }
    }
    const buttons=updateButtons(InjectMainMenu(PAGE,updateButtons(GpsPageButtons())),buttonActions);

    const onItemClick = useCallback((ev:Event, panelInfo:PanelData) => {
        const avev=injectav(ev);
        const item=avev.avnav.item;
        if (! item) return;
        if (LayoutHandler.isEditing()) {
            showDialog(dialogContext, () => <EditWidgetDialogWithFunc
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
            const mmsi = avev.avnav.mmsi;
            if (mmsi === undefined) return;
            showDialog(dialogContext, () => {
                return <AisInfoWithFunctions
                    mmsi={mmsi}
                    actionCb={(action:string, m:any) => {
                        if (action === 'AisInfoList') {
                            history.push(PAGEIDS.AIS, {mmsi: m});
                        }
                    }}
                />;
            })
            return;
        }
        history.pop();
    }, [pageNumber]);
    let autohide = undefined;
    if (globalStore.getData(keys.properties.autoHideGpsPage)) {
        autohide = globalStore.getData(keys.properties.hideButtonTime, 30) * 1000;
    }

    let fontSize = layoutBaseParam.baseWidgetFontSize;
    const dimensions = props.windowDimensions;
    if (dimensions) {
        /* we just compute a first guess for the font size
           the resizing stuff will enlarge/shrink the font later
         */
        const width = dimensions.width - 60; //TODO: correct button dimensions...
        if (width > 0 && dimensions.height > 0) {
            const fw = width / layoutBaseParam.layoutWidth || 0;
            const fh = dimensions.height / layoutBaseParam.layoutHeight || 0;
            if (fw > 0 && fh > 0) {
                const factor=Math.min(fh, fw);
                if (factor < 1 ) fontSize = fontSize * factor;
            }
        }
    }
    currentButtons.current=buttons;
    useInitialButton(currentButtons);
    const titleIcons = globalStore.getData(keys.properties.titleIconsGps);
    const views=[];
    for (let i=0;i<maxPage;i++){
        views.push(<DashboardPanel
            pageNumber={i+1}
            fontSize={fontSize}
            onItemClick={onItemClick}
            visible={visible(i) || pageNumber == (i+1)}
        />)
    }
    return (
        <PageFrame
            id={props.id}
            autoHideButtons={autohide}
        >
            <PageLeft id={props.id} >
                {titleIcons && <DynamicTitleIcons/>}
                <MultiView
                    {...scrollProps}
                    views={views}
                    maxNumber={1}
                />
            </PageLeft>
            <ButtonList page={props.id} itemList={currentButtons.current} widthChanged={() => resizeFont()}/>
        </PageFrame>
    )
}


export default GpsPage;