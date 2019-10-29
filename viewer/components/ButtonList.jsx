import React from 'react';
import Button from './Button.jsx';
import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import keys from '../util/keys.jsx';
import ItemList from './ItemList.jsx';

const DynamicList=Dynamic(ItemList);
module.exports=function(props){
    let className=props.className||"";
    className+=" buttonContainer";
    return <DynamicList {...props}
        className={className}
        itemClass={Dynamic(Visible(Button))}
        storeKeys={{fontSize:keys.gui.global.buttonFontSize}}/>
};