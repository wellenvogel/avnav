import React from 'react';
import Button from './Button.jsx';
import Dynamic from '../hoc/Dynamic.jsx';
import LayoutEditing from '../hoc/LayoutEditMode.jsx';
import Visible from '../hoc/Visible.jsx';
import keys from '../util/keys.jsx';
import ItemList from './ItemList.jsx';
import PropertyHandler from '../util/propertyhandler.js';


class ButtonList extends React.Component{
    constructor(props){
        super(props);
        this.refCallback=this.refCallback.bind(this);
    }
    refCallback(el){
        if (!el) return;
        if (this.props.buttonOverflow == 'columns') {
            el.style.width = el.scrollWidth + "px";
        }
    }

    render(){
        let className=this.props.className||"";
        className+=" buttonContainer "+this.props.buttonOverflow;
        return <ItemList {...this.props}
            className={className}
            itemClass={Dynamic(Visible(LayoutEditing(Button)))}
            listRef={(el)=>{this.refCallback(el)}}
            />
    }

}
module.exports=Dynamic(ButtonList,{
    storeKeys:{
        maxButtons:keys.properties.maxButtons,
        buttonSize: keys.properties.style.buttonSize,
        //fontSize:keys.gui.global.buttonFontSize,
        dimensions: keys.gui.global.windowDimensions,
        buttonOverflow: keys.properties.buttonOverflow
        },
    updateFunction:(state)=> {
        let fontSize= state.buttonSize / 4;
        if (state.buttonOverflow == 'shrink' && state.dimensions) {
            let scale=1;
            let height = state.dimensions.height;
            if (height !== undefined) {
                let buttonHeight = height / state.maxButtons - 4; //TODO: should we get this from CSS?
                scale = buttonHeight / state.buttonSize;
            }
            if (scale > 1) scale = 1;
            fontSize = state.buttonSize * scale / 4;
        }
        return{
            fontSize: fontSize,
            buttonOverflow: state.buttonOverflow
        };
    }
});