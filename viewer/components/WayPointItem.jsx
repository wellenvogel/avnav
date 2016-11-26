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
        addClass: React.PropTypes.string,
        showLatLon: React.PropTypes.bool,
        onItemClick:    React.PropTypes.func.isRequired
    },
    getDefaultProps(){
        return{
        };
    },
    onClick: function(){
      if (this.props.onItemClick) this.props.onItemClick(this.props);
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
        return(
        <div className={classNames} onClick={this.onClick} data-waypoint-idx={this.props.idx}>
            <div className="avn_route_info_name">{this.props.name}</div>
            <span className="avn_more"></span>
            {info}
        </div>
        );

    }
});