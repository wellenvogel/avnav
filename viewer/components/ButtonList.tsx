import React, {useCallback, useEffect, useRef, useState} from 'react';
import Button, {ButtonDef, ButtonEvent, DynamicButtonProps} from './Button';
import {dynamicWrapper, useStore} from '../hoc/Dynamic';
import keys from '../util/keys';
import ItemList from './ItemList';
import Helper from "../util/helper";
import {PageType} from "../util/pageids";
import {addonViewManager} from "./AddonView";

const storeKeys={
    maxButtons: keys.properties.maxButtons,
    buttonHeight: keys.gui.global.computedButtonHeight,
    buttonWidth: keys.gui.global.computedButtonWidth,
    buttonSize: keys.properties.style.buttonSize,
    dimensions: keys.gui.global.windowDimForce,
    buttonCols: keys.properties.buttonCols,
    isEditing: keys.gui.global.layoutEditing,
    showShade:keys.properties.showButtonShade
}
export type ButtonDescription=ButtonDef|DynamicButtonProps;
export interface ButtonListProps{
    page?: PageType;
    itemList: ButtonDescription[];
    widthChanged?: (width:number)=>void;
    className?: string;
    buttonsHidden?: boolean;
    shadeCallback?: ()=>void;
}

type ButtonListPropsI=ButtonListProps & Record<keyof typeof storeKeys,any>;

const ButtonList = (iprops:ButtonListProps) => {
    const sprops:ButtonListPropsI=useStore(iprops,{
        storeKeys: storeKeys})
    const [showOverflow, setShowOverflow] = useState(false);
    const getStateKey = useCallback((iprops:ButtonDescription) => {
        if (!iprops || !iprops.name) return;
        return "button-" + iprops.name;
    }, []);
    const buttonVisible = useCallback((itemprops:ButtonDescription) => {
        const item=dynamicWrapper(itemprops);
        if (item.visible !== undefined && !item.visible) return false;
        if (item.editDisable && sprops.isEditing) return false;
        if (item.editOnly && !sprops.isEditing) return false;
        return true;
    }, [sprops.isEditing]);
    const computeVisibility=useCallback((items:ButtonDescription[])=>{
        const rt:Record<string, boolean>={};
        if (!items) return;
        for (const k in items) {
            const key = getStateKey(items[k]);
            if (!key) continue;
            const visible = buttonVisible(items[k]);
            rt[key] = visible;
        }
        return rt;
    },[buttonVisible])
    const [visibility, setVisibilityImpl] = useState(computeVisibility(sprops.itemList));
    const buttonListRef = useRef<HTMLDivElement|null>(null);
    const buttonListWidth = useRef(0);
    const setVisbility = useCallback((key:string, value:boolean) => setVisibilityImpl((old) => {
        const rt = {...old};
        rt[key] = value;
        return rt;
    }), []);
    useEffect(() => {
        if (sprops.itemList) {
            setVisibilityImpl(computeVisibility(sprops.itemList));
        }
    }, [sprops.itemList]);


    /**
     * whenever the values for a buttons are changing
     * we recompute the visibility
     * this way we always have a clear picture about the visible buttons
     * @param values the currently active values for the button
     */
    const buttonChanged = (values:ButtonDescription) => {
        if (!values || !values.name) return;
        const visible = buttonVisible(values);
        const stateKey = getStateKey(values);
        if (visibility[stateKey] === visible) return;
        setVisbility(stateKey, visible);
    }
    const injectConfig=(button:ButtonDescription)=>{
        return {
            ...button,
            dataChanged:buttonChanged,
            onClick:(ev:ButtonEvent)=>{
                if (!button.isAddon){
                    addonViewManager.setPageAddon(iprops.page);
                }
                button.onClick(ev);
            },
            closeDialogs: (button.closeDialogs === undefined)?(iprops.page !== undefined):button.closeDialogs,
        }
    }
    useEffect(() => {
        if (!buttonListRef.current) return;
        const rect = buttonListRef.current.getBoundingClientRect();
        if (rect.width !== buttonListWidth.current) {
            if (sprops.widthChanged) {
                sprops.widthChanged(rect.width);
            }
            buttonListWidth.current = rect.width;
        }
    });

    const className=Helper.concatsp(sprops.className,"buttonContainer",
        sprops.buttonsHidden?"buttonsHidden":undefined);
    const listHeight = (sprops.dimensions) ? sprops.dimensions.height : 0;
    let items:ButtonDescription[] = [];
    //we must render all invsible buttons to be sure to get called back
    //if their visibility changes
    let invisibleItems:ButtonDescription[] = [];
    let allowedOverflowItems = 0;
    for (const button of sprops.itemList) {
        const stateKey = getStateKey(button);
        if (!stateKey) continue;
        if (!sprops.buttonsHidden && (visibility[stateKey] === undefined || visibility[stateKey])) {
            items.push(injectConfig(button));
            if (button.overflow) allowedOverflowItems++;
        } else {
            invisibleItems.push(injectConfig(button));
        }
    }
    let scale = 1;
    let hasOverflow = false;
    let moveToOverflow = 0;
    if (!sprops.buttonsHidden) {
        /* strategy:
           add 1 to len for overflow button (cannot overflow) if buttonCols is not set
           check if we can overflow without scaling - overflow items will be at most == remaining
           compute scale based on remaining
         */
        if (listHeight && sprops.buttonHeight) {
            let completeLength = items.length;
            if (completeLength * sprops.buttonHeight > listHeight) {
                if (!sprops.buttonCols) completeLength += 1; //overflow button
                if (allowedOverflowItems > completeLength / 2) {
                    allowedOverflowItems = Math.floor(completeLength / 2);
                }
                while (moveToOverflow < allowedOverflowItems && ((completeLength - moveToOverflow) * sprops.buttonHeight > listHeight)) {
                    moveToOverflow++;
                }
                scale = listHeight / (sprops.buttonHeight * (completeLength - moveToOverflow));
            }
            if (scale > 1) scale = 1;
        }
    }
    const fontSize = sprops.buttonSize * scale / 4.0;
    const mainItems:ButtonDescription[] = [];
    const overflowItems:ButtonDescription[] = [];
    if (!sprops.buttonsHidden) {
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
        if (overflowItems.length > 0 && !sprops.buttonCols) {
            mainItems.push({
                name: 'Overflow',
                toggle: showOverflow,
                onClick: () => {
                    setShowOverflow((old) => !old)
                }
            });
        }
    }
    if (hasOverflow) {
        if (!showOverflow && !sprops.buttonCols) {
            //add currently invisible items to the invisible list
            //to get changeCallbacks
            invisibleItems = invisibleItems.concat(overflowItems);

        }
    }
    return (
        <div className={"buttonContainerWrap "} ref={buttonListRef}>
            {(!sprops.buttonsHidden) && <ItemList {...sprops}
                                                  fontSize={fontSize}
                                                  className={className + " main"}
                                                  itemList={mainItems}
                                                  itemClass={Button}
            />
            }
            {(hasOverflow && (showOverflow || sprops.buttonCols)) ?
                <ItemList {...sprops}
                          fontSize={fontSize}
                          className={className + " overflow"}
                          itemList={overflowItems}
                          itemClass={Button}
                />
                :
                null
            }
            <ItemList className="hidden"
                      itemList={invisibleItems}
                      itemClass={Button}
            />
            {sprops.buttonsHidden &&
                <div
                    className={"buttonShade " + (sprops.showShade ? "shade" : "")}
                    style={{width: sprops.buttonWidth}}
                    onClick={sprops.shadeCallback}
                />
            }
        </div>
    )

}
export default ButtonList;
