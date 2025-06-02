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

import React, {useState} from 'react';
import PropTypes from 'prop-types';
import LayoutHandler from '../util/layouthandler.js';
import {DialogButtons, DialogFrame, DialogRow, showDialog} from './OverlayDialog.jsx';
import WidgetFactory from '../components/WidgetFactory.jsx';
import {Input, InputSelect} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import cloneDeep from 'clone-deep';
import Compare from "../util/compare";
import {EditableParameterListUI} from "./EditableParameterUI";
import assign from "object-assign";


export const getList = (list, current) => {
    if (list instanceof Promise) {
        return new Promise((resolve, reject) => {
            list
                .then((data) => resolve(getList(data, current)))
                .catch((e) => reject(e))
        })
    }
    let idx = 0;
    let displayList = [];
    list.forEach((el) => {
        let item = undefined;
        if (typeof (el) === 'object') {
            item = assign({}, el);
        } else {
            item = {name: el}
        }
        item.key = idx;
        if (!item.label) item.label = item.name;
        idx++;
        displayList.push(item);
    });
    displayList.sort((a, b) => {
        if (!a || !a.name) return -1;
        if (!b || !b.name) return 1;
        let na = (typeof (a.name) === 'string') ? a.name.toUpperCase() : a;
        let nb = (typeof (b.name) === 'string') ? b.name.toUpperCase() : b;
        if (na < nb) return -1;
        if (na > nb) return 1;
        return 0;
    });
    return displayList;
}
const EditWidgetDialog = (props) => {
    const [panel, setPanel] = useState(props.panel);
    const [widget, setWidget] = useState(cloneDeep(props.current || {}));
    const [initialWidget,setInitialWidget]=useState(cloneDeep(props.current||{}));
    const [parameters, setParameters] = useState(()=>WidgetFactory.getEditableWidgetParameters(props.current.name));

    const insert = (before) => {
        if (!props.insertCallback) return;
        props.insertCallback(widget, before, panel);
    }
    const updateWidgetState = (values, opt_new) => {
        let nvalues = undefined;
        if (opt_new) {
            const nvalues = {...values};
            let parameters = WidgetFactory.getEditableWidgetParameters(values.name);
            parameters.forEach((p) => {
                const v=p.getValue();
                p.setValue(nvalues,v);
            });
            setParameters(parameters);
            setWidget({weight: widget.weight, ...nvalues})
            setInitialWidget({weight: widget.weight, ...nvalues})
        } else {
            nvalues = {...widget, ...values};
            if (widget.formatter !== nvalues.formatter) {
                nvalues.formatterParameters = [];
            }
            setWidget(nvalues);
        }
    }

    const changedParameters = () => {
        /**
         * we need to compare
         * the current values (state.widget) and the default values (from state.parameters)
         * the rule is to include in the output anything that differs from the defaults
         * and the name and weight in any case
         */
        if (!parameters) return widget;
        let nwidget = WidgetFactory.findWidget(widget);
        let rt = {};
        parameters.forEach((parameter) => {
            let fv = parameter.getValue(widget);
            if (fv !== undefined) {
                let dv = parameter.getValue(nwidget);
                if (Compare(fv, dv)) {
                    return; //we have set the value that is at the widget anyway - do not write this out
                }
                parameter.setValue(rt, fv);
            }
        })
        let fixed = ['name', 'weight'];
        fixed.forEach((fp) => {
            if (widget[fp] !== undefined) rt[fp] = widget[fp];
        });
        return rt;
    }
    let hasCurrent = props.current.name !== undefined;
    let panelClass = "panel";
    if (props.panel !== panel) {
        panelClass += " changed";
    }
    let completeWidgetData = {...WidgetFactory.findWidget(widget.name), ...widget};
    let validData=true;
    parameters.forEach((param)=>{
        if (param.hasError(completeWidgetData)){
            validData=false;
        }
    })
    return (
        <DialogFrame className="selectDialog editWidgetDialog" title={props.title || 'Select Widget'}>
            {(props.panelList !== undefined) && <InputSelect className={panelClass}
                                                             dialogRow={true}
                                                             label="Panel"
                                                             value={panel}
                                                             list={(current) => getList(props.panelList, current)}
                                                             onChange={(selected) => {
                                                                 setPanel(selected.name)
                                                             }}
            />
            }
            {hasCurrent ?
                <DialogRow className="info"><span className="inputLabel">Current</span>{props.current.name}</DialogRow>
                :
                null}
            {(props.weight !== undefined) ?
                <Input className="weigth"
                       dialogRow={true}
                       type="number"
                       label="Weight"
                       onChange={(ev) => updateWidgetState({weight: ev})}
                       value={widget.weight !== undefined ? widget.weight : 1}/>
                : null}
            <InputSelect className="selectElement info"
                         dialogRow={true}
                         label="New Widget"
                         onChange={(selected) => {
                             updateWidgetState({name: selected.name}, true);
                         }}
                         list={() => getList(WidgetFactory.getAvailableWidgets(props.types))}
                         value={widget.name || '-Select Widget-'}
            />
            <EditableParameterListUI
                parameters={parameters}
                values={completeWidgetData}
                initialValues={initialWidget}
                onChange={updateWidgetState}
            />
            {(widget.name !== undefined && props.insertCallback) ?
                <DialogButtons className="insertButtons">
                    {hasCurrent ? <DB name="before" disabled={!validData} onClick={() => insert(true)}>Before</DB> : null}
                    {hasCurrent ? <DB name="after" disabled={!validData} onClick={() => insert(false)}>After</DB> : null}
                    {(!hasCurrent) ? <DB name="after" disabled={!validData} onClick={() => insert(false)}>Insert</DB> : null}
                </DialogButtons>
                : null}
            <DialogButtons>
                {(props.removeCallback && (panel === props.panel)) ?
                    <DB name="delete" onClick={() => {
                        props.removeCallback();
                    }}>Delete</DB> : null}
                <DB name="cancel">Cancel</DB>
                {props.updateCallback ?
                    <DB name="ok" disabled={!validData} onClick={() => {
                        let changes = changedParameters();
                        if (props.weight) {
                            if (changes.weight !== undefined) changes.weight = parseFloat(changes.weight)
                        } else {
                            changes.weight = undefined;
                        }
                        props.updateCallback(changes, panel);
                    }}>Update</DB>
                    : null}
            </DialogButtons>
        </DialogFrame>
    );
}

EditWidgetDialog.propTypes = {
    title: PropTypes.string,
    panel: PropTypes.string,
    panelList: PropTypes.array,
    current: PropTypes.any,
    weight: PropTypes.bool,
    insertCallback: PropTypes.func,
    updateCallback: PropTypes.func,
    removeCallback: PropTypes.func,
    types: PropTypes.array
};

const filterObject=(data)=>{
    for (let k in data){
        if (data[k] === undefined) delete data[k];
    }
    return data;
};

export const EditWidgetDialogWithFunc=({widgetItem,pageWithOptions,panelname,opt_options})=>{
    const panelList=[panelname];
    if (! opt_options) opt_options={};
    let index=opt_options.beginning?-1:1;
    if (widgetItem){
        index=widgetItem.index;
    }
    return <EditWidgetDialog
        title="Select Widget"
        panel={panelname}
        types={opt_options.types}
        panelList={panelList}
        current={widgetItem?widgetItem:{}}
        weight={opt_options.weight}
        insertCallback={(selected,before,newPanel)=>{
            if (! selected || ! selected.name) return;
            let addMode=LayoutHandler.ADD_MODES.noAdd;
            if (widgetItem){
                addMode=before?LayoutHandler.ADD_MODES.beforeIndex:LayoutHandler.ADD_MODES.afterIndex;
            }
            else{
                addMode=opt_options.beginning?LayoutHandler.ADD_MODES.beginning:LayoutHandler.ADD_MODES.end;
            }
            LayoutHandler.withTransaction(pageWithOptions,(handler)=> {
                handler.replaceItem(pageWithOptions, newPanel, index, filterObject(selected), addMode);
            });
        }}
        removeCallback={widgetItem?()=>{
            LayoutHandler.withTransaction(pageWithOptions,(handler)=> {
                handler.replaceItem(pageWithOptions, panelname, index);
            });
        }:undefined}
        updateCallback={widgetItem?(changes,newPanel)=>{
            if (newPanel !== panelname){
                LayoutHandler.withTransaction(pageWithOptions,(handler)=>{
                    handler.replaceItem(pageWithOptions,panelname,index);
                    handler.replaceItem(pageWithOptions,newPanel,1,filterObject(changes),LayoutHandler.ADD_MODES.end);
                })
            }
            else{
                LayoutHandler.withTransaction(pageWithOptions,(handler)=>{
                    handler.replaceItem(pageWithOptions,panelname,index,filterObject(changes));
                })
            }
        }:undefined}
    />
}

/**
 *
 * @param widgetItem
 * @param pageWithOptions
 * @param panelname
 * @param opt_options
 *  beginning: insert at the beginning
 *  weight: show weight input
 *  fixPanel: if set: do not allow panel change
 *  types: a list of allowed widget types
 * @return {boolean}
 */
EditWidgetDialog.createDialog=(widgetItem,pageWithOptions,panelname,opt_options)=>{
    if (! LayoutHandler.isEditing()) return false;
    showDialog(undefined,()=>{
        return <EditWidgetDialogWithFunc
            pageWithOptions={pageWithOptions}
            panelname={panelname}
            widgetItem={widgetItem}
            opt_options={opt_options}
            />
    });
    return true;
};

export default  EditWidgetDialog;