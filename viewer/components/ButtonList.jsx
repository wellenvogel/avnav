import React from 'react';
import Button from './Button.jsx';
import Dynamic,{GetCurrentValues} from '../hoc/Dynamic.jsx';
import keys from '../util/keys.jsx';
import ItemList from './ItemList.jsx';
import PropertyHandler from '../util/propertyhandler.js';


class ButtonList extends React.Component{
    constructor(props){
        super(props);
        this.itemSort=this.itemSort.bind(this);
        this.state={showOverflow:false};
    }
    itemSort(a,b){
        if (! this.props.cancelTop) return 0;
        if (a.name == 'Cancel') return -1;
        return 0;
    }

    itemVisible(item){
        let itemv=GetCurrentValues(item);
        if (itemv.visible !== undefined && ! itemv.visible) return false;
        if (itemv.editDisable && this.props.isEditing) return false;
        if (itemv.editOnly && ! this.props.isEditing) return false;
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
        if (hasOverflow && !this.props.buttonCols){
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
        if (hasOverflow && !this.props.buttonCols){
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
            let style={};
            if (hasOverflow && this.props.buttonCols ) style.width=(this.props.buttonWidth*scale*2)+"px";
            return <ItemList {...this.props}
                style={style}
                fontSize={fontSize}
                itemList={items}
                className={className +(this.props.buttonCols?" wrap":"")}
                itemClass={Dynamic(Button)}
                />
        }
    }

}
module.exports=Dynamic(ButtonList,{
    storeKeys:{
        maxButtons:keys.properties.maxButtons,
        buttonHeight: keys.gui.global.computedButtonHeight,
        buttonWidth: keys.gui.global.computedButtonWidth,
        buttonSize: keys.properties.style.buttonSize,
        dimensions: keys.gui.global.windowDimensions,
        buttonCols: keys.properties.buttonCols,
        cancelTop: keys.properties.cancelTop,
        isEditing:keys.gui.global.layoutEditing
        }
});