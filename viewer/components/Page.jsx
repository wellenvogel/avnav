import React from 'react';
import PropTypes from 'prop-types';
import Headline from './Headline.jsx';
import ButtonList from './ButtonList.jsx';
import {hideToast} from '../components/Toast.jsx';
import WidgetFactory from './WidgetFactory.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import NavData from '../nav/navdata.js';
import KeyHandler from '../util/keyhandler.js';
import AlarmHandler from '../nav/alarmhandler.js';
import Dynamic from '../hoc/Dynamic.jsx';
import GuiHelpers from "../util/GuiHelpers";

const alarmClick =function(){
    let alarms=globalStore.getData(keys.nav.alarms.all,"");
    if (! alarms) return;
    for (let k in alarms){
        if (!alarms[k].running)continue;
        AlarmHandler.stopAlarm(k);
    }
};
const ButtonShade=Dynamic((props)=>{
    let {buttonWidth,showShade,...forward}=props;
    let style={
        width: buttonWidth
    };
    let className="buttonShade";
    if (showShade) className+=" shade";
    return <div className={className} style={style} {...forward}/>;
},{
    storeKeys:{
        buttonWidth: keys.gui.global.computedButtonWidth,
        showShade: keys.properties.showButtonShade
    }
});
class Page extends React.Component {
    constructor(props){
        super(props);
        this.alarmWidget=WidgetFactory.createWidget({name:'Alarm'});
        this.userEvent=this.userEvent.bind(this);
        this.timerCallback=this.timerCallback.bind(this);
        this.timer=GuiHelpers.lifecycleTimer(this,this.timerCallback,1000,true);
        this.lastUserAction=(new Date()).getTime();
        this.state={
            hideButtons:false
        }
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
        if (this.state.hideButtons) className+=" hiddenButtons";
        if (props.isEditing) className+=" editing";
        if (props.className) className += " " + props.className;
        let Alarm=this.alarmWidget;
        return <div className={className} id={props.id} style={props.style}
                    onClick={this.userEvent}
                    onTouchMove={this.userEvent}
                    onTouchStart={this.userEvent}
                    onMouseMove={this.userEvent}
                    onWheel={this.userEvent}
            >
            {props.floatContent && props.floatContent}
            <div className="leftPart">
                {props.title ? <Headline title={props.title}/> : null}
                {props.mainContent ? props.mainContent : null}
                {props.bottomContent ? props.bottomContent : null}
                <Alarm onClick={alarmClick}/>
            </div>
            {! this.state.hideButtons && <ButtonList itemList={props.buttonList} widthChanged={props.buttonWidthChanged}/>}
            { this.state.hideButtons && <ButtonShade onClick={
                (ev)=>{
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.userEvent(ev);
                }
            }/>}
        </div>
    }
    componentDidMount(){
        KeyHandler.setPage(this.props.id);
    }
    componentWillUnmount(){
        hideToast();
    }

}

Page.propTypes={
    id: PropTypes.string.isRequired,
    className: PropTypes.string,
    title: PropTypes.string,
    mainContent: PropTypes.any,
    floatContent: PropTypes.any,
    bottomContent: PropTypes.any,
    buttonList: PropTypes.any,
    style: PropTypes.object,
    isEditing: PropTypes.bool,
    buttonWidthChanged: PropTypes.func,
    autoHideButtons: PropTypes.any // number of ms or undefined
};

export default Dynamic(Page,{storeKeys:{isEditing:keys.gui.global.layoutEditing}});