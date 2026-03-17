import React, {SyntheticEvent} from 'react';
// @ts-ignore
import {useKeyEventHandlerPlain} from '../util/GuiHelpers.js';
import {DynamicProps, useStore} from "../hoc/Dynamic";
import Helper, {setav} from "../util/helper";
import {useDialogContext} from "./DialogContext";
import {CopyAware} from "../util/CopyAware";
import {ListItem, ListMainSlot} from "./exports";
export interface ButtonProps {
        onClick?: (ev:SyntheticEvent|Record<string,any>)=>void,
        className?: string;
        toggle?: boolean|(()=>boolean);
        name: string;
        icon?: string;
        style?: Record<string, any>;
        disabled?:()=>boolean;
        overflow?:boolean;
        editDisable?:boolean;
        editOnly?:boolean;
        visible?:boolean;
        children?:React.ReactNode;
        localOnly?:boolean;
        displayName?:string
}

export type ButtonEvent=SyntheticEvent | Record<string, any>;
export type ButtonEventHandler=(ev:ButtonEvent)=>void;

export class ButtonDef extends CopyAware implements DynamicButtonProps{
    constructor(props:DynamicButtonProps) {
        super();
        for (const key in props) {
            // @ts-ignore
            this[key] = props[key];
        }
    }

    onClick?: ButtonEventHandler
    className?: string;
    toggle?: boolean | (() => boolean);
    name: string;
    icon?: string;
    style?: Record<string, any>;
    disabled?: () => boolean;
    overflow?: boolean;
    editDisable?:boolean;
    editOnly?: boolean;
    visible?: boolean;
    children?: React.ReactNode;
    localOnly?: boolean;
    displayName?: string;
}

const Button = (props:ButtonProps) => {
    const dialogContext=useDialogContext();
    useKeyEventHandlerPlain(props.name, "button", () => {
        if (props.onClick && !props.disabled) {
            const ev= setav({},{dialogContext:dialogContext});
            props.onClick(ev);
        }
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {toggle, icon, style, disabled, overflow, editDisable, editOnly, visible, children, ...forward} = props;
    let className = props.className || "";
    className += " button " + props.name;
    if (toggle !== undefined) {
        const togglev = (typeof (toggle) === 'function') ? toggle() : toggle;
        className += togglev ? " active" : " inactive";
    }
    const spanStyle:Record<string, any> = {};
    if (icon !== undefined) {
        spanStyle.backgroundImage = "url(" + icon + ")";
    }
    const add:Record<string, any> = {};
    if (disabled) {
        add.disabled = "disabled";
    }
    if (forward.onClick){
        const click=forward.onClick;
        forward.onClick=(ev)=>{
            click(setav(ev,{dialogContext:dialogContext}));
        }
    }
    return (
        <button {...forward} {...add} className={className}>
            <span style={spanStyle}/>
            {children}
        </button>
    );
}

export const ButtonRow=(button:ButtonProps) => {
    const className=Helper.concatsp('buttonRow','button','smallButton',button.name);
    return <ListItem className={className} onClick={button.onClick}>
            <span className={'buttonIcon'}></span>
        <ListMainSlot primary={button.displayName||button.name}></ListMainSlot>
    </ListItem>
}


export default Button;
export interface DynamicButtonProps extends ButtonProps,DynamicProps {}
export const DynamicButton=(props:DynamicButtonProps)=>{
    const iprops=useStore(props);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {visible,storeKeys,store,...forward}=iprops;
    if (! visible) return null;
    return <Button {...forward}>{props.children}</Button>;
}

export const propsToDefs=(props:DynamicButtonProps[]):ButtonDef[] => {
    const rt:ButtonDef[] = [];
    if (! props) return rt;
    for (const bt of props){
        rt.push(new ButtonDef(bt));
    }
    return rt;
}
export const updateButtons=(buttonDefs:ButtonDef[],updates?:Record<string, Partial<DynamicButtonProps>>):ButtonDef[]=> {
   if (! updates) return buttonDefs;
   const rt:ButtonDef[] = [];
   for (const bt of buttonDefs){
       const update=updates[bt.name];
       if (update){
           rt.push(bt.copy(update));
       }
       else{
           rt.push(bt);
       }
   }
   return rt;
}