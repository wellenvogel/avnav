import React, {SyntheticEvent} from 'react';
// @ts-ignore
import {useKeyEventHandlerPlain} from '../util/UiHelper';
import {DynamicProps, StoreKeys, UpdateFunction, useStore} from "../hoc/Dynamic";
import Helper, {setav} from "../util/helper";
import {useDialogContext} from "./DialogContext";
import {CopyAware} from "../util/CopyAware";
import {ListMainSlot} from "./exports";
import {useHistory} from "./HistoryProvider";
export type ButtonEvent=SyntheticEvent | Record<string, any>;
export type ButtonEventHandler=((ev:ButtonEvent)=>void)|((ev:ButtonEvent) => Promise<void>);

export interface ButtonProps {
        onClick?: ButtonEventHandler;
        className?: string;
        toggle?: boolean|(()=>boolean);
        name: string;
        icon?: string|URL;
        style?: Record<string, any>;
        disabled?:boolean|(()=>boolean);
        overflow?:boolean;
        editDisable?:boolean;
        editOnly?:boolean;
        visible?:boolean;
        children?:React.ReactNode;
        localOnly?:boolean;
        displayName?:string,
        storeKeys?: StoreKeys;
        updateFunction?: UpdateFunction;
}
export interface DynamicButtonProps extends ButtonProps,DynamicProps {}
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
    icon?: string|URL;
    style?: Record<string, any>;
    disabled?: boolean|(() => boolean);
    overflow?: boolean;
    editDisable?:boolean;
    editOnly?: boolean;
    visible?: boolean;
    children?: React.ReactNode;
    localOnly?: boolean;
    displayName?: string;
}

const toggleClass=(props:ButtonProps)=> {
    if (props.toggle !== undefined) {
        const togglev = (typeof (props.toggle) === 'function') ? props.toggle() : props.toggle;
        return togglev ? " active" : " inactive";
    }
}

const Button = (props:ButtonProps) => {
    const dialogContext=useDialogContext();
    const history = useHistory();
    const disabledv=(typeof (props.disabled) === 'function') ? props.disabled() : props.disabled;
    useKeyEventHandlerPlain(props.name, "button", () => {
        if (props.onClick && !disabledv) {
            const ev= setav({},{dialogContext:dialogContext,history:history});
            props.onClick(ev);
        }
    });
    const iprops=useStore(props);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {name,displayName,toggle, icon, style, disabled, overflow, editDisable, editOnly, visible, children,localOnly, ...forward} = iprops;
    if (visible !== undefined && ! visible) {
        return null;
    }
    const className=Helper.concatsp(props.className,
        'button',
        name,
        toggleClass(iprops),
        disabled ? 'disabled' : undefined,
    );
    const spanStyle:Record<string, any> = {};
    if (icon !== undefined) {
        spanStyle.backgroundImage = "url(" + icon + ")";
    }
    if (forward.onClick){
        const click=forward.onClick;
        forward.onClick=(ev:ButtonEvent)=>{
            if (disabledv) {
                ev.stopPropagation();
                return;
            }
            click(setav(ev,{dialogContext:dialogContext,history:history}));
        }
    }
    return (
        <div {...forward} className={className} title={displayName}>
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

export const updateFromOld=(
    buttons:ButtonDef[],
    updates:ButtonUpdate[],
):ButtonDef[] => {
    const converted:Record<string, ButtonUpdate> = {};
    for (const update of updates){
        if (! update.name) continue;
        converted[update.name]=update;
    }
    return updateButtons(buttons,converted);
}