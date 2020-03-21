import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';
import DialogContainer from './OverlayDialogDisplay.jsx';
import WidgetFactory,{WidgetParameter} from '../components/WidgetFactory.jsx';
import assign from 'object-assign';
import {Input,Checkbox,InputReadOnly,InputSelect,ColorSelector} from './Inputs.jsx';
import ColorDialog from './ColorDialog.jsx';
import DB from './DialogButton.jsx';


class EditWidgetDialog extends React.Component{
    constructor(props){
        super(props);
        this.state= {
            panel: props.panel,
            widget:props.current,
            sizeCount:0,
            parameters:WidgetFactory.getEditableWidgetParameters(props.current)};
        this.insert=this.insert.bind(this);
        this.showDialog=this.showDialog.bind(this);
        this.getList=this.getList.bind(this);
        this.sizeCount=0;
    }
    insert(before){
        if (! this.props.insertCallback) return;
        this.props.closeCallback();
        this.props.insertCallback(this.state.widget,before,this.state.panel);
    }
    getList(list,current){
        let self=this;
        let idx=0;
        let displayList=[];
        list.forEach((el)=>{
            let item=undefined;
            if (typeof(el) === 'object') {
                item=assign({},el);
            }
            else{
                item={name:el}
            }
            item.key=idx;
            if (! item.label) item.label=item.name;
            idx++;
            displayList.push(item);
        });
        displayList.sort((a,b)=>{
            if ( ! a || ! a.name) return -1;
            if (! b || ! b.name) return 1;
            let na=a.name.toUpperCase();
            let nb=b.name.toUpperCase();
            if (na<nb) return -1;
            if (na > nb) return 1;
            return 0;
        });
        return displayList;
    }
    showDialog(Dialog){
        let self=this;
        this.setState({
            dialog: (props)=>{
                return(
                    <Dialog
                        {...props}
                        closeCallback={()=>self.setState({dialog:undefined})}
                    />
                )
            }
        });
    }
    updateWidgetState(values,opt_new){
        let nvalues=undefined;
        if (opt_new){
            nvalues=values;
            let newState={
                widget: nvalues,
                sizeCount: this.sizeCount + 1,
                parameters:WidgetFactory.getEditableWidgetParameters(nvalues)};
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

    getWidgetFromState(){
        let rt=assign({},this.state.widget);
        if (this.state.parameters){
            this.state.parameters.forEach((p)=>{
                p.ensureValue(rt);
            })
        }
    }


    render () {
        let self=this;
        let Dialog=this.state.dialog;
        let hasCurrent=this.props.current.name !== undefined;
        let parameters=this.state.parameters;
        if (this.sizeCount !== this.state.sizeCount && this.props.updateDimensions){
            this.sizeCount=this.state.sizeCount;
            window.setTimeout(self.props.updateDimensions,100);
        }
        let panelClass="panel";
        if (this.props.panel !== this.state.panel){
            panelClass+=" changed";
        }
        return (
            <React.Fragment>
            <div className="selectDialog editWidgetDialog">
                <h3 className="dialogTitle">{this.props.title||'Select Widget'}</h3>
                <InputSelect className={panelClass}
                             dialogRow={true}
                             label="Panel"
                             value={this.state.panel}
                             list={(current)=>this.getList(this.props.panelList,current)}
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
                    list={()=>this.getList(WidgetFactory.getAvailableWidgets())}
                    value={this.state.widget.name||'-Select Widget-'}
                    showDialogFunction={this.showDialog}/>
                {parameters.map((param)=>{
                    let ValueInput=undefined;
                    let current=param.getValue(this.state.widget);
                    let addClass="";
                    let inputFunction=(val)=>{
                        self.updateWidgetState(param.setValue({},val));
                    };
                    if (param.type == WidgetParameter.TYPE.DISPLAY){
                        ValueInput=InputReadOnly;
                        addClass=" disabled";
                    }
                    if (param.type == WidgetParameter.TYPE.STRING ||
                        param.type == WidgetParameter.TYPE.NUMBER||
                        param.type == WidgetParameter.TYPE.ARRAY){
                        ValueInput=Input;
                    }
                    if (param.type == WidgetParameter.TYPE.SELECT || param.type == WidgetParameter.TYPE.KEY){
                        ValueInput=InputSelect;
                        inputFunction=(val)=>{
                            self.updateWidgetState(param.setValue({},val.name));
                        };
                    }
                    if (param.type == WidgetParameter.TYPE.BOOLEAN){
                        ValueInput=Checkbox;
                    }
                    if (param.type == WidgetParameter.TYPE.COLOR){
                        ValueInput=ColorSelector;
                    }
                    if (!ValueInput) return;
                    return <ValueInput
                            dialogRow={true}
                            className={"editWidgetParam "+param.name+addClass}
                            key={param.name.replace(/  */,'')}
                            label={param.displayName}
                            onChange={inputFunction}
                            showDialogFunction={self.showDialog}
                            showUnset={true}
                            list={(current)=>this.getList(param.getList(),current)}
                            value={current}
                        />
                })}
                {(this.state.widget.name !== undefined)?
                    <div className="insertButtons">
                        {hasCurrent?<DB name="before" onClick={()=>this.insert(true)}>Before</DB>:null}
                        {hasCurrent?<DB name="after" onClick={()=>this.insert(false)}>After</DB>:null}
                        {(!hasCurrent)?<DB name="after" onClick={()=>this.insert(false)}>Insert</DB>:null}
                    </div>
                    :null}
                <div className="dialogButtons">
                    {this.props.updateCallback?
                        <DB name="ok" onClick={()=>{
                        this.props.closeCallback();
                        let changes=this.state.widget;
                        if (this.props.weight){
                            if (changes.weight !== undefined) changes.weight=parseFloat(changes.weight)
                        }
                        else{
                            changes.weight=undefined;
                        }
                        this.props.updateCallback(changes,this.state.panel);
                    }}>Update</DB>
                    :null}
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    {(this.props.removeCallback && (this.state.panel === this.props.panel)) ?
                    <DB name="delete" onClick={()=>{
                        this.props.closeCallback();
                        this.props.removeCallback();
                    }}>Delete</DB>:null}
                <div className="clear"></div>
                </div>
            </div>
            {Dialog?
                <DialogContainer
                    className="nested"
                    content={Dialog}
                    onClick={()=>{this.setState({dialog:undefined})}}
                />:
                null}
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
            weight={opt_weight||false}
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

export default EditWidgetDialog;