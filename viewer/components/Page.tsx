import React, {
    Children,
    cloneElement,
    ReactNode,
    SyntheticEvent,
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import Headline from './Headline';
import ButtonList from './ButtonList';
import {hideToast} from './Toast';
// @ts-ignore
import WidgetFactory from './WidgetFactory';
import globalStore from '../util/globalstore';
import keys from '../util/keys';
import KeyHandler from '../util/keyhandler';
// @ts-ignore
import AlarmHandler from '../nav/alarmhandler';
import {useTimer} from "../util/UiHelper";
import Helper from "../util/helper";
import {useStore, useStoreState} from "../hoc/Dynamic";
import {DialogDisplay} from "./OverlayDialog";
import {ButtonDef, DynamicButtonProps} from "./Button";
import {IHistory} from "../util/history";
import {PageType} from "../util/pageids";
import {addonViewManager} from "./AddonView";

export interface PageFrameProps{
    className?: string;
    autoHideButtons?: number;
    hideCallback?: (hidden:boolean)=>void;
    editingChanged?: ()=>void;
    id: PageType;
    children?: React.ReactNode;
    style?:Record<string, any>;
    title?:React.ReactNode;
}
export interface PageLeftProps{
    className?: string;
    title?: ReactNode;
    children?: React.ReactNode;
    id:PageType
}

export interface PageBaseProps{
    className?: string;
    style?: Record<string, any>;
    options?: Record<string, any>;
    location: string;
    small: boolean;
    id: PageType;
    windowDimensions?:{width:number,height:number};
    pageColumns: number;
}
export interface PageProps extends PageBaseProps{
    title?: string;
    mainContent?: React.ReactNode;
    floatContent?: React.ReactNode;
    bottomContent?: React.ReactNode;
    buttonList?: ButtonDef[]|DynamicButtonProps[];
    style?: Record<string, any>;
    buttonWidthChanged?: ()=>void;
    autoHideButtons?: number; //ms or undefined
    history: IHistory
}


const alarmClick =function(){
    const alarms=globalStore.getData(keys.nav.alarms.all,"");
    if (! alarms) return;
    for (const k in alarms){
        if (!alarms[k].running)continue;
        AlarmHandler.stopAlarm(k);
    }
};

export const PageFrame=
    (iprops:PageFrameProps)=>{
    const {autoHideButtons,hideCallback,children,className,isEditing,id,editingChanged}=useStore(iprops,{
        storeKeys:{
            isEditing: keys.gui.global.layoutEditing
        }
    });
    useEffect(() => {
        if (editingChanged) editingChanged(isEditing);
    }, [isEditing]);
    useEffect(() => {
        KeyHandler.setPage(id);
        return ()=>hideToast();
    }, []);
    const lastUserEvent=useRef(Helper.now());
    const [hidden,setHidden]=useState(false);
    useEffect(() => {
        if (hideCallback) hideCallback(hidden);
    },[hidden]);
    const timer=useTimer((sequence)=>{
        if (autoHideButtons !== undefined && ! isEditing){
            const now=Helper.now();
            if (globalStore.getData(keys.gui.global.hasActiveInputs)){
                lastUserEvent.current=now;
            }
            if (! hidden) {
                if (lastUserEvent.current < (now - autoHideButtons)) {
                    setHidden(true);
                }
            }
        }
        timer.startTimer(sequence);
    },1000,true);
    const userEvent=useCallback((ev:SyntheticEvent)=>{
        lastUserEvent.current=Helper.now();
        if (hidden && ev && ev.type === 'click'){
            setHidden(false);
        }
    },[hideCallback,hidden]);
    const cl=Helper.concatsp("page",
        className,
        hidden?"hiddenButtons":undefined,
        isEditing?"editing":undefined
        )
    return <div
                className={cl}
                id={id}
                onClick={userEvent}
                onTouchMove={userEvent}
                onTouchStart={userEvent}
                onMouseMove={userEvent}
                onWheel={userEvent}
    >
        {Children.map(children,(child)=> {
            if (child) return cloneElement(child, {buttonsHidden: hidden && !!autoHideButtons })
            return null;
            }
        )}
    </div>
}


export const PageLeft=
    ({className,title,children,id}:PageLeftProps)=>{
    useStoreState(keys.gui.global.addonViewChanged);
    const Alarm=useCallback(WidgetFactory.createWidget({name:'Alarm'}),[])
    const AddOn=addonViewManager.getPageAddon(id);
    return <div className={Helper.concatsp("leftPart","dialogAnchor", className)}
            >
            {(title && ! AddOn) ? <Headline title={title} connectionLost={true}/> : null}
            <DialogDisplay name={'page'}/>
            {AddOn?<AddOn></AddOn>:children}
            <Alarm onClick={alarmClick}/>

        </div>
}

const Page=
    // eslint-disable-next-line react/display-name
    (props:PageProps)=>{
        return <PageFrame
            className={props.className}
            id={props.id}
            style={props.style}
            autoHideButtons={props.autoHideButtons}
            hideCallback={props.buttonWidthChanged}
            >
            {props.floatContent && props.floatContent}
            <PageLeft
                id={props.id}
                title={props.title}>
                {props.mainContent ? props.mainContent : null}
                {props.bottomContent ? props.bottomContent : null}
            </PageLeft>
            <ButtonList
                page={props.id}
                itemList={props.buttonList}
                widthChanged={props.buttonWidthChanged}
            />
        </PageFrame>
};


export default Page;