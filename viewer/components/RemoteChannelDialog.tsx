import React, {useState} from 'react';
import {DialogButtons, DialogFrame, showDialog} from './OverlayDialog';
import globalStore from '../util/globalstore';
import keys, {KeyHelper} from '../util/keys';
import {Checkbox, InputSelect} from "./Inputs";
import DialogButton from "./DialogButton";
import {getav} from "../util/helper";
import {SelectListEntry} from "../util/EditableParameter";
import {IDialogContext} from "./DialogContext";
import {ButtonEvent, DynamicButtonProps} from "./Button";
import {useStoreState} from "../hoc/Dynamic";
import {iconClasses} from './Icons';


export interface RemoteChannelProps {
    channel?:string
    read?:boolean
    write?:boolean
}
export interface RemoteChannelDialogProps extends RemoteChannelProps {
    setCallback:(v:RemoteChannelProps)=>void;
}

const RemoteChannelDialogImpl=(props:RemoteChannelDialogProps)=> {
    const [channel,setChannel]=useState(props.channel);
    const [read,setRead]=useState(props.read);
    const [write,setWrite]=useState(props.write);
    const selectList:SelectListEntry[]=KeyHelper.getKeyDescriptions(true)[keys.properties.remoteChannelName].values.map((x:string)=>{return {label:x,value:x}})
    return <DialogFrame className="RemoteChannelDialog" title={"RemoteChannel"}>
        <InputSelect dialogRow={true}
               value={channel}
               onChange={(v)=>setChannel(v)}
               label="Channel"
               changeOnlyValue={true}
               list={selectList}
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
    connected: keys.gui.global.connectedMode
};

export const RemoteDialog=()=>{
    const [read]=useStoreState(keys.properties.remoteChannelRead);
    const [write]=useStoreState(keys.properties.remoteChannelWrite);
    const [channel]=useStoreState(keys.properties.remoteChannelName);
    return <RemoteChannelDialogImpl
        setCallback={(values)=>{
            if (! values.read && ! values.write){
                globalStore.storeMultiple({read:false,write:false},storeKeys,false,true); //omit undefined
            }
            else{
                globalStore.storeMultiple(values,storeKeys,false,true); //omit undefined
            }}
        }
        read={read}
        write={write}
        channel={channel}/>
}

export const showRemoteChannelDialog=async (dialogContext?:IDialogContext)=> {
    await showDialog(dialogContext,()=><RemoteDialog/>)
}

export default  (options:Partial<DynamicButtonProps>):DynamicButtonProps=>{
    return {
        name: "RemoteChannel",
        displayName: 'remote control',
        iconClass: iconClasses.RemoteChannel,
        storeKeys: storeKeys,
        updateFunction:(state:Record<string,any>)=>{
            const enabled=state.available && state.connected && state.active;
            return {
                toggle: enabled && (state.read || state.write),
                visible: enabled
            }
        },
        onClick: async (ev:ButtonEvent)=>{
            const dialogContext=getav(ev).dialogContext;
            await showRemoteChannelDialog(dialogContext);
        },
        editDisable:true,
        overflow: true
    ,...options};
}