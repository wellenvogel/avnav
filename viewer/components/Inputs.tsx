import React, {SyntheticEvent, useEffect, useState} from 'react';
// @ts-ignore
import ColorDialog from './ColorDialog';
import Toast from "./Toast";
import {SelectDialog} from "./BasicDialogs";
import Helper from "../util/helper";
import {useDialogContext} from "./DialogContext";
import {SelectListEntry} from "../util/EditableParameter";

/**
 * input elements
 * default properties:
 * value: the value to be displayed
 * label: label
 * onChange: callback when value has been changed
 * className
 */

interface DEFAULT_TYPES{
    value: any;
    label?: string;
    className?: string;
    onChange: (v:any) => void;
    dialogRow?: boolean;
    mandatory?: boolean|((v:any)=>boolean);
    children?: React.ReactNode;
}

export const valueMissing=(check:((value:any)=>boolean)|boolean,value:any)=>{
    if (!check) return false;
    if (typeof check === 'function'){
        return check(value);
    }
    return value === undefined || value === null;
}
export interface InputProps extends DEFAULT_TYPES{
        type?: string; //the type of the input element, default: text
        minSize?: number;
        maxSize?: number;
        min?: number;
        max?: number;
        step?: number|string;
        checkFunction?: (v:any)=>boolean|Promise<boolean>;
}
export const Input=(props:InputProps)=>{
    const [hasError,setError]=useState(false);
    let size=undefined;
    if (props.minSize){
        size=(props.value||"").length;
        if (size < props.minSize) size=props.minSize;
    }
    if (size !== undefined && props.maxSize){
        if (size > props.maxSize) size=props.maxSize;
    }
    useEffect(() => {
        if (props.checkFunction){
            const cr=props.checkFunction(props.value);
            if (cr instanceof Promise){
                cr.then(()=>setError(false),()=>setError(true));
            }
            else setError(!cr);
        }
    }, [props.value]);
    const className=Helper.concatsp(props.dialogRow?"dialogRow":undefined,
        props.className,
        hasError?"error":undefined,
        valueMissing(props.mandatory,props.value)?"missing":undefined);
    return <div className={className} >
        <span className="inputLabel">{props.label}</span>
        <input size={size} type={props.type||"text"} value={props.value} min={props.min} max={props.max} step={props.step} onChange={
            (ev)=>{ev.stopPropagation();props.onChange(ev.target.value);}
            }/>
        {props.children}
        </div>;
};

export interface CheckBoxProps extends DEFAULT_TYPES{
    onClick?: (ev:SyntheticEvent)=>void; //if set: do not call onChange but call onClick with the event
    readOnly?: boolean;
    frame?: boolean;
    hideLabel?: boolean;
}

export const Checkbox=(props:CheckBoxProps)=>{
    let className="checkBox";
    if (props.value) className+=" checked";
    let frameClass=props.dialogRow?"dialogRow":"";
    if (props.className) frameClass+=" "+props.className;
    const clickFunction=(ev:SyntheticEvent)=>{
        if (props.readOnly) {
            ev.stopPropagation();
            return;
        }
        if (props.onClick) return props.onClick(ev);
        if (props.onChange) {
            ev.stopPropagation();
            props.onChange(!props.value);
        }
    };
    return <div className={frameClass} onClick={clickFunction} >
        {(! props.hideLabel) && <span className="inputLabel">{props.label}</span>}
        <div className={props.frame?'inputFrame':''}>
            <span className= {className} ></span>
        </div>
        {props.children}

    </div>
};

export interface RadioProps extends DEFAULT_TYPES{
    itemList: SelectListEntry[] //a list of {label:xxx,value:yyy}
}

export const Radio=(props:RadioProps)=>{
    const className="radio";
    const frameClass=Helper.concatsp(props.dialogRow?"dialogRow":undefined,props.className);
    return <div className={frameClass} >
        {props.label&& <span className="inputLabel radioLabel">{props.label}</span>}
        <div className={"radioFrame"}>
        {props.itemList.map((el)=>{
            let displayClass=className;
            if (props.value == el.value) displayClass+=" checked";
            if (el.disabled) displayClass+=" disabled";
            return(
                <div className="radioInner" onClick={(ev)=>{
                        ev.stopPropagation();
                        if (el.disabled) return;
                        props.onChange(el.value);
                        }}
                     key={el.label}
                >
                <span className="inputLabel">{el.label}</span>
                <span className= {displayClass} ></span>
                </div>
                )
            })}
        {props.children}
        </div>
    </div>
};


export interface InputReadOnlyProps extends DEFAULT_TYPES{
    onClick?: (ev:SyntheticEvent)=>void;
    frameClick?: boolean;
}
export const InputReadOnly=(props:InputReadOnlyProps)=>{
    let className=props.dialogRow?"dialogRow":"";
    if (props.className) className+=" "+props.className;
    if (! props.onClick) className+=" disabled";
    if (valueMissing(props.mandatory,props.value)) className+=" missing";
    const frameClick=props.frameClick?props.onClick:undefined;
    return <div className={className}  onClick={frameClick}>
        <span className="inputLabel">{props.label}</span>
        <div className="input" onClick={frameClick?undefined:props.onClick}>{props.value}</div>
        {props.children}
        </div>
};

export type InputSelectList=SelectListEntry[]|((v:any)=>SelectListEntry[]|Promise<SelectListEntry[]>)
export interface InputSelectProps extends DEFAULT_TYPES{
    onChange: (nv:any)=>void; //if set  and if prop.list is set: show the select dialog
    onClick?: (ev:SyntheticEvent)=>void;
    list?: InputSelectList ;      //array of items to show or a function to create the list
    itemList?: InputSelectList;
    changeOnlyValue?: boolean; //only return the value property of the list element in onChange
    resetCallback?: ()=>void //if set - show a reset button an call this on reset
}
export const InputSelect=(props:InputSelectProps)=>{
    const dialogContext=useDialogContext();
    let onClick=props.onClick;
    // eslint-disable-next-line prefer-const
    let {value,...forwardProps}=props;
    if (value === null || value === undefined) value='';
    let label=value;
    if (value instanceof Object){
        label=value.label;
        value=value.value;
    }
    if (label === undefined) label=value;
    if (label === undefined) label='';
    const displayList = props.list||props.itemList;
    if (props.onChange && displayList){
        onClick=()=> {
            const valueChanged = (newValue:any)=>{
                props.onChange(props.changeOnlyValue?(newValue||{}).value:newValue);
            };
            const resetCallback= props.resetCallback?props.resetCallback:undefined;
            const showDialog=(finalList:SelectListEntry[])=>{
                dialogContext.showDialog(()=><SelectDialog
                    title={props.label}
                    list={finalList}
                    resolveFunction={valueChanged}
                    optResetCallback={resetCallback}/>);
            }
            let finalList;
            if (typeof(displayList) === 'function') finalList = displayList(props.value);
            else {
                finalList = displayList.slice();
                finalList.forEach((el)=> {
                    if (el.value == value) el.selected = true;
                });
            }
            if (finalList instanceof Promise){
                finalList
                    .then((fetchedList)=>showDialog(fetchedList))
                    .catch((e)=>Toast(e));

            }
            else{
                showDialog(finalList);
            }

        };
    }
    return <InputReadOnly
        {...forwardProps}
        onClick={onClick}
        value={label}
        frameClick={true}
        />
};

export interface ColorSelectorProps extends DEFAULT_TYPES{
        onClick?: (ev:SyntheticEvent)=>void; //if onChange is not set, call this function when clicked
        style?: Record<string, any>; //if set use this style for the color display
        readOnly?: boolean;
        default?:string;
        showUnset?:boolean;
}
export const ColorSelector=(props:ColorSelectorProps)=>{
    const dialogContext=useDialogContext();
    let onClick=props.onClick;
    if (props.onChange){
        //show the dialog and call onChange
        const colorChange=(newColor:string)=>{
            props.onChange(newColor)
        };
        onClick=(ev)=>{
            ev.stopPropagation();
            if (props.readOnly) return;
            dialogContext.showDialog(()=>{
                return <ColorDialog
                    value={props.value}
                    okCallback={colorChange}
                    showUnset={props.showUnset}
                    default={props.default}
                    />
            })
        }
    }
    const style=props.style||{backgroundColor:props.value};
    let className=props.dialogRow?"dialogRow":"";
    if (props.className) className+=" "+props.className;
    let ipClass="input";
    if (valueMissing(props.mandatory,props.value)) ipClass+=" missing";
    return <div className={className + " colorSelector"}
                onClick={onClick}>
        <span className="inputLabel">{props.label}</span>
        <div className={ipClass}>
            <div className="colorValue" style={style}></div>
            <div className={"value"}>{props.value}</div>
        </div>
        {props.children}
    </div>;
};
