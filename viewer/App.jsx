//avnav (C) wellenvogel 2019

import React, { Component } from 'react';
import history from './util/history.js';
import Dynamic from './hoc/Dynamic.jsx';
import keys from './util/keys.jsx';
import MainPage from './gui/MainPage.jsx';
import PropertyHandler from './util/propertyhandler.js';
import OverlayDialog from './components/OverlayDialog.jsx';

//legacy support - hand over to the "old" gui handler
class Other extends React.Component{
    constructor(props){
        super(props);
    }
    componentDidMount(){
        avnav.guiHandler.showPageInternal(this.props.location,this.props.options);
    }
    componentDidUpdate(){
        avnav.guiHandler.showPageInternal(this.props.location,this.props.options);
    }
    componentWillUnmount(){
        avnav.guiHandler.showPageInternal('none');
    }
    render() {
        return null;
    }
}


class MainWrapper extends React.Component{
    constructor(props){
        super(props);
    }
    render(){
        return <MainPage {...this.props}/>
    }
    componentDidMount(){
        history.reset(); //reset history if we reach the mainpage
    }
}
const pages={
    mainpage: MainWrapper
};
class Router extends Component {
    render() {
        let Page=pages[this.props.location];
        if (Page === undefined){
            Page=Other;
        }
        let className=this.props.nightMode?"nightMode":"";
        let style={};
        if (this.props.nightMode) style['opacity']=PropertyHandler.getValueByName('nightFade');
        return <Page className={className} style={style} options={this.props.options} location={this.props.location}/>
    }
}

const DynamicRouter=Dynamic(Router);

module.exports=function(props){
    const Dialogs=OverlayDialog.getDialogContainer;
    return <React.Fragment>
            <DynamicRouter
            storeKeys={{
                location: keys.gui.global.pageName,
                options: keys.gui.global.pageOptions,
                nightMode: keys.properties.nightMode,
                sequence: keys.gui.global.propertySequence
            }}
            />
            <Dialogs/>
           </React.Fragment>
};