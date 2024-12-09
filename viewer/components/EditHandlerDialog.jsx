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

import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import OverlayDialog, {
    DBOk,
    DialogButtons,
    DialogFrame,
    dialogHelper,
    showPromiseDialog,
    useDialogContext
} from './OverlayDialog.jsx';
import assign from 'object-assign';
import DB from './DialogButton.jsx';
import {ParamValueInput} from "./ParamValueInput";
import RequestHandler from "../util/requests";
import Toast from "./Toast";
import {createEditableParameter} from "./EditableParameters";
import Button from "./Button";
import {stateHelper} from "../util/GuiHelpers";
import DialogButton from "./DialogButton.jsx";

const HelpButton=(props)=>{
    const dialogContext=useDialogContext();
    let InfoDialog=()=>{
        return(
            <DialogFrame className="HelpDialog">
                <div className="dialogRow infoText">
                    {props.param.description}
                </div>
                <DialogButtons buttonList={DBOk()}>
                </DialogButtons>
            </DialogFrame>
        )
    }
    return <Button
        name={'help'}
        className="Help smallButton"
        onClick={(ev)=>{
            ev.stopPropagation();
            ev.preventDefault();
            if (props.param && props.param.description) {
                dialogContext.showDialog(InfoDialog);
            }
        }}
        />
}
const EditHandlerDialog=(props)=>{
    const [loaded,setLoaded]=useState(false);
    const [parameters,setParameters]=useState(undefined);
    const [handlerId,setHandlerId]=useState(props.handlerId);
    const [currentValues,setCurrentValues]=useState({});
    const [modifiedValues,setModifiedValues]=useState({});
    const [name,setName]=useState();
    const [canDelete,setCanDelete]=useState(false);
    const dialogContext=useDialogContext();
    useEffect(() => {
        let param={
            request: 'api',
            type: 'config',
            handlerId: handlerId,
            handlerName: props.handlerName
        }
        if (!props.addHandler){
            param.command='getEditables';
            if (props.child !== undefined){
                param.child=props.child;
            }
        }
        else{
            param.command='getAddAttributes';
        }
        RequestHandler.getJson('',undefined,param)
            .then((data)=>{
                if (props.handlerId === undefined && data.handlerId !== undefined){
                    setHandlerId(data.handlerId);
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
                setLoaded(true);
                setParameters(parameters);
                setName(data.configName||props.handlerName)
                setCanDelete(data.canDelete);
                setCurrentValues(data.values||{});
                if (props.initialValues){
                    setModifiedValues(props.initialValues);
                }
            })
            .catch((e)=>{
                Toast(e);
                dialogContext.closeDialog();
            });
    }, []);

    const getRequestParam= (add)=>{
        let rt=assign({
            request: 'api',
            type:'config',
            handlerId: handlerId
        },add)
        if (props.child !== undefined){
            rt.child=props.child;
        }
        return rt;
    }

    const updateValues=()=>{
        let param=getRequestParam({command:'setConfig'});
        RequestHandler.postJson('',modifiedValues,undefined,param)
            .then((data)=>{
                dialogContext.closeDialog();
            })
            .catch(e=>Toast(e));
    }
    const deleteHandler=()=>{
        let text="really delete handler "+name||''+"?";
        if (props.child){
            text="really delete "+props.child+"?";
        }
        showPromiseDialog(dialogContext,OverlayDialog.createConfirmDialog(text))
            .then(()=> {
                let param = getRequestParam({command: props.child !== undefined ? 'deleteChild' : 'deleteHandler'});
                return RequestHandler.getJson('', undefined, param);
            },()=>{})
            .then(() => dialogContext.closeDialog())
            .catch(e => Toast(e));
    }
    const addHandler=()=>{
        let param=getRequestParam({handlerName:props.handlerName,command:'createHandler'});
        RequestHandler.postJson('',modifiedValues,undefined,param)
            .then((data)=>{
                if (props.createdCallback){
                    props.createdCallback(data.id)
                }
                dialogContext.closeDialog();
            })
            .catch((e)=>Toast(e));
    }

    const modifyValues=(newValues)=>{
        let newState={...modifiedValues,...newValues};
        let original=currentValues;
        for (let k in original){
            if (newState[k] === original[k] || (newState[k]+'') === (original[k]+'')){
                delete newState[k];
            }
        }
        setModifiedValues(newState);
    }

    const checkCondition=(condition,values)=>{
        if (! (condition instanceof Array)){
            condition=[condition]
        }
        for (let i in condition){
            let matches=true;
            for (let k in condition[i]){
                let compare=condition[i][k];
                let value=undefined;
                let hasFound=false;
                for (let pi in parameters) {
                    if (parameters[pi].name === k){
                        value=parameters[pi].getValueForDisplay(values);
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
                    if (compare.substring(1) == value){
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

        let renderValues={...currentValues,...modifiedValues};
        let renderName=name||'';
        if (props.child){
            renderName+=":"+props.child;
        }
        return (
            <DialogFrame className={"EditHandlerDialog"} title={props.title||'Edit Handler'}>
                <div className="dialogRow">{renderName}</div>
                {!loaded ?
                    <div className="loadingIndicator"></div>
                    :
                    <React.Fragment>
                        {parameters.map((param) => {
                            let notFilled=!param.mandatoryOk(renderValues);
                            let children=
                                <div className="paramButtons">
                                    {param.description && <HelpButton
                                        param={param}
                                    />
                                    }
                                    {param.default !== undefined && <Button
                                        name={'Delete'}
                                        className={'smallButton'}
                                        onClick={(ev) => {
                                            ev.stopPropagation();
                                            let nv = {};
                                            nv[param.name] = param.default;
                                            modifyValues(nv);
                                        }}
                                    />
                                    }
                                </div>;
                            if (param.condition){
                                let show=checkCondition(param.condition,renderValues);
                                if (!show) return null;
                            }
                            return ParamValueInput({
                                param: param,
                                currentValues: renderValues,
                                showDialogFunction: dialogContext.showDialog,
                                onChange: (nv) => modifyValues(nv),
                                className: notFilled?'missing':'',
                                children: children
                            })
                        })}

                    </React.Fragment>
                }
                <DialogButtons>
                        <DB
                            name="delete"
                            onClick={()=>{
                                deleteHandler();
                            }}
                            visible={canDelete}
                            close={false}
                        >
                            Delete
                        </DB>
                    <DB name="cancel" >Cancel</DB>
                    <DB name="ok" onClick={()=>{
                        if (! props.addHandler) updateValues();
                        else addHandler();
                    }}>Ok</DB>
                </DialogButtons>
            </DialogFrame>
        );
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