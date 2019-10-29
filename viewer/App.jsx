//avnav (C) wellenvogel 2019

import React, { Component } from 'react';
import history from './util/history.js';
import Dynamic from './hoc/Dynamic.jsx';
import keys from './util/keys.jsx';
import MainPage from './gui/MainPage.jsx';

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
        return <Page options={this.props.options} location={this.props.location}/>
    }
}

const DynamicRouter=Dynamic(Router);

module.exports=function(props){
    return <DynamicRouter
            storeKeys={{
                location: keys.gui.global.pageName,
                options: keys.gui.global.pageOptions
            }}
        />
};