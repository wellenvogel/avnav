import React from 'react';
import ColorDialog from './ColorDialog.jsx';
import OverlayDialog from './OverlayDialog.jsx';
import PropTypes from 'prop-types';
import assign from 'object-assign';

/**
 * input elements
 * default properties:
 * value: the value to be displayed
 * label: label
 * onChange: callback when value has been changed
 * className
 */

const DEFAULT_TYPES={
    value: PropTypes.any.isRequired,
    label: PropTypes.string,
    className: PropTypes.string,
    onChange: PropTypes.func,
    dialogRow: PropTypes.bool
};


export const Input=(props)=>{
    let className=props.dialogRow?"dialogRow":"";
    if (props.className) className+=" "+props.className;
    let size=undefined;
    if (props.minSize){
        size=(props.value||"").length;
        if (size < props.minSize) size=props.minSize;
    }
    if (size !== undefined && props.maxSize){
        if (size > props.maxSize) size=props.maxSize;
    }
    return <div className={className} key={props.key}>
        <span className="inputLabel">{props.label}</span>
        <input size={size} type={props.type||"text"} value={props.value} onChange={
            (ev)=>{ev.stopPropagation();props.onChange(ev.target.value);}
            }/>
        {props.children}
        </div>;
};

Input.propTypes=assign({},DEFAULT_TYPES,{
    type: PropTypes.string, //the type of the input element, default: text
    minSize: PropTypes.number,
    maxSize: PropTypes.number
});

export const Checkbox=(props)=>{
    let className="checkBox";
    if (props.value) className+=" checked";
    let frameClass=props.dialogRow?"dialogRow":"";
    if (props.className) frameClass+=" "+props.className;
    let clickFunction=(ev)=>{
        if (props.onClick) return props.onClick(ev);
        if (props.onChange) {
            ev.stopPropagation();
            props.onChange(!props.value);
        }
    };
    return <div className={frameClass} onClick={clickFunction} key={props.key}>
        <span className="inputLabel">{props.label}</span>
        <span className= {className} ></span>
        {props.children}
    </div>
};



Checkbox.propTypes=assign({},DEFAULT_TYPES,{
    onClick: PropTypes.func, //if set: do not call onChange but call onClick with the event
});

export const Radio=(props)=>{
    let className="radio";
    let frameClass=props.dialogRow?"dialogRow":"";
    if (props.className) frameClass+=" "+props.className;
    return <div className={frameClass} key={props.key}>
        {props.label&& <span className="inputLabel">{props.label}</span>}
        {props.itemList.map((el)=>{
            let displayClass=className;
            if (props.value == el.value) displayClass+=" checked";
            return(
                <div className="radioInner" onClick={(ev)=>{
                        ev.stopPropagation();
                        props.onChange(el.value);
                        }}>
                <span className="inputLabel">{el.label}</span>
                <span className= {displayClass} ></span>
                </div>
                )
            })}
        {props.children}
    </div>
};

Radio.propTypes=assign({},DEFAULT_TYPES,{
    itemList: PropTypes.array, //a list of {label:xxx,value:yyy}
});


export const InputReadOnly=(props)=>{
    let className=props.dialogRow?"dialogRow":"";
    if (props.className) className+=" "+props.className;
    if (! props.onClick) className+=" disabled";
    return <div className={className} key={props.key}>
        <span className="inputLabel">{props.label}</span>
        <div className="input" onClick={props.onClick}>{props.value}</div>
        {props.children}
        </div>
};

export const InputSelect=(props)=>{
    let onClick=props.onClick;
    let {value,...forwardProps}=props;
    let label=value;
    if (typeof value === 'object'){
        label=value.label;
        value=value.value;
    }
    let displayList = props.list||props.itemList;
    if (props.onChange && displayList){
        onClick=()=> {
            let valueChanged = (newValue)=>{
                props.onChange(props.changeOnlyValue?(newValue||{}).value:newValue);
            };
            let finalList;
            if (typeof(displayList) === 'function') finalList = displayList(props.value);
            else {
                finalList = displayList.slice();
                finalList.forEach((el)=> {
                    if (el.value == value) el.selected = true;
                });
            }
            let d =OverlayDialog.createSelectDialog(props.label, finalList, valueChanged);
            if (props.showDialogFunction) {
                props.showDialogFunction(d);
            }
            else{
                OverlayDialog.dialog(d);
            }
        };
    }
    return <InputReadOnly
        {...forwardProps}
        onClick={onClick}
        value={label}
        />
};

InputSelect.propTypes=assign({},DEFAULT_TYPES,{
    onChange: PropTypes.func, //if set  and if prop.list is set: show the select dialog
    list: PropTypes.any,      //array of items to show or a function to create the list
    showDialogFunction: PropTypes.func, //if set: use this function to display the select dialog
    changeOnlyValue: PropTypes.bool //only return the value property of the list element in onChange
});


export const ColorSelector=(props)=>{
    let onClick=props.onClick;
    if (props.onChange){
        //show the dialog and call onChange
        let colorChange=(newColor)=>{
            props.onChange(newColor)
        };
        onClick=(ev)=>{
            ev.stopPropagation();
            let d=(p)=>{
                return <ColorDialog
                    {...p}
                    value={props.value}
                    okCallback={colorChange}
                    showUnset={props.showUnset}
                    default={props.default}
                    />
            };
            if (props.showDialogFunction){
                props.showDialogFunction(d);
            }
            else{
                OverlayDialog.dialog(d);
            }
        }
    }
    let style=props.style||{backgroundColor:props.value};
    let className=props.dialogRow?"dialogRow":"";
    if (props.className) className+=" "+props.className;
    return <div className={className+ " colorSelector"}
              onClick={onClick}>
            <span className="inputLabel">{props.label}</span>
            <div className="colorValue" style={style}></div>
            <div className="input">{props.value}</div>
        {props.children}
  </div>;
};
ColorSelector.propTypes=assign({},DEFAULT_TYPES,{
    onClick: PropTypes.func, //if onChange is not set, call this function when clicked
    showDialogFunction: PropTypes.func,//if set - use this function to display the color dialog
    style: PropTypes.object //if set use this style for the color display
});