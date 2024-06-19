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

import React,{useState} from 'react';
import PropTypes from 'prop-types';
import assign from 'object-assign';


const getKey=function(obj){
    let rt=obj.key;
    if (rt !== undefined) return rt;
    rt=obj.name;
    return rt;
};

const ItemWrapper=(props)=>{
    let {ItemClass,...iprops}=props;
    const memoClick=(data)=>{
        if (data && data.stopPropagation) data.stopPropagation();
        if (data && data.preventDefault) data.preventDefault();
        if (props.reverse){
            let len=props.itemList?props.itemList.length:0;
            props.onItemClick(assign({},iprops,{index:len-iprops.index}),data);
        }
        else {
            props.onItemClick(iprops, data);
        }
    };
    return <ItemClass
        {...iprops}
        onClick={memoClick}
    />
}
const ItemWrapperNoClick=(props)=>{
    let {ItemClass,...iprops}=props;
    return <ItemClass
        {...iprops}
    />
}

const Content=(props)=>{
    let idx = 0;
    let existingKeys={};
    return (
        <div className={props.className}
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
                let itemProps ={...entry};
                let key = getKey(entry);
                //we allow for multiple items with the same name
                //we try at most 20 times to get a unique key by appending _idx
                let tries=20;
                while (tries > 0 && (! key || existingKeys[key])){
                    key+="_"+idx;
                    tries--;
                }
                itemProps.index=props.reverse?props.allitems.length-idx:idx;
                itemProps.key = key;
                existingKeys[key]=true;
                if (props.selectedIndex !== undefined){
                    if (idx == props.selectedIndex) {
                        itemProps.selected = true;
                    }
                    else {
                        itemProps.selected = false;
                    }
                }
                let ItemClass;
                if (props.itemCreator) {
                    ItemClass = props.itemCreator(entry);
                    if (!ItemClass) return null;
                }
                else {
                    ItemClass = props.itemClass;
                }
                if (props.dragdrop) {
                    //ItemClass=SortableElement(ItemClass);
                }
                let ItemWrapperEl;
                if (!itemProps.onClick && props.onItemClick) {
                    ItemWrapperEl=ItemWrapper;
                }
                else{
                    ItemWrapperEl=ItemWrapperNoClick;
                }
                idx++;

                return <ItemWrapperEl ItemClass={ItemClass} key={key} {...itemProps} onItemClick={props.onItemClick}/>
            })}
        </div>
    );
};

const ItemList=(props)=>{
    const itemList=props.itemList;
    /*
    onSortEnd(data){
        let len=this.props.itemList?this.props.itemList.length:0;
        if (this.props.reverse) {
            if (this.props.onSortEnd) this.props.onSortEnd(len-data.oldIndex,len- data.newIndex);
        }
        else{
            if (this.props.onSortEnd) this.props.onSortEnd(data.oldIndex, data.newIndex);
        }

    }
    */
        if (props.hideOnEmpty && itemList.length < 1) return null;
        let className = "listContainer";
        if (props.scrollable) className+=" scrollable";
        if (props.className) className += " " + props.className;
        if (props.horizontal) className += " horizontal";
        let style=props.style||{};
        if (props.fontSize){
            style.fontSize=props.fontSize;
        }

        let dragProps={};
        /*let Content=this.Content;
        if (this.props.dragdrop){
            Content= SortableContainer(Content);
            dragProps.axis=self.props.horizontal?"x":"y";
            dragProps.distance=20;
            dragProps.onSortEnd=self.onSortEnd;
            dragProps.helperClass="sortableHelper";

        }
         */
        if (props.scrollable) {
            return (
                <div onClick={props.onClick} className={className} style={style} ref={(el)=>{if (props.listRef) props.listRef(el)}}>
                    <Content className="listScroll" {...props} allitems={itemList} {...dragProps}/>
                </div>
            );
        }
        else {
            return(
                <Content className={className} {...props} allitems={itemList} style={style} {...dragProps}/>
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
        onSortEnd:      PropTypes.func
};

export default ItemList;