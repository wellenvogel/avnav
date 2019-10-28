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
import assign from 'object-assign';


const getKey=function(obj){
    let rt=obj.key;
    if (rt !== undefined) return rt;
    rt=obj.name;
    return rt;
};

class ItemList extends React.Component{
    constructor(props){
        super(props);
    }
    render() {
        let allitems = this.props.itemList || [];
        if (this.props.hideOnEmpty && allitems.length < 1) return null;
        let self = this;
        let className = "listContainer";
        if (this.props.scrollable) className+=" scrollable";
        if (this.props.className) className += " " + this.props.className;
        let Content=function(props) {
            return (
                <div className={props.className}>
                    {allitems.map(function (entry) {
                    let itemProps = assign({}, entry);
                    let key = getKey(entry);
                    itemProps.key = key;
                    if (!itemProps.onClick && self.props.onItemClick) {
                        itemProps.onClick = function (data) {
                            self.props.onItemClick(entry, data);
                        }
                    }
                    let ItemClass;
                    if (self.props.itemCreator) {
                        ItemClass = self.props.itemCreator(entry);
                        if (!ItemClass) return null;
                        return <ItemClass {...itemProps}/>
                    }
                    else {
                        ItemClass = self.props.itemClass;
                    }
                    return <ItemClass {...itemProps}/>
                })}
                </div>
            );
        };
        if (this.props.scrollable) {
            return (
                <div className={className}>
                    <Content className="listScroll"/>
                </div>
            );
        }
        else {
            return (
                <Content className={className}/>
            );
        }
    }


}

ItemList.propTypes={
    onItemClick:    PropTypes.func,
        itemClass:      PropTypes.any, //one of itemClass or itemCreator must be set
        itemCreator:    PropTypes.func,
        itemList:       PropTypes.array,
        className:      PropTypes.string,
        scrollable:     PropTypes.bool,
        hideOnEmpty:    PropTypes.bool
};

module.exports=ItemList;