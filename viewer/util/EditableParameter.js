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
    checker: undefined,
    existingUnchecked: false //allow to keep an existing value even if the check would fail (still marking it red in the UI)
}

export const EditableParameterTypes={
    STRING:1,
    NUMBER:2,
    FLOAT: 3,
    SELECT:4,
    BOOLEAN:5,
    COLOR:6,
    ICON: 7,
    KEY: 8,
    UNKNOWN: 10,
    WIDGET_BASE: 100,
    PROP_BASE: 200
};


export class EditableParameter extends Object{
    static TYPE=EditableParameterTypes.UNKNOWN

    /**
     * @param plain {Object} object with properties from assignableProperties
     * @param type the type from EditableParameterTypes
     * @param [opt_noFreeze] {boolean} if set - do not freeze the object
     */
    constructor(plain,type,opt_noFreeze) {
        super();
        this.type=type;
        this.assign(this,plain);
        if (this.name === undefined) throw new Error("invalid editable parameter: missing name");
        if (this.type === undefined) throw new Error("invalid editable parameter "+this.name+" has no type");
        if (this.checker !== undefined && (typeof this.checker !== 'function')) throw new Error("invalid type"+(typeof this.checker)+" for checker ("+this.name+") - must be function");
        if (this.displayName === undefined) this.displayName=this.name;
        if (! opt_noFreeze) Object.freeze(this);
    }
    assign(target,plain,onlyExisting){
        if (! target) target={};
        for (let k in assignableProperties){
            if (Object.hasOwn(plain,k)){
                target[k]=plain[k];
                if (target[k] === null) target[k]=undefined;
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
    reset(values){
        return this.setValue(values, this.default);
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
    setValue(values,value,check){
        if (! values) values={};
        if (check && this.checker) {
            if (! this.checker(value,values)) throw new Error("invalid value for "+this.name+": "+value);
        }
        if (check) {
            if (!this.mandatoryOk(value)) throw new Error("mandatory parameter " + this.name + " missing");
        }
        if (this.readOnly) return values;
        values[this.name] = value;
        return values;
    }

    getValue(values){
        if (! values) values={};
        let rt=values[this.name];
        if (rt === undefined && this.default !== undefined){
            return this.default;
        }
        return rt;
    }
    conditionMatch(values,compare){
        const value=this.getValue(values);
        if (typeof compare === 'function'){
            return compare(values,value);
        }
        else return compare == value;
    }

    checkConditions(values,allParameters){
        if (!this.condition) return true;
        if (! values) values={};
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
                    if (! editableParameter.conditionMatch(values,compare)){
                        match=false;
                        break;
                    }
                }
                else {
                    const value = values[k];
                    if (typeof compare === 'function') {
                        if (!compare(values, value)) {
                            match = false;
                            break;
                        }
                    } else {
                        if (typeof(compare) === 'string' && compare.match(/^!/)){
                            //special case: empty after ! also matches undefined
                            if (value === undefined && compare === '!'){
                                match=false;
                                break;
                            }
                            //intentionally use ==
                            if (compare.substring(1) == value){
                                match=false;
                                break;
                            }
                        }
                        else {
                            if (compare != value) {
                                match = false;
                                break;
                            }
                        }
                    }
                }
            }
            if (match) return true;
        }
        return false;
    }

    mandatoryOk(cv){
        if (! this.mandatory) return true;
        if (cv !== undefined && cv !== null && cv !== '') return true;
        return false;
    }
    isDefault(values){
        return this.getValue(values) === this.default;
    }
    isChanged(currentValues,initialValues){
        if (! initialValues || ! currentValues) return false;
        return this.getValue(currentValues) !== this.getValue(initialValues)
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
     * @param values
     * @param [opt_old]
     */
    hasError(values,opt_old){
        const cv=this.getValue(values);
        if (opt_old && this.existingUnchecked){
            const ov=this.getValue(opt_old)
            if (ov == cv) return false;
        }
        try{
            this.setValue({},cv,true);
            return false;
        }catch (e){}
        return true;
    }

    getRange(){
        return{}
    }
}
export class EditableStringParameterBase extends EditableParameter{
    constructor(plain,type,opt_noFreeze) {
        super(plain,type,opt_noFreeze);
    }
    /**
     *
     * @param values
     * @param value
     * @param [check] {boolean} - check the value type
     * @returns {*}
     */
    setValue(values, value,check) {
        return super.setValue(values, (value!==undefined)?value+"":undefined,check);
    }

    getValue(values) {
        const rt=super.getValue(values);
        if (rt === undefined) return rt;
        return rt+"";
    }
}
export class EditableStringParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.STRING;
    constructor(plain,opt_noFreeze) {
        super(plain,EditableParameterTypes.STRING,opt_noFreeze);
    }
}
export class EditableBooleanParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.BOOLEAN;
    constructor(plain,opt_noFreeze) {
        super(plain,EditableBooleanParameter.TYPE,opt_noFreeze);
    }
    toBool(v){
        if (v === undefined) return false;
        if (typeof(v) === 'string'){
            return v.toLowerCase() === 'true';
        }
        return !!v;
    }

    /**
     *
     * @param values
     * @param value
     * @param [check] {boolean} - check the value type
     * @returns {*}
     */
    setValue(values, value,check) {
        return super.setValue(values, this.toBool(value),check);
    }

    getValue(values) {
        const rt=super.getValue(values);
        return this.toBool(rt);
    }
}
export class EditableNumberParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.NUMBER;
    constructor(plain,opt_noFreeze) {
        super(plain,EditableNumberParameter.TYPE,opt_noFreeze);
    }
    getRange() {
        let rt={};
        const list = this.getList();
        if (! list || ! (list instanceof Array)) return rt;
        if (list.length >= 1) {
            rt.min = parseFloat(list[0]);
        }
        if (list.length >= 2) {
            rt.max = parseFloat(list[1]);
        }
        return rt;
    }

    setValue(values, value, check) {
        let parsed = (value !== undefined) ? parseInt(value) : value;
        if (check) {
            if (isNaN(parsed)) throw new Error("no value for " + this.name);
            const range = this.getRange();
            if ((range.min !== undefined && parsed < range.min) ||
                (range.max !== undefined && parsed > range.max)) {
                throw new Error("value " + parsed + " for " + this.name + " outside range " + list[0] + "," + list[1]);
            }
        }
        return super.setValue(values, parsed, check);
    }

    getValue(values) {
        const rt=super.getValue(values);
        if (rt === undefined) return rt;
        return parseInt(rt);
    }
}
export class EditableFloatParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.FLOAT;
    constructor(plain,opt_noFreeze) {
        super(plain,EditableFloatParameter.TYPE,opt_noFreeze);
    }
    getRange() {
        let rt={};
        const list = this.getList();
        if (! list || ! (list instanceof Array)) return rt;
        if (list.length >= 1) {
            rt.min = parseFloat(list[0]);
        }
        if (list.length >= 2) {
            rt.max = parseFloat(list[1]);
        }
        return rt;
    }
    setValue(values, value,check) {
        let parsed=(value!==undefined)?parseFloat(value):value;
        if (check){
            if (isNaN(parsed)) throw new Error("invalid value (NaN): "+value+" for "+this.name);
            const range = this.getRange();
            if ((range.min !== undefined && parsed < range.min) ||
                (range.max !== undefined && parsed > range.max)) {
                throw new Error("value " + parsed + " for " + this.name + " outside range " + list[0] + "," + list[1]);
            }
        }
        return super.setValue(values, parsed,check);
    }

    getValue(values) {
        const rt=super.getValue(values);
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
    constructor(plain,opt_noFreeze) {
        super(plain,EditableSelectParameter.TYPE,opt_noFreeze);
        const theList=super.getList();
        if (theList === undefined) throw new Error("missing list parameter for select "+this.name);
        if (theList instanceof Promise){
            //"silent" resolve - do nothing
            theList.then(()=>{},()=>{});
            return;
        }
        if (! (theList instanceof Array) ) throw new Error("list parameter must be an array or a function for "+this.name);
        theList.forEach((item)=>{
            if (item === undefined) return;
            if (typeof item === 'string' || typeof item === 'number') return;
            if (typeof item !== 'object') throw new Error("invalid list item "+item+" for "+this.name+" must be string or object");
            if (! ('value' in item)) throw new Error("invalid list item "+JSON.stringify(item)+" for "+this.name+", missing value property");
        })
    }
    getList(){
        let list=super.getList();
        const fillDefault=(clist)=>{
            if (!(clist instanceof Array)) {
                //just get a list with the default value
                clist=[];
                if (this.default !== undefined) clist.push(this.default);
                return clist;
            }
            return clist;
        }
        if (list instanceof Promise){
            return list.then((plist)=>{return fillDefault(plist)})
        }
        return fillDefault(list);
    }
    setValue(values, value,check) {
        if (check){
            const list=this.getList();
            if (!(list instanceof Promise)) {
                let found = false;
                for (let i = 0; i < list.length; i++) {
                    const lv = EditableSelectParameter.getValueFromListEntry(list[i]);
                    //intentionally allow to convert e.g. strings to numbers
                    if (lv == value) {
                        value = lv;
                        found = true;
                        break;
                    }
                }
                if (!found) throw new Error("value " + value + " for " + this.name + " not in list");
            }
            else{
                //silent resolve
                list.then(()=>{},()=>{});
            }
        }
        return super.setValue(values, value,check);
    }
    getValue(values) {
        const rt=super.getValue(values);
        return rt;
    }
}

export class EditableKeyParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.KEY;
    static KEY='storeKeys';
    constructor(plain,opt_noFreeze) {
        super(plain,EditableKeyParameter.TYPE,opt_noFreeze);
    }
    setValue(values, value,check) {
        if (! values) values={};
        if (check){
            if (! this.mandatoryOk(value)) throw new Error("missing mandatory value for "+this.name);
        }
        if (this.readOnly) return values;
        const current=values[EditableKeyParameter.KEY]||{};
        if (! value){
            delete current[this.name];
        }
        else {
            current[this.name] = value;
        }
        values[EditableKeyParameter.KEY]=current;
        return values;
    }
    getValue(values) {
        if (! values) values={};
        const current=values[EditableKeyParameter.KEY]||{};
        if (this.name in current) return current [this.name];
        return this.default;
    }
}

export class EditableIconParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.ICON;
    constructor(plain,opt_noFreeze) {
        super(plain,EditableIconParameter.TYPE,opt_noFreeze);
    }
}
export class EditableColorParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.COLOR;
    constructor(plain,opt_noFreeze) {
        super({checker:(cv)=>{
            if (! cv) return true;
            return CSS.supports('color',cv);
            },...plain},EditableColorParameter.TYPE,opt_noFreeze);
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
    EditableColorParameter,
    EditableKeyParameter
];

const editableParameterFactory=new EditableParameterFactory(editableParameters);
export default editableParameterFactory;


