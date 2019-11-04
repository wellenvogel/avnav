//avnav (C) wellenvogel 2019

import React, { Component } from 'react';
import history from './util/history.js';
import Dynamic from './hoc/Dynamic.jsx';
import keys from './util/keys.jsx';
import MainPage from './gui/MainPage.jsx';
import PropertyHandler from './util/propertyhandler.js';
import OverlayDialog from './components/OverlayDialog.jsx';
import globalStore from './util/globalstore.jsx';

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
        let className="pageFrame "+ (this.props.nightMode?"nightMode":"");
        let style={};
        if (this.props.nightMode) style['opacity']=PropertyHandler.getValueByName('nightFade')/100;
        return <div className={className}>
                <Page style={style} options={this.props.options} location={this.props.location}/>
            </div>
    }
}

const DynamicRouter=Dynamic(Router);

class App extends React.Component {
    constructor(props) {
        super(props);
        this.checkSizes=this.checkSizes.bind(this);
        this.state={};
    }
    checkSizes(){
        if (globalStore.getData(keys.gui.global.hasActiveInputs,false)) return;
        if (! this.refs.app) return;
        let current=this.refs.app.getBoundingClientRect();
        if (! current) return;
        let small = current.width < PropertyHandler.getProperties().smallBreak;
        globalStore.storeData(keys.gui.global.smallDisplay,small); //set small before we change dimensions...
        globalStore.storeData(keys.gui.global.dimensions,{width:current.width,height:current.height});
    }
    componentDidMount(){
        let iv=window.setInterval(this.checkSizes,100000);
        this.checkSizes();
        this.setState({interval:iv});
        window.addEventListener('resize',this.checkSizes)
    }
    componentWillUnmount(){
        window.removeEventListener('resize',this.checkSizes);
        if (this.state.interval){
            window.clearInterval(this.state.interval);
        }
    }
    render(){
        const Dialogs = OverlayDialog.getDialogContainer;
        return <div className="app" ref="app">
            <DynamicRouter
                storeKeys={{
                location: keys.gui.global.pageName,
                options: keys.gui.global.pageOptions,
                nightMode: keys.properties.nightMode,
                sequence: keys.gui.global.propertySequence,
                dimensions: keys.gui.global.windowDimensions
            }}
                />
            <Dialogs/>
        </div>
    };
}
module.exports=App;