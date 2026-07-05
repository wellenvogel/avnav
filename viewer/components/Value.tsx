import React from 'react';
import PropTypes from 'prop-types';

export interface ValueProps {
    value: number|string;
}
/**
 * value display with replacing all leading spaces with invisible "0"
 * @param props
 * @constructor
 */
const Value=function(props:ValueProps){
    if (! props.value) return null;
    let val=''+props.value;
    val=val.replace(/[-]/g,'\u2012'); // replace - by digit wide hyphen (figure dash)
    val=val.replace(/:/g,'\uA789'); // replace : with raised colon, looks better in time format 00:00
    const remain=val.replace(/^ */,'');
    const prfxlen=val.length-remain.length;
    return(
        <React.Fragment>
            <span className='valuePrefix'>{''.padEnd(prfxlen,'0')}</span>
            <span className='valueData'>{remain}</span>
        </React.Fragment>
    )
}

Value.propTypes={
    value: PropTypes.string
}
export default Value;