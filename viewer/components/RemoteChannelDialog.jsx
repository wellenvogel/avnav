import React, {useState} from 'react';
import OverlayDialog, {DialogButtons, DialogFrame} from '../components/OverlayDialog.jsx';
import globalStore from '../util/globalstore.jsx';
import keys, {KeyHelper} from '../util/keys.jsx';
import {Checkbox, InputSelect} from "./Inputs";
import DialogButton from "./DialogButton";
import cloneDeep from 'clone-deep';
import assign from "object-assign";


const RemoteChannelDialog=(props)=> {
    const [channel,setChannel]=useState(props.channel);
    const [read,setRead]=useState(props.read);
    const [write,setWrite]=useState(props.write);
    return <DialogFrame className="RemoteChannelDialog" title={"RemoteChannel"}>
        <InputSelect dialogRow={true}
               value={channel}
               onChange={(v)=>setChannel(v)}
               label="Channel"
               changeOnlyValue={true}
               list={KeyHelper.getKeyDescriptions(true)[keys.properties.remoteChannelName].values.map((x)=>{return {label:x,value:x}})}
               />
        <Checkbox dialogRow={true}
               value={read}
               onChange={(v)=>setRead(!!v)}
               label="Read"
               />
        <Checkbox dialogRow={true}
               value={write}
               onChange={(v)=>setWrite(!!v)}
               label="Write"
        />
        <DialogButtons >
            <DialogButton name={'disconnect'}
                          disabled={ !props.read && !props.write}
                          onClick={()=>{
                              props.setCallback({});
                          }}>Disconnect</DialogButton>
                <DialogButton name={'connect'}
                              disabled={ ! (read|| write)}
                              onClick={()=>{
                                  props.setCallback({channel:channel,read:read,write:write});
                              }}>Connect</DialogButton>
                <DialogButton name={'cancel'}
                          >Cancel</DialogButton>
        </DialogButtons>
    </DialogFrame>
}
const storeKeys={
    available:keys.gui.capabilities.remoteChannel,
    active: keys.gui.global.remoteChannelActive,
    channel: keys.properties.remoteChannelName,
    write: keys.properties.remoteChannelWrite,
    read: keys.properties.remoteChannelRead,
    connected: keys.properties.connectedMode
};

export default  (options, opt_dialogContext)=>{
    return assign({
        name: "RemoteChannel",
        storeKeys: storeKeys,
        updateFunction:(state)=>{
            let enabled=state.available && state.connected && state.active;
            return {
                toggle: enabled && (state.read || state.write),
                visible: enabled
            }
        },
        onClick: ()=>{
            const current=globalStore.getMultiple(storeKeys);
            OverlayDialog.showDialog(opt_dialogContext,()=><RemoteChannelDialog
                {...current}
                setCallback={(values)=>{
                    if (! values.read && ! values.write){
                        globalStore.storeMultiple({read:false,write:false},storeKeys,false,true); //omit undefined
                    }
                    else{
                        globalStore.storeMultiple(values,storeKeys,false,true); //omit undefined
                    }
                }}
            />)
        },
        editDisable:true
    },options);
}