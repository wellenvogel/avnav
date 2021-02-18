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
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog, {dialogHelper, stateHelper} from './OverlayDialog.jsx';
import WidgetFactory from '../components/WidgetFactory.jsx';
import assign from 'object-assign';
import {Input,InputSelect} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import {getList,ParamValueInput} from "./ParamValueInput";
import RequestHandler from "../util/requests";
import Toast from "./Toast";
import {createEditableParameter} from "./EditableParameters";

class EditHandlerDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            loaded:false,
            parameters:undefined,
            sizeCount:0
        }
        this.currentValues=stateHelper(this,{},'current');
        this.modifiedValues=stateHelper(this,{},'modified');
        this.dialogHelper=dialogHelper(this);
        this.sizeCount=0;
        this.dialogHelper=dialogHelper(this);
    }
    componentDidMount() {
        let param={
            request: 'config',
            type: 'getEditables',
            handlerId: this.props.handlerId
        }
        if (this.props.child !== undefined){
            param.child=this.props.child;
        }
        RequestHandler.getJson('',undefined,param)
            .then((data)=>{
                let parameters=[];
                data.data.forEach((param)=>{
                    let type = param.type;
                    if (type === 'FILTER') type = 'STRING';
                    let description=createEditableParameter(param.name,type,
                        param.rangeOrList,
                        param.name
                        )
                    if (! description) return;
                    description.default=param.default;
                    parameters.push(description);
                })
                this.setState({
                    loaded: true,
                    parameters: parameters,
                    name: data.configName,
                    canDelete: data.canDelete,
                    sizeCount:1
                })
                this.currentValues.setState(data.values);
            })
            .catch((e)=>Toast(e));
    }
    getRequestParam(add){
        let rt=assign({
           request:'config',
           handlerId: this.props.handlerId
        },add)
        if (this.props.child !== undefined){
            rt.child=this.props.child;
        }
        return rt;
    }
    updateValues(){
        let param=this.getRequestParam({type:'setConfig'});
        RequestHandler.postJson('',this.modifiedValues.getState(),undefined,param)
            .then((data)=>{
                this.props.closeCallback();
            })
            .catch(e=>Toast(e));
    }
    deleteHandler(){
        let param=this.getRequestParam({type:this.props.child !== undefined?'deleteChild':'deleteHandler'});
        RequestHandler.getJson('',undefined,param)
            .then(()=>this.props.closeCallback())
            .catch(e=>Toast(e))
    }

    modifyValues(newValues){
        let newState=assign(this.modifiedValues.getState(true),newValues)
        let original=this.currentValues.getState()
        for (let k in original){
            if (newState[k] === original[k]){
                delete newState[k];
            }
        }
        this.modifiedValues.setState(newState,true);
    }

    render () {
        let self=this;
        if (this.sizeCount !== this.state.sizeCount && this.props.updateDimensions){
            this.sizeCount=this.state.sizeCount;
            window.setTimeout(self.props.updateDimensions,100);
        }
        let currentValues=assign({},this.currentValues.getState(),this.modifiedValues.getState());
        return (
            <React.Fragment>
            <div className="selectDialog EditHandlerDialog">
                <h3 className="dialogTitle">{this.props.title||'Edit Handler'}</h3>
                <div className="dialogRow">{this.state.name||''}</div>
                {!this.state.loaded ?
                    <div className="loadingIndicator"></div>
                    :
                    <React.Fragment>
                        {this.state.parameters.map((param) => {
                            return ParamValueInput({
                                param: param,
                                currentValues: currentValues,
                                showDialogFunction: this.dialogHelper.showDialog,
                                onChange: (nv) => this.modifyValues(nv)
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
                        this.updateValues();
                    }}>Ok</DB>
                </div>
            </div>
            </React.Fragment>
        );
    }
}

EditHandlerDialog.propTypes={
    title: PropTypes.string,
    handlerId: PropTypes.string.isRequired,
    childId: PropTypes.string,
    closeCallback: PropTypes.func.isRequired
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
EditHandlerDialog.createDialog=(handlerId,opt_child)=>{
    OverlayDialog.dialog((props)=> {
        return <EditHandlerDialog
            {...props}
            title="Edit Handler"
            handlerId={handlerId}
            child={opt_child}
            />
    });
    return true;
};

export default  EditHandlerDialog;