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
import PropTypes from 'prop-types';
import {SortContext, SortModes, useAvNavSortFrame} from "../hoc/Sortable";
import {injectav} from "../util/helper";

const getKey=function(obj,opt_keyFunction){
    if (opt_keyFunction){
        return opt_keyFunction(obj);
    }
    let rt=obj.key;
    if (rt !== undefined) return rt;
    rt=obj.name;
    return rt;
};


const Content=(props)=>{
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
            {props.allitems.map(function (entry) {
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
                    onClick=(idata)=>{
                        const data=injectav(idata);
                        if (data && data.stopPropagation) data.stopPropagation();
                        if (data && data.preventDefault) data.preventDefault();
                        if (props.reverse){
                            let len=props.itemList?props.itemList.length:0;
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

const SortableContent =
    (sprops) => {
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

const ItemList = (props) => {
    const itemList = [];
    const existingKeys = {};
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
    let style = props.style || {};
    if (props.fontSize) {
        style.fontSize = props.fontSize;
    }

    if (props.scrollable) {
        return (
            <div onClick={props.onClick} className={className} style={style} ref={(el) => {
                if (props.listRef) props.listRef(el)
            }}>
                <SortableContent className="listScroll" {...props} allitems={itemList}/>
            </div>
        );
    } else {
        return (
            <SortableContent className={className} {...props} allitems={itemList}
                             style={style}/>
        );
    }
}

ItemList.propTypes={
        onItemClick:    PropTypes.func, //will be called with 2 parameters:
                                        //1st: the item description, 2nd: the data provided by the item
        itemClass:      PropTypes.any, //one of itemClass or itemCreator must be set
        itemCreator:    PropTypes.func,
        itemList:       PropTypes.array,
        className:      PropTypes.string,
        scrollable:     PropTypes.bool,
        hideOnEmpty:    PropTypes.bool,
        fontSize:       PropTypes.any,
        listRef:        PropTypes.func,
        selectedIndex:  PropTypes.number,
        onClick:        PropTypes.func,
        dragdrop:       PropTypes.bool,
        horizontal:     PropTypes.bool,
        reverse:        PropTypes.bool, //let the index count backwards
        onSortEnd:      PropTypes.func,
        style:          PropTypes.object,
        dragFrame:      PropTypes.string,
        allowOther:     PropTypes.bool, //allow dragging from other frames
        keyFunction:    PropTypes.func
};
Content.propTypes=ItemList.propTypes;
export default ItemList;