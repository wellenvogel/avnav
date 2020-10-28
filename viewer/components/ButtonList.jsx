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
        this.itemSort=this.itemSort.bind(this);
    }
    refCallback(el){
        if (!el) return;
        if (this.props.buttonOverflow == 'columns') {
            let margin=5;
            let numChildren=el.children.length;
            let prect=el.getBoundingClientRect();
            let minx=prect.x;
            let cwidth=-1;
            for (let i=0;i<numChildren;i++){
                let crect=el.children[i].getBoundingClientRect();
                if (crect.x < minx) minx=crect.x;
                if (cwidth < 0) cwidth=crect.width;
            }
            if (minx < prect.x){
                el.style.width=(prect.width+prect.x-minx+margin)+"px";
            }
            //el.style.width = el.scrollWidth + "px";
        }

    }

    itemSort(a,b){
        if (! this.props.cancelTop) return 0;
        if (a.name == 'Cancel') return -1;
        return 0;
    }

    render(){
        let className=this.props.className||"";
        className+=" buttonContainer "+this.props.buttonOverflow;
        let items=this.props.itemList.slice();
        items.sort(this.itemSort);
        if (this.props.buttonOverflow == 'scroll' && this.props.cancelTop && items.length > 1 && items[0].name == 'Cancel'){
            //we keep the cancel button separate at the top
            let topItems=[items.shift()];
            return <div className="buttonContainerWrap">
                    <ItemList {...this.props}
                        className="buttonContainer"
                        itemList={topItems}
                        itemClass={Dynamic(Visible(LayoutEditing(Button)))}
                        />
                    <ItemList {...this.props}
                        className={className}
                        itemList={items}
                        itemClass={Dynamic(Visible(LayoutEditing(Button)))}
                        listRef={(el)=>{this.refCallback(el)}}
                    />
                </div>
        }
        else {
            return <ItemList {...this.props}
                itemList={items}
                className={className}
                itemClass={Dynamic(Visible(LayoutEditing(Button)))}
                listRef={(el)=>{this.refCallback(el)}}
                />
        }
    }

}
module.exports=Dynamic(ButtonList,{
    storeKeys:{
        maxButtons:keys.properties.maxButtons,
        buttonHeight: keys.gui.global.computedButtonHeight,
        buttonSize: keys.properties.style.buttonSize,
        //fontSize:keys.gui.global.buttonFontSize,
        dimensions: keys.gui.global.windowDimensions,
        buttonOverflow: keys.properties.buttonOverflow,
        cancelTop: keys.properties.cancelTop
        },
    updateFunction:(state)=> {
        let fontSize= state.buttonSize / 4;
        if (state.buttonOverflow == 'shrink' && state.dimensions && state.buttonHeight) {
            let scale=1;
            let height = state.dimensions.height;
            if (height !== undefined && height > 0) {
                let buttonHeight = state.buttonHeight*state.maxButtons; //TODO: should we get this from CSS?
                scale = buttonHeight / height;
            }
            if (scale > 1) scale = 1;
            fontSize = state.buttonSize * scale / 4;
        }
        return{
            fontSize: fontSize,
            buttonOverflow: state.buttonOverflow,
            cancelTop: state.cancelTop
        };
    }
});