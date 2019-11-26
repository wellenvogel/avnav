/**
 * Created by andreas on 10.10.16.
 */
import React from 'react';
import PropTypes from 'prop-types';

let WayPointListItem=(props)=>{
   {
        let self=this;
        let classNames="avn_route_list_entry "+props.className||"";
        if (props.selected) classNames+=" activeEntry";
        return(
        <div className={classNames} onClick={props.onClick} >
            <button className="avn_route_btnDelete avn_smallButton"
                    onClick={function(ev){
                    ev.preventDefault();
                    ev.stopPropagation();
                    props.onClick('btnDelete');
                    }}/>
            <div className="avn_route_listname">{props.name}</div>
            <div className="avn_route_listinfo">{props.latlon},&nbsp;{props.course}&#176;/{props.distance}nm</div>
            <div className="avn_route_targetImage"></div>
        </div>
        );
    }
};

WayPointListItem.propTypes={
        idx: PropTypes.number,
        name: PropTypes.string,
        latlon: PropTypes.string,
        course: PropTypes.string,
        distance: PropTypes.string,
        className: PropTypes.string,
        onClick:  PropTypes.func.isRequired,
        selected: PropTypes.bool
};

module.exports=WayPointListItem;