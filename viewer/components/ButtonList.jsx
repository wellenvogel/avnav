import React, {useCallback, useEffect, useRef, useState} from 'react';
import Button from './Button.jsx';
import Dynamic, {dynamicWrapper, useStore} from '../hoc/Dynamic.jsx';
import keys from '../util/keys.jsx';
import ItemList from './ItemList.jsx';
import PropTypes from "prop-types";


const ButtonList = (iprops) => {
    const props=useStore(iprops,{
        storeKeys: {
            maxButtons: keys.properties.maxButtons,
            buttonHeight: keys.gui.global.computedButtonHeight,
            buttonWidth: keys.gui.global.computedButtonWidth,
            buttonSize: keys.properties.style.buttonSize,
            dimensions: keys.gui.global.windowDimensions,
            buttonCols: keys.properties.buttonCols,
            cancelTop: keys.properties.cancelTop,
            isEditing: keys.gui.global.layoutEditing,
            showShade:keys.properties.showButtonShade
        }})
    const [showOverflow, setShowOverflow] = useState(false);
    const getStateKey = useCallback((iprops) => {
        if (!iprops || !iprops.name) return;
        return "button-" + iprops.name;
    }, []);
    const buttonVisible = useCallback((itemprops) => {
        const item=dynamicWrapper(itemprops);
        if (item.visible !== undefined && !item.visible) return false;
        if (item.editDisable && props.isEditing) return false;
        if (item.editOnly && !props.isEditing) return false;
        return true;
    }, [props.isEditing]);
    const computeVisibility=useCallback((items)=>{
        let rt={};
        if (!items) return;
        for (let k in items) {
            let key = getStateKey(items[k]);
            if (!key) continue;
            let visible = buttonVisible(items[k]);
            rt[key] = visible;
        }
        return rt;
    },[buttonVisible])
    const [visibility, setVisibilityImpl] = useState(computeVisibility(props.itemList));
    const buttonListRef = useRef();
    const buttonListWidth = useRef(0);
    const setVisbility = useCallback((key, value) => setVisibilityImpl((old) => {
        let rt = {...old};
        rt[key] = value;
        return rt;
    }), []);
    useEffect(() => {
        if (props.itemList) {
            setVisibilityImpl(computeVisibility(props.itemList));
        }
    }, [props.itemList]);
    const itemSort = (items) => {
        if (!props.cancelTop) return items;
        let rt = [];
        for (let round = 0; round < 2; round++) {
            items.forEach((item) => {
                if ((round === 0 && item.name === 'Cancel')
                    || (round !== 0 && item.name !== 'Cancel')) {
                    rt.push(item);
                }
            })
        }
        return rt;
    }


    /**
     * whenever the values for a buttons are changing
     * we recompute the visibility
     * this way we always have a clear picture about the visible buttons
     * @param values the currently active values for the button
     */
    const buttonChanged = (values) => {
        if (!values || !values.name) return;
        let visible = buttonVisible(values);
        let stateKey = getStateKey(values);
        if (visibility[stateKey] === visible) return;
        setVisbility(stateKey, visible);
    }
    useEffect(() => {
        if (!buttonListRef.current) return;
        let rect = buttonListRef.current.getBoundingClientRect();
        if (rect.width !== buttonListWidth.current) {
            if (props.widthChanged) {
                props.widthChanged(rect.width);
            }
            buttonListWidth.current = rect.width;
        }
    });

    let className = props.className || "";
    className += " buttonContainer ";
    if (props.buttonsHidden) {
        className += " buttonsHidden";
    }
    let listHeight = (props.dimensions) ? props.dimensions.height : 0;
    let items = [];
    //we must render all invsible buttons to be sure to get called back
    //if their visibility changes
    let invisibleItems = [];
    let allowedOverflowItems = 0;
    for (let k in props.itemList) {
        let stateKey = getStateKey(props.itemList[k]);
        if (!stateKey) continue;
        if (!props.buttonsHidden && (visibility[stateKey] === undefined || visibility[stateKey])) {
            items.push(props.itemList[k]);
            if (props.itemList[k].overflow) allowedOverflowItems++;
        } else {
            invisibleItems.push(props.itemList[k]);
        }
    }
    items = itemSort(items);
    let scale = 1;
    let hasOverflow = false;
    let moveToOverflow = 0;
    if (!props.buttonsHidden) {
        /* strategy:
           add 1 to len for overflow button (cannot overflow) if buttonCols is not set
           check if we can overflow without scaling - overflow items will be at most == remaining
           compute scale based on remaining
         */
        if (listHeight && props.buttonHeight) {
            let completeLength = items.length;
            if (completeLength * props.buttonHeight > listHeight) {
                if (!props.buttonCols) completeLength += 1; //overflow button
                if (allowedOverflowItems > completeLength / 2) {
                    allowedOverflowItems = Math.floor(completeLength / 2);
                }
                while (moveToOverflow < allowedOverflowItems && ((completeLength - moveToOverflow) * props.buttonHeight > listHeight)) {
                    moveToOverflow++;
                }
                scale = listHeight / (props.buttonHeight * (completeLength - moveToOverflow));
            }
            if (scale > 1) scale = 1;
        }
    }
    let fontSize = props.buttonSize * scale / 4.0;
    let mainItems = [];
    let overflowItems = [];
    if (!props.buttonsHidden) {
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
        if (overflowItems.length > 0 && !props.buttonCols) {
            mainItems.push({
                name: 'Overflow',
                toggle: showOverflow,
                onClick: (el) => {
                    setShowOverflow((old) => !old)
                }
            });
        }
    }
    if (hasOverflow) {
        if (!showOverflow && !props.buttonCols) {
            //add currently invisible items to the invisible list
            //to get changeCallbacks
            invisibleItems = invisibleItems.concat(overflowItems);

        }
    }
    return (
        <div className={"buttonContainerWrap "} ref={buttonListRef}>
            {(!props.buttonsHidden) && <ItemList {...props}
                                          fontSize={fontSize}
                                          className={className + " main"}
                                          itemList={mainItems}
                                          itemClass={Dynamic(Button, {changeCallback: buttonChanged})}
            />
            }
            {(hasOverflow && (showOverflow || props.buttonCols)) ?
                <ItemList {...props}
                          fontSize={fontSize}
                          className={className + " overflow"}
                          itemList={overflowItems}
                          itemClass={Dynamic(Button, {changeCallback: buttonChanged})}
                />
                :
                null
            }
            <ItemList className="hidden"
                      itemList={invisibleItems}
                      itemClass={Dynamic(Button, {changeCallback: buttonChanged})}
            />
            {props.buttonsHidden &&
                <div
                    className={"buttonShade " + (props.showShade ? "shade" : "")}
                    style={{width: props.buttonWidth}}
                    onClick={props.shadeCallback}
                />
            }
        </div>
    )

}
export default ButtonList;

ButtonList.propTypes={
    itemList: PropTypes.array.isRequired,
    widthChanged: PropTypes.func,
    className: PropTypes.string,
    buttonsHidden: PropTypes.bool,
    shadeCallback: PropTypes.func
}