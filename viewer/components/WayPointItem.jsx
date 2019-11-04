/**
 * Created by andreas on 10.10.16.
 */
var React=require('react');
var reactCreateClass=require('create-react-class');
var PropTypes=require('prop-types');

module.exports=reactCreateClass({
    propTypes:{
        idx: PropTypes.number,
        name: PropTypes.string,
        latlon: PropTypes.string,
        course: PropTypes.string,
        distance: PropTypes.string,
        addClass: PropTypes.string,
        showLatLon: PropTypes.bool,
        onItemClick:    PropTypes.func.isRequired
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