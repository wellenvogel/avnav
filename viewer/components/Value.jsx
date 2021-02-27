import React from 'react';
import PropTypes from 'prop-types';

/**
 * value display with replacing all leading spaces with invisible "0"
 * @param props
 * @constructor
 */
const Value=function(props){
    if (! props.value) return null;
    let prefix=(props.value+"").replace(/[^ ].*/,'');
    let remain=(props.value+"").replace(/^ */,'');
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