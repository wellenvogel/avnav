import React, {useCallback} from 'react';
import PropTypes from 'prop-types';
import LayoutHandler from '../util/layouthandler.js';
import {DialogButtons, DialogFrame, showDialog} from './OverlayDialog.jsx';
import DB from './DialogButton.jsx';

const LayoutFinishedDialog=(props)=>{
        
    const buttonFunction=useCallback( (mode)=>{
        switch (mode) {
            case 1:
                LayoutHandler.activateLayout(true);
                if (props.finishCallback) props.finishCallback(true);
                break;
            case 2:
                LayoutHandler.loadStoredLayout();
                if (props.finishCallback) props.finishCallback(true);
                break;
            case 3:
                break;
        }
    },[]);
        return (
            <DialogFrame title={"Save Layout Changes?"}>
                <DialogButtons >
                    <DB name="delete" onClick={()=>buttonFunction(2)}>Discard Changes</DB>
                    <DB name="cancel" onClick={()=>buttonFunction(3)}>Cancel</DB>
                    <DB name="ok" onClick={()=>buttonFunction(1)}>Ok</DB>
                </DialogButtons>
            </DialogFrame>
        );
}

LayoutFinishedDialog.propTypes={
    finishCallback: PropTypes.func
};


LayoutFinishedDialog.getButtonDef=(callback,opt_dialogContext)=>{
    return {
        name: 'LayoutFinished',
        editOnly: true,
        onClick: ()=>{
            showDialog(opt_dialogContext,()=><LayoutFinishedDialog finishCallback={(res)=>{if (callback) callback(res)}}/>);
        },
        toggle: true
    }
};

export default  LayoutFinishedDialog;