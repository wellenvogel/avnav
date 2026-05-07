import React, {useCallback, useRef} from 'react';
import {useKeyEventHandlerPlain, useTimer} from '../util/UiHelper';
import {DynamicProps, dynamicWrapper, StoreKeys, UpdateFunction, useStore, useStoreState} from "../hoc/Dynamic";
import Helper, {setav} from "../util/helper";
import {IDialogContext, useDialogContext} from "./DialogContext";
import {CopyAware} from "../util/CopyAware";
import {useHistory} from "./HistoryProvider";
import base from "../base";
import {ButtonDescription} from "./ButtonList";
import {Icon} from "./Icons";
import {ListMainSlot} from "./ListItems";
import keys, {ButtonFontSizeFactor} from "../util/keys";


export type ButtonEventBase=Record<string, any>;
export interface ButtonEvent extends ButtonEventBase {
    avnav?:{
        dialogContext: IDialogContext;
    }
}
export type ButtonEventHandler=((ev:ButtonEvent)=>void)|((ev:ButtonEvent) => Promise<void>);
export enum ButtonAddonType{
    NONE='none',
    USER_HANDLER='handler',
    CONFIG='config',
    CONFIG_NEW_WINDOW='newWindow'
}
export interface ButtonProps {
        onClick?: ButtonEventHandler;
        className?: string;
        toggle?: boolean|(()=>boolean);
        name: string;
        icon?: string|URL;
        disabled?:boolean|(()=>boolean);
        overflow?:boolean;
        editDisable?:boolean;
        editOnly?:boolean;
        visible?:boolean;
        children?:React.ReactNode;
        localOnly?:boolean;
        storeKeys?: StoreKeys;
        updateFunction?: UpdateFunction;
        closeDialogs?: boolean;
        isAddon?: ButtonAddonType;
        iconClass?: string;
        dataChanged?:(data:ButtonDescription) => void;
        noHover?:boolean;
        setFontSize?:boolean;
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

    [x: string]: any;
    storeKeys?: StoreKeys;
    updateFunction?: UpdateFunction;
    dataChanged: (data: ButtonDescription) => void;
    store?: any;
    minTime?: number;

    onClick?: ButtonEventHandler
    className?: string;
    toggle?: boolean | (() => boolean);
    name: string;
    icon?: string|URL;
    iconClass?: string;
    disabled?: boolean|(() => boolean);
    overflow?: boolean;
    editDisable?:boolean;
    editOnly?: boolean;
    visible?: boolean;
    children?: React.ReactNode;
    localOnly?: boolean;
    closeDialogs?: boolean;
    isAddon?: ButtonAddonType=ButtonAddonType.NONE;
    noHover?: boolean;
    setFontSize?:boolean;
}

const toggleClass=(props:ButtonProps)=> {
    if (props.toggle !== undefined) {
        const togglev = (typeof (props.toggle) === 'function') ? props.toggle() : props.toggle;
        return togglev ? " active" : " inactive";
    }
}

let idx=0
const getIdx=()=>{
    idx++;
    return idx;
}

const isVisible=(props:{visible?:boolean})=>{
    return Helper.unsetorTrue(props.visible);
}

export const isButtonVisible=(props:ButtonProps) => {
    const computed=dynamicWrapper(props);
    return isVisible(computed);
}

const Button = (sprops:ButtonProps) => {
    const iprops:ButtonProps=useStore(sprops,{changeCallback:sprops.dataChanged});
    const [hoverTime]=useStoreState(keys.properties.buttonTitleTime);
    const [buttonSize]=useStoreState(keys.properties.style.buttonSize);
    const [hover,setHover]=React.useState(false);
    const hoverTimer=useTimer((seq:number)=>{
        hoverTimer.guardedCall(seq,()=>setHover(true));
        hoverStopTimer.restart();
    },1000);
    const hoverStopTimer=useTimer((seq:number)=>{
        hoverStopTimer.guardedCall(seq,()=>setHover(false));
    },hoverTime*1000);
    const idxRef=useRef(getIdx());
    const dialogContext=useDialogContext();
    const history = useHistory();
    const disabledv=((typeof (iprops.disabled) === 'function') ? iprops.disabled() : iprops.disabled);
    const syntheticClick=useCallback(()=>{
        if (sprops.onClick && !disabledv) {
            base.log("synthetic button click",idxRef.current);
            const ev= setav({},{
                dialogContext:dialogContext,
                history:history
            });
            if (!iprops.closeDialogs) sprops.onClick(ev);
            else dialogContext.closeDialog().then(()=>sprops.onClick(ev));
        }
    },[sprops.name,sprops.onClick,disabledv])
    useKeyEventHandlerPlain(sprops.name, "button", () => {
        syntheticClick();
    });
    if (! isVisible(iprops)) return null;
    const classNamev=Helper.concatsp(iprops.className,
        'button',
        sprops.name,
        toggleClass(iprops),
        iprops.disabled ? 'disabled' : undefined,
        hover ? 'longText hoverClass' : undefined,
    );
    let onClick;
    if (iprops.onClick){
        const click=iprops.onClick;
        onClick=async (ev:ButtonEvent)=>{
            ev.stopPropagation();
            ev.preventDefault();
            hoverTimer.stopTimer();
            setHover(false);
            if (disabledv) {
                return;
            }
            const avev=setav(ev,{
                dialogContext:dialogContext,
                history:history,
            });
            if (!iprops.closeDialogs){
                click(avev);
            }
            else {
                dialogContext.closeDialog().then(() =>
                    click(avev)
                );
            }
        }
    }
    const style:Record<string,any>={};
    if (iprops.setFontSize){
        style.fontSize=`${buttonSize/ButtonFontSizeFactor}px`;
    }
    return (
        <div onClick={onClick}
             style={style}
             className={classNamev}
             //title={displayName+""}
             onMouseEnter={()=>{
                 if (iprops.noHover || hoverTime == 0) return;
                 hoverTimer.restart()}}
             onMouseLeave={()=>{
                 hoverTimer.stopTimer();
                 setHover(false);
             }}
        >
            <Icon className={iprops.iconClass} /*icon={icon}*/ forceClass={true}/>
            {sprops.children}
        </div>
    );
}

export const ButtonRow=(button:DynamicButtonProps) => {
    const className=Helper.concatsp('buttonRow listEntry longText',button.className);
    return <Button {...button} noHover={true} className={className} >
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