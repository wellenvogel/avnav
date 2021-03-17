import React from 'react';
import PropTypes from 'prop-types';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';
import DB from './DialogButton.jsx';

class LayoutFinishedDialog extends React.Component{
    constructor(props){
        super(props);
        this.buttonFunction=this.buttonFunction.bind(this);
    }
    buttonFunction(mode){
        switch (mode) {
            case 1:
                LayoutHandler.activateLayout(true);
                if (this.props.finishCallback) this.props.finishCallback(true);
                break;
            case 2:
                LayoutHandler.loadStoredLayout();
                if (this.props.finishCallback) this.props.finishCallback(true);
                break;
            case 3:
                break;
        }
        if (this.props.closeCallback) this.props.closeCallback();
    }
    render () {
        return (
            <div>
                <h3 className="dialogTitle">Save Layout Changes?</h3>
                <div className="dialogButtons">
                    <DB name="delete" onClick={()=>this.buttonFunction(2)}>Discard Changes</DB>
                    <DB name="cancel" onClick={()=>this.buttonFunction(3)}>Cancel</DB>
                    <DB name="ok" onClick={()=>this.buttonFunction(1)}>Ok</DB>
                </div>
            </div>
        );
    }
}

LayoutFinishedDialog.propTypes={
    closeCallback: PropTypes.func.isRequired,
    finishCallback: PropTypes.func
};

LayoutFinishedDialog.createDialog=()=>{
    return new Promise((resolve,reject)=>{
        if (!LayoutHandler.isEditing()) reject("not editing");
        OverlayDialog.dialog((props)=> {
            return <LayoutFinishedDialog
                {...props}
                finishCallback={()=>{
                    resolve(true);
                }}
                />
        },undefined,()=>reject("cancelled"));
    });
};

LayoutFinishedDialog.getButtonDef=(callback)=>{
    return {
        name: 'LayoutFinished',
        editOnly: true,
        onClick: ()=>{
            LayoutFinishedDialog.createDialog().then((result)=>{
                if (callback){callback(result);}
            }).catch((error)=>{})
        },
        toggle: true
    }
};

export default  LayoutFinishedDialog;