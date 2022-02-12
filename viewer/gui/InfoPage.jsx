/**
 * Created by andreas on 02.05.14.
 */

import React from 'react';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import Mob from '../components/Mob.js';

class InfoPage extends React.Component{
    constructor(props){
        super(props);
        this.buttons=[
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
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
                {...self.props}
                id="infopage"
                title="License and Privacy Info"
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}

export default InfoPage;