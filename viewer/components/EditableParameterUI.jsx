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
import {DialogRow, showPromiseDialog, useDialogContext} from "./OverlayDialog";
import {IconDialog} from "./IconDialog";
import {Checkbox, ColorSelector, Input, InputReadOnly, InputSelect} from "./Inputs";
import editableParameterFactory, {
    EditableBooleanParameter,
    EditableColorParameter,
    EditableFloatParameter, EditableIconParameter,
    EditableNumberParameter, EditableSelectParameter,
    EditableStringParameter
} from "../util/EditableParameter";
import Helper from "../util/helper";

//------------------------- legacy part ------
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
    getTypeForEdit(params){
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
    COLOR:6,
    ICON: 7
};

export class IconParameter extends EditableParameter{
    constructor(name, type, list, displayName) {
        super(name, EditableParameter.TYPE.ICON, list, displayName);
    }
    renderValue=({url})=>{
        return <React.Fragment>
            {url && <span className="icon" style={{backgroundImage: "url('" + url + "')"}}/>}
            {url&&<span className={"url"}>{url.replace(/.*\//,'')}</span>}
        </React.Fragment>
    }
    render=(props)=>{
        if (! props.currentValues) return null;
        const dialogContext=useDialogContext();
        const RV=(vprops)=>this.renderValue(vprops);
        return <InputReadOnly
            className={'iconInput'}
            dialogRow={true}
            label={props.param.displayName}
            value={<RV url={this.getValueForDisplay(props.currentValues)}/>}
            onClick={()=>{
                showPromiseDialog(dialogContext,(dprops)=><IconDialog {...dprops} addEmpty={props.param.mandatory !== true} />)
                    .then((selected)=>{
                        let rt={};
                        rt[props.param.name]=selected.url;
                        props.onChange(rt);
                    })
                    .catch(()=>{})
            }}/>
    }
}


export const createEditableParameter=(name, type, list, displayName,opt_default)=>{
    if (typeof(type) === 'string'){
        type=EditableParameter.TYPE[type];
        if (type === undefined) return;
    }
    let rt;
    switch(type) {
        case EditableParameter.TYPE.STRING:
        case EditableParameter.TYPE.NUMBER:
        case EditableParameter.TYPE.SELECT:
        case EditableParameter.TYPE.BOOLEAN:
        case EditableParameter.TYPE.COLOR:
            rt=new EditableParameter(name, type, list, displayName);
            break;
        case EditableParameter.TYPE.ICON:
            rt=new IconParameter(name,type,list,displayName);
    }
    if (rt && opt_default !== undefined){
        rt.default=opt_default;
    }
    return rt;
};


//------------ new part --------------------------
/**
 *
 * @param param
 * @param newValue
 * @returns {boolean} ttrue if the value is ok
 */
const checkerHelper=(param,newValue)=>{
    try{
        param.setValue({},newValue,true);
        return true;
    }catch (e){}
    return false;
}

const getMinMax=(ep)=>{
    const list=ep.getList();
    if (list && list.length >= 2){
        return {
            min: parseFloat(list[0]),
            max: parseFloat(list[1])
        }
    }
    return {}
}
const getCommonParam=(ep,currentValues,className)=>{
    const v=ep.getValue(currentValues);
    const errorClass=checkerHelper(ep,v)?undefined:'error';
    return {
        dialogRow:true,
        className:Helper.concatsp('editParam',ep.name,className,errorClass),
        label:ep.displayName,
        key: ep.name,
        value:v,
        checkFunction:(nv)=>checkerHelper(ep,nv)
    }
}

export class EditableBooleanParameterUI extends EditableBooleanParameter{
    constructor(props) {
        super(props);
    }
    render({currentValues,className,onChange}) {
        return <Checkbox
            {...getCommonParam(this,currentValues,className)}
            readOnly={!this.canEdit()}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv));
            }}
        />
    }
}

export class EditableStringParameterUI extends EditableStringParameter{
    constructor(props) {
        super(props);
    }
    render({currentValues,className,onChange}){
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam(this,currentValues,className)}/>
        }
        return <Input
            {...getCommonParam(this,currentValues,className)}
            type={'text'}
            checkFunction={(nv)=>checkerHelper(this,nv)}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv))
            }}
        />
    }
}

export class EditableNumberParameterUI extends EditableNumberParameter{
    constructor(props) {
        super(props);
    }
    render({currentValues,className,onChange}){
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam(this,currentValues,className)}
            />
        }

        return <Input
            {...getMinMax(this)}
            {...getCommonParam(this,currentValues,className)}
            type={'number'}
            step={1}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv))
            }}
        />
    }
}

export class EditableFloatParameterUI extends EditableFloatParameter{
    constructor(props) {
        super(props);
    }
    render({currentValues,className,onChange}){
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam(this,currentValues,className)}
            />
        }
        return <Input
            {...getCommonParam(this,currentValues,className)}
            type={'number'}
            step={"any"}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv))
            }}
        />
    }
}
export class EditableSelectParameterUI extends EditableSelectParameter{
    constructor(props) {
        super(props);
    }
    render({currentValues,className,onChange}){
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam(this,currentValues,className)}
            />
        }
        let displayList=[];
        const current=this.getValue(currentValues);
        this.getList().forEach((item)=>{
            const label=EditableSelectParameter.getLabelFromListEntry(item);
            const value=EditableSelectParameter.getValueFromListEntry(item);
            displayList.push({label:label,value:value,selected:value === current});
        })
        displayList.sort((a,b)=>{
            const na=a.label.toLowerCase();
            const nb=b.label.toLowerCase();
            if (na<nb) return -1;
            if (na>nb) return 1;
            return 0;
        })
        return <InputSelect
            {...getCommonParam(this,currentValues,className)}
            list={displayList}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv.value))
            }}
        />
    }
}

class EditableColorParameterUI extends EditableColorParameter{
    constructor(props) {
        super(props);
    }

    render({currentValues, className, onChange}) {
        return <ColorSelector
            {...getCommonParam(this, currentValues, className)}
            readOnly={!this.canEdit()}
            onChange={(nv) => {
                onChange(this.setValue(undefined, nv))
            }}
        />
    }
}

const RenderIcon=({url})=>{
    return <React.Fragment>
        {url && <span className="icon" style={{backgroundImage: "url('" + url + "')"}}/>}
        {url&&<span className={"url"}>{url.replace(/.*\//,'')}</span>}
    </React.Fragment>
}
class EditableIconParameterUI extends EditableIconParameter{
    constructor(props) {
        super(props);
    }
    render({currentValues,className,onChange}) {
        const dialogContext=useDialogContext();
        const url=this.getValue(currentValues);
        return <InputReadOnly
            {...getCommonParam(this,currentValues,Helper.concatsp(className,'iconInput'))}
            value={<RenderIcon url={url}/>}
            onClick={()=>{
                showPromiseDialog(dialogContext,(dprops)=>
                    <IconDialog {...dprops}
                                addEmpty={this.mandatory !== true}
                                value={url}
                    />)
                    .then((selected)=>{
                        onChange(this.setValue(undefined,selected.url))
                    })
                    .catch(()=>{})
            }}/>
    }
}



const editableParameterUIList=[
    EditableBooleanParameterUI,
    EditableStringParameterUI,
    EditableNumberParameterUI,
    EditableFloatParameterUI,
    EditableSelectParameterUI,
    EditableColorParameterUI,
    EditableIconParameterUI
]

class EditableParameterUIFactory{
    constructor(eplist) {
        this.eplist=eplist;
    }
    createEditableParameterUI(plainOrEP){
        if (! plainOrEP) throw new Error("empty parameter for createEditableParameterUI");
        if (! plainOrEP.type){
            return new EditableStringParameterUI(plainOrEP);
        }
        if (isNaN(plainOrEP.type)){
            plainOrEP=editableParameterFactory.createParameterFromPlain(plainOrEP);
        }
        for (let i=0;i<this.eplist.length;i++){
            if (this.eplist[i].TYPE === plainOrEP.type){
                return new this.eplist[i](plainOrEP);
            }
        }
        return new EditableStringParameterUI(plainOrEP);
    }
}

export default new EditableParameterUIFactory(editableParameterUIList);