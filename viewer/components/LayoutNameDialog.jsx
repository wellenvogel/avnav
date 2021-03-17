import React from 'react';
import PropTypes from 'prop-types';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';
import {Input} from './Inputs.jsx';
import DB from './DialogButton.jsx';

class LayoutNameDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            value:props.value,
            exists:props.checkName?props.checkName(props.value):false,
            active:props.checkActive?props.checkActive(props.value):false};
        this.valueChanged=this.valueChanged.bind(this);
    }
    valueChanged(value) {
        let nstate={value:value};
        if (this.props.checkName){
            nstate.exists=this.props.checkName(value);
        }
        if (this.props.checkActive){
            nstate.active=this.props.checkActive(value)
        }
        this.setState(nstate);
    }
    render () {
        let info="New Layout";
        if (this.state.active){
            info="Active Layout";
        }
        else{
            if (this.state.exists){
                info="Existing Layout";
            }
        }
        return (
            <div className="inner layoutNameDialog">
                <h3 className="dialogTitle">{this.props.title||'Select Layout Name'}</h3>
                {this.props.subTitle?<p>{this.props.subTitle}</p>:null}
                <div>
                    <div className="dialogRow"><span className="inputLabel">{info}</span></div>
                    <div className="dialogRow">
                        <Input
                            className="layoutName"
                            label={'user.'}
                            value={this.state.value} onChange={this.valueChanged}/>
                    </div>
                </div>
                <div className="dialogButtons">
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    <DB name="ok" onClick={() => {
                        this.props.okCallback(this.state.value);
                        this.props.closeCallback();
                    }}>{this.state.exists ? "Overwrite" : "Ok"}</DB>
                </div>
            </div>
        );
    }
}

LayoutNameDialog.propTypes={
    title: PropTypes.string,
    subTitle: PropTypes.string,
    exists: PropTypes.bool,
    value: PropTypes.string,
    okCallback: PropTypes.func.isRequired,
    checkName: PropTypes.func,
    checkActive: PropTypes.func,
    closeCallback: PropTypes.func.isRequired
};

LayoutNameDialog.createDialog=(name,opt_checkExists,opt_title,opt_subTitle)=>{
    return new Promise((resolve,reject)=>{
        OverlayDialog.dialog((props)=> {
            return <LayoutNameDialog
                {...props}
                exists={true}
                value={name}
                okCallback={(newName)=>{
                        resolve(newName)
                   }}
                checkName={(cname)=>{
                        if (opt_checkExists){
                            return opt_checkExists(cname);
                        }
                        return false;
                    }
                }
                title={opt_title}
                subTitle={opt_subTitle}
                checkActive={(name)=>{return LayoutHandler.isActiveLayout(LayoutHandler.fileNameToServerName(name))}}
                />
        },undefined,()=>{reject("")});
    });
};

export default  LayoutNameDialog;