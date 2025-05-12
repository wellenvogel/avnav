import React, {Children, cloneElement, useCallback, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import Headline from './Headline.jsx';
import ButtonList from './ButtonList.jsx';
import {hideToast} from '../components/Toast.jsx';
import WidgetFactory from './WidgetFactory.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import KeyHandler from '../util/keyhandler.js';
import AlarmHandler from '../nav/alarmhandler.js';
import GuiHelpers, {useTimer} from "../util/GuiHelpers";
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
    const {autoHideButtons,hideCallback,children,...forward}=useStore(iprops);
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
    return <div {...forward}
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
    autoHideButtons: PropTypes.oneOfType([PropTypes.undefined,PropTypes.number]),
    hideCallback: PropTypes.func
}

class Page extends React.Component {
    constructor(props){
        super(props);
        this.alarmWidget=WidgetFactory.createWidget({name:'Alarm'});
        this.userEvent=this.userEvent.bind(this);
        this.timerCallback=this.timerCallback.bind(this);
        this.timer=GuiHelpers.lifecycleTimer(this,this.timerCallback,1000,true);
        this.lastUserAction=(new Date()).getTime();
        this.state={
            hideButtons:false,
            connectionLost:globalStore.getData(keys.nav.gps.connectionLost)
        }
        GuiHelpers.storeHelper(this,(data)=>{
            this.setState(data)
        },{connectionLost: keys.nav.gps.connectionLost});
    }
    timerCallback(sequence){
        if (this.props.autoHideButtons !== undefined){
            let now=(new Date()).getTime();
            if (globalStore.getData(keys.gui.global.hasActiveInputs)){
                this.lastUserAction=now;
            }
            if (! this.state.hideButtons) {
                if (this.lastUserAction < (now - this.props.autoHideButtons)) {
                    this.setState({hideButtons: true})
                    if (this.props.buttonWidthChanged) this.props.buttonWidthChanged();
                }
            }
        }
        this.timer.startTimer(sequence);
    }
    userEvent(ev){
        this.lastUserAction=(new Date()).getTime();
        if (this.state.hideButtons && ev.type === 'click'){
            window.setTimeout(()=>{
                this.setState({hideButtons:false});
                if (this.props.buttonWidthChanged) this.props.buttonWidthChanged();
            },1);
        }
    }
    render() {
        let props=this.props;
        let className = "page";
        let hideButtons=this.state.hideButtons && props.autoHideButtons;
        if (hideButtons) className+=" hiddenButtons";
        if (props.isEditing) className+=" editing";
        if (props.className) className += " " + props.className;
        let Alarm=this.alarmWidget;
        return <PageFrame
            className={className}
            id={props.id}
            style={props.style}
            autoHideButtons={props.autoHideButtons}
            >
            {props.floatContent && props.floatContent}
            <div className="leftPart">
                {props.title ? <Headline title={props.title} connectionLost={this.state.connectionLost}/> : null}
                {props.mainContent ? props.mainContent : null}
                {props.bottomContent ? props.bottomContent : null}
                <Alarm onClick={alarmClick}/>
            </div>
            <ButtonList
                itemList={props.buttonList}
                widthChanged={props.buttonWidthChanged}
                shadeCallback={this.userEvent}
                showShade={globalStore.getData(keys.properties.showButtonShade)}
            />
        </PageFrame>
    }
    componentDidMount(){
        KeyHandler.setPage(this.props.id);
    }
    componentWillUnmount(){
        hideToast();
    }

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
    isEditing: PropTypes.bool,
    buttonWidthChanged: PropTypes.func,
    autoHideButtons: PropTypes.any // number of ms or undefined
});



export default Page;