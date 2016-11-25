/**
 * Created by andreas on 10.10.16.
 * an itemlist to display items of a common type
 * it is able to handle a couple of selectors to add classes to the items
 */

var React=require('react');



module.exports=React.createClass({
    propTypes:{
        onClick:    React.PropTypes.func,
        itemClass:  React.PropTypes.func.isRequired,
        updateCallback: React.PropTypes.func,
        selectors:  React.PropTypes.object,
        initialList: React.PropTypes.array
    },
    getInitialState: function(){
        var itemList=[];
        if (this.props.initialList) itemList=this.props.initialList;
        var st= {
            itemList: itemList,
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
                    var prop=avnav.assign({},entry,self.state.options||{});
                    var clickHandler=function(ev,opt_item){
                        if (! self.props.onClick) return;
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

    },
    /**
     * set the new list of items
     * @param items
     */
    setItems: function(items){
        this.setState({
           itemList: items
        });
    }
});