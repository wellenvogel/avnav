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
        this.buttonChanged=this.buttonChanged.bind(this);
        this.state={showOverflow:false};
    }
    itemSort(a,b){
        if (! this.props.cancelTop) return 0;
        if (a.name == 'Cancel') return -1;
        return 0;
    }
    getStateKey(props){
        if (!props || ! props.name) return;
        return "button-"+props.name;
    }

    /**
     * whenever the values for a buttons are changing
     * we recompute the visibility
     * this way we always have a clear picture about the visible buttons
     * @param values the currently active values for the button
     */
    buttonChanged(values){
        if (! values || ! values.name) return;
        let visible=this.buttonVisible(values);
        let stateKey=this.getStateKey(values);
        if (this.state[stateKey] === visible) return;
        let ns={};
        ns[stateKey]=visible;
        this.setState(ns);
    }

    buttonVisible(item){
        if (item.visible !== undefined && ! item.visible) return false;
        if (item.editDisable && this.props.isEditing) return false;
        if (item.editOnly && ! this.props.isEditing) return false;
        return true;
    }

    render(){
        let className=this.props.className||"";
        className+=" buttonContainer ";
        let listHeight=(this.props.dimensions)?this.props.dimensions.height:0;
        let items=[];
        //we must render all invsible buttons to be sure to get called back
        //if their visibility changes
        let invisibleItems=[];
        for (let k in this.props.itemList){
            let stateKey=this.getStateKey(this.props.itemList[k]);
            if (!stateKey) continue;
            if (this.state[stateKey] === undefined || this.state[stateKey]){
                items.push(this.props.itemList[k]);
            }
            else{
                invisibleItems.push(this.props.itemList[k]);
            }
        }
        items.sort(this.itemSort);
        let maxButtons=this.props.maxButtons;
        if (this.props.buttonCols) maxButtons=Math.ceil(maxButtons/2);
        let scale=1;
        let hasOverflow=false;
        if (listHeight && this.props.buttonHeight){
            scale=listHeight/(this.props.buttonHeight*maxButtons);
            if (scale > 1) scale=1;
            if (items.length*this.props.buttonHeight*scale > listHeight) {
                hasOverflow=true;
            }
        }
        let fontSize=this.props.buttonSize*scale/4.0;
        let mainItems=[];
        let overflowItems=[];
        if (hasOverflow && !this.props.buttonCols){
            //split the buttons into multiple lists
            let maxInMain=Math.floor(listHeight/(this.props.buttonHeight*scale))-1;
            let inOverflow=items.length-maxInMain;
            for (let k=items.length-1;k>=0;k--){
                if (items[k].overflow && inOverflow){
                    overflowItems.splice(0,0,items[k]);
                    inOverflow--;
                }
                else{
                    mainItems.splice(0,0,items[k]);
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
                        itemClass={Dynamic(Button,{changeCallback:this.buttonChanged})}
                        />
                {this.state.showOverflow ?
                    <ItemList {...this.props}
                        fontSize={fontSize}
                        className={className + " overflow"}
                        itemList={overflowItems}
                        itemClass={Dynamic(Button,{changeCallback:this.buttonChanged})}
                        />
                    :
                    null
                }
                <ItemList className="hidden"
                          itemList={invisibleItems}
                          itemClass={Dynamic(Button,{changeCallback:this.buttonChanged})}
                    />
                </div>
        }
        else {
            let style={};
            if (hasOverflow && this.props.buttonCols ) style.width=(this.props.buttonWidth*scale*2)+"px";
            return <React.Fragment>
                <ItemList {...this.props}
                style={style}
                fontSize={fontSize}
                itemList={items}
                className={className +(this.props.buttonCols?" wrap":"")}
                itemClass={Dynamic(Button,{changeCallback:this.buttonChanged})}
                />
                <ItemList className="hidden"
                    itemList={invisibleItems}
                    itemClass={Dynamic(Button,{changeCallback:this.buttonChanged})}
                />
                </React.Fragment>
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