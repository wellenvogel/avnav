/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import keys, {AlarmShowMode} from '../util/keys';
import {useKeyEventHandler} from '../util/UiHelper';
import AlarmHandler, {Alarm} from '../nav/alarmhandler';
import {WidgetFrame} from "./WidgetBase";
import {KeyComponents} from "../util/keyhandler";
import {IWidgetProps} from "../util/types";
import {DBCancel, DialogButtons, DialogFrame, showDialog} from "./OverlayDialog";
import ItemList from "./ItemList";
import {ListItem, ListMainSlot, ListSlot} from "./ListItems";
import ButtonDefs from "./ButtonDefs";
import {useDialogContext, useStoreState} from "./exports";
import globalstore from "../util/globalstore";
import Button from "./Button";


const ActiveAlarm=(props:Alarm)=>{
    return <ListItem>
        <ListMainSlot
            primary={props.alarm}
            secondary={props.message}
        />
        <ListSlot>
            <Button className={'smallButton'}
                    {...ButtonDefs.DBClear}
                onClick={()=>{
                    clearAlarms(props.alarm);
                }
                }
            ></Button>
        </ListSlot>
    </ListItem>
}
interface AlarmDialogProps{
    clearFunction:(name?:string) => void,
}

const AlarmDialog=(props:AlarmDialogProps) => {
    const [alarms]=useStoreState(STORE_KEYS.alarmInfo);
    const dialogContext = useDialogContext();
    const activeAlarms= AlarmHandler.sortedActiveAlarms(alarms);
    if (!activeAlarms || activeAlarms.length < 1) {
        dialogContext.closeDialog();
        return null;
    }
    return <DialogFrame className={'AlarmDialog'} title={'Alarms'}>
        <ItemList itemList={activeAlarms}
                  itemClass={ActiveAlarm}></ItemList>
        <DialogButtons buttonList={[
            {
                ...ButtonDefs.DBClear,
                onClick: ()=>{ props.clearFunction()}
            },
            DBCancel()
        ]}/>
    </DialogFrame>
}
const STORE_KEYS={
    alarmInfo: keys.nav.alarms.all,
    isEditing: keys.gui.global.layoutEditing,
    disabled: keys.gui.global.preventAlarms,
    showMode: keys.properties.alarmShowMode
};
interface AlarmWidgetProps extends IWidgetProps,
    Record<keyof typeof STORE_KEYS,any>
{
}
const clearAlarms=(name?:string)=>{
    const alarms:Alarm[]=globalstore.getData(STORE_KEYS.alarmInfo);
    if (! alarms) return;
    for (const alarm of Object.values(alarms)) {
        if (!name || alarm.alarm == name) AlarmHandler.stopAlarm(alarm.alarm)
    }
}
//TODO: compare alarm info correctly
const AlarmWidget = (props:AlarmWidgetProps) => {
    useKeyEventHandler({name: 'stop'}, KeyComponents.ALARM,()=>{
        clearAlarms();
    });
    if (props.disabled) return null;
    let alarmText:string = undefined;
    let list:Alarm[]=[]
    if (props.alarmInfo) {
        list = AlarmHandler.sortedActiveAlarms(props.alarmInfo)
        for (const al of list){
            if (alarmText) {
                alarmText += "\n...";
                break;
            } else {
                if (props.showMode === AlarmShowMode.both){
                    alarmText=al.alarm+"\n"+(al.message||'')
                }
                else if (props.showMode === AlarmShowMode.message){
                    alarmText=al.message||al.alarm
                }
                else {
                    alarmText = al.alarm;
                }
            }
        }
    }
    if (! alarmText){
        if (! props.isEditing || ! props.mode) return null;
    }
    const Content = () => {
        if (!alarmText) return null;
        const dialogContext=useDialogContext();
        return <div onClick={(event ) =>{
            event.stopPropagation();
            showDialog(dialogContext,()=><AlarmDialog clearFunction={
                ()=>clearAlarms()
            }/>);
        }}>
            <span className="alarmInfo">{alarmText}</span>
        </div>
    }
    return (
        <WidgetFrame
            {...props}
            addClass="alarmWidget"
            caption="Alarm"
            unit={undefined}
        >
            <Content/>
        </WidgetFrame>
    );
}

AlarmWidget.storeKeys = STORE_KEYS;

export default AlarmWidget;