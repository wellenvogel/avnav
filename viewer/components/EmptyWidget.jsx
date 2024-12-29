/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const EmptyWidget =(props)=>{
        return (
        <WidgetFrame {...props} >
        </WidgetFrame>
        );
    }

EmptyWidget.propTypes={
    ...WidgetProps,
    classes: PropTypes.string
};

export default EmptyWidget;