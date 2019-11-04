/**
 * Created by andreas on 25.11.16.
 */
var Store=require('../util/store');
var ItemList=require('./ItemListOld.jsx');
var React=require('react');
var reactCreateClass=require('create-react-class');
var PropTypes=require('prop-types');
var assign=require('object-assign');

//properties to be filtered away from the buttons
const FILTER_PROPERTIES=['url','icon','android','toggle','title','addClass','onItemClick'];
/**
 * a button list
 * it will use an ItemList
 * the key property of each item must be the button name
 * this will be used to add a class avb_<key> and to call the appropriate function btn<Key> at the button handler
 * if the toggle property is set, the button will have avb_toggleButton added and the avn_buttonActive, avn_buttonInactive added
 * 
 * @returns {*} the wrapped react class
 * @constructor
 */
var ButtonList= reactCreateClass({
    propTypes: {
        itemList: PropTypes.array.isRequired,
        buttonHandler: PropTypes.object.isRequired,
        visibilityFlags: PropTypes.object, //each key given will be compared with the item keys to decide the visibility
        fontSize: PropTypes.number.isRequired,
        className: PropTypes.string
    },
    onItemClick: function(item){
        if (! this.props.buttonHandler) return;
        var proto = Object.getPrototypeOf(this.props.buttonHandler);
        var f = proto['btn' + item.key];
        if (f) {
            f.call(this.props.buttonHandler);
            return;
        }
        f = proto['btnAny'];
        if (f) {
            f.call(this.props.buttonHandler,item.key);
        }
    },
    computeButtonList:function(from){
        if (! from.itemList) return from;
        var newItemList=[];
        for (var idx in from.itemList){
            var item=avnav.assign({},from.itemList[idx]);
            var skip=false;
            if (this.props.visibilityFlags){
                for (var vkey in this.props.visibilityFlags){
                    if (item[vkey] !== undefined){
                        if (item[vkey] != this.props.visibilityFlags[vkey]) {
                            skip=true;
                            break;
                        }
                    }
                }
            }
            if (skip) continue;
            var addClass="avn_button avb_"+item.key;
            if (item.toggle !== undefined){
                addClass+=" avb_toggleButton ";
                if (item.toggle) addClass+="avn_buttonActive";
                else addClass+="avn_buttonInactive"
            }
            item.addClass=item.addClass?(item.addClass+" "+addClass):addClass;
            newItemList.push(item);
        }
        var buttonCreator=function(props){
            if (props.icon !== undefined) {
                props.style=assign({},props.style,{backgroundImage:"url("+props.icon+")"});
                delete props.icon;
            }
            FILTER_PROPERTIES.forEach(function(fe){
               if (props[fe] !== undefined) delete props[fe];
            });
            return 'button';

        };
        return avnav.assign({},from,{itemList:newItemList,onItemClick: this.onItemClick,itemCreator:buttonCreator});
    },
    render: function () {
        var props=this.computeButtonList(this.props);
        return <ItemList {...props} childProperties={{style:{fontSize:this.props.fontSize}}}/>
    }
});

module.exports=ButtonList;