import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';

class LayoutNameDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            value:props.value,
            exists:props.checkName?props.checkName(props.value):false,
            active:props.checkActive?props.checkActive(props.value):false};
        this.valueChanged=this.valueChanged.bind(this);
    }
    valueChanged(event) {
        let value=event.target.value;
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
            <div>
                <h3 className="dialogTitle">{this.props.title||'Select Layout Name'}</h3>
                {this.props.subTitle?<p>{this.props.subTitle}</p>:null}
                <div>
                    <div className="row"><label>{info}</label></div>
                    <div className="row"><label>{'user.'}</label>
                        <input type="text" name="value" value={this.state.value} onChange={this.valueChanged}/>
                    </div>
                </div>
                <button name="ok" onClick={()=>{
                    this.props.okCallback(this.state.value);
                    this.props.closeCallback();
                    }}>{this.state.exists?"Overwrite":"Ok"}</button>
                <button name="cancel" onClick={this.props.closeCallback}>Cancel</button>
                <div className="clear"></div>
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

export default LayoutNameDialog;