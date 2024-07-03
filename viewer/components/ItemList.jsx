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

import React, {useRef} from 'react';
import PropTypes from 'prop-types';
import {DndProvider, useDrag, useDrop} from 'react-dnd';
import {TouchBackend} from 'react-dnd-touch-backend';


const getKey=function(obj){
    let rt=obj.key;
    if (rt !== undefined) return rt;
    rt=obj.name;
    return rt;
};
const DDType="dd";
const DDItem=({ItemClass,...props})=>{
    const ref = useRef(null)
    const [{ handlerId }, drop] = useDrop({
        accept: DDType,
        collect(monitor) {
            return {
                handlerId: monitor.getHandlerId(),
            }
        },
        hover(item, monitor) {
            if (!ref.current) {
                return
            }
            const dragIndex = item.index
            const hoverIndex = index
            // Don't replace items with themselves
            if (dragIndex === hoverIndex) {
                return
            }
            // Determine rectangle on screen
            const hoverBoundingRect = ref.current?.getBoundingClientRect()
            // Get vertical middle
            const hoverMiddleY =
                (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
            // Determine mouse position
            const clientOffset = monitor.getClientOffset()
            // Get pixels to the top
            const hoverClientY = clientOffset.y - hoverBoundingRect.top
            // Only perform the move when the mouse has crossed half of the items height
            // When dragging downwards, only move when the cursor is below 50%
            // When dragging upwards, only move when the cursor is above 50%
            // Dragging downwards
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                return
            }
            // Dragging upwards
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                return
            }
            // Time to actually perform the action
            props.move(dragIndex, hoverIndex)
            // Note: we're mutating the monitor item here!
            // Generally it's better to avoid mutations,
            // but it's good here for the sake of performance
            // to avoid expensive index searches.
            item.index = hoverIndex
        },
    })
    const [{ isDragging }, drag] = useDrag({
        type: DDType,
        item: () => {
            return { id, index }
        },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    })
    const opacity = isDragging ? 0 : 1
    drag(drop(ref))
    return (
        <div ref={ref} style={{ opacity }} data-handler-id={handlerId}>
            <ItemClass {...props}/>
        </div>
    )
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
                if (!itemProps.onClick && props.onItemClick) {
                    itemProps.onClick = (ev) => {
                        if (ev.stopPropagation) ev.stopPropagation();
                        if (ev.preventDefault) ev.preventDefault();
                        if (props.reverse){
                            let len=props.itemList?props.itemList.length:0;
                            props.onItemClick({...itemProps,index:len-itemProps.index},ev);
                        }
                        else{
                            props.onItemClick(itemProps, ev);
                        }
                    }
                }
                idx++;
                if (props.dragdrop){
                    return <DDItem ItemClass={ItemClass} key={key}{...itemProps} onItemClick={props.onItemClick} move={(p1,p2)=>{
                        console.log("move",p1,p2);
                    }}/>
                }
                return <ItemClass key={key} {...itemProps} onItemClick={props.onItemClick}/>
            })}
        </div>
    );
};

const DDContent=({Content,...props})=>{
    return <DndProvider backend={TouchBackend}>
        <Content {...props}/>
    </DndProvider>
}

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
        let ContentEl=props.dragdrop?(props)=><DDContent Content={Content} {...props}/>:Content;
        if (props.scrollable) {
            return (
                <div onClick={props.onClick} className={className} style={style} ref={(el)=>{if (props.listRef) props.listRef(el)}}>
                    <ContentEl className="listScroll" {...props} allitems={itemList} />
                </div>
            );
        }
        else {
            return(
                <ContentEl className={className} {...props} allitems={itemList} style={style} />
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
        style:          PropTypes.object
};

export default ItemList;