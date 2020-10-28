import React from 'react';
import Button from './Button.jsx';
import Dynamic from '../hoc/Dynamic.jsx';
import keys from '../util/keys.jsx';
import ItemList from './ItemList.jsx';
import PropertyHandler from '../util/propertyhandler.js';


class ButtonList extends React.Component{
    constructor(props){
        super(props);
        this.itemSort=this.itemSort.bind(this);
        this.refCallback=this.refCallback.bind(this);
        this.state={showOverflow:false};
    }
    refCallback(el){
        if (!el) return;
        if (this.props.buttonCols) {
            let rect=el.getBoundingClientRect();
            let min=rect.left;
            for (let i=0;i<el.childElementCount;i++){
                let crect=el.children[i].getBoundingClientRect();
                if (crect.left < min) min=crect.left;
            }
            let width=rect.width;
            width+=Math.ceil((rect.left-min)/55)*55;
            el.style.width = width + "px";
        }
    }
    itemSort(a,b){
        if (! this.props.cancelTop) return 0;
        if (a.name == 'Cancel') return -1;
        return 0;
    }

    itemVisible(item){
        if (item.visible !== undefined && ! item.visible) return false;
        if (item.editDisable && this.props.isEditing) return false;
        if (item.editOnly && ! this.props.isEditing) return false;
        return true;
    }

    render(){
        let className=this.props.className||"";
        className+=" buttonContainer ";
        let items=[];
        for (let k in this.props.itemList){
            if (this.itemVisible(this.props.itemList[k])){
                items.push(this.props.itemList[k]);
            }
        }
        items.sort(this.itemSort);
        let maxButtons=this.props.maxButtons;
        if (this.props.buttonCols) maxButtons=Math.ceil(maxButtons/2);
        let scale=1;
        let hasOverflow=false;
        if (this.props.dimensions && this.props.dimensions.height && this.props.buttonHeight){
            scale=this.props.dimensions.height/(this.props.buttonHeight*maxButtons);
            if (scale > 1) scale=1;
            if (items.length*this.props.buttonHeight*scale > this.props.dimensions.height) {
                hasOverflow=true;
            }
        }
        let fontSize=this.props.buttonSize*scale/4.0;
        let mainItems=[];
        let overflowItems=[];
        if (hasOverflow){
            //split the buttons into multiple lists
            for (let k in items){
                if (items[k].overflow ){
                    overflowItems.push(items[k]);
                }
                else{
                    mainItems.push(items[k]);
                }
            }
            if (overflowItems.length > 0) {
                mainItems.push({
                    name: 'Overflow',
                    toggle: this.state.showOverflow,
                    onClick: (el)=> {
                        this.setState({showOverflow: !this.state.showOverflow})
                    }
                });
            }
            else {
                hasOverflow = false;
            }
        }
        else{
            mainItems=items;
        }
        if (hasOverflow){
            //we keep the cancel button separate at the top
            let topItems=[items.shift()];
            return <div className={"buttonContainerWrap "}>
                    <ItemList {...this.props}
                        fontSize={fontSize}
                        className={className + " main"}
                        itemList={mainItems}
                        itemClass={Dynamic(Button)}
                        />
                {this.state.showOverflow ?
                    <ItemList {...this.props}
                        fontSize={fontSize}
                        className={className + " overflow"}
                        itemList={overflowItems}
                        itemClass={Dynamic(Button)}
                        />
                    :
                    null
                }
                </div>
        }
        else {
            return <ItemList {...this.props}
                fontSize={fontSize}
                itemList={items}
                className={className +(this.props.buttonCols?" wrap":"")}
                itemClass={Dynamic(Button)}
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
        buttonCols: keys.properties.buttonCols,
        cancelTop: keys.properties.cancelTop,
        isEditing:keys.gui.global.layoutEditing
        },
    updateFunctionXX:(state)=> {
        let fontSize= state.buttonSize / 4;
        let buttonScale=1;
        let maxButtons=state.maxButtons;
        if (state.dimensions && state.buttonHeight) {
            let height = state.dimensions.height;
            if (height !== undefined && height > 0) {
                let buttonHeight = state.buttonHeight*state.maxButtons; //TODO: should we get this from CSS?
                buttonScale = height / buttonHeight;
            }
            if (buttonScale > 1) buttonScale = 1;
        }
        return{
            fontSize: fontSize,
            buttonCols: state.buttonCols,
            cancelTop: state.cancelTop,
            buttonScale: buttonScale,
            buttonHeight: scale.buttonHeight
        };
    }
});