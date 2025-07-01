import React, {Children, cloneElement, forwardRef, useCallback, useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import Headline from './Headline.jsx';
import ButtonList from './ButtonList.jsx';
import {hideToast} from '../components/Toast.jsx';
import WidgetFactory from './WidgetFactory.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import KeyHandler from '../util/keyhandler.js';
import AlarmHandler from '../nav/alarmhandler.js';
import {useTimer} from "../util/GuiHelpers";
import assign from 'object-assign';
import Helper from "../util/helper";
import {useStore} from "../hoc/Dynamic";
import {NestedDialogDisplay} from "./OverlayDialog";

const alarmClick =function(){
    let alarms=globalStore.getData(keys.nav.alarms.all,"");
    if (! alarms) return;
    for (let k in alarms){
        if (!alarms[k].running)continue;
        AlarmHandler.stopAlarm(k);
    }
};

export const PageFrame=forwardRef((iprops,ref)=>{
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {autoHideButtons,hideCallback,children,className,isEditing,id,buttonList,small,editingChanged,windowDimensions,...forward}=useStore(iprops,{
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
            let now=Helper.now();
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
    const userEvent=useCallback((ev)=>{
        lastUserEvent.current=Helper.now();
        if (hidden && ev && ev.type === 'click'){
            setHidden(false);
        }
    },[hideCallback,hidden]);
    let cl=Helper.concatsp("page",
        className,
        hidden?"hiddenButtons":undefined,
        isEditing?"editing":undefined
        )
    return <div
                ref={ref}
                className={cl}
                id={id}
                {...forward}
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
})

PageFrame.propTypes={
    className: PropTypes.string,
    autoHideButtons: PropTypes.number,
    hideCallback: PropTypes.func,
    editingChanged: PropTypes.func,
    id: PropTypes.string.isRequired
}

export const PageLeft=({className,title,children,dialogCtxRef})=>{
    const Alarm=useCallback(WidgetFactory.createWidget({name:'Alarm'}),[])
    return <div className={Helper.concatsp("leftPart","dialogAnchor", className)}>
            <NestedDialogDisplay dialogCtxRef={dialogCtxRef}>
            {title ? <Headline title={title} connectionLost={true}/> : null}
            {children}
            <Alarm onClick={alarmClick}/>
            </NestedDialogDisplay>
        </div>
}
PageLeft.propTypes = {
    className: PropTypes.string,
    title: PropTypes.string,
    dialogCtxRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({current: PropTypes.any})
    ])
}

const Page=forwardRef((props,ref)=>{
        return <PageFrame
            className={props.className}
            id={props.id}
            style={props.style}
            autoHideButtons={props.autoHideButtons}
            hideCallback={props.buttonWidthChanged}
            ref={ref}
            >
            {props.floatContent && props.floatContent}
            <PageLeft title={props.title}>
                {props.mainContent ? props.mainContent : null}
                {props.bottomContent ? props.bottomContent : null}
            </PageLeft>
            <ButtonList
                itemList={props.buttonList}
                widthChanged={props.buttonWidthChanged}
            />
        </PageFrame>
});

Page.pageProperties={
    className: PropTypes.string,
    style: PropTypes.object,
    options: PropTypes.object,
    location: PropTypes.string.isRequired,
    history: PropTypes.object.isRequired,
    small: PropTypes.bool.isRequired
}
Page.propTypes=assign({},Page.pageProperties,{
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    mainContent: PropTypes.any,
    floatContent: PropTypes.any,
    bottomContent: PropTypes.any,
    buttonList: PropTypes.array,
    style: PropTypes.object,
    buttonWidthChanged: PropTypes.func,
    autoHideButtons: PropTypes.any, // number of ms or undefined
    windowDimensions: PropTypes.any
});



export default Page;