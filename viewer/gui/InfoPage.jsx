/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import Mob from '../components/Mob.js';

class InfoPage extends React.Component{
    constructor(props){
        super(props);
        this.buttons=[
            Mob.mobDefinition,
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.showLicense=this.showLicense.bind(this);
        this.showPrivacy=this.showPrivacy.bind(this);
        this.state={};
    }
    showLicense(){
        let target=this.refs.info;
        if (! target) return;
        let parent=this.refs.frame;
        if (! parent) return;
        parent.scrollTop=0;
    }
    showPrivacy(){
        let target=this.refs.privacy;
        if (! target) return;
        let parent=this.refs.frame;
        if (! parent) return;
        parent.scrollTop=target.offsetTop-parent.offsetTop;
    }
    componentDidMount(){
        let self=this;
        Requests.getHtmlOrText('info.html').then((text)=>{
            self.setState({info:text});
        },(error)=>{});
        Requests.getHtmlOrText('license.html').then((text)=>{
            self.setState({license:text});
        },(error)=>{});
        Requests.getHtmlOrText('privacy-en.html').then((text)=>{
            self.setState({privacy:text});
        },(error)=>{});
    }
    render(){
        let self=this;
        let MainContent=<React.Fragment>
            <div className="linkWrapper">
                <div className="link" onClick={self.showLicense}>License</div>
                <div className="link" onClick={self.showPrivacy}>PrivacyInfo</div>
            </div>
            <div className="listContainer scrollable" ref="frame">
            <div className="infoFrame" >
                <div className="infoText" dangerouslySetInnerHTML={{__html: this.state.info}} ref="info">
                </div>
                <div className="licenseText" dangerouslySetInnerHTML={{__html: this.state.license}} >
                </div>
                <div className="privacyText" dangerouslySetInnerHTML={{__html: this.state.privacy}} ref="privacy">
                </div>
            </div>
            </div>
            </React.Fragment>;

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="infopage"
                title="License and Privacy Info"
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}

module.exports=InfoPage;