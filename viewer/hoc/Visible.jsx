import React from 'react';

/**
 * adds a visible property to the component
 * @param Component
 * @returns {Function}
 * @constructor
 */
const Visible=function(Component){
    return (props)=>{
        if (props !== undefined && props.visible !== undefined && ! props.visible) return null;
        let {visible,...compProp}=props;
        return <Component {...compProp}/>;
    }
};

export default Visible;