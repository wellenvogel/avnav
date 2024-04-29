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
 * edit server handler parameters
 */

import React from 'react';
import PropTypes from 'prop-types';
import OverlayDialog, {dialogHelper} from './OverlayDialog.jsx';
import assign from 'object-assign';
import DB from './DialogButton.jsx';
import {ParamValueInput} from "./ParamValueInput";
import RequestHandler from "../util/requests";
import Toast from "./Toast";
import {createEditableParameter} from "./EditableParameters";
import Button from "./Button";
import {stateHelper} from "../util/GuiHelpers";

const HelpButton=(props)=>{
    let InfoDialog=(dprops)=>{
        return(
            <div className="flexInner HelpDialog">
                <div className="dialogRow infoText">
                    {props.param.description}
                </div>
                <div className="dialogButtons">
                    <DB name={'ok'} onClick={()=>dprops.closeCallback()}>Ok</DB>
                </div>
            </div>
        )
    }
    return <Button
        name={'help'}
        className="Help smallButton"
        onClick={(ev)=>{
            ev.stopPropagation();
            ev.preventDefault();
            if (props.param && props.param.description) {
                props.showDialog(InfoDialog);
            }
        }}
        />
}
class EditHandlerDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            loaded:false,
            parameters:undefined,
            handlerId:props.handlerId
        }
        this.currentValues=stateHelper(this,{},'current');
        this.modifiedValues=stateHelper(this,{},'modified');
        this.dialogHelper=dialogHelper(this);
    }
    componentDidMount() {
        let param={
            request: 'api',
            type: 'config',
            handlerId: this.state.handlerId,
            handlerName: this.props.handlerName
        }
        if (!this.props.addHandler){
            param.command='getEditables';
            if (this.props.child !== undefined){
                param.child=this.props.child;
            }
        }
        else{
            param.command='getAddAttributes';
        }
        RequestHandler.getJson('',undefined,param)
            .then((data)=>{
                let nextState={};
                if (this.props.handlerId === undefined && data.handlerId !== undefined){
                    nextState.handlerId=data.handlerId;
                }
                let parameters=[];
                data.data.forEach((param)=>{
                    let type = param.type;
                    if (type === 'FILTER') type = 'STRING';
                    if (type === 'FLOAT') type='NUMBER';
                    let description=createEditableParameter(param.name,type,
                        param.rangeOrList,
                        param.name
                        )
                    if (! description) return;
                    description.default=param.default;
                    description.mandatory=param.mandatory;
                    description.description=param.description;
                    description.condition=param.condition;
                    parameters.push(description);
                })
                nextState.loaded=true;
                nextState.parameters=parameters;
                nextState.name=data.configName||this.props.handlerName;
                nextState.canDelete=data.canDelete;
                this.setState(nextState);
                this.currentValues.setState(data.values||{});
                if (this.props.initialValues){
                    this.modifiedValues.setState(this.props.initialValues);
                }
            })
            .catch((e)=>{
                Toast(e);
                this.props.closeCallback();
            });
    }
    getRequestParam(add){
        let rt=assign({
            request: 'api',
            type:'config',
            handlerId: this.state.handlerId
        },add)
        if (this.props.child !== undefined){
            rt.child=this.props.child;
        }
        return rt;
    }
    updateValues(){
        let param=this.getRequestParam({command:'setConfig'});
        RequestHandler.postJson('',this.modifiedValues.getState(),undefined,param)
            .then((data)=>{
                this.props.closeCallback();
            })
            .catch(e=>Toast(e));
    }
    deleteHandler(){
        let text="really delete handler "+this.state.name||''+"?";
        if (this.props.child){
            text="really delete "+this.props.child+"?";
        }
        let confirm=OverlayDialog.createConfirmDialog(text,()=> {
            let param = this.getRequestParam({command: this.props.child !== undefined ? 'deleteChild' : 'deleteHandler'});
            RequestHandler.getJson('', undefined, param)
                .then(() => this.props.closeCallback())
                .catch(e => Toast(e))
        });
        this.dialogHelper.showDialog(confirm);
    }
    addHandler(){
        let param=this.getRequestParam({handlerName:this.props.handlerName,command:'createHandler'});
        RequestHandler.postJson('',this.modifiedValues.getState(),undefined,param)
            .then((data)=>{
                if (this.props.createdCallback){
                    this.props.createdCallback(data.id)
                }
                this.props.closeCallback()
            })
            .catch((e)=>Toast(e));
    }

    modifyValues(newValues){
        let newState=assign(this.modifiedValues.getState(true),newValues)
        let original=this.currentValues.getState()
        for (let k in original){
            if (newState[k] === original[k] || (newState[k]+'') === (original[k]+'')){
                delete newState[k];
            }
        }
        this.modifiedValues.setState(newState,true);
    }

    checkCondition(condition,values){
        if (! (condition instanceof Array)){
            condition=[condition]
        }
        for (let i in condition){
            let matches=true;
            for (let k in condition[i]){
                let compare=condition[i][k];
                let value=undefined;
                let hasFound=false;
                for (let pi in this.state.parameters) {
                    if (this.state.parameters[pi].name === k){
                        value=this.state.parameters[pi].getValueForDisplay(values);
                        hasFound=true;
                        break;
                    }
                }
                if (! hasFound){
                    //potentially we have some none editable parameter
                    //we need to compare to - in this case we still take it's current value
                    //this will potentially not include the default....
                    value=values[k]
                }
                if (typeof(compare) === 'string' && compare.match(/^!/)){
                    //special case: empty after ! also matches undefined
                    if (value === undefined && compare === '!'){
                        matches=false;
                        break;
                    }
                    //intentionally use ==
                    if (compare.substr(1) == value){
                        matches=false;
                        break;
                    }
                }
                else {
                    if (compare != value) {
                        matches = false;
                        break;
                    }
                }
            }
            if (matches) return true;
        }
        return false;
    }

    render () {
        let self=this;
        let currentValues=assign({},this.currentValues.getState(),this.modifiedValues.getState());
        let name=this.state.name||'';
        if (this.props.child){
            name+=":"+this.props.child;
        }
        return (
            <React.Fragment>
            <div className="selectDialog EditHandlerDialog">
                <h3 className="dialogTitle">{this.props.title||'Edit Handler'}</h3>
                <div className="dialogRow">{name}</div>
                {!this.state.loaded ?
                    <div className="loadingIndicator"></div>
                    :
                    <React.Fragment>
                        {this.state.parameters.map((param) => {
                            let notFilled=!param.mandatoryOk(currentValues);
                            let children=
                                <div className="paramButtons">
                                    {param.description && <HelpButton
                                        param={param}
                                        showDialog={this.dialogHelper.showDialog}
                                    />
                                    }
                                    {param.default !== undefined && <Button
                                        name={'Delete'}
                                        className={'smallButton'}
                                        onClick={(ev) => {
                                            ev.stopPropagation();
                                            let nv = {};
                                            nv[param.name] = param.default;
                                            this.modifyValues(nv);
                                        }}
                                    />
                                    }
                                </div>;
                            if (param.condition){
                                let show=this.checkCondition(param.condition,currentValues);
                                if (!show) return null;
                            }
                            return ParamValueInput({
                                param: param,
                                currentValues: currentValues,
                                showDialogFunction: this.dialogHelper.showDialog,
                                onChange: (nv) => this.modifyValues(nv),
                                className: notFilled?'missing':'',
                                children: children
                            })
                        })}

                    </React.Fragment>
                }
                <div className="dialogButtons">
                    {this.state.canDelete ?
                        <DB name="delete" onClick={()=>{
                            this.deleteHandler();
                        }}>Delete</DB>:null}
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    <DB name="ok" onClick={()=>{
                        if (! this.props.addHandler) this.updateValues();
                        else this.addHandler();
                    }}>Ok</DB>
                </div>
            </div>
            </React.Fragment>
        );
    }
}

EditHandlerDialog.propTypes={
    title: PropTypes.string,
    handlerId: PropTypes.oneOfType([PropTypes.string,PropTypes.number]),
    childId: PropTypes.string,
    handlerName: PropTypes.string,
    closeCallback: PropTypes.func.isRequired,
    initialValues: PropTypes.object,
    createdCallback: PropTypes.func,
    addHandler: PropTypes.bool
};

const filterObject=(data)=>{
    for (let k in data){
        if (data[k] === undefined) delete data[k];
    }
    return data;
};

/**
 *
 * @param handlerId: the handler to be edited
 * @param opt_child: the child identifier
 * @return {boolean}
 */
EditHandlerDialog.createDialog=(handlerId,opt_child,opt_doneCallback,opt_handlerName)=>{
    OverlayDialog.dialog((props)=> {
        return <EditHandlerDialog
            {...props}
            title="Edit Handler"
            handlerId={handlerId}
            handlerName={opt_handlerName}
            child={opt_child}
            />
    },undefined,opt_doneCallback);
    return true;
};

EditHandlerDialog.createNewHandlerDialog=(typeName,opt_initialParameters,opt_doneCallback)=>{
    OverlayDialog.dialog((props)=> {
        return <EditHandlerDialog
            {...props}
            title="Add Handler"
            handlerName={typeName}
            initialValues={opt_initialParameters}
            createdCallback={opt_doneCallback}
            addHandler={true}
        />
    },undefined);
}

EditHandlerDialog.createAddDialog=(opt_doneCallback)=>{
    RequestHandler.getJson('',undefined,{
        request:'api',
        type: 'config',
        command: 'getAddables'
    })
        .then((data)=>{
            if (! data.data || data.data.length < 1){
                Toast("no handlers can be added");
                return;
            }
            let list=[];
            data.data.forEach((h)=>list.push({label:h,value:h}));
            OverlayDialog.selectDialogPromise('Select Handler to Add',list)
                .then((selected)=>{
                    EditHandlerDialog.createNewHandlerDialog(selected.value,undefined,opt_doneCallback);
                })
                .catch((e)=>{})
        })
        .catch((err)=>Toast(err));
}


export default  EditHandlerDialog;