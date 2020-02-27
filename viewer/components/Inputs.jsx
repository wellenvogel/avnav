import React from 'react';

export const Input=(props)=>{
    return <div className={props.className} key={props.key}>
        <span className="inputLabel">{props.label}</span>
        <input type={props.type||"text"} value={props.value} onChange={(ev)=>props.onChange(ev.target.value)}/>
        </div>;
};

export const Checkbox=(props)=>{
    let className="checkBox";
    if (props.value) className+=" checked";
    let clickFunction=(ev)=>{
        if (props.onClick) return props.onClick(ev);
        if (props.onChange) props.onChange(!props.value);
    };
    return <div className={props.className} onClick={clickFunction} key={props.key}>
        <span className="inputLabel">{props.label}</span>
        <span className= {className} ></span>
    </div>
};
export const InputReadOnly=(props)=>{
    return <div className={props.className} key={props.key}>
        <span className="inputLabel">{props.label}</span>
        <div className="input" onClick={props.onClick}>{props.value}</div>
        </div>
};

export const ColorSelector=(props)=>{
    let style=props.style||{backgroundColor:props.value};
    return <div className={props.className+ " colorSelector"}
              onClick={props.onClick}>
            <span className="label">{props.label}</span>
            <div className="colorValue" style={style}></div>
            <div className="input">{props.value}</div>
  </div>;
};