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
        return (
            <div>
                <h3 className="dialogTitle">{this.props.title||'Select Widget'}</h3>
                {this.props.subTitle?<p>{this.props.subTitle}</p>:null}
                <div>

                </div>
                <button name="ok" onClick={()=>{
                    this.props.okCallback(this.state.value);
                    this.props.closeCallback();
                    }}>{this.state.exists?"Overwrite":"Ok"}</button>
                <button name="cancel" onClick={this.props.closeCallback}>Cancel</button>
                <div className="clear"></div>
            </div>
        );
    }
}

EditWidgetDialog.propTypes={
    title: PropTypes.string,
    subTitle: PropTypes.string,
    okCallback: PropTypes.func.isRequired,
    closeCallback: PropTypes.func.isRequired
};

EditWidgetDialog.createDialog=(widgetItem,pagename,panelname)=>{
    if (! LayoutHandler.isEditing()) return false;
    let widgetList=WidgetFactory.getAvailableWidgets();
    let displayList=[];
    //copy the list as we maybe add more properties...
    widgetList.forEach((el)=>{
        let item=assign({},el);
        item.label=el.name;
        displayList.push(item);
    });

    let title=("Widget for panel "+panelname+", current="+widgetItem.name);
    OverlayDialog.selectDialogPromise(title,displayList).then((selected)=>{
        let newItem={name:selected.name};
        LayoutHandler.replaceItem(pagename,panelname,widgetItem.index,newItem);
    }).catch(()=>{});
    return true;
};

export default EditWidgetDialog;