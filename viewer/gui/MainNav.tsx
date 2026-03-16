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
// @ts-ignore
import Helper, {getav, setav} from "../util/helper";
import {useDialogContext} from "../components/DialogContext";
// @ts-ignore
import {DialogFrame} from '../components/OverlayDialog.jsx';

class ButtonEntry{
    name:string;
    buttonName?:string;
    localOnly:boolean
    constructor(name:string,buttonName?:string,localOnly?:boolean){
        this.name = name;
        this.buttonName = buttonName;
        this.localOnly = !!localOnly;
    }
    getDisplay(){
        return this.buttonName||this.name;
    }
}

type PageKind='navigation'|'settings';

class Page{
    name:string;
    displayName?:string;
    buttons:ButtonEntry[];
    kind:PageKind;
    constructor(name:string,kind:PageKind,displayName?:string,buttons?:ButtonEntry[]){
        this.name=name;
        this.displayName=displayName;
        this.buttons=buttons;
        this.kind=kind;
    }
    getDisplay(){
        return this.displayName||this.name;
    }
}

const MOB=new ButtonEntry('MOB','mob',true);
const BACK=new ButtonEntry('Cancel','back',true);

const mainTree=[
    new Page('charts','settings','Charts, Overlays',
        [
        BACK,
        MOB,
        new ButtonEntry('charts'),
        new ButtonEntry('overlays'),
        new ButtonEntry('import','chart import'),
        new ButtonEntry('display')
        ]),
    new Page('mainpage','navigation','Select Chart',[
        BACK,
        MOB,
        new ButtonEntry('Connected','connected mode'),
        new ButtonEntry('ShowGps','dashboard'),
        new ButtonEntry('Night','night mode'),
        new ButtonEntry('FullScreen','full screen'),
        new ButtonEntry('RemoteChannel','remote control'),
        new ButtonEntry('Split','split mode'),
    ])
]
type EventHandler=(e:SyntheticEvent) => void;

interface ButtonRowProps{
    button:ButtonEntry,
    onClick:EventHandler
}

const ButtonRow=({button,onClick}:ButtonRowProps) => {
    const className=Helper.concatsp('button','smallButton',button.name);
    return <ListItem className={'ButtonRow'} onClick={onClick}>
        <ListSlot>
            <button className={className}><span></span></button>
        </ListSlot>
        <ListMainSlot primary={button.getDisplay()}></ListMainSlot>
    </ListItem>
}

interface PageRowProps{
    page:Page;
    onClick:EventHandler;
    isCurrent:boolean;
    expanded: boolean;
}
const PageRow=({page,onClick,isCurrent,expanded}:PageRowProps)=>{
    const className=Helper.concatsp('Page',page.kind)
    return <React.Fragment>
        <ListItem
        className={className}
        selected={isCurrent}
        onClick={(ev)=>{
        setav(ev,{page:page.name});
        onClick(ev);
    }}>
        <ListMainSlot primary={page.getDisplay()}>
        </ListMainSlot>
        <ListSlot
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
                    return <ButtonRow
                            button={bt}
                            key={bt.name}
                            onClick={(ev) => {
                                ev.stopPropagation()
                                setav(ev, {page: page.name, button: bt.name})
                                onClick(ev)
                            }}></ButtonRow>
                    }
                )}
            </ListFrame>}

    </React.Fragment>
}

export interface MainNavProps extends Record<string, any> {}
export const MainNav = (props:MainNavProps) => {
    const dialogContext=useDialogContext();
    const [expanded,setExpanded]=useState(props.current);
    return <DialogFrame className={'MainNav'}>
        {mainTree.map((page)=>{
            return <PageRow key={page.name} page={page} onClick={(ev: SyntheticEvent)=> {
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
                alert(`page=${av.page},bt=${av.button}`)
                dialogContext.closeDialog();
            }}
                 isCurrent={page.name==props.current}
                 expanded={page.name === expanded}
            />;
        })}
    </DialogFrame>
}
 
