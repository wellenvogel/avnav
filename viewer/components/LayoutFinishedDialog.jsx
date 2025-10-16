import React, {useCallback} from 'react';
import PropTypes from 'prop-types';
import LayoutHandler, {layoutLoader} from '../util/layouthandler.js';
import {DialogButtons, DialogFrame, showDialog, useDialogContext} from './OverlayDialog.jsx';
import DB from './DialogButton.jsx';
import {EditDialog} from "./EditDialog";
import layouthandler from "../util/layouthandler.js";
import Toast from "./Toast";

const LayoutFinishedDialog=(props)=>{
    const dialogContext=useDialogContext();
    const buttonFunction=useCallback( (mode)=>{
        switch (mode) {
            case 1: {
                if (LayoutHandler.isEditing()) {
                    LayoutHandler.activateLayout();
                    const name = LayoutHandler.getLayout()
                    const layout = layouthandler.getLayout();
                    layoutLoader.uploadLayout(name, layout, true)
                        .then(() => {
                            if (props.finishCallback) props.finishCallback(true);
                        })
                        .catch((e) => Toast(e + ""))
                }
                }
                break;
            case 2:
                LayoutHandler.resetEditing();
                if (props.finishCallback) props.finishCallback(true);
                break;
            case 3:
                break;
            case 4:
                dialogContext.replaceDialog((dprops)=><EditDialog
                    {...dprops}
                    data={layouthandler.getCss()||""}
                    language="css"
                    saveFunction={(data)=>{
                        layouthandler.updateCss(data);
                    }}
                    resolveFunction={(data)=>{
                        layouthandler.updateCss(data);
                        return true;
                    }}
                    fileName={"layout-"+layouthandler.name+".css"}
                    showCollapse={true}
                    />);
                break;
        }
    },[]);
        return (
            <DialogFrame title={"Save Layout Changes?"}>
                <DialogButtons >
                    <DB name="edit" onClick={()=>buttonFunction(4)}>Edit CSS</DB>
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