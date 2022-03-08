import React from 'react';
import OverlayDialog from '../components/OverlayDialog.jsx';
import globalStore from '../util/globalstore.jsx';
import keys, {KeyHelper} from '../util/keys.jsx';
import {Checkbox, Input, InputSelect} from "./Inputs";
import DialogButton from "./DialogButton";
import cloneDeep from 'clone-deep';
import assign from "object-assign";


class RemoteChannelDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            channel: props.channel,
            read: props.read,
            write: props.write
        }
    }
    render(){
    return <div className="RemoteChannelDialog flexInner" >
        <h3 className="dialogTitle">RemoteChannel</h3>
        <InputSelect dialogRow={true}
               value={this.state.channel}
               onChange={(v)=>this.setState({channel:v})}
               label="Channel"
               changeOnlyValue={true}
               list={KeyHelper.getKeyDescriptions(true)[keys.properties.remoteChannelName].values.map((x)=>{return {label:x,value:x}})}
               />
        <Checkbox dialogRow={true}
               value={this.state.read}
               onChange={(v)=>this.setState({read:!!v})}
               label="Read"
               />
        <Checkbox dialogRow={true}
               value={this.state.write}
               onChange={(v)=>this.setState({write:!!v})}
               label="Write"
        />
        < div className="dialogButtons">
            <DialogButton name={'disconnect'}
                          disabled={ !this.props.read && !this.props.write}
                          onClick={()=>{
                              this.props.closeCallback();
                              this.props.setCallback({});
                          }}>Disconnect</DialogButton>
                <DialogButton name={'connect'}
                              disabled={ ! (this.state.read|| this.state.write)}
                              onClick={()=>{
                                  this.props.closeCallback();
                                  this.props.setCallback(cloneDeep(this.state));
                              }}>Connect</DialogButton>
                <DialogButton name={'cancel'}
                          onClick={()=>this.props.closeCallback()}
                          >Cancel</DialogButton>
        </div>
    </div>
    }
}
const storeKeys={
    available:keys.gui.capabilities.remoteChannel,
    channel: keys.properties.remoteChannelName,
    write: keys.properties.remoteChannelWrite,
    read: keys.properties.remoteChannelRead,
    connected: keys.properties.connectedMode
};
export const remoteChannelDialog = (showDialogFunction)=> {
    const dialog=(props)=>{
        let current=globalStore.getMultiple(storeKeys);
        return <RemoteChannelDialog
            {...current}
            {...props}
            setCallback={(values)=>{
                if (! values.read && ! values.write){
                    globalStore.storeMultiple({read:false,write:false},storeKeys,false,true); //omit undefined
                }
                else{
                    globalStore.storeMultiple(values,storeKeys,false,true); //omit undefined
                }
            }}
        />};
    if (showDialogFunction){
        showDialogFunction(dialog)
    }
    else {
        OverlayDialog.dialog(dialog);
    }
};

export default  (options)=>{
    return assign({
        name: "RemoteChannel",
        storeKeys: storeKeys,
        updateFunction:(state)=>{
            let enabled=state.available && state.connected;
            return {
                toggle: enabled && (state.read || state.write),
                visible: enabled
            }
        },
        onClick: ()=>{
            remoteChannelDialog(undefined);
        },
        editDisable:true
    },options);
}