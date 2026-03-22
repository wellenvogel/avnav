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
import {IDialogContext, useDialogContext} from "../components/DialogContext";
// @ts-ignore
import {DialogFrame, showDialog} from '../components/OverlayDialog.jsx';
import {useHistory} from "../components/HistoryProvider";
import {ButtonDef, ButtonEventHandler, ButtonRow, propsToDefs} from "../components/Button";
import MainPageButtons from "./MainPageButtons";
import GeneralButtons from "./GeneralButtons";
import globalstore from "../util/globalstore";
import keys, {MainColumns, MainExpandMode} from "../util/keys";
import {ChartOverlayButtons} from "./DownloadPageButtons";
import {PAGE_TITLES, PAGEIDS} from "../util/pageids";
import {CopyAware} from "../util/CopyAware";
import {HistoryEntry, IHistory} from "../util/history";
import ChannelsPageButtons from "./ChannelsPageButtons";
import ServerPageButtons from "./ServerPageButtons";
import addons from '../components/Addons';
import NavPageButtons from "./NavPageButtons";
import {ScrollExeMode, scrollInContainer} from "../util/UiHelper";
import RoutesPageButtons from "./RoutesPageButtons";

type PageKind='navigation'|'settings';

class Page extends CopyAware{
    name:string;
    displayName?:string;
    buttons:ButtonDef[];
    kind:PageKind;
    options:Record<string, any>;
    constructor(name:string,kind:PageKind,
                displayName?:string,
                buttons?:ButtonDef[],
                options?:Record<string, any>
        ){
        super();
        this.name=name;
        this.displayName=displayName;
        this.buttons=buttons;
        this.kind=kind;
        this.options=options;
    }
    getDisplay(){
        return this.displayName||this.name;
    }
    getButtons(){
        const addonButtons=addons.getPageUserButtons(this.name);
        return this.buttons.concat(propsToDefs(addonButtons));
    }
}


const mainTree=[
    new Page(PAGEIDS.MAIN,'navigation',PAGE_TITLES.MAIN,
        MainPageButtons),
    new Page(PAGEIDS.NAV,'navigation',PAGE_TITLES.NAV,
        NavPageButtons),
    new Page(PAGEIDS.NROUTE,'settings',PAGE_TITLES.NROUTE,
        RoutesPageButtons),
    new Page(PAGEIDS.CHANNELS,'settings',PAGE_TITLES.CHANNELS,
        ChannelsPageButtons),
    new Page(PAGEIDS.SERVER,"settings",PAGE_TITLES.SERVER,
        ServerPageButtons),
    new Page(PAGEIDS.DOWNLOAD,'settings',PAGE_TITLES.DOWNLOAD,
        GeneralButtons.concat(ChartOverlayButtons)),
]


interface PageRowProps{
    page:Page;
    onClick:ButtonEventHandler;
    isCurrent:boolean;
    expanded: boolean;
    expandSequence: number;
    pageref?:(el:HTMLElement)=>void;
}
const PageRow=({page,onClick,isCurrent,expanded,expandSequence,pageref}:PageRowProps)=>{
    const className=Helper.concatsp('Page',page.kind);
    const layoutEditing=globalstore.getData(keys.gui.global.layoutEditing);
    const dialogContext=useDialogContext();
    const [isExpanded,setExpanded]=useState(expanded);
    useEffect(() => {
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
        <ListSlot
            className={'iconSlot'}
            icon={{className:isExpanded?'MNexpanded':'MNcollapsed'}}
            onClick={(ev)=>{
                setExpanded(!isExpanded);
                ev.stopPropagation();
            }}
        ></ListSlot>
        </ListItem>
        {isExpanded &&
            <ListFrame className={'ButtonList'}>
                {page.getButtons().map((bt)=> {
                    if (bt.localOnly && ! isCurrent) return null;
                    if (bt.editOnly && ! layoutEditing) return null;
                    return <ButtonRow
                            {...bt}
                            key={bt.name}
                            onClick={(ev) => {
                                if (isCurrent) {
                                    //directly call the button action from the page
                                    //remove the dialog context
                                    //to ensure the global context will be used
                                    setav(ev,{dialogContext:undefined});
                                    dialogContext.closeDialog();
                                    if (bt.onClick) {
                                        bt.onClick(ev);
                                    }
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
export interface MainNavProps{
    current:string,
    currentButtons:ButtonDef[],
    expandMode:MainExpandMode
}
export const MainNav = (props:MainNavProps) => {
    const dialogContext=useDialogContext();
    const history=useHistory();
    const [expandMode,setExpandMode]=useState(props.expandMode);
    const [expandSequence,setExpandSequence]=useState(0);
    const pages=mainTree.slice(0);
    const currentEl=useRef<HTMLElement>(null);
    //pages.sort((a)=>(a.name===props.current)?-1:0);
    useEffect(() => {
        if (!currentEl.current) return;
        scrollInContainer(currentEl.current.parentElement,currentEl.current,ScrollExeMode.vertical)
    }, []);
    return <DialogFrame className={'MainNav'}>
        <ListItem className={'heading'}>
            <ListSlot className={'iconSlot'}
                icon={{className:'MNcollapsed'}}
                onClick={()=>{
                    setExpandMode(MainExpandMode.ALL);
                    setExpandSequence((old)=>old+1)
                }}
            />
            <ListSlot className={'iconSlot'}
                icon={{className:'MNexpanded'}}
                onClick={()=>{
                        setExpandMode(MainExpandMode.NONE);
                        setExpandSequence((old)=>old+1)
                        }}
                />
            <ListSlot className={'iconSlot'}
                icon={{className:'Cancel'}}
                onClick={()=>{
                            dialogContext.closeDialog();
                        }}
                />
        </ListItem>
        {pages.map((page)=>{
            const displayPage=(page.name === props.current)?page.copy({
                buttons:props.currentButtons
            }):page;
            const isCurrent=page.name==props.current;
            const expand=(expandMode == MainExpandMode.ALL)
                || isCurrent && ( expandMode == MainExpandMode.CURRENT);
            return <PageRow
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
                    history.push(page.name,{...page.options, button:av.button});
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
    pagename:string,
    pageButtons:ButtonDef[]
    ) => {
    return propsToDefs([ {
        name: 'MainNav',
        onClick: (ev:SyntheticEvent)=>{
            const dialogContext=getav(ev).dialogContext;
            const expandMode=globalstore.getData(keys.properties.mainNavExpand);
            const columns=globalstore.getData(keys.properties.mainNavCols);
            let colClass="";
            if (columns == MainColumns.five) colClass="col5";
            else if (columns == MainColumns.seven) colClass="col7";
            else if (columns == MainColumns.all) colClass="full";
            showDialog(dialogContext,()=><MainNav
                current={pagename}
                currentButtons={pageButtons}
                expandMode={expandMode}
            />,undefined,{coverClassName:Helper.concatsp('MainNavCover',colClass)})
        }
    }]).concat(pageButtons,propsToDefs(addons.getPageUserButtons(pagename)));
}

export const handleInitialButton = (history: IHistory, pageButtons: ButtonDef[], dialogContext?: IDialogContext) => {
    //check and remove the button from the history
    const current = history.currentLocation(true) as HistoryEntry;
    if (current.options && current.options.button) {
        const bname = current.options.button;
        history.replace(current.location,
            {
                ...current.options,
                button: undefined
            });
        for (const bt of pageButtons) {
            if (bt.name === bname && bt.onClick) {
                bt.onClick(setav(new Event('avnav'), {
                    history: history,
                    dialogContext: dialogContext
                }))
                return;
            }
        }
    }
}

export const useInitialButton=(buttonList:RefObject<ButtonDef[]>)=>{
    const history=useHistory()
    const dialogContext=useDialogContext()
    useEffect(() => {
        if (! buttonList.current) return;
        handleInitialButton(history,buttonList.current,dialogContext);
    }, []);
}
