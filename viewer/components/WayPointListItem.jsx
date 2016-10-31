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
        onClick:    React.PropTypes.func.isRequired
    },
    getDefaultProps(){
        return{
        };
    },
    render: function(){
        var info;
        var self=this;
        var classNames="avn_route_list_entry "+this.props.addClass||"";
        return(
        <div className={classNames} onClick={this.props.onClick} data-waypoint-idx={this.props.idx}>
            <button className="avn_route_btnDelete avn_smallButton"
                    onClick={function(ev){self.props.onClick(ev,'btnDelete');}}></button>
            <div className="avn_route_listname">{this.props.name}</div>
            <div className="avn_route_listinfo">{this.props.latlon},&nbsp;>{this.props.course}&#176;/{this.props.distance}nm</div>
        </div>
        );
    }
});