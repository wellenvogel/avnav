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
 * edit widget parameters
 */

import React from 'react';
import PropTypes from 'prop-types';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog,{dialogHelper} from './OverlayDialog.jsx';
import WidgetFactory from '../components/WidgetFactory.jsx';
import assign from 'object-assign';
import {Input,InputSelect} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import {getList,ParamValueInput} from "./ParamValueInput";
import cloneDeep from 'clone-deep';
import ShallowCompare from "../util/shallowcompare";


class EditWidgetDialog extends React.Component{
    constructor(props){
        super(props);
        this.state= {
            panel: props.panel,
            widget:cloneDeep(props.current),
            parameters:WidgetFactory.getEditableWidgetParameters(props.current.name)};
        this.insert=this.insert.bind(this);
        this.showDialog=this.showDialog.bind(this);
        this.updateWidgetState=this.updateWidgetState.bind(this);
        this.dialogHelper=dialogHelper(this);
    }
    insert(before){
        if (! this.props.insertCallback) return;
        this.props.closeCallback();
        this.props.insertCallback(this.state.widget,before,this.state.panel);
    }
    showDialog(Dialog){
        this.dialogHelper.showDialog(Dialog);
    }
    updateWidgetState(values,opt_new){
        let nvalues=undefined;
        if (opt_new){
            nvalues=values;
            let newState={
                widget: assign({weight:this.state.widget.weight},nvalues),
                parameters:WidgetFactory.getEditableWidgetParameters(nvalues.name)};
            newState.parameters.forEach((p)=>{
                p.setDefault(newState.widget);
            });
            this.setState(newState);
        }
        else {
            nvalues = assign({}, this.state.widget, values);
            this.setState({widget: nvalues})
        }
    }

    changedParameters(){
        /**
         * we need to compare
         * the current values (state.widget) and the default values (from state.parameters)
         * the rule is to include in the output anything that differs from the defaults
         * and the name and weight in any case
         */
        let defaultValues={};
        let editableNames={};
        if (! this.state.parameters) return this.state.widget;
        this.state.parameters.forEach((p)=>{
            p.setDefault(defaultValues);
            if (p.canEdit()) editableNames[p.name]=true;
        });
        let rt={};
        let fixed=['name','weight'];
        for (let k in this.state.widget){
            let v=this.state.widget[k];
            if (fixed.indexOf(k) >= 0){
                rt[k]=v;
            }
            else{
                if (! (k in editableNames)) continue;
                if ( ShallowCompare(defaultValues[k],v)) continue;
                rt[k]=v;
            }
        }
        return rt;
    }
    render () {
        let self=this;
        let hasCurrent=this.props.current.name !== undefined;
        let parameters=this.state.parameters;
        let panelClass="panel";
        if (this.props.panel !== this.state.panel){
            panelClass+=" changed";
        }
        let completeWidgetData=assign({},WidgetFactory.findWidget(this.state.widget.name),this.state.widget);
        return (
            <React.Fragment>
            <div className="selectDialog editWidgetDialog">
                <h3 className="dialogTitle">{this.props.title||'Select Widget'}</h3>
                <InputSelect className={panelClass}
                             dialogRow={true}
                             label="Panel"
                             value={this.state.panel}
                             list={(current)=>getList(this.props.panelList,current)}
                             onChange={(selected)=>{
                                this.setState({panel:selected.name})
                                }}
                             showDialogFunction={this.showDialog}/>
                {hasCurrent?
                    <div className="dialogRow info"><span className="inputLabel">Current</span>{this.props.current.name}</div>
                    :
                    null}
                {(this.props.weight !== undefined)?
                        <Input className="weigth"
                               dialogRow={true}
                               type="number"
                               label="Weight"
                               onChange={(ev)=>this.updateWidgetState({weight:ev})}
                               value={this.state.widget.weight!==undefined?this.state.widget.weight:1}/>
                    :null}
                <InputSelect className="selectElement info"
                    dialogRow={true}
                    label="New Widget"
                    onChange={(selected)=>{this.updateWidgetState({name:selected.name},true);}}
                    list={()=>getList(WidgetFactory.getAvailableWidgets())}
                    value={this.state.widget.name||'-Select Widget-'}
                    showDialogFunction={this.showDialog}/>
                {parameters.map((param)=>{
                    return ParamValueInput({
                        param:param,
                        currentValues:completeWidgetData,
                        showDialogFunction: self.dialogHelper.showDialog,
                        onChange:self.updateWidgetState
                    })
                })}
                {(this.state.widget.name !== undefined)?
                    <div className="insertButtons">
                        {hasCurrent?<DB name="before" onClick={()=>this.insert(true)}>Before</DB>:null}
                        {hasCurrent?<DB name="after" onClick={()=>this.insert(false)}>After</DB>:null}
                        {(!hasCurrent)?<DB name="after" onClick={()=>this.insert(false)}>Insert</DB>:null}
                    </div>
                    :null}
                <div className="dialogButtons">
                    {(this.props.removeCallback && (this.state.panel === this.props.panel)) ?
                        <DB name="delete" onClick={()=>{
                            this.props.closeCallback();
                            this.props.removeCallback();
                        }}>Delete</DB>:null}
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    {this.props.updateCallback?
                        <DB name="ok" onClick={()=>{
                        this.props.closeCallback();
                        let changes=this.changedParameters();
                        if (this.props.weight){
                            if (changes.weight !== undefined) changes.weight=parseFloat(changes.weight)
                        }
                        else{
                            changes.weight=undefined;
                        }
                        this.props.updateCallback(changes,this.state.panel);
                    }}>Update</DB>
                    :null}
                </div>
            </div>
            </React.Fragment>
        );
    }
}

EditWidgetDialog.propTypes={
    title: PropTypes.string,
    panel: PropTypes.string,
    panelList: PropTypes.array,
    current:PropTypes.any,
    weight: PropTypes.bool,
    insertCallback: PropTypes.func,
    updateCallback: PropTypes.func,
    removeCallback: PropTypes.func,
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
 * @param widgetItem
 * @param pagename
 * @param panelname
 * @param opt_beginning: insert at the beginning
 * @param opt_weight: show weight input
 * @return {boolean}
 */
EditWidgetDialog.createDialog=(widgetItem,pagename,panelname,opt_beginning,opt_weight)=>{
    if (! LayoutHandler.isEditing()) return false;
    let index=opt_beginning?-1:1;
    if (widgetItem){
        index=widgetItem.index;
    }
    OverlayDialog.dialog((props)=> {
        return <EditWidgetDialog
            {...props}
            title="Select Widget"
            panel={panelname}
            panelList={LayoutHandler.getPagePanels(pagename)}
            current={widgetItem?widgetItem:{}}
            weight={opt_weight}
            insertCallback={(selected,before,newPanel)=>{
                if (! selected || ! selected.name) return;
                let addMode=LayoutHandler.ADD_MODES.noAdd;
                if (widgetItem){
                    addMode=before?LayoutHandler.ADD_MODES.beforeIndex:LayoutHandler.ADD_MODES.afterIndex;
                }
                else{
                    addMode=opt_beginning?LayoutHandler.ADD_MODES.beginning:LayoutHandler.ADD_MODES.end;
                }
                LayoutHandler.replaceItem(pagename,newPanel,index,filterObject(selected),addMode);
            }}
            removeCallback={widgetItem?()=>{
                LayoutHandler.replaceItem(pagename,panelname,index);
            }:undefined}
            updateCallback={widgetItem?(changes,newPanel)=>{
                if (newPanel !== panelname){
                    LayoutHandler.replaceItem(pagename,panelname,index);
                    LayoutHandler.replaceItem(pagename,newPanel,1,filterObject(changes),LayoutHandler.ADD_MODES.end);
                }
                else{
                    LayoutHandler.replaceItem(pagename,panelname,index,filterObject(changes));
                }
            }:undefined}
            />
    });
    return true;
};

export default  EditWidgetDialog;