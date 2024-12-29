import React, {useState} from 'react';
import PropTypes from 'prop-types';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import DB from './DialogButton.jsx';
import {DialogButtons, DialogFrame} from "./OverlayDialog";

const ColorDialog =(props)=>{
        const [value,setValue]=useState(props.value||"#ffffff");
    const ok=props.resolveFunction||props.okCallback;
        let style={
            backgroundColor:value,
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
            <DialogFrame className="settingsDialog colorDialog" title={props.title}>
                <ColorPicker value={value} onChange={(v)=>setValue(v)} {...pickerProperties}/>
                <div className="colorFrame">
                    <div style={style} className="colorValue"></div>
                    <input className="colorName"
                           onChange={(ev)=>setValue(ev.target.value)}
                           value={value}/>
                </div>
                <DialogButtons>
                    {(props.default !== undefined) ?
                        <DB name="reset" onClick={()=>setValue(props.default)} close={false}>Reset</DB>
                        :
                        null}
                    {(props.showUnset !== undefined) ?
                        <DB name="unset" onClick={()=>ok()}>Unset</DB>
                        :
                        null}
                    <DB name="cancel">Cancel</DB>
                    <DB name="ok" onClick={()=>ok(value)}>Ok</DB>
                </DialogButtons>
            </DialogFrame>
        );
}

ColorDialog.propTypes={
    okCallback: PropTypes.func,
    value: PropTypes.string.isRequired,
    default: PropTypes.string,
    title: PropTypes.string,
    showUnset: PropTypes.bool
};

export default  ColorDialog;