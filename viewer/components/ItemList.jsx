/**
 * Created by andreas on 10.10.16.
 * an itemlist to display items of a common type
 * it is able to handle a couple of selectors to add classes to the items
 * the itemClick callback will have the item from the list + an added selectorState object
 * that has a "true" value for each selector where the item key is the value in the property "selectors"
 */

var React=require('react');



module.exports=React.createClass({
    propTypes:{
        onItemClick:    React.PropTypes.func,
        itemClass:  React.PropTypes.any, //one of itemClass or itemCreator must be set
        itemCreator:React.PropTypes.func,
        updateCallback: React.PropTypes.func,
        selectors:  React.PropTypes.object, //if a value from this object matches an item key
                                            //the key will be added as an additional class
        itemList: React.PropTypes.array,
        childProperties: React.PropTypes.object,
        className: React.PropTypes.string
    },
    getInitialState: function(){
        var itemList=[];
        if (this.props.itemList) itemList=this.props.itemList;
        var st= {
            itemList: itemList,
        };
        if (this.props.selectors){
            st.selectors=this.props.selectors;
        }
        return st;
    },
    componentWillReceiveProps:function(nextProps){
        var nstate={};
        if (nextProps.itemList) {
            nstate.itemList=nextProps.itemList;
        }
        if (nextProps.selectors){
            nstate.selectors=nextProps.selectors;
        }
        this.setState(nstate);
    },
    render: function(){
        var allitems=this.state.itemList||[];
        var self=this;
        var className="avn_listContainer";
        if (this.props.className) className+=" "+this.props.className;
        var items=[];
        for (var idx in allitems){
            if (allitems[idx].visible === undefined || allitems[idx].visible){
                items.push(allitems[idx]);
            }
        }
        return(
            <div className={className}>
                { items.map(function (entry) {
                    var opts = {};
                    var addClass = entry.addClass||"";
                    addClass+=" ";
                    var isSet = false;
                    var k;
                    var key = entry.key;
                    if (key !== undefined) {
                        if (self.state.selectors) {
                            for (k in self.state.selectors) {
                                isSet = self.state.selectors[k] == entry.key;
                                if (isSet) {
                                    addClass += " " + k;
                                }
                            }
                        }
                    }
                    var prop=avnav.assign({},entry,self.props.childProperties);
                    var clickHandler=function(opt_item,opt_data){
                        if (! self.props.onItemClick) return;
                        if (!opt_item) opt_item=prop;
                        self.props.onItemClick(opt_item,opt_data);
                        return false;
                    };
                    prop.onClick=function(data){
                        if (data.preventDefault){
                            data.preventDefault();
                            clickHandler();
                        }
                        else{
                            clickHandler(data);
                        }
                    };
                    prop.onItemClick=clickHandler;
                    prop.addClass=addClass;
                    prop.className=addClass;
                    var itemClass;
                    if (self.props.itemCreator){
                        //give the creator the chance to finally control all properties
                        itemClass=self.props.itemCreator(prop);
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