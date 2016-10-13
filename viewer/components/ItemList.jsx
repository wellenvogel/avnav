/**
 * Created by andreas on 10.10.16.
 */

var React=require('react');
var Item=require('./WayPointItem.jsx');
var update=require('react-addons-update');


module.exports=React.createClass({
    propTypes:{
        onClick:    React.PropTypes.func.isRequired,
        itemClass:  React.PropTypes.func.isRequired,
        updateCallback: React.PropTypes.func,
        selectors:  React.PropTypes.object
    },
    getInitialState: function(){
        var st= {
            itemList: [],
            options: {}
        };
        if (this.props.selectors){
            st.selectors={};
            for (var k in this.props.selectors){
                st.selectors[k]=-1;
            }
        }
        return st;
    },
    render: function(){
        var items=this.state.itemList||[];
        var self=this;
        return(
            <div className="avn_listContainer">
                { items.map(function (entry) {
                    var opts={};
                    var addClass="";
                    var isSet=false;
                    var k;
                    if (self.props.selectors){
                        for (k in self.props.selectors){
                            isSet=self.state.selectors[k]==entry.idx;
                            opts[k]=isSet;
                            if (isSet) addClass+=" "+self.props.selectors[k];
                        }
                    }
                    var prop=avnav.clone(entry);
                    if (self.state.options){
                        for (k in self.state.options){
                            prop[k]=self.state.options[k];
                        }
                    }
                    var clickHandler=function(ev,opt_item){
                        ev.preventDefault();
                        ev.stopPropagation();
                        var clOpts=avnav.clone(opts);
                        if (opt_item) clOpts.item=opt_item;
                        self.props.onClick(entry.idx,clOpts);
                        return false;
                    };
                    prop.onClick=clickHandler;
                    prop.addClass=addClass;
                    return React.createElement(self.props.itemClass,prop);
                })}
            </div>
        );

    },
    componentDidUpdate: function(prevProp,prevState){
        if (this.props.updateCallback){
            this.props.updateCallback();
        }
    },
    /**
     * be sure to call this only once before an new render has been done
     * @param idx
     * @param selector
     * @returns {boolean}
     */
    setSelectors: function(idx: Number, selectors: Array){
        if (! selectors) return;
        var nsel=avnav.clone(this.state.selectors);
        for (var i=0;i<selectors.length;i++) {
            if (this.props.selectors && this.props.selectors[selectors[i]]){
                nsel[selectors[i]]=idx;
            }
        }
        this.setState({
            selectors: nsel
        });

    }
});