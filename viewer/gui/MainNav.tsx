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
import React,{SyntheticEvent, useState} from "react";
import {ListFrame, ListItem, ListMainSlot, ListSlot} from "../components/ListItems";
import Helper, {getav, setav} from "../util/helper";
import {useDialogContext} from "../components/DialogContext";
// @ts-ignore
import {DialogFrame, showDialog} from '../components/OverlayDialog.jsx';
import {useHistory} from "../components/HistoryProvider";
import {ButtonDef, ButtonEvent, ButtonEventHandler, ButtonRow, propsToDefs} from "../components/Button";
import MainPageButtons from "./MainPageButtons";
import GeneralButtons from "./GeneralButtons";
import globalstore from "../util/globalstore";
// @ts-ignore
import keys from "../util/keys";
import {ChartOverlayButtons} from "./DownloadPageButtons";
import {PAGEIDS} from "../util/pageids";
import {CopyAware} from "../util/CopyAware";

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
}


const mainTree=[
    new Page(PAGEIDS.DOWNLOAD,'settings','Charts, Overlays',
        GeneralButtons.concat(ChartOverlayButtons),{allowedTypes:['chart','overlay']}),
    new Page(PAGEIDS.MAIN,'navigation','Select Chart',
        MainPageButtons
        )
]


interface PageRowProps{
    page:Page;
    onClick:ButtonEventHandler;
    isCurrent:boolean;
    expanded: boolean;
}
const PageRow=({page,onClick,isCurrent,expanded}:PageRowProps)=>{
    const className=Helper.concatsp('Page',page.kind);
    const layoutEditing=globalstore.getData(keys.gui.global.layoutEditing);
    const dialogContext=useDialogContext();
    return <React.Fragment>
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
            icon={{className:expanded?'MNexpanded':'MNcollapsed'}}
            onClick={(ev)=>{
                setav(ev,{expanded:!expanded});
                onClick(ev);
            }}
        ></ListSlot>
        </ListItem>
        {expanded &&
            <ListFrame className={'ButtonList'}>
                {page.buttons.map((bt)=> {
                    if (bt.localOnly && ! isCurrent) return null;
                    if (bt.editOnly && ! layoutEditing) return null;
                    return <ButtonRow
                            {...bt}
                            key={bt.name}
                            onClick={(ev) => {
                                if (isCurrent) {
                                    //directly call the butoon action from the page
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

    </React.Fragment>
}
export type ButtonCallback= (ev:ButtonEvent, button:string)=>void;
export interface MainNavProps{
    current:string,
    currentButtons:ButtonDef[],
}
export const MainNav = (props:MainNavProps) => {
    const dialogContext=useDialogContext();
    const [expanded,setExpanded]=useState(props.current);
    const history=useHistory();
    const pages=mainTree.slice(0);
    pages.sort((a)=>(a.name===props.current)?-1:0);
    return <DialogFrame className={'MainNav'}>
        {pages.map((page)=>{
            const displayPage=(page.name === props.current)?page.copy({
                buttons:props.currentButtons
            }):page;
            return <PageRow key={page.name} page={displayPage} onClick={(ev: SyntheticEvent)=> {
                const av=getav(ev);
                if (av.expanded !== undefined) {
                    if (av.expanded) {
                        setExpanded(page.name);
                    }
                    else {
                        setExpanded(undefined);
                    }
                    return;
                }
                dialogContext.closeDialog();
                if (page.name !== props.current) {
                    history.push(page.name,{...page.options, button:av.button});
                }
            }}
                 isCurrent={page.name==props.current}
                 expanded={page.name === expanded}
            />;
        })}
    </DialogFrame>
}
export const InjectMainMenu=(pagename:string, pageButtons:ButtonDef[]) => {
    return propsToDefs([ {
        name: 'MainNav',
        onClick: (ev:SyntheticEvent)=>{
            const dialogContext=getav(ev).dialogContext;
            showDialog(dialogContext,()=><MainNav
                current={pagename}
                currentButtons={pageButtons}
            />,undefined,{coverClassName:'MainNavCover'})
        }
    }]).concat(pageButtons);
}
