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
import {DBOk, DialogButtons, DialogFrame, showPromiseDialog, useDialogContext} from "./OverlayDialog";
import {IconDialog} from "./IconDialog";
import {Checkbox, ColorSelector, Input, InputReadOnly, InputSelect} from "./Inputs";
import editableParameterFactory, {
    EditableBooleanParameter,
    EditableColorParameter,
    EditableFloatParameter,
    EditableIconParameter,
    EditableNumberParameter,
    EditableSelectParameter,
    EditableStringParameter
} from "../util/EditableParameter";
import Helper from "../util/helper";
import Button from "./Button";

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
    COLOR:6
};



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
    }
    if (rt && opt_default !== undefined){
        rt.default=opt_default;
    }
    return rt;
};


//------------ new part --------------------------
const InfoDialog = ({description}) => {
    return (
        <DialogFrame className="HelpDialog">
            <div className="dialogRow infoText">
                {description}
            </div>
            <DialogButtons buttonList={DBOk()}>
            </DialogButtons>
        </DialogFrame>
    )
}
export const HelpButton = ({description}) => {
    const dialogContext = useDialogContext();
    return <Button
        name={'help'}
        className="Help smallButton"
        onClick={(ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            if (description) {
                dialogContext.showDialog(()=><InfoDialog description={description}/>);
            }
        }}
    />
}
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
const ItemButtons=({description,onReset})=>{
    if (! description && ! onReset) return null;
    return <div className={"paramButtons"}>
        {description && <HelpButton description={description}/> }
        {onReset && <Button
            name={'Delete'}
            className={'smallButton'}
            onClick={(ev) => {
                 ev.stopPropagation()
                onReset();
            }}
        />}
    </div>
}

export const EditableParameterListUI=({values,parameters,initialValues,onChange})=>{
    if (! parameters) return null;
    return <React.Fragment>
        {parameters.map((param)=>{
          if (! param) return null;
            if (! param.checkConditions(values,parameters)) return null;
          return <param.render
              key={param.name}
              currentValues={values}
              className={param.isChanged(values,initialValues)?'changed':undefined}
              onChange={(nv)=>onChange(nv)}
          ></param.render>
        })}
    </React.Fragment>
}

const getCommonParam=(ep,currentValues,className,onChange)=>{
    const v=ep.getValue(currentValues);
    const errorClass=checkerHelper(ep,v)?undefined:'error';
    let rt={
        dialogRow:true,
        className:Helper.concatsp(
            'editParam',
            ep.name,
            className,
            errorClass,
            ep.isDefault(currentValues)?'defaultValue':undefined,
            ep.mandatoryOk(currentValues)?undefined:'missing'),
        label:ep.displayName,
        key: ep.name,
        value:v,
        checkFunction:(nv)=>checkerHelper(ep,nv)
    }
    rt.children=<ItemButtons
        description={getDescription(ep)}
        onReset={(onChange && ('default' in ep))?()=>{
            onChange(ep.reset(undefined))
        }:undefined}
    />
    return rt
}

const cHelper=(thisref)=>{
    if (typeof thisref.render === 'function') {
        thisref.render=thisref.render.bind(thisref);
    }
    Object.freeze(thisref);
}

const getDescription=(ep)=>{
    const range=ep.getRange();
    let rtext;
    if (range.min !== undefined && range.max !== undefined){
        rtext=`range: ${range.min}...${range.max}`;
    }
    else if (range.min !== undefined){
        rtext=`range: ${range.min}...`
    }
    else if (range.max !== undefined){
        rtext=`range: ...${range.max}`
    }
    if (! rtext) return ep.description;
    if (! ep.description) return rtext;
    return ep.description+"\n"+rtext;
}

export class EditableBooleanParameterUI extends EditableBooleanParameter{
    constructor(props) {
        super(props,true);
        cHelper(this);
    }
    render({currentValues,className,onChange}) {
        return <Checkbox
            frame={true}
            {...getCommonParam(this,currentValues,className,this.canEdit()?onChange:undefined)}
            readOnly={!this.canEdit()}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv));
            }}
        />
    }
}

export class EditableStringParameterUI extends EditableStringParameter{
    constructor(props) {
        super(props,true);
        cHelper(this);
    }
    render({currentValues,className,onChange}){
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam(this,currentValues,className)}/>
        }
        return <Input
            {...getCommonParam(this,currentValues,className,onChange)}
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
        super(props,true);
        cHelper(this);
    }
    render({currentValues,className,onChange}){
        const canEdit=this.canEdit();
        let common=getCommonParam(this,currentValues,className,canEdit?onChange:undefined);
        if (isNaN(common.value)) common.value="";
        if (!canEdit){
            return <InputReadOnly
                {...common}
            />
        }

        return <Input
            {...getMinMax(this)}
            {...common}
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
        super(props,true);
        cHelper(this);
    }
    render({currentValues,className,onChange}){
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam(this,currentValues,className)}
            />
        }
        return <Input
            {...getCommonParam(this,currentValues,className,onChange)}
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
        super(props,true);
        cHelper(this);
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
            const na=(typeof a.label === 'string')?a.label.toLowerCase():a.label;
            const nb=(typeof b.label === 'string')?b.label.toLowerCase():b.label;
            if (na<nb) return -1;
            if (na>nb) return 1;
            return 0;
        })
        return <InputSelect
            {...getCommonParam(this,currentValues,className,onChange)}
            list={displayList}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv.value))
            }}
        />
    }
}

class EditableColorParameterUI extends EditableColorParameter{
    constructor(props) {
        super(props,true);
        cHelper(this);
    }

    render({currentValues, className, onChange}) {
        return <ColorSelector
            {...getCommonParam(this, currentValues, className,this.canEdit()?onChange:undefined)}
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
        super(props,true);
        cHelper(this);
    }
    render({currentValues,className,onChange}) {
        const dialogContext=useDialogContext();
        const url=this.getValue(currentValues);
        return <InputReadOnly
            {...getCommonParam(this,currentValues,Helper.concatsp(className,'iconInput'),this.canEdit()?onChange:undefined)}
            value={<RenderIcon url={url}/>}
            onClick={()=>{
                if (! this.canEdit()) return;
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
