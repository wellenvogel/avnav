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

const getKey=function(obj){
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
                if (!itemProps.onClick && props.onItemClick) {
                    itemProps.onClick=(data)=>{
                        if (data && data.stopPropagation) data.stopPropagation();
                        if (data && data.preventDefault) data.preventDefault();
                        if (props.reverse){
                            let len=props.itemList?props.itemList.length:0;
                            props.onItemClick({...itemProps,index:len-itemProps.index},data);
                        }
                        else {
                            props.onItemClick(itemProps, data);
                        }
                    }
                }
                return <ItemClass key={itemProps.key} {...itemProps}/>
            })}
        </div>
    );
};

const ItemList = (props) => {
    const itemList = [];
    const existingKeys = {};
    let idx = 0;
    const allitems = props.itemList || [];
    allitems.forEach((entry) => {
        const itemProps = {...entry};
        let key = getKey(entry);
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
    const SortableContent =
        (sprops) => {
            if (props.dragdrop) {
                return (
                    <SortContext
                        onDragEnd={props.onSortEnd}
                        id={props.dragFrame}
                        allowOther={props.allowOther}
                        reverse={props.reverse}
                        mode={props.horizontal? SortModes.horizontal:SortModes.vertical}>
                            <Content {...sprops}/>
                    </SortContext>
                )
            } else {
                return <Content {...sprops}/>
            }
        };
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
        allowOther:     PropTypes.bool //allow dragging from other frames
};
Content.propTypes=ItemList.propTypes;
export default ItemList;