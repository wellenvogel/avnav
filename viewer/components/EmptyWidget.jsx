/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetProps} from "./WidgetBase";

const EmptyWidget =(props)=>{
    const ddProps=useAvNavSortable(props.dragId);
        let classes="widget "+props.classes||"";
        if (props.className) classes+=" "+props.className;
        const style={...props.style,...ddProps.style};
        return (
        <div className={classes} onClick={props.onClick} {...ddProps} style={style}>
        </div>
        );
    }

EmptyWidget.propTypes={
    ...SortableProps,
    ...WidgetProps,
    classes: PropTypes.string
};

export default EmptyWidget;