import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';
import DialogContainer from './OverlayDialogDisplay.jsx';
import WidgetFactory from '../components/WidgetFactory.jsx';
import assign from 'object-assign';


class EditWidgetDialog extends React.Component{
    constructor(props){
        super(props);
        this.state= {weight:props.weight,selectedWidget:props.current};
        this.valueChanged=this.valueChanged.bind(this);
        this.selectWidget=this.selectWidget.bind(this);
        this.insert=this.insert.bind(this);
    }
    valueChanged(event,name) {
        let value=event.target.value;
        let nstate={};
        nstate[name]=value;
        this.setState(nstate);
    }
    insert(before){
        if (! this.props.insertCallback) return;
        this.props.closeCallback();
        this.props.insertCallback({
            name:this.state.selectedWidget,
            weight:this.state.weight
        },before);
    }
    selectWidget(){
        let self=this;
        let widgetList=WidgetFactory.getAvailableWidgets();
        let displayList=[];
        //copy the list as we maybe add more properties...
        let idx=0;
        widgetList.forEach((el)=>{
            let item=assign({},el);
            item.key=idx;
            item.label=el.name;
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
        this.setState({
            dialog: OverlayDialog.createSelectDialog("Select Widget", displayList,
                (selected)=> {
                    self.setState({selectedWidget: selected.name, dialog: undefined});
                },
                ()=> {
                    self.setState({dialog: undefined})
                })
        });
    }
    render () {
        let self=this;
        let Dialog=this.state.dialog;
        return (
            <React.Fragment>
            <div className="selectDialog editWidgetDialog">
                <h3 className="dialogTitle">{this.props.title||'Select Widget'}</h3>
                <div className="info"><span className="label">Panel:</span>{this.props.panel}</div>
                {(this.props.current !== undefined)?
                    <div className="info"><span className="label">Current:</span>{this.props.current}</div>
                    :
                    null}
                {(this.state.weight !== undefined)?
                    <div className="input">
                        <span className="label">Weight:</span>
                        <input type="number" name="weight" onChange={(ev)=>this.valueChanged(ev,"weight")} value={this.state.weight}/>
                    </div>
                    :null}
                <div className="selectElement info" onClick={this.selectWidget}>
                    <span className="label">New Widget:</span>
                    <span className="newWidget">{this.state.selectedWidget}</span>
                </div>
                {(this.state.selectedWidget !== undefined)?
                    <div className="insertButtons">
                        {(this.props.current !== undefined)?<button name="before" onClick={()=>this.insert(true)}>Before</button>:null}
                        {(this.props.current !== undefined)?<button name="after" onClick={()=>this.insert(false)}>After</button>:null}
                        {(this.props.current === undefined)?<button name="after" onClick={()=>this.insert(false)}>Insert</button>:null}
                    </div>
                    :null}
                <div className="dialogButtons">
                    <button name="cancel" onClick={this.props.closeCallback}>Cancel</button>
                    {this.props.updateCallback?
                        <button name="ok" onClick={()=>{
                        this.props.closeCallback();
                        let changes={name: this.state.selectedWidget};
                        if (this.state.weight !== undefined){
                            changes.weight=parseFloat(this.state.weight)
                        }
                        this.props.updateCallback(changes);
                    }}>Update</button>
                    :null}
                    {this.props.removeCallback?
                    <button name="remove" onClick={()=>{
                        this.props.closeCallback();
                        this.props.removeCallback();
                    }}>Remove</button>:null}
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
    current:PropTypes.string,
    weight: PropTypes.number,
    insertCallback: PropTypes.func,
    updateCallback: PropTypes.func,
    removeCallback: PropTypes.func,
    closeCallback: PropTypes.func.isRequired
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
    let add=true;
    let index=opt_beginning?-1:1;
    if (widgetItem){
        index=widgetItem.index;
        add=false;
    }
    let weight=undefined;
    if (opt_weight){
        weight=widgetItem?widgetItem.weight||1:1;
    }
    OverlayDialog.dialog((props)=> {
        return <EditWidgetDialog
            {...props}
            title="Select Widget"
            panel={panelname}
            current={widgetItem?widgetItem.name:undefined}
            weight={weight}
            insertCallback={(selected,before)=>{
                if (! selected || ! selected.name) return;
                let newItem={name:selected.name};
                if (opt_weight && newItem){
                    newItem.weight=selected.weight;
                }
                let addMode=LayoutHandler.ADD_MODES.noAdd;
                if (widgetItem){
                    addMode=before?LayoutHandler.ADD_MODES.beforeIndex:LayoutHandler.ADD_MODES.afterIndex;
                }
                else{
                    addMode=opt_beginning?LayoutHandler.ADD_MODES.beginning:LayoutHandler.ADD_MODES.end;
                }
                LayoutHandler.replaceItem(pagename,panelname,index,newItem,addMode);
            }}
            removeCallback={widgetItem?()=>{
                LayoutHandler.replaceItem(pagename,panelname,index);
            }:undefined}
            updateCallback={widgetItem?(changes)=>{
                //TODO: filter allowed properties
                let changedItem=assign({},LayoutHandler.getItem(pagename,panelname,index),changes);
                LayoutHandler.replaceItem(pagename,panelname,index,changedItem);
            }:undefined}
            />
    });
    return true;
};

export default EditWidgetDialog;