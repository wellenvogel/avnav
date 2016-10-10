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
            <div className="reactContainer">
                { waypoints.map(function (entry) {
                    var selected=entry.idx == self.state.selectedIdx;
                    var centered=entry.idx == self.state.centeredIdx;
                    var addClass="";
                    if (selected) addClass+=" avn_route_info_active_point";
                    if (centered) addClass+=" avn_route_info_centered";
                    if (self.state.showLatLon) entry.showLatLon=true;
                    var clickHandler=function(ev){
                        ev.preventDefault();
                        self.props.onClick(entry.idx,{
                            centered:centered,
                            selected: selected
                        });
                        return false;
                    };

                    return <Item {...entry}
                        onClick={clickHandler}
                        addClass={addClass}
                    ></Item>;
                })}
            </div>
        );

    }
});