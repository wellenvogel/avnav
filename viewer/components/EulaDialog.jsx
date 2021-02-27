import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import Requests from '../util/requests.js';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';
import {Input} from './Inputs.jsx';
import DB from './DialogButton.jsx';

class EulaDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            eula:undefined
        };
        this.lastEula=0;
    }
    componentDidMount(){
        Requests.getHtmlOrText(this.props.eulaUrl)
            .then((html)=>{
                this.setState({eula:html});
            })
            .catch((error)=>{});
    }
    render () {
        if (this.state.eula && ! this.lastEula && this.props.updateDimensions){
            let self=this;
            window.setTimeout(()=>{
                self.lastEula=1;
                self.props.updateDimensions();
            },100);

        }
        return (
            <div className="inner EulaDialog">
                <h3 className="dialogTitle">{'EULA'}</h3>
                <div className="dialogRow">{this.props.name}</div>
                <div className="dialogRow eulaContainer">
                    {this.state.eula?
                        <div className="eula" dangerouslySetInnerHTML={{__html: this.state.eula}}></div>
                        :
                        <div className="dialogRow">Loading EULA</div>
                    }

                </div>
                <div className="dialogButtons">
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    <DB name="ok" onClick={() => {
                        this.props.okCallback(this.state.value);
                        this.props.closeCallback();
                    }}>Accept</DB>
                </div>
            </div>
        );

    }
}

EulaDialog.propTypes={
    eulaUrl: PropTypes.string,
    name: PropTypes.string,
    okCallback: PropTypes.func.isRequired,
    closeCallback: PropTypes.func.isRequired
};

EulaDialog.createDialog=(name,eulaUrl)=>{
    return new Promise((resolve,reject)=>{
        OverlayDialog.dialog((props)=> {
            return <EulaDialog
                {...props}
                okCallback={()=>{
                        resolve(0)
                   }}
                name={name}
                eulaUrl={eulaUrl}
                />
        },undefined,()=>{reject("")});
    });
};

export default  EulaDialog;