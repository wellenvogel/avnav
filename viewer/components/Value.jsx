import React from 'react';
import PropTypes from 'prop-types';

/**
 * value display with replacing all leading spaces with invisible "0"
 * @param props
 * @constructor
 */
const Value=function(props){
    if (! props.value) return null;
    let val=''+props.value;
    val=val.replaceAll('-','\u2012'); // replace - by digit wide hyphen (figure dash)
    val=val.replaceAll(':','\uA789'); // replace : with raised colon, looks better in time format 00:00
    let prefix=val.replace(/[^ ].*/,'');
    let remain=val.replace(/^ */,'');
    return(
        <React.Fragment>
            <span className='valuePrefix'>{prefix.replace(/ /g,'0')}</span>
            <span className='valueData'>{remain}</span>
        </React.Fragment>
    )
}

Value.propTypes={
    value: PropTypes.string
}
export default Value;
