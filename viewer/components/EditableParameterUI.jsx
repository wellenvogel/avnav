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

import React, {useState} from "react";
import {DBOk, DialogButtons, DialogFrame, showPromiseDialog, useDialogContext} from "./OverlayDialog";
import {IconDialog} from "./IconDialog";
import {Checkbox, ColorSelector, Input, InputReadOnly, InputSelect} from "./Inputs";
import editableParameterFactory, {
    EditableBooleanParameter,
    EditableColorParameter,
    EditableFloatParameter,
    EditableIconParameter, EditableKeyParameter,
    EditableNumberParameter,
    EditableSelectParameter,
    EditableStringParameter
} from "../util/EditableParameter";
import Helper from "../util/helper";
import Button from "./Button";
import {KeyHelper} from "../util/keys";
import globalStore from "../util/globalstore";
import Toast from "./Toast";






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

export const EditableParameterListUI=({values,parameters,initialValues,onChange,itemClassName})=>{
    if (! parameters) return null;
    return <React.Fragment>
        {parameters.map((param)=>{
          if (! param) return null;
            if (! param.checkConditions(values,parameters)) return null;
          return <param.render
              key={param.name}
              currentValues={values}
              onChange={(nv)=>onChange(nv)}
              initialValues={initialValues}
              className={itemClassName}
          ></param.render>
        })}
    </React.Fragment>
}

export const getCommonParam=({ep,currentValues,initialValues,className,onChange})=>{
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
            ep.mandatoryOk(v)?undefined:'missing',
            ep.isChanged(currentValues,initialValues)?'changed':undefined),
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
    render({currentValues,initialValues,className,onChange}) {
        return <Checkbox
            frame={true}
            {...getCommonParam({ep:this,currentValues,className,initialValues,onChange:this.canEdit()?onChange:undefined})}
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

    render({currentValues,initialValues,className,onChange}){
        const common=getCommonParam({ep:this,currentValues,initialValues,className,onChange:this.canEdit()?onChange:undefined});
        if (common.value === undefined) common.value='';
        if (!this.canEdit()){
            return <InputReadOnly
                {...common}/>
        }
        return <Input
            {...common}
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
    render({currentValues,initialValues,className,onChange}){
        const canEdit=this.canEdit();
        let common=getCommonParam({ep:this,currentValues,initialValues,className,onChange:canEdit?onChange:undefined});
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
    render({currentValues,initialValues,className,onChange}){
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam({ep:this,currentValues,initialValues,className})}
            />
        }
        return <Input
            {...getCommonParam({ep:this,currentValues,initialValues,className,onChange})}
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
    render({currentValues,initialValues,className,onChange}){
        const [dynamicList,setDynamicList]=useState(undefined);
        if (!this.canEdit()){
            return <InputReadOnly
                {...getCommonParam({ep:this,currentValues,initialValues,className})}
            />
        }
        let displayList=[];
        const current=this.getValue(currentValues);
        let theList=dynamicList;
        if (theList === undefined){
            theList=this.getList();
            if (theList instanceof Promise){
                theList
                    .then((plist)=>setDynamicList(plist||[]))
                    .catch((e)=>{Toast(e);setDynamicList([])})
                theList=[];
            }
        }
        theList.forEach((item)=>{
            let label=EditableSelectParameter.getLabelFromListEntry(item);
            if (label === undefined) label="";
            else label=label+"";
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
            {...getCommonParam({ep:this,currentValues,initialValues,className,onChange})}
            list={displayList}
            onChange={(nv)=>{
                onChange(this.setValue(undefined,nv.value))
            }}
        />
    }
}

export class EditableKeyParameterUI extends EditableKeyParameter {
    constructor(props) {
        super(props, true);
        this.getDisplayList=this.getDisplayList.bind(this);
        cHelper(this);
    }

    /**
     * lazy evaluation of the list of available keys
     * this will allow to pick up the current status from the store even if the dialog
     * is already open for longer times
     * @param currentValues
     */
    getDisplayList(currentValues){
        let displayList = KeyHelper.getValueKeys().slice(0);
        const current = this.getValue(currentValues);
        let storeKeys = globalStore.getKeysByPrefix('nav.gps', true);
        storeKeys.forEach((sk) => {
            if (displayList.indexOf(sk) >= 0) return;
            displayList.push(sk);
        })
        const finalList=[];
        displayList.forEach((item) => {
            const label = item;
            const value = item;
            finalList.push({label: label, value: value, selected: value === current});
        })
        finalList.sort((a, b) => {
            const na = (typeof a.label === 'string') ? a.label.toLowerCase() : a.label;
            const nb = (typeof b.label === 'string') ? b.label.toLowerCase() : b.label;
            if (na < nb) return -1;
            if (na > nb) return 1;
            return 0;
        })
        return finalList;
    }
    render({currentValues, initialValues,className, onChange}) {
        if (!this.canEdit()) {
            return <InputReadOnly
                {...getCommonParam({ep:this, currentValues,initialValues, className})}
            />
        }

        const currentKeys = currentValues ? currentValues[EditableKeyParameter.KEY] : {};
        return <InputSelect
            {...getCommonParam({ep:this, currentValues,initialValues, className, onChange})}
            list={()=>this.getDisplayList(currentValues)}
            onChange={(nv) => {
                onChange(this.setValue({[EditableKeyParameter.KEY]: currentKeys}, nv.value))
            }}
        />
    }
}
class EditableColorParameterUI extends EditableColorParameter{
    constructor(props) {
        super(props,true);
        cHelper(this);
    }

    render({currentValues, initialValues,className, onChange}) {
        return <ColorSelector
            {...getCommonParam({ep:this, currentValues,initialValues, className,onChange:this.canEdit()?onChange:undefined})}
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
    render({currentValues,initialValues,className,onChange}) {
        const dialogContext=useDialogContext();
        const url=this.getValue(currentValues);
        return <InputReadOnly
            {...getCommonParam({ep:this,currentValues,initialValues,className:Helper.concatsp(className,'iconInput'),onChange:this.canEdit()?onChange:undefined})}
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
    EditableIconParameterUI,
    EditableKeyParameterUI
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
