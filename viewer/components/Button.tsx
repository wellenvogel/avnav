import React, {SyntheticEvent} from 'react';
// @ts-ignore
import {useKeyEventHandlerPlain} from '../util/GuiHelpers';
import {DynamicProps, useStore} from "../hoc/Dynamic";
import Helper, {setav} from "../util/helper";
import {useDialogContext} from "./DialogContext";
import {CopyAware} from "../util/CopyAware";
import {ListMainSlot} from "./exports";
import {useHistory} from "./HistoryProvider";
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
export interface DynamicButtonProps extends ButtonProps,DynamicProps {}

const toggleClass=(props:ButtonProps)=> {
    if (props.toggle !== undefined) {
        const togglev = (typeof (props.toggle) === 'function') ? props.toggle() : props.toggle;
        return togglev ? " active" : " inactive";
    }
}

const Button = (props:ButtonProps) => {
    const dialogContext=useDialogContext();
    const history = useHistory();
    useKeyEventHandlerPlain(props.name, "button", () => {
        if (props.onClick && !props.disabled) {
            const ev= setav({},{dialogContext:dialogContext,history:history});
            props.onClick(ev);
        }
    });
    const iprops=useStore(props);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {name,displayName,toggle, icon, style, disabled, overflow, editDisable, editOnly, visible, children, ...forward} = iprops;
    if (visible !== undefined && ! visible) {
        return null;
    }
    const className=Helper.concatsp(props.className,
        'button',
        name,
        toggleClass(iprops));
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
        forward.onClick=(ev:ButtonEvent)=>{
            click(setav(ev,{dialogContext:dialogContext,history:history}));
        }
    }
    return (
        <div {...forward} {...add} className={className}>
            <span style={spanStyle}/>
            {children}
        </div>
    );
}

export const ButtonRow=(button:DynamicButtonProps) => {
    const className=Helper.concatsp('buttonRow listEntry',button.className);
    return <Button {...button} className={className} displayName={undefined}>
        <ListMainSlot primary={button.displayName||button.name}></ListMainSlot>
    </Button>
}


export default Button;

export const propsToDefs=(props:DynamicButtonProps[]):ButtonDef[] => {
    const rt:ButtonDef[] = [];
    if (! props) return rt;
    for (const bt of props){
        rt.push(new ButtonDef(bt));
    }
    return rt;
}
export type ButtonUpdate=Partial<DynamicButtonProps> | ((old:Partial<DynamicButtonProps>)=>Partial<DynamicButtonProps>)
export const updateButtons=(buttonDefs:ButtonDef[],updates?:Record<string, ButtonUpdate>):ButtonDef[]=> {
   if (! updates) return buttonDefs;
   const rt:ButtonDef[] = [];
   for (const bt of buttonDefs){
       const update=updates[bt.name];
       if (update){
           if (typeof (update) === 'function') {
               rt.push(bt.copy(update(bt)))
           }
           else {
               rt.push(bt.copy(update));
           }
       }
       else{
           rt.push(bt);
       }
   }
   return rt;
}