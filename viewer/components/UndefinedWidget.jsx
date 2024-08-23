/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetProps} from "./WidgetBase";

const UndefinedWidget=(props)=>{
    useKeyEventHandler(props,"widget");
    const dd=useAvNavSortable()
    let classes="widget undefinedWidget";
    return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style} {...dd}>
            <div className="resize">
            <div className='widgetData'>
                {this.props.name}
            </div>
            </div>
            <div className='infoLeft'>Undefined Widget</div>
        </div>
        );
    }

UndefinedWidget.propTypes={
    ...SortableProps,
    ...WidgetProps
};


export default UndefinedWidget;