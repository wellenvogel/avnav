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

var React=require('react');
var assign=require('object-assign');


const getKey=function(obj){
    let rt=obj.key;
    if (rt !== undefined) return rt;
    rt=obj.name;
    return rt;
};

module.exports=React.createClass({
    propTypes:{
        onItemClick:    React.PropTypes.func,
        itemClass:  React.PropTypes.any, //one of itemClass or itemCreator must be set
        itemCreator:React.PropTypes.func,
        updateCallback: React.PropTypes.func,
        selectors:  React.PropTypes.object, //if a value from this object matches an item key
                                            //the key will be added as an additional class
        visibilityFlags: React.PropTypes.object, //if there is an entry for a particular item key
                                            //this will be considered for visibility
        itemList: React.PropTypes.array,
        childProperties: React.PropTypes.object,
        className: React.PropTypes.string,
        style: React.PropTypes.object,
        hidden: React.PropTypes.bool,
        hideOnEmpty: React.PropTypes.bool
    },
    render: function(){
        var allitems=this.props.itemList||[];
        if (this.props.hideOnEmpty && allitems.length < 1) return null;
        if (this.props.hidden) return null;
        var self=this;
        var className="avn_listContainer";
        if (this.props.className) className+=" "+this.props.className;
        var items=[];
        for (var idx in allitems){
            var vis=false;
            if (allitems[idx].visible === undefined || allitems[idx].visible){
                vis=true;
            }
            if (self.props.visibilityFlags && getKey(allitems[idx])){
                var flag=self.props.visibilityFlags[getKey(allitems[idx])];
                if (flag !== undefined){
                    vis=flag;
                }
            }
            if (vis)items.push(allitems[idx]);
        }
        return(
            <div className={className} style={this.props.style}>
                { items.map(function (entry) {
                    var opts = {};
                    var addClass = entry.addClass||"";
                    addClass+=" ";
                    var isSet = false;
                    var k;
                    var key = getKey(entry);
                    if (key !== undefined) {
                        if (self.props.selectors) {
                            for (k in self.props.selectors) {
                                isSet = self.props.selectors[k] == getKey(entry);
                                if (isSet) {
                                    addClass += " " + k;
                                }
                            }
                        }
                    }
                    var prop=assign({},entry,self.props.childProperties);
                    var clickHandler=function(opt_item,opt_data){
                        if (! self.props.onItemClick) return;
                        if (!opt_item) opt_item=prop;
                        self.props.onItemClick(opt_item,opt_data);
                        return false;
                    };
                    prop.onClick=function(data){
                        if (data.preventDefault){
                            data.preventDefault();
                            clickHandler(prop);
                        }
                        else{
                            clickHandler(prop,data);
                        }
                    };
                    prop.onItemClick=clickHandler;
                    prop.addClass=addClass;
                    prop.className=addClass;
                    prop.key=getKey(entry);
                    var itemClass;
                    if (self.props.itemCreator){
                        //give the creator the chance to finally control all properties
                        itemClass=self.props.itemCreator(prop);
                        if (! itemClass) return null;
                        return React.createElement(itemClass,prop);
                    }
                    else{
                        itemClass=self.props.itemClass;
                    }
                    return React.createElement(itemClass,prop);
                })}
            </div>
        );

    },
    componentDidUpdate: function(prevProp,prevState){
        if (this.props.updateCallback){
            this.props.updateCallback();
        }
    },
    componentDidMount: function(prevProp,prevState){
        if (this.props.updateCallback){
            this.props.updateCallback();
        }
    }
});