import React, {useCallback} from 'react';
import PropTypes from 'prop-types';
import LayoutHandler, {layoutLoader} from '../util/layouthandler.ts';
import {DialogButtons, DialogFrame, DialogText, showDialog} from './OverlayDialog.tsx';
import DB from './DialogButton.tsx';
import {EditDialog} from "./EditDialog";
import Toast from "./Toast";
import Helper, {getav} from "../util/helper";
import {useDialogContext} from "./DialogContext";
import ButtonDefs from "./ButtonDefs";

const LayoutFinishedDialog=(props)=>{
    const dialogContext=useDialogContext();
    const buttonFunction=useCallback( (mode)=>{
        switch (mode) {
            case 1: {
                if (LayoutHandler.isEditing()) {
                    LayoutHandler.activateLayout();
                    let name = LayoutHandler.getName();
                    if (! Helper.startsWith(name,layoutLoader.getUserPrefix())){
                        throw new Error("invalid layout name for editing "+name);
                    }
                    name=name.substring(layoutLoader.getUserPrefix().length);
                    const layout = LayoutHandler.getLayout();
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
                    showColorDialog={true}
                    data={LayoutHandler.getCss()||""}
                    language="css"
                    saveFunction={(data)=>{
                        LayoutHandler.updateCss(data);
                        return true;
                    }}
                    resolveFunction={(data)=>{
                        LayoutHandler.updateCss(data);
                        return true;
                    }}
                    fileName={"layout-"+LayoutHandler.getName()+".css"}
                    showCollapse={true}
                    />);
                break;
        }
    },[]);
        return (
            <DialogFrame title={"Save Layout Changes?"}>
                <DialogText>{LayoutHandler.getName()}</DialogText>
                <DialogButtons >
                    <DB {...ButtonDefs.DBEditCss} onClick={()=>buttonFunction(4)}/>
                    <DB {...ButtonDefs.DBDiscard} onClick={()=>buttonFunction(2)}/>
                    <DB {...ButtonDefs.DBCancel} onClick={()=>buttonFunction(3)}/>
                    <DB {...ButtonDefs.DBOk} onClick={()=>buttonFunction(1)}/>
                </DialogButtons>
            </DialogFrame>
        );
}

LayoutFinishedDialog.propTypes={
    finishCallback: PropTypes.func
};

LayoutFinishedDialog.show=(event,callback)=>{
    const dialogContext=getav(event).dialogContext;
    showDialog(dialogContext,()=><LayoutFinishedDialog finishCallback={(res)=>{if (callback) callback(res)}}/>);
}

LayoutFinishedDialog.getButtonDef=(callback)=>{
    return {
        ...ButtonDefs.LayoutFinished,
        editOnly: true,
        onClick: (ev)=>{
            LayoutFinishedDialog.show(ev,callback);
        },
        toggle: true
    }
};

export default  LayoutFinishedDialog;