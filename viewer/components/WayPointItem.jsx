/**
 * Created by andreas on 10.10.16.
 */
var React=require('react');

module.exports=React.createClass({
    propTypes:{
        idx: React.PropTypes.number,
        name: React.PropTypes.string,
        latlon: React.PropTypes.string,
        course: React.PropTypes.string,
        distance: React.PropTypes.string,
        showLatLon: React.PropTypes.bool,
        onClick:    React.PropTypes.func.isRequired,
        centered: React.PropTypes.bool,
        selected: React.PropTypes.bool
    },
    getDefaultProps(){
        return{
        };
    },
    render: function(){
        var info;
        if (this.props.showLatLon){
            info=<div className="avn_route_point_ll">{this.props.latlon}</div>;
        }
        else{
            info=<div className="avn_route_point_course">{this.props.course}&#176;/{this.props.distance}nm</div>;
        }
        var classNames="avn_route_info_point "+this.props.addClass||"";
        if (this.props.centered)classNames+=" avn_route_info_centered";
        if (this.props.selected)classNames+=" avn_route_info_active_point";
        return(
        <div className={classNames} onClick={this.clickHandler} data-waypoint-idx={this.props.idx}>
            <div className="avn_route_info_name">{this.props.name}</div>
            <span className="avn_more"></span>
            {info}
        </div>
        );

    },
    clickHandler: function(event){
        event.preventDefault();
        return this.props.onClick(event);
    }
});