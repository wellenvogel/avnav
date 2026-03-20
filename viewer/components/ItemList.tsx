/**
 * Created by andreas on 10.10.16.
 * an itemlist to display items of a common type
 * it is able to handle a couple of selectors to add classes to the items
 * the itemClick callback will have the item from the list
 * that has a "true" value for each selector where the item key is the value in the property "selectors"
 * child items will have an onClick and an onItemClick
 * the onClick will insert the current item properties as first parameter and pass the provided parameter
 *             (if not being the event object) as second
 * ths onIemClick will directly pass through
 */

import React from 'react';
import {OnDragEnd, SortContext, SortModes, useAvNavSortFrame} from "../hoc/Sortable";
import {injectav} from "../util/helper";
import {ButtonEvent, ButtonEventHandler} from "./Button";

export type KeyFunction=(p:Record<string, any>)=>string

const getKey=(obj:Record<string,any>,opt_keyFunction?:KeyFunction)=>{
    if (opt_keyFunction){
        return opt_keyFunction(obj);
    }
    let rt=obj.key;
    if (rt !== undefined) return rt;
    rt=obj.name;
    return rt;
};

export interface Item extends Record<string, any> {}

interface ContentProps{
    className?:string
    style?:Record<string, any>
    onClick?:ButtonEventHandler
    onItemClick?: ButtonEventHandler
    itemClass?: React.ElementType                           //one of itemClass or itemCreator must be set
    itemCreator?: (item:Item)=>React.ElementType
    itemList: Item[],
    scrollable?: boolean
    hideOnEmpty?: boolean
    listRef?: (el:HTMLElement) => void
    selectedIndex?: number
    reverse?: boolean                               //let the index count backwards
}

const Content=(props:ContentProps)=>{
    const sortFrameProps=useAvNavSortFrame();
    return (
        <div {...sortFrameProps}
            className={props.className}
             style={props.style}
             ref={(el)=>{if (props.listRef) props.listRef(el)}}
             onClick={(ev)=>{
                 if (props.onClick){
                     ev.stopPropagation();
                     props.onClick(ev);
                 }
             }}
        >
            {props.itemList.map(function (entry) {
                const itemProps={...entry};
                let ItemClass;
                if (props.itemCreator) {
                    ItemClass = props.itemCreator(entry);
                    if (!ItemClass) return null;
                }
                else {
                    ItemClass = props.itemClass;
                }
                let onClick;
                if (!itemProps.onClick && props.onItemClick) {
                    onClick=(idata:ButtonEvent)=>{
                        const data=injectav(idata);
                        if (data && data.stopPropagation) data.stopPropagation();
                        if (data && data.preventDefault) data.preventDefault();
                        if (props.reverse){
                            const len=props.itemList?props.itemList.length:0;
                            data.avnav.item=data.avnav.item?{...data.avnav.item,index:len-itemProps.index}:{...itemProps,index:len-itemProps.index};
                        }
                        else {
                            data.avnav.item=data.avnav.item?{...data.avnav.item,index:itemProps.index}:{...itemProps};
                        }
                        props.onItemClick(data);
                    }
                }
                return <ItemClass onClick={onClick} key={itemProps.key} {...itemProps}/>
            })}
        </div>
    );
};

interface SortableContentProps extends ContentProps{
    horizontal?: boolean;
    allowOther?: boolean;
    dragFrame?: number;
    onSortEnd?: OnDragEnd;
    dragdrop?: boolean;

}

const SortableContent =
    (sprops:SortableContentProps) => {
        if (sprops.dragdrop) {
            return (
                <SortContext
                    onDragEnd={sprops.onSortEnd}
                    id={sprops.dragFrame}
                    allowOther={sprops.allowOther}
                    reverse={sprops.reverse}
                    mode={sprops.horizontal? SortModes.horizontal:SortModes.vertical}>
                    <Content {...sprops}/>
                </SortContext>
            )
        } else {
            return <Content {...sprops}/>
        }
    };

export interface ItemListProps extends SortableContentProps{
    keyFunction?:KeyFunction;
    fontSize?: string;
}

const ItemList = (props:ItemListProps) => {
    const itemList:any[] = [];
    const existingKeys:Record<string,boolean> = {};
    let idx = 0;
    const allitems = props.itemList || [];
    allitems.forEach((entry) => {
        const itemProps = {...entry};
        let key = getKey(entry,props.keyFunction);
        //we allow for multiple items with the same name
        //we try at most 20 times to get a unique key by appending _idx
        let tries = 20;
        while (tries > 0 && (!key || existingKeys[key])) {
            key += "_" + idx;
            tries--;
        }
        itemProps.index = props.reverse ? allitems.length - idx : idx;
        itemProps.key = key;
        if (props.dragdrop) {
            itemProps.dragId = idx;
        }
        existingKeys[key] = true;
        if (props.selectedIndex !== undefined) {
            if (idx == props.selectedIndex) {
                itemProps.selected = true;
            } else {
                itemProps.selected = false;
            }
        }
        idx++;
        itemList.push(itemProps);

    })

    if (props.hideOnEmpty && itemList.length < 1) return null;
    let className = "listContainer";
    if (props.scrollable) className += " scrollable";
    if (props.className) className += " " + props.className;
    if (props.horizontal) className += " horizontal";
    const style = props.style || {};
    if (props.fontSize) {
        style.fontSize = props.fontSize;
    }

    if (props.scrollable) {
        return (
            <div onClick={props.onClick} className={className} style={style} ref={(el) => {
                if (props.listRef) props.listRef(el)
            }}>
                <SortableContent className="listScroll" {...props} itemList={itemList}/>
            </div>
        );
    } else {
        return (
            <SortableContent className={className} {...props} itemList={itemList}
                             style={style}/>
        );
    }
}
export default ItemList;