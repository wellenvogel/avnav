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
 * a definition for editable parameters
 */

import React from "react";
import CloneDeep from 'clone-deep';

export class EditableParameter{
    constructor(name,type,list,displayName){
        this.name=name;
        this.type=type;
        this.default=undefined;
        this.list=list;
        this.displayName=displayName||name;
        this.readOnly=false;
        this.mandatory=false;
        this.description=undefined;
        this.arrayIndex=undefined; //if set - operate on an array
    }
    canEdit(){
        return ! this.readOnly;
    }
    getTypeForEdit(){
        return this.type;
    }
    getList(){
        if (typeof (this.list) === 'function') return this.list();
        return this.list||[];
    }
    setValue(param,value){
        if (! param) param={};
        if (this.arrayIndex === undefined) {
            param[this.name] = value;
            return param;
        }
        let current=param[this.name];
        if (! current) current=[];
        if (typeof(current) === 'string') current=current.split(",");
        current[this.arrayIndex]=value;
        param[this.name]=current;
        return param;
    }

    /**
     * unconditionally set the default value
     * @param param
     */
    setDefault(param){
        let current=this.getValue(param);
        if (this.default !== undefined){
            this.setValue(param,CloneDeep(this.default));
        }
    }
    getValue(param){
        let rt=param[this.name];
        if (this.arrayIndex === undefined)  return rt;
        if (rt === undefined) return rt;
        let current=rt;
        if (typeof(current) === 'string') current=current.split(',');
        return current[this.arrayIndex];
    }
    getValueForDisplay(param,opt_placeHolder){
        let rt=this.getValue(param);
        if (rt === undefined || rt === null) {
            rt = CloneDeep(this.default);
        }
        if (rt === undefined || rt === null){
            rt=opt_placeHolder;
        }
        if (rt === undefined || rt === null){
            if (this.type === EditableParameter.TYPE.BOOLEAN) return false
            return '';
        }
        if (this.type === EditableParameter.TYPE.BOOLEAN){
            if (typeof(rt)==='string'){
                return rt.toLowerCase() === 'true';
            }
        }
        return rt;
    }
    isValid(value){
        return true;
    }
    mandatoryOk(param){
        if (! this.mandatory) return true;
        let cv=this.getValue(param);
        if (cv !== undefined && cv !== null && cv !== '') return true;
        return false;
    }
    isChanged(value){
        return value !== this.default;
    }
    ensureValue(param){
        if (this.type === EditableParameter.TYPE.NUMBER){
            if (param[this.name] !== undefined ) {
                this.setValue(param,parseFloat(this.getValue(param)));
            }
        }
        if (this.type === EditableParameter.TYPE.BOOLEAN){
            if (param[this.name] !== undefined )
                this.setValue(param, !! this.getValue(param));
        }
    }
}


EditableParameter.TYPE={
    STRING:1,
    NUMBER:2,
    FLOAT: 3,
    SELECT:4,
    BOOLEAN:5,
    COLOR:6
};


export const createEditableParameter=(name, type, list, displayName)=>{
    if (typeof(type) === 'string'){
        type=EditableParameter.TYPE[type];
        if (type === undefined) return;
    }
    switch(type) {
        case EditableParameter.TYPE.STRING:
        case EditableParameter.TYPE.NUMBER:
        case EditableParameter.TYPE.SELECT:
        case EditableParameter.TYPE.BOOLEAN:
        case EditableParameter.TYPE.COLOR:
            return new EditableParameter(name, type, list, displayName);
    }
};

