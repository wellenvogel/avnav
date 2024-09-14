/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import {SortableProps} from "../hoc/Sortable";
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const EmptyWidget =(props)=>{
        return (
        <WidgetFrame {...props} >
        </WidgetFrame>
        );
    }

EmptyWidget.propTypes={
    ...SortableProps,
    ...WidgetProps,
    classes: PropTypes.string
};

export default EmptyWidget;