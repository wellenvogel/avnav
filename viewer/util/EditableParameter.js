/*
# Copyright (c) 2022,2025 Andreas Vogel andreas@wellenvogel.net

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
*/

import CloneDeep from "clone-deep";
import Helper from "./helper";

const assignableProperties={
    name: undefined,
    default: undefined,
    list: undefined,
    displayName: undefined,
    /**
     * a list of conditions
     * each of them is an object with keys (being editable parameter names) and values to compare
     * the value can be a function that will be called with the currentValues object and the value of the key parameter
     * @type {(Object|Array)}
     */
    condition: undefined,
    description: undefined,
    mandatory: false,
    readOnly: false,
    checker: undefined
}

export const EditableParameterTypes={
    STRING:1,
    NUMBER:2,
    FLOAT: 3,
    SELECT:4,
    BOOLEAN:5,
    COLOR:6,
    ICON: 7,
    UNKNOWN: 10
};


export class EditableParameter extends Object{
    static TYPE=EditableParameterTypes.UNKNOWN
    constructor(plain,type) {
        super();
        this.type=type;
        this.assign(this,plain);
        if (this.name === undefined) throw new Error("invalid editable parameter: missing name");
        if (this.type === undefined) throw new Error("invalid editable parameter "+this.name+" has no type");
        if (this.checker !== undefined && (typeof this.checker !== 'function')) throw new Error("invalid type"+(typeof this.checker)+" for checker ("+this.name+") - must be function");
        if (this.displayName === undefined) this.displayName=this.name;
        Object.freeze(this);
    }
    assign(target,plain,onlyExisting){
        if (! target) target={};
        for (let k in assignableProperties){
            if (Object.hasOwn(plain,k)){
                target[k]=plain[k];
            }
            else{
                if (! onlyExisting) target[k]=assignableProperties[k];
            }
        }
        return target;
    }
    clone(updates){
        let param;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        if (! updates) param=this;
        else {
            param=this.assign(undefined,this);
            param.type=this.type;
            this.assign(param,updates,true);
        }
        let rt=new this.constructor(param,this.type);
        return rt;
    }
    reset(param){
        this.setValue(param, this.default);
    }
    canEdit(){
        return ! this.readOnly;
    }
    getTypeForEdit(){
        return this.type;
    }
    getList(){
        if (typeof (this.list) === 'function') return this.list();
        return this.list;
    }
    setValue(param,value,check){
        if (! param) param={};
        if (check && this.checker) {
            if (! this.checker(value,param)) throw new Error("invalid value for "+this.name+": "+value);
        }
        if (check) {
            if (this.mandatory && value === undefined) throw new Error("mandatory parameter " + this.name + " missing");
        }
        param[this.name] = value;
        return param;
    }

    getValue(param){
        if (! param) param={};
        let rt=param[this.name];
        if (rt === undefined && this.default !== undefined){
            return this.default;
        }
        return rt;
    }
    conditionMatch(param,compare){
        const value=this.getValue(param);
        if (typeof compare === 'function'){
            return compare(param,value);
        }
        else return compare == value;
    }

    checkConditions(param,allParameters){
        if (!this.condition) return true;
        const conditions=(this.condition instanceof Array)?this.condition:[this.condition];
        const knownEditables={};
        for (let i=0;i<conditions.length;i++){
            const condition=conditions[i];
            if (!(condition instanceof Object)) continue;
            let match=true;
            for (let k in condition){
                //try to find the editableParameter with the name
                //that matches the key
                let editableParameter=knownEditables[k];
                if (! editableParameter) {
                    Helper.iterate(allParameters, (parameter) => {
                        if (editableParameter) return;
                        if (!(parameter instanceof EditableParameter)) return;
                        if (parameter.name != k) return;
                        editableParameter = parameter;
                        knownEditables[k]=editableParameter;
                    })
                }
                const compare=condition[k];
                if (editableParameter){
                    if (! editableParameter.conditionMatch(param,compare)){
                        match=false;
                        break;
                    }
                }
                else {
                    const value = param[k];
                    if (typeof compare === 'function') {
                        if (!compare(param, value)) {
                            match = false;
                            break;
                        }
                    } else {
                        if (compare != value) {
                            match = false;
                            break;
                        }
                    }
                }
            }
            if (match) return true;
        }
        return false;
    }

    /**
     * @deprecated
     * @param param
     * @param opt_placeHolder
     * @returns {*|string|boolean}
     */
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

    /**
     * allow to use the parameter as index
     * @returns {*}
     */
    toString() {
        return this.name;
    }

    /**
     * check if a vlaue is ok
     * @param param
     */
    hasError(param){
        const cv=this.getValue(param);
        try{
            this.setValue({},cv,true);
            return false;
        }catch (e){}
        return true;
    }
}
export class EditableStringParameterBase extends EditableParameter{
    constructor(plain,type) {
        super(plain,type);
    }
    /**
     *
     * @param param
     * @param value
     * @param [check] {boolean} - check the value type
     * @returns {*}
     */
    setValue(param, value,check) {
        return super.setValue(param, (value!==undefined)?value+"":undefined,check);
    }

    getValue(param) {
        const rt=super.getValue(param);
        if (rt === undefined) return rt;
        return rt+"";
    }
}
export class EditableStringParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.STRING;
    constructor(plain) {
        super(plain,EditableParameterTypes.STRING);
    }
}
export class EditableBooleanParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.BOOLEAN;
    constructor(plain) {
        super(plain,EditableBooleanParameter.TYPE);
    }
    toBool(v){
        if (v === undefined) return false;
        if (v instanceof String){
            return v.toLowerCase() === 'true';
        }
        return !!v;
    }

    /**
     *
     * @param param
     * @param value
     * @param [check] {boolean} - check the value type
     * @returns {*}
     */
    setValue(param, value,check) {
        return super.setValue(param, this.toBool(value),check);
    }

    getValue(param) {
        const rt=super.getValue(param);
        return this.toBool(rt);
    }
}
export class EditableNumberParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.NUMBER;
    constructor(plain) {
        super(plain,EditableNumberParameter.TYPE);
    }
    setValue(param, value,check) {
        let parsed=(value!==undefined)?parseInt(value):value;
        if (check && this.list !== undefined){
            const list=this.getList();
            if (list.length >= 2){
                if (parsed < parseFloat(list[0]) || parsed > parseFloat(list[1])){
                    throw new Error("value "+parsed+" for "+this.name+" outside range "+list[0]+","+list[1]);
                }
            }
        }
        return super.setValue(param, parsed,check);
    }

    getValue(param) {
        const rt=super.getValue(param);
        if (rt === undefined) return rt;
        return parseInt(rt);
    }
}
export class EditableFloatParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.FLOAT;
    constructor(plain) {
        super(plain,EditableFloatParameter.TYPE);
    }
    setValue(param, value,check) {
        let parsed=(value!==undefined)?parseFloat(value):value;
        if (check && this.list !== undefined){
            const list=this.getList();
            if (list.length >= 2){
                if (parsed < parseFloat(list[0]) || parsed > parseFloat(list[1])){
                    throw new Error("value "+parsed+" for "+this.name+" outside range "+list[0]+","+list[1]);
                }
            }
        }
        return super.setValue(param, parsed,check);
    }

    getValue(param) {
        const rt=super.getValue(param);
        if (rt === undefined) return rt;
        return parseFloat(rt);
    }
}

export class EditableSelectParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.SELECT;
    static getValueFromListEntry(listEntry){
        if (typeof listEntry === 'string') return listEntry;
        if (! (listEntry instanceof Object)) return listEntry;
        return listEntry.value;
    }
    static getLabelFromListEntry(listEntry){
        if (typeof listEntry === 'string') return listEntry;
        if (! (listEntry instanceof Object)) return listEntry;
        if ('label' in listEntry) return listEntry.label+'';
        if ('l' in listEntry) return listEntry.l+'';
        if ('displayName' in listEntry) return listEntry.displayName+'';
        return listEntry.value+'';
    }
    constructor(plain) {
        super(plain,EditableSelectParameter.TYPE);
        const theList=super.getList();
        if (theList === undefined) throw new Error("missing list parameter for select "+this.name);
        if (! (theList instanceof Array) ) throw new Error("list parameter must be an array or a function for "+this.name);
        theList.forEach((item)=>{
            if (item === undefined) return;
            if (typeof item === 'string') return;
            if (typeof item !== 'object') throw new Error("invalid list item "+item+" for "+this.name+" must be string or object");
            if (! ('value' in item)) throw new Error("invalid list item "+JSON.stringify(item)+" for "+this.name+", missing value property");
        })
    }
    getList(){
        let list=super.getList();
        if (!(list instanceof Array)) {
            //just get a list with the default value
            list=[];
            if (this.default !== undefined) list.push(this.default);
            return list;
        }
        return list;
    }
    setValue(param, value,check) {
        if (check){
            const list=this.getList();
            let found=false;
            for (let i=0;i<list.length;i++){
                if (EditableSelectParameter.getValueFromListEntry(list[i]) === value){
                    found=true;
                    break;
                }
            }
            if (! found) throw new Error("value "+value+" for "+this.name+" not in list");
        }
        return super.setValue(param, value,check);
    }
    getValue(param) {
        const rt=super.getValue(param);
        return rt;
    }
}

export class EditableIconParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.ICON;
    constructor(plain) {
        super(plain,EditableIconParameter.TYPE);
    }
}
export class EditableColorParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.COLOR;
    constructor(plain) {
        super({checker:(cv)=>{
            return CSS.supports('color',cv);
            },...plain},EditableColorParameter.TYPE);
    }
}

class EditableParameterFactory{
    constructor(list) {
        this.list=list;
    }
    addParameterClass(clazz){
        if (!clazz) throw new Error("no class in addParameter class:"+clazz);
        if (! (clazz.prototype instanceof EditableParameter)) throw new Error(clazz + " is no EditableParameter");
        this.list.forEach((exiting)=>{
            if (exiting.TYPE === clazz.TYPE) throw new Error("type "+exiting.TYPE+" already found in addParameterClass for "+clazz);
        })
        this.list.push(clazz);
    }
    createParameterFromPlain(plain,base){
        if (! (plain instanceof Object)) throw new Error("invalid data type "+plain+ " in createParameterFromPlain");
        if (base) plain={...base,...plain}
        let type=plain.type;
        if (type && isNaN(type)){
            type=EditableParameterTypes[type];
        }
        if (!type) type=EditableParameterTypes.STRING;
        for (let i=0;i<this.list.length;i++){
            if (this.list[i].TYPE === type){
                return new this.list[i](plain);
            }
        }
        return new EditableStringParameter(plain);
    }
}
const editableParameters=[
    EditableStringParameter,
    EditableBooleanParameter,
    EditableNumberParameter,
    EditableFloatParameter,
    EditableSelectParameter,
    EditableIconParameter,
    EditableColorParameter
];

const editableParameterFactory=new EditableParameterFactory(editableParameters);
export default editableParameterFactory;


