import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';
import WidgetFactory from '../components/WidgetFactory.jsx';
import assign from 'object-assign';

class EditWidgetDialog extends React.Component{
    constructor(props){
        super(props);
        this.state= {};
        this.valueChanged=this.valueChanged.bind(this);
    }
    valueChanged(event) {
        let value=event.target.value;
        let nstate={value:value};
        this.setState(nstate);
    }
    render () {
        let self=this;
        return (
            <div className="selectDialog editWidgetDialog">
                <h3 className="dialogTitle">{this.props.title||'Select Widget'}</h3>
                <div className="info"><span className="label">Panel:</span>{this.props.panel}</div>
                <div className="info"><span className="label">Current:</span>{this.props.current}</div>
                <div className="selectList">
                    {this.props.list.map(function(elem){
                        return(
                            <div className={"listEntry "+(elem.selected && 'selectedItem')} onClick={function(){
                              self.props.okCallback(elem);
                              self.props.closeCallback();
                            }}>{elem.name}</div>);
                    })}
                </div>
                <div className="dialogButtons">
                    <button name="cancel" onClick={this.props.closeCallback}>Cancel</button>
                    <button name="remove" onClick={()=>{
                        this.props.closeCallback();
                        this.props.okCallback();
                    }}>Remove</button>
                <div className="clear"></div>
                </div>
            </div>
        );
    }
}

EditWidgetDialog.propTypes={
    title: PropTypes.string,
    panel: PropTypes.string,
    current:PropTypes.string,
    okCallback: PropTypes.func.isRequired,
    closeCallback: PropTypes.func.isRequired
};

EditWidgetDialog.createDialog=(widgetItem,pagename,panelname,opt_beginning)=>{
    if (! LayoutHandler.isEditing()) return false;
    let widgetList=WidgetFactory.getAvailableWidgets();
    let displayList=[];
    //copy the list as we maybe add more properties...
    let idx=0;
    widgetList.forEach((el)=>{
        let item=assign({},el);
        item.key=idx;
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
    let add=true;
    let index=opt_beginning?-1:1;
    if (widgetItem){
        index=widgetItem.index;
        add=false;
    }
    OverlayDialog.dialog((props)=> {
        return <EditWidgetDialog
            {...props}
            title="Select Widget"
            panel={panelname}
            current={widgetItem?widgetItem.name:""}
            list={displayList}
            okCallback={(selected)=>{
                let newItem=selected?{name:selected.name}:undefined;
                LayoutHandler.replaceItem(pagename,panelname,index,newItem,add);
            }}
            />
    });
    return true;
};

export default EditWidgetDialog;