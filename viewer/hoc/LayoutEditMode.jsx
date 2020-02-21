import React from 'react';
import Dynamic from './Dynamic.jsx';
import keys from '../util/keys.jsx';
/**
 * adds handling for the layout editing mode
 * @param Component
 * @returns {Function}
 * @constructor
 */
const LayoutEditMode=function(Component){
    let HComponent=function(props){
        let {editDisable,isEditing,editOnly,...compProps}=props;
        if (props.editDisable && props.isEditing) compProps.disabled=true;
        if (props.editOnly && ! props.isEditing) return null;
        return <Component {...compProps}/>;
    };
    return Dynamic(HComponent,{
        storeKeys:{isEditing:keys.gui.global.layoutEditing}
    })
};

module.exports=LayoutEditMode;