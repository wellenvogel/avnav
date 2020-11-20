import React from 'react';
import PropTypes from 'prop-types';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import DB from './DialogButton.jsx';

class ColorDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            value: props.value
        };
        if (!this.state.value) this.state.value="#ffffff";
        this.valueChange=this.valueChange.bind(this);
        this.buttonClick=this.buttonClick.bind(this);
        this.onColorChange=this.onColorChange.bind(this);
        this.colorInput=this.colorInput.bind(this);
    }
    valueChange(ev){
        this.setState({value: ev.target.value});
    }
    buttonClick(ev){
        let button=ev.target.name;
        if (button == 'ok'){
            if (this.props.okCallback) this.props.okCallback(this.state.value);
        }
        if (button == 'unset'){
            if (this.props.okCallback) this.props.okCallback();
        }
        if (button == 'reset'){
            this.setState({
                value: this.props.default
            });
            return;
        }
        this.props.closeCallback();
    }
    onColorChange(color,c){
        this.setState({
            value: color
        })
    }
    colorInput(ev){
        this.setState({
            value:ev.target.value
        })
    }
    render() {
        let style={
            backgroundColor:this.state.value,
            width: 30,
            height: 30
        };
        let pickerProperties={
            saturationWidth: 250,
            saturationHeight: 250,
            hueWidth: 30,
            showAlpha: true
        };
        let dimensions=globalStore.getData(keys.gui.global.windowDimensions,{});
        let v = dimensions.height;
        let margin=250;
        if (v) {
            pickerProperties.saturationHeight = v < pickerProperties.saturationHeight + margin ? v - margin : pickerProperties.saturationHeight;
        }
        if (pickerProperties.saturationHeight < 50) pickerProperties.saturationHeight=50;
        v = dimensions.width;
        margin=70;
        if (v) {
            pickerProperties.saturationWidth = v < pickerProperties.saturationWidth + margin ? v - margin : pickerProperties.saturationWidth;
        }
        if (pickerProperties.saturationWidth < 50 ) pickerProperties.saturationWidth=50;
        return (
            <div className="settingsDialog colorDialog inner">
                {this.props.title?<h3>{this.props.title}</h3>:null}
                <ColorPicker value={this.state.value} onChange={this.onColorChange} {...pickerProperties}/>
                <div className="colorFrame">
                    <div style={style} className="colorValue"></div>
                    <input className="colorName"
                           onChange={this.colorInput}
                           value={this.state.value}/>
                </div>
                <div className="dialogButtons">
                    {(this.props.default !== undefined) ?
                        <DB name="reset" onClick={this.buttonClick}>Reset</DB>
                        :
                        null}
                    {(this.props.showUnset !== undefined) ?
                        <DB name="unset" onClick={this.buttonClick}>Unset</DB>
                        :
                        null}
                    <DB name="cancel" onClick={this.buttonClick}>Cancel</DB>
                    <DB name="ok" onClick={this.buttonClick}>Ok</DB>
                </div>
            </div>
        );
    }

}

ColorDialog.propTypes={
    closeCallback: PropTypes.func.isRequired,
    okCallback: PropTypes.func,
    value: PropTypes.string.isRequired,
    default: PropTypes.string,
    title: PropTypes.string,
    showUnset: PropTypes.bool
};

export default  ColorDialog;