/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
import React, {RefObject, SyntheticEvent, useEffect, useRef, useState} from "react";
import {ListFrame, ListItem, ListMainSlot, ListSlot} from "../components/ListItems";
import Helper, {getav, setav} from "../util/helper";
import {useDialogContext} from "../components/DialogContext";
import {DialogFrame, showDialog} from '../components/OverlayDialog';
import {useHistory} from "../components/HistoryProvider";
import {ButtonDef, ButtonEvent, ButtonEventHandler, ButtonRow, propsToDefs} from "../components/Button";
import MainPageButtons from "./MainPageButtons";
import globalstore from "../util/globalstore";
import keys, {MainColumns, MainExpandMode} from "../util/keys";
import {getPageTitle, PAGEIDS, PageType} from "../util/pageids";
import {CopyAware} from "../util/CopyAware";
import {IHistory} from "../util/history";
import ChannelsPageButtons from "./ChannelsPageButtons";
import ServerPageButtons from "./ServerPageButtons";
import addons, {PageUserButton} from '../util/Addons';
import NavPageButtons from "./NavPageButtons";
import {ScrollExeMode, scrollInContainer} from "../util/UiHelper";
import RoutesPageButtons from "./RoutesPageButtons";
import TracksPageButtons from "./TracksPageButtons";
import AisCfgPageButtons from "./AisCfgPageButtons";
import LayoutsPageButtons from "./LayoutsPageButtons";
// @ts-ignore
import LayoutFinishedDialog from '../components/LayoutFinishedDialog';
import ChartsPageButtons from "./ChartsPageButtons";
import SettingsPageButtons from "./SettingsPageButtons";
import GpsPageButtons from "./GpsPageButtons";
import keyhandler from "../util/keyhandler";
import {injectAddonButtonAction} from "../components/AddonView";
import PluginsPageButtons from "./PluginsPageButtons";
import AddOnPageButtons from "./AddOnPageButtons";
import AddOnConfigPageButtons from "./AddOnConfigPageButtons";
import RemotePageButtons from "./RemotePageButtons";
import {EditSettingsCategory} from "../components/Settings";
import {ActionDialog} from "../components/ActionDialog";
import {actionButtons} from "./MainActionButtons";
import layouthandler from "../util/layouthandler";


type PageKind='navigation'|'settings';

class Page extends CopyAware{
    name:string;
    displayName?:string;
    buttons:ButtonDef[]|(()=>ButtonDef[]);
    kind:PageKind;
    constructor(name:string,kind:PageKind,
                buttons?:ButtonDef[]|(()=>ButtonDef[])
        ){
        super();
        this.name=name;
        this.displayName=getPageTitle(name);
        this.buttons=buttons;
        this.kind=kind;
    }
    getDisplay(){
        return this.displayName||this.name;
    }
    getButtons(){
        const addonButtons=addons.getPageUserButtons(this.name);
        const buttons=(typeof this.buttons === 'function'? this.buttons() :this.buttons)
        return buttons.concat(propsToDefs(addonButtons));
    }
}

class ActionPage extends Page{
    constructor() {
        super("Actions","navigation");
        this.displayName="Actions";
    }
    override getButtons():ButtonDef[]{
        return [];
    }

}

const actionPage=new ActionPage();

const mainTree=[
    new Page(PAGEIDS.MAIN,'navigation',
        MainPageButtons),
    new Page(PAGEIDS.NAV,'navigation',
        NavPageButtons),
    new Page(PAGEIDS.GPS,'navigation',
        GpsPageButtons),
    new Page(PAGEIDS.ADDON,'navigation',
        AddOnPageButtons),
    new Page(PAGEIDS.CHARTS,'settings',
        ChartsPageButtons),
    new Page(PAGEIDS.NROUTE,'settings',
        RoutesPageButtons),
    new Page(PAGEIDS.TRACKS,'settings',
        TracksPageButtons),
    new Page(PAGEIDS.AISCFG,'settings',
        AisCfgPageButtons),
    new Page(PAGEIDS.PLUGINS,'settings',
        PluginsPageButtons),
    new Page(PAGEIDS.LAYOUT,'settings',
        LayoutsPageButtons),
    new Page(PAGEIDS.CHANNELS,'settings',
        ChannelsPageButtons),
    new Page(PAGEIDS.SETTINGS,'settings',
        SettingsPageButtons),
    new Page(PAGEIDS.ADDCFG,'settings',
        AddOnConfigPageButtons),
    new Page(PAGEIDS.SERVER,"settings",
        ServerPageButtons),
    new Page(PAGEIDS.REMOTE,"settings",
        RemotePageButtons)
]


interface PageRowProps{
    page:Page;
    onClick:ButtonEventHandler;
    isCurrent:boolean;
    expanded: boolean;
    expandSequence: number;
    noExpand?:boolean;
    pageref?:(el:HTMLElement)=>void;
}
const PageRow=({
                   page,onClick,isCurrent,
                   expanded,expandSequence,noExpand,
                   pageref
}:PageRowProps)=>{
    const className=Helper.concatsp('Page',page.kind);
    const layoutEditing=globalstore.getData(keys.gui.global.layoutEditing);
    const dialogContext=useDialogContext();
    const [isExpanded,setExpanded]=useState(expanded);
    useEffect(() => {
        if (noExpand) return;
        setExpanded(expanded);
    }, [expanded,expandSequence]);
    return <div ref={(el:HTMLElement) =>{
            if (pageref) pageref(el);
            }
        } className={'PageRowFrame'}>
        <ListItem
        className={className}
        selected={isCurrent}
        onClick={(ev)=>{
        setav(ev,{page:page.name});
        onClick(ev);
    }}>
        <ListSlot icon={{className:page.kind}}/>
        <ListMainSlot primary={page.getDisplay()}>
        </ListMainSlot>
            {!noExpand && <ListSlot
            className={'iconSlot'}
            icon={{className:isExpanded?'MNexpanded':'MNcollapsed'}}
            onClick={(ev)=>{
                setExpanded(!isExpanded);
                ev.stopPropagation();
            }}
        ></ListSlot>
            }
        </ListItem>
        {isExpanded && ! noExpand &&
            <ListFrame className={'ButtonList'}>
                {page.getButtons().map((bt)=> {
                    if (bt.localOnly && ! isCurrent) return null;
                    if (bt.editOnly && ! layoutEditing) return null;
                    return <ButtonRow
                            {...bt}
                            key={bt.name}
                            onClick={async (ev) => {
                                if (isCurrent) {
                                    await dialogContext.closeDialog();
                                    keyhandler.callHandler('button',bt.name);
                                    return;
                                }
                                ev.stopPropagation()
                                setav(ev, {page: page.name, button: bt.name})
                                onClick(ev)
                            }}></ButtonRow>
                    }
                )}
            </ListFrame>}

    </div>
}

export const exitAndroidApp=()=>{
    // @ts-ignore
    if (! window.avnavAndroid) return false
    // @ts-ignore
    window.avnavAndroid.goBack();
    return true;
}

export interface MainNavProps{
    current:string,
    currentButtons:ButtonDef[],
    expandMode:MainExpandMode
    cancelCallback?:()=>void
}
export const MainNav = (props:MainNavProps) => {
    const dialogContext=useDialogContext();
    const history=useHistory();
    const [expandMode,setExpandMode]=useState(props.expandMode);
    const [expandSequence,setExpandSequence]=useState(0);
    const pages=mainTree.slice(0);
    const currentEl=useRef<HTMLElement>(null);
    const noExpand = expandMode === MainExpandMode.NEVER;
    //pages.sort((a)=>(a.name===props.current)?-1:0);
    useEffect(() => {
        if (!currentEl.current) return;
        scrollInContainer(currentEl.current.parentElement,currentEl.current,ScrollExeMode.vertical)
    }, []);
    return <DialogFrame className={'MainNav'}>
        <ListItem className={'heading'}>
            { ! noExpand && <ListSlot className={'iconSlot'}
                icon={{className:'MNcollapsed'}}
                onClick={()=>{
                    setExpandMode(MainExpandMode.ALL);
                    setExpandSequence((old)=>old+1)
                }}
            />}
            { ! noExpand && <ListSlot className={'iconSlot'}
                icon={{className:'MNexpanded'}}
                onClick={()=>{
                        setExpandMode(MainExpandMode.NONE);
                        setExpandSequence((old)=>old+1)
                        }}
                />
            }
            <ListSlot className={'iconSlot'}
                icon={{className:'MNSettings'}}
                onClick={()=>{
                            dialogContext.replaceDialog(()=><EditSettingsCategory
                                category={'MainMenu'}
                                title={'MainMenu Settings'}
                            />)
                        }}
                />
        </ListItem>
        <PageRow page={actionPage}
                 noExpand={true}
                 onClick={() => {
                     dialogContext.replaceDialog(()=><ActionDialog actionButtons={actionButtons}/>,
                         ()=>dialogContext.closeDialog());
                 }}
                 isCurrent={false}
                 expanded={false}
                 expandSequence={0}/>
        {pages.map((page)=>{
            const displayPage=(page.name === props.current)?page.copy({
                buttons:props.currentButtons
            }):page;
            const isCurrent=page.name==props.current;
            const expand=(expandMode == MainExpandMode.ALL)
                || isCurrent && ( expandMode == MainExpandMode.CURRENT);
            return <PageRow
                noExpand={noExpand}
                pageref={isCurrent?(el)=>{
                    currentEl.current=el
                    }
                    :undefined}
                key={page.name}
                page={displayPage}
                onClick={(ev: SyntheticEvent)=> {
                dialogContext.closeDialog();
                const av=getav(ev);
                if (page.name !== props.current) {
                    history.push(page.name,{ button:av.button});
                }
            }}
                 isCurrent={isCurrent}
                 expanded={expand }
                 expandSequence={expandSequence}
            />;
        })}
    </DialogFrame>
}
export const InjectMainMenu=(
    pagename:PageType,
    pageButtons:ButtonDef[]|(()=>ButtonDef[]),
    mainCancel?:()=>void,
    ) => {
    const computedButtons=(typeof pageButtons === 'function'? pageButtons() :pageButtons);
    const addonButtons=addons.getPageUserButtons(pagename);
    const computedAddonButtons:PageUserButton[]=[];
    for (const addonButton of addonButtons){
        computedAddonButtons.push(injectAddonButtonAction(addonButton,pagename));
    }
    return propsToDefs([ {
        name: 'MainNav',
        displayName: 'main menu',
        onClick: async (ev:ButtonEvent)=>{
            const dialogContext=getav(ev).dialogContext;
            const toggle=globalstore.getData(keys.gui.global.mainNavVisible);
            if (toggle){
                toggle();
                globalstore.storeData(keys.gui.global.mainNavVisible,undefined);
                if (mainCancel) mainCancel();
                return;
            }
            const expandMode=globalstore.getData(keys.properties.mainNavExpand);
            const columns=globalstore.getData(keys.properties.mainNavCols);
            const noExpand=expandMode == MainExpandMode.NEVER;
            let colClass="";
            if (columns == MainColumns.five && ! noExpand) colClass="col5";
            else if (columns == MainColumns.seven && ! noExpand) colClass="col7";
            else if (columns == MainColumns.all && ! noExpand) colClass="full";
            const cleanup=await showDialog(dialogContext,()=><MainNav
                current={pagename}
                currentButtons={computedButtons}
                expandMode={expandMode}
                cancelCallback={mainCancel}
            />,()=>{
                globalstore.storeData(keys.gui.global.mainNavVisible,undefined);
            },{coverClassName:Helper.concatsp('MainNavCover',colClass)})
            globalstore.storeData(keys.gui.global.mainNavVisible,cleanup);
        },
        storeKeys:{
            toggle:keys.gui.global.mainNavVisible
        },
        updateFunction:props => {
            return {
                toggle: !!props.toggle
            }
        },
        closeDialogs:false
    },
        LayoutFinishedDialog.getButtonDef(),
        layouthandler.revertButtonDef()
    ]).concat(computedButtons,propsToDefs(computedAddonButtons));
}

export const handleInitialButton = (history: IHistory) => {
    //check and remove the button from the history
    const bname=history.fetchOptionValue('button');
    if (bname){
        keyhandler.callHandler('button', bname);
        return bname;
    }
}

export const useInitialButton=(buttonList:RefObject<ButtonDef[]>)=>{
    const history=useHistory()
    useEffect(() => {
        if (! buttonList.current) return;
        handleInitialButton(history);
    }, []);
}
