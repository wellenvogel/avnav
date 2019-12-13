/**
 * Created by andreas on 10.10.16.
 */
import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button.jsx';

let WayPointListItem=(props)=>{
   {
        let self=this;
        let classNames="listEntry waypointListItem "+props.className||"";
        if (props.selected) classNames+=" activeEntry";
        return(
        <div className={classNames} onClick={props.onClick} >
            <Button className="Delete smallButton"
                    onClick={function(ev){
                    ev.preventDefault();
                    ev.stopPropagation();
                    props.onClick('btnDelete');
                    }}/>
            <div className="name">{props.name}</div>
            <div className="info">{props.latlon},&nbsp;{props.course}&#176;/{props.distance}nm</div>
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