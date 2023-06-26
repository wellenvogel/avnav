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
        if (this.props.itemList){
            for (let k in this.props.itemList){
                let key=this.getStateKey(this.props.itemList[k]);
                if (! key) continue;
                let visible=this.buttonVisible(this.props.itemList[k]);
                this.state[key]=visible;
            }
        }
        this.buttonListRef=this.buttonListRef.bind(this);
        this.buttonList=undefined;
        this.buttonListWidth=0;
    }
    itemSort(items){
        if (! this.props.cancelTop) return items;
        let rt=[];
        for (let round=0;round < 2;round++){
            items.forEach((item)=>{
                if ((round === 0 && item.name === 'Cancel')
                    ||(round !== 0 && item.name !== 'Cancel')){
                    rt.push(item);
                }
            })
        }
        return rt;
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
    buttonListRef(el){
        this.buttonList=el;
    }
    handleListCols(){
        if (! this.buttonList) return;
        let rect=this.buttonList.getBoundingClientRect();
        if (rect.width !== this.buttonListWidth){
            if (this.props.widthChanged){
                this.props.widthChanged(rect.width);
            }
            this.buttonListWidth=rect.width;
        }
    }

    componentDidMount() {
        this.handleListCols();
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        this.handleListCols();
    }

    render(){
        let className=this.props.className||"";
        className+=" buttonContainer ";
        if (this.props.hidden){
            className+=" buttonsHidden";
        }
        let listHeight=(this.props.dimensions)?this.props.dimensions.height:0;
        let items=[];
        //we must render all invsible buttons to be sure to get called back
        //if their visibility changes
        let invisibleItems=[];
        let allowedOverflowItems=0;
        for (let k in this.props.itemList){
            let stateKey=this.getStateKey(this.props.itemList[k]);
            if (!stateKey) continue;
            if (! this.props.hidden && (this.state[stateKey] === undefined || this.state[stateKey])){
                items.push(this.props.itemList[k]);
            }
            else{
                invisibleItems.push(this.props.itemList[k]);
            }
            if (this.props.itemList[k].overflow) allowedOverflowItems++;
        }
        items=this.itemSort(items);
        let scale = 1;
        let hasOverflow = false;
        let moveToOverflow = 0;
        if (! this.props.hidden) {
            /* strategy:
               add 1 to len for overflow button (cannot overflow) if buttonCols is not set
               check if we can overflow without scaling - overflow items will be at most == remaining
               compute scale based on remaining
             */
            if (listHeight && this.props.buttonHeight) {
                let completeLength = items.length;
                if (completeLength * this.props.buttonHeight > listHeight) {
                    if (!this.props.buttonCols) completeLength += 1; //overflow button
                    if (allowedOverflowItems > completeLength / 2) {
                        allowedOverflowItems = Math.floor(completeLength / 2);
                    }
                    while (moveToOverflow < allowedOverflowItems && ((completeLength - moveToOverflow) * this.props.buttonHeight > listHeight)) {
                        moveToOverflow++;
                    }
                    scale = listHeight / (this.props.buttonHeight * (completeLength - moveToOverflow));
                }
                if (scale > 1) scale = 1;
            }
        }
        let fontSize=this.props.buttonSize*scale/4.0;
        let mainItems=[];
        let overflowItems=[];
        if (!this.props.hidden) {
            //split the buttons into multiple lists
            for (let k = items.length - 1; k >= 0; k--) {
                if (items[k].overflow && moveToOverflow > 0) {
                    overflowItems.splice(0, 0, items[k]);
                    moveToOverflow--;
                    hasOverflow = true;
                } else {
                    mainItems.splice(0, 0, items[k]);
                }
            }
            if (overflowItems.length > 0 && !this.props.buttonCols) {
                mainItems.push({
                    name: 'Overflow',
                    toggle: this.state.showOverflow,
                    onClick: (el) => {
                        this.setState({showOverflow: !this.state.showOverflow})
                    }
                });
            }
        }
        if (hasOverflow) {
            if (!this.state.showOverflow && !this.props.buttonCols) {
                //add currently invisible items to the invisible list
                //to get changeCallbacks
                invisibleItems = invisibleItems.concat(overflowItems);

            }
        }
        return (
             <div className={"buttonContainerWrap "} ref={this.buttonListRef}>
                 {(!this.props.hidden) && <ItemList {...this.props}
                          fontSize={fontSize}
                          className={className + " main"}
                          itemList={mainItems}
                          itemClass={Dynamic(Button, {changeCallback: this.buttonChanged})}
                />
                }
                {(hasOverflow && (this.state.showOverflow || this.props.buttonCols)) ?
                    <ItemList {...this.props}
                              fontSize={fontSize}
                              className={className + " overflow"}
                              itemList={overflowItems}
                              itemClass={Dynamic(Button, {changeCallback: this.buttonChanged})}
                    />
                    :
                    null
                }
                <ItemList className="hidden"
                          itemList={invisibleItems}
                          itemClass={Dynamic(Button, {changeCallback: this.buttonChanged})}
                />
                 {this.props.hidden &&
                 <div
                     className={"buttonShade "+(this.props.showShade?"shade":"")}
                     style={{width: this.props.buttonWidth}}
                     onClick={this.props.shadeCallback}
                 />
                 }
            </div>
        )
    }

}
export default Dynamic(ButtonList,{
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