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
        onClick:  PropTypes.func.isRequired
    },
    getDefaultProps(){
        return{
        };
    },
    onClick:function(opt_key){
        if (this.props.onClick) this.props.onItemClick(this.props,opt_key);
    },
    render: function(){
        var info;
        var self=this;
        var classNames="avn_route_list_entry "+this.props.addClass||"";
        return(
        <div className={classNames} onClick={self.props.onClick} >
            <button className="avn_route_btnDelete avn_smallButton"
                    onClick={function(ev){
                    ev.preventDefault();
                    ev.stopPropagation();
                    self.props.onClick('btnDelete');
                    }}/>
            <div className="avn_route_listname">{this.props.name}</div>
            <div className="avn_route_listinfo">{this.props.latlon},&nbsp;{this.props.course}&#176;/{this.props.distance}nm</div>
            <div className="avn_route_targetImage"></div>
        </div>
        );
    }
});