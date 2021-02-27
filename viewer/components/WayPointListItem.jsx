/**
 * Created by andreas on 10.10.16.
 */
import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button.jsx';
import Formatter from '../util/formatter.js';

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
            <div className="info">{Formatter.formatLonLats(props)},&nbsp;{Formatter.formatDirection(props.course)}&#176;/{Formatter.formatDistance(props.distance)}nm</div>
        </div>
        );
    }
};

WayPointListItem.propTypes={
        idx:        PropTypes.number,
        name:       PropTypes.string,
        course:     PropTypes.number,
        distance:   PropTypes.number,
        lat:        PropTypes.number,
        lon:        PropTypes.number,
        className:  PropTypes.string,
        onClick:    PropTypes.func.isRequired,
        selected:   PropTypes.bool
};

export default WayPointListItem;