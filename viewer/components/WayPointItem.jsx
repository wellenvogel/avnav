/**
 * Created by andreas on 10.10.16.
 */
import React from 'react';
import reactCreateClass from 'create-react-class';
import PropTypes from 'prop-types';
import Formatter from '../util/formatter.js';
const WayPointItem =(props)=>{
        let info;
        if (props.showLatLon){
            info=<div className="info">{Formatter.formatLonLats(props)}</div>;
        }
        else{
            info=<div className="info">{Formatter.formatDirection(props.course)}&#176;/{Formatter.formatDistance(props.distance)}nm</div>;
        }
        let classNames="routeInfoPoint "+props.className||"";
        if (props.selected) classNames+=" activeEntry";
        return(
        <div className={classNames} onClick={(ev)=>{if (props.onClick)props.onClick(ev);}}>
            <div className="info">{props.name}</div>
            <span className="more"></span>
            {info}
        </div>
        );
};

WayPointItem.propTypes={
        idx:        PropTypes.number,
        name:       PropTypes.string,
        lat:        PropTypes.number,
        lon:        PropTypes.number,
        course:     PropTypes.number,
        distance:   PropTypes.number,
        className:  PropTypes.string,
        showLatLon: PropTypes.bool,
        onClick:    PropTypes.func,
        selected:   PropTypes.bool
    };

export default  WayPointItem;