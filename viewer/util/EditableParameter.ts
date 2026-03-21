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

export type Properties =Record<string,any>;
export type Value =string|number|boolean|Record<string,string>;
export type Values =Record<string, Value>;
export type Condition=Value|((values:Values,value:Value)=>boolean);
export type Conditions =Record<string,Condition>;
export interface SelectListEntry extends Record<string, any>{
    value:Value,
    label?:string,
    l?:string,
    displayName?:string,
    selected?:boolean,
}
export type ListEntry=Value| SelectListEntry;
export const assignableProperties:Properties={
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

export enum EditableParameterTypes{
    STRING=1,
    NUMBER=2,
    FLOAT=3,
    SELECT=4,
    BOOLEAN=5,
    COLOR=6,
    ICON= 7,
    KEY= 8,
    UNKNOWN= 10,
    WIDGET_BASE=100,
    PROP_BASE= 200
}

export type CheckFunction=(value:any,values:Values)=>boolean;

export class EditableParameter extends Object{
    static TYPE=EditableParameterTypes.UNKNOWN
    protected type: EditableParameterTypes;
    protected name: string;
    protected checker?:CheckFunction;
    protected displayName?: string;
    protected default?: Value;
    protected readOnly?: boolean;
    protected list: ListEntry[]|(()=>ListEntry[]);
    protected condition?: Conditions|Conditions[];
    protected mandatory?: boolean;
    protected existingUnchecked?: boolean;

    /**
     * @param plain {Object} object with properties from assignableProperties
     * @param type the type from EditableParameterTypes
     * @param [opt_noFreeze] {boolean} if set - do not freeze the object
     */
    constructor(plain:Properties, type:EditableParameterTypes, opt_noFreeze:boolean=false) {
        super();
        this.type=type;
        this.assign(this,plain);
        if (this.name === undefined) throw new Error("invalid editable parameter: missing name");
        if (this.type === undefined) throw new Error("invalid editable parameter "+this.name+" has no type");
        if (this.checker !== undefined && (typeof this.checker !== 'function')) throw new Error("invalid type"+(typeof this.checker)+" for checker ("+this.name+") - must be function");
        if (this.displayName === undefined) this.displayName=this.name;
        if (! opt_noFreeze) Object.freeze(this);
    }
    assignImpl(properties:Properties, target:EditableParameter|Properties, plain:Properties, onlyExisting?:boolean){
        if (! target) target={};
        for (const k in properties){
            // @ts-ignore
            if (Object.hasOwn(plain,k)){
                // @ts-ignore
                target[k]=plain[k];
                // @ts-ignore
                if (target[k] === null) target[k]=undefined;
            }
            else{
                if (! onlyExisting) {
                    // @ts-ignore
                    target[k]=properties[k];
                }
            }
        }
        return target;
    }
    assign(target:EditableParameter|Properties, plain:Properties, onlyExisting?:boolean){
        return this.assignImpl(assignableProperties,target,plain,onlyExisting);
    }
    clone(updates:Properties){
        let param;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        if (! updates) param=this;
        else {
            param=this.assign(undefined,this);
            // @ts-ignore
            param.type=this.type;
            this.assign(param,updates,true);
        }
        // @ts-ignore
        const rt=new this.constructor(param,this.type);
        return rt;
    }
    reset(values:Values){
        return this.setValue(values, this.default);
    }
    canEdit(){
        return ! this.readOnly;
    }
    getTypeForEdit(){
        return this.type;
    }
    getList():ListEntry[]|Promise<ListEntry[]>{
        if (typeof (this.list) === 'function') return this.list();
        return this.list;
    }
    setValue(values:Values|undefined, value:any, check?:boolean){
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

    getValue(values:Values){
        if (! values) values={};
        const rt=values[this.name];
        if (rt === undefined && this.default !== undefined){
            return this.default;
        }
        return rt;
    }
    conditionMatch(values:Values, compare:Condition){
        const value=this.getValue(values);
        if (typeof compare === 'function'){
            return compare(values,value);
        }
        else return compare == value;
    }

    checkConditions(values:Values, allParameters:EditableParameter[]){
        if (!this.condition) return true;
        if (! values) values={};
        const conditions=(this.condition instanceof Array)?this.condition:[this.condition];
        const knownEditables:Record<string, EditableParameter>={};
        for (let i=0;i<conditions.length;i++){
            const condition=conditions[i];
            if (!(condition instanceof Object)) continue;
            let match=true;
            for (const k in condition){
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

    mandatoryOk(cv:Value){
        if (! this.mandatory) return true;
        if (cv !== undefined && cv !== null && cv !== '') return true;
        return false;
    }
    isDefault(values:Values){
        return this.getValue(values) === this.default;
    }
    isChanged(currentValues:Values, initialValues:Values){
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
    hasError(values:Values, opt_old?:Values){
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
    constructor(plain:Properties, type:EditableParameterTypes, opt_noFreeze?:boolean) {
        super(plain,type,opt_noFreeze);
    }
    /**
     *
     * @param values
     * @param value
     * @param [check] {boolean} - check the value type
     * @returns {*}
     */
    setValue(values:Values, value:Value, check?:boolean) {
        return super.setValue(values, (value!==undefined)?value+"":undefined,check);
    }

    getValue(values:Values) {
        const rt=super.getValue(values);
        if (rt === undefined) return rt;
        return rt+"";
    }
}
export class EditableStringParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.STRING;
    constructor(plain:Properties, opt_noFreeze?:boolean) {
        super(plain,EditableParameterTypes.STRING,opt_noFreeze);
    }
}
export class EditableBooleanParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.BOOLEAN;
    constructor(plain:Properties, opt_noFreeze?:boolean) {
        super(plain,EditableBooleanParameter.TYPE,opt_noFreeze);
    }
    toBool(v:Value):boolean{
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
    setValue(values:Values, value:Value, check?:boolean) {
        return super.setValue(values, this.toBool(value),check);
    }

    getValue(values:Values) {
        const rt=super.getValue(values);
        return this.toBool(rt);
    }
}
export interface Range {
    min:number;
    max:number;
}
export class EditableNumberParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.NUMBER;
    constructor(plain:Properties, opt_noFreeze?:boolean) {
        super(plain,EditableNumberParameter.TYPE,opt_noFreeze);
    }
    getRange() {
        const rt:Range={
            min: undefined,
            max: undefined
        };
        const list = this.getList();
        if (! list || ! (list instanceof Array)) return rt;
        if (list.length >= 1) {
            if (typeof list[0] !== 'object') {
                rt.min = parseFloat(list[0] as string);
            }
        }
        if (list.length >= 2) {
            if (typeof list[1] !== 'object') {
                rt.max = parseFloat(list[1] as string);
            }
        }
        return rt;
    }

    setValue(values:Values, value:Value, check?:boolean) {
        const parsed:number = (value !== undefined) ? parseInt(value as string) : undefined;
        if (check) {
            if (isNaN(parsed as number)) throw new Error("no value for " + this.name);
            const range = this.getRange();
            if ((range.min !== undefined && parsed < range.min) ||
                (range.max !== undefined && parsed > range.max)) {
                throw new Error("value " + parsed + " for " + this.name + " outside range " + range.min + "," + range.max);
            }
        }
        return super.setValue(values, parsed, check);
    }

    getValue(values:Values) {
        const rt=super.getValue(values);
        if (rt === undefined) return rt;
        return parseInt(rt as string);
    }
}
export class EditableFloatParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.FLOAT;
    constructor(plain:Properties, opt_noFreeze?:boolean) {
        super(plain,EditableFloatParameter.TYPE,opt_noFreeze);
    }
    getRange() {
        const rt:Range={max: undefined, min: undefined};
        const list = this.getList();
        if (! list || ! (list instanceof Array)) return rt;
        if (list.length >= 1) {
            if (typeof list[0] !== 'object') {
                rt.min = parseFloat(list[0] as string);
            }
        }
        if (list.length >= 2) {
            if (typeof list[1] !== 'object') {
                rt.max = parseFloat(list[1] as string);
            }
        }
        return rt;
    }
    setValue(values:Values, value:Value, check?:boolean) {
        const parsed=(value!==undefined)?parseFloat(value as string):undefined;
        if (check){
            if (isNaN(parsed)) throw new Error("invalid value (NaN): "+value+" for "+this.name);
            const range = this.getRange();
            if ((range.min !== undefined && parsed < range.min) ||
                (range.max !== undefined && parsed > range.max)) {
                throw new Error("value " + parsed + " for " + this.name + " outside range " + range.min + "," + range.max);
            }
        }
        return super.setValue(values, parsed,check);
    }

    getValue(values:Values) {
        const rt=super.getValue(values);
        if (rt === undefined) return rt;
        return parseFloat(rt as string);
    }
}

export class EditableSelectParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.SELECT;
    static getValueFromListEntry(listEntry:ListEntry){
        if (typeof listEntry === 'string') return listEntry;
        if (! (listEntry instanceof Object)) return listEntry;
        return listEntry.value;
    }
    static getLabelFromListEntry(listEntry:ListEntry){
        if (typeof listEntry === 'string') return listEntry;
        if (! (listEntry instanceof Object)) return listEntry;
        if ('label' in listEntry) return listEntry.label+'';
        if ('l' in listEntry) return listEntry.l+'';
        if ('displayName' in listEntry) return listEntry.displayName+'';
        return listEntry.value+'';
    }
    constructor(plain:Properties,opt_noFreeze?:boolean) {
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
        const list=super.getList();
        const fillDefault=(clist:ListEntry[])=>{
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
    setValue(values:Values, value:Value,check?:boolean) {
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
    getValue(values:Values) {
        const rt=super.getValue(values);
        return rt;
    }
}

export class EditableKeyParameter extends EditableParameter{
    static TYPE=EditableParameterTypes.KEY;
    static KEY='storeKeys';
    constructor(plain:Properties,opt_noFreeze?:boolean) {
        super(plain,EditableKeyParameter.TYPE,opt_noFreeze);
    }
    setValue(values:Values, value:Value,check?:boolean) {
        if (! values) values={};
        if (check){
            if (! this.mandatoryOk(value)) throw new Error("missing mandatory value for "+this.name);
        }
        if (this.readOnly) return values;
        const current:Record<string,string>=(values[EditableKeyParameter.KEY]||{}) as Record<string, string>;
        if (! value){
            delete current[this.name];
        }
        else {
            current[this.name] = value as string;
        }
        values[EditableKeyParameter.KEY]=current;
        return values;
    }
    getValue(values:Values) {
        if (! values) values={};
        const current=(values[EditableKeyParameter.KEY]||{}) as Record<string, string>;
        if (this.name in current) return current [this.name];
        return this.default;
    }
}

export class EditableIconParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.ICON;
    constructor(plain:Properties,opt_noFreeze?:boolean) {
        super(plain,EditableIconParameter.TYPE,opt_noFreeze);
    }
}
export class EditableColorParameter extends EditableStringParameterBase{
    static TYPE=EditableParameterTypes.COLOR;
    constructor(plain:Properties,opt_noFreeze?:boolean) {
        super({checker:(cv:string)=>{
            if (! cv) return true;
            return CSS.supports('color',cv);
            },...plain},EditableColorParameter.TYPE,opt_noFreeze);
    }
}
type EditableParameterAnyClass=
    typeof EditableStringParameter|
    typeof EditableColorParameter|
    typeof EditableNumberParameter|
    typeof EditableFloatParameter|
    typeof EditableSelectParameter|
    typeof EditableIconParameter|
    typeof EditableColorParameter|
    typeof EditableKeyParameter

class EditableParameterFactory{
    private list: EditableParameterAnyClass[];
    constructor(list:EditableParameterAnyClass[]) {
        this.list=list;
    }
    addParameterClass(clazz :EditableParameterAnyClass){
        if (!clazz) throw new Error("no class in addParameter class:"+clazz);
        if (! (clazz.prototype instanceof EditableParameter)) throw new Error(clazz + " is no EditableParameter");
        this.list.forEach((exiting:EditableParameterAnyClass)=>{
            if (exiting.TYPE === clazz.TYPE) throw new Error("type "+exiting.TYPE+" already found in addParameterClass for "+clazz);
        })
        this.list.push(clazz);
    }
    createParameterFromPlain(plain:Properties,base:Partial<Properties>){
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
const editableParameters: EditableParameterAnyClass[]=[
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


