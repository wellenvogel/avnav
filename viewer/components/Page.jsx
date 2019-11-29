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

const alarmClick =function(){
    let alarms=globalStore.getData(keys.nav.gps.alarms,"");
    if (! alarms) return;
    for (let k in alarms){
        NavData.getGpsHandler().stopAlarm(k);
    }
};
class Page extends React.Component {
    constructor(props){
        super(props);
        this.alarmWidget=WidgetFactory.createWidget({name:'Alarm'});
    }

    render() {
        let props=this.props;
        let className = "page";
        if (props.className) className += " " + props.className;
        let Alarm=this.alarmWidget;
        return <div className={className} id={props.id} style={props.style}>
            <div className="leftPart">
                {props.title ? <Headline title={props.title}/> : null}
                {props.mainContent ? props.mainContent : null}
                {props.bottomContent ? props.bottomContent : null}
                <Alarm onClick={alarmClick}/>
            </div>
            <ButtonList itemList={props.buttonList}/>
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
    bottomContent: PropTypes.any,
    buttonList: PropTypes.any,
    style: PropTypes.object
};

module.exports=Page;