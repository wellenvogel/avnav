/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * a dialog entry for editable parameters
 */
import React from 'react';
import PropTypes from 'prop-types';
import assign from 'object-assign';
import {Input,Checkbox,InputReadOnly,InputSelect,ColorSelector} from './Inputs.jsx';
import {EditableParameter} from "./EditableParameters";

export const getList=(list,current)=> {
    if (list instanceof Promise){
        return new Promise((resolve,reject)=>{
            list
                .then((data)=>resolve(getList(data,current)))
                .catch((e)=>reject(e))
        })
    }
    let self=this;
    let idx=0;
    let displayList=[];
    list.forEach((el)=>{
        let item=undefined;
        if (typeof(el) === 'object') {
            item=assign({},el);
        }
        else{
            item={name:el}
        }
        item.key=idx;
        if (! item.label) item.label=item.name;
        idx++;
        displayList.push(item);
    });
    displayList.sort((a,b)=>{
        if ( ! a || ! a.name) return -1;
        if (! b || ! b.name) return 1;
        let na=(typeof(a.name) === 'string') ? a.name.toUpperCase():a;
        let nb=(typeof(b.name) === 'string')? b.name.toUpperCase():b;
        if (na<nb) return -1;
        if (na > nb) return 1;
        return 0;
    });
    return displayList;
}

export const ParamValueInput=(props)=>{
    let param=props.param;
    if (typeof(param.render) === 'function'){
        return param.render(
            {
                ...props,
                onChange: (paramWithVal) => {
                    props.onChange(props.onlyOwnParam?{...paramWithVal}:{...props.currentValues,...paramWithVal});
                }
            });
    }
    let ValueInput=undefined;
    let current=param.getValueForDisplay(props.currentValues);
    let addClass=props.className?(" "+props.className):"";
    let inputFunction=(val)=>{
        props.onChange(param.setValue(assign({},props.onlyOwnParam?{}:props.currentValues),val));
    };
    let type=param.getTypeForEdit(props.currentValues);
    if (type instanceof  Array){
        return <React.Fragment>
            {
                type.map((nested)=>{
                    return ParamValueInput(assign({},props,{param:nested}));
                })
            }
        </React.Fragment>
    }
    if (!param.canEdit()){
        ValueInput=InputReadOnly;
        addClass=" disabled";
    }
    else {
        if (type === EditableParameter.TYPE.STRING ||
            type === EditableParameter.TYPE.NUMBER ||
            type === EditableParameter.TYPE.FLOAT ||
            type === EditableParameter.TYPE.ARRAY) {
            ValueInput = Input;
        }
        if (type === EditableParameter.TYPE.SELECT ) {
            ValueInput = InputSelect;
            inputFunction = (val) => {
                props.onChange(param.setValue(assign({},props.onlyOwnParam?{}:props.currentValues), val.name));
            };
        }
        if (type === EditableParameter.TYPE.BOOLEAN){
            ValueInput=Checkbox;
        }
        if (type === EditableParameter.TYPE.COLOR) {
            ValueInput = ColorSelector;
        }
    }
    if (!ValueInput) return;
    return <ValueInput
        dialogRow={true}
        className={"editParam "+param.name+addClass}
        key={param.name.replace(/  */,'')}
        label={param.displayName}
        onChange={inputFunction}
        showDialogFunction={props.showDialogFunction}
        showUnset={true}
        list={(current)=>getList(param.getList(),current)}
        value={current}
    >{props.children}</ValueInput>
}

ParamValueInput.PropTypes={
    param: PropTypes.object.isRequired,
    currentValues: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    showDialogFunction: PropTypes.func.isRequired,
    className: PropTypes.string,
    onlyOwnParam: PropTypes.bool
}