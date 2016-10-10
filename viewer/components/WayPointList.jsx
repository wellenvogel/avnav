/**
 * Created by andreas on 10.10.16.
 */

var React=require('react');
var Item=require('./WayPointItem.jsx');

module.exports=React.createClass({
    propTypes:{
        onClick:    React.PropTypes.func.isRequired
    },
    getInitialState: function(){
        return{
            waypoints:[],
            showLatLon: false,
            selectedIdx: -1,
            centeredIdx: -1
        }
    },
    render: function(){
        var waypoints=this.state.waypoints||[];
        var self=this;
        return(
            <div>
                { waypoints.map(function (entry) {
                    var selected=entry.idx == self.state.selectedIdx;
                    var centered=entry.idx == self.state.centeredIdx;
                    if (self.state.showLatLon) entry.showLatLon=true;
                    var clickHandler=function(ev){
                        self.props.onClick(entry.idx,{
                            centered:centered,
                            selected: selected
                        });
                        return false;
                    };

                    return <Item {...entry}
                        onClick={clickHandler}
                        selected={selected}
                        centered={selected}
                    ></Item>;
                })}
            </div>
        );

    }
});