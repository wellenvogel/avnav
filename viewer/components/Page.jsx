import React, {Children, cloneElement, useCallback, useEffect, useRef, useState} from 'react';
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

const alarmClick =function(){
    let alarms=globalStore.getData(keys.nav.alarms.all,"");
    if (! alarms) return;
    for (let k in alarms){
        if (!alarms[k].running)continue;
        AlarmHandler.stopAlarm(k);
    }
};

export const PageFrame=(iprops)=>{
    const {autoHideButtons,hideCallback,children,className,isEditing,id,...forward}=useStore(iprops,{
        storeKeys:{
            isEditing: keys.gui.global.layoutEditing
        }
    });
    useEffect(() => {
        KeyHandler.setPage(id);
        return ()=>hideToast();
    }, []);
    const lastUserEvent=useRef(Helper.now());
    const [hidden,setHidden]=useState(false);
    const timer=useTimer((sequence)=>{
        if (autoHideButtons !== undefined){
            let now=Helper.now();
            if (globalStore.getData(keys.gui.global.hasActiveInputs)){
                lastUserEvent.current=now;
            }
            if (! hidden) {
                if (lastUserEvent.current < (now - autoHideButtons)) {
                    setHidden(true);
                    if (hideCallback) hideCallback(true);
                }
            }
        }
        timer.startTimer(sequence);
    },1000,true);
    const userEvent=useCallback((ev)=>{
        lastUserEvent.current=Helper.now();
        if (hidden && ev && ev.type === 'click'){
            setHidden(false);
            if (hideCallback) hideCallback(false)
        }
    },[hideCallback,hidden]);
    let cl=Helper.concatsp("page",
        className,
        hidden?"hiddenButtons":undefined,
        isEditing?"editing":undefined
        )
    return <div
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
            if (child) return cloneElement(child, {buttonsHidden: hidden})
            return null;
            }
        )}
    </div>
}

PageFrame.propTypes={
    className: PropTypes.string,
    autoHideButtons: PropTypes.oneOfType([PropTypes.undefined,PropTypes.number]),
    hideCallback: PropTypes.func,
    id: PropTypes.string.isRequired
}

export const PageLeft=({className,title,children})=>{
    const Alarm=useCallback(WidgetFactory.createWidget({name:'Alarm'}),[])
    return <div className={Helper.concatsp("leftPart",className)}>
        {title ? <Headline title={title} connectionLost={true}/> : null}
        {children}
        <Alarm onClick={alarmClick}/>
    </div>
}
PageLeft.propTypes={
    className: PropTypes.string,
    title: PropTypes.string
}

const Page=(props)=>{
        return <PageFrame
            className={props.className}
            id={props.id}
            style={props.style}
            autoHideButtons={props.autoHideButtons}
            hideCallback={props.buttonWidthChanged}
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
}

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
    buttonList: PropTypes.any,
    style: PropTypes.object,
    buttonWidthChanged: PropTypes.func,
    autoHideButtons: PropTypes.any // number of ms or undefined
});



export default Page;