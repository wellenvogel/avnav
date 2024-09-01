/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetHead, WidgetProps} from "./WidgetBase";

const UndefinedWidget=(props)=>{
    useKeyEventHandler(props,"widget");
    const dd=useAvNavSortable(props.id);
    let classes="widget undefinedWidget";
    return (
        <div className={classes} onClick={props.onClick} style={props.style} {...dd}>
            <WidgetHead caption="Undefined Widget"/>
            <div className="resize">
            <div className='widgetData'>
                {props.name}
            </div>
            </div>
        </div>
        );
    }

UndefinedWidget.propTypes={
    ...SortableProps,
    ...WidgetProps
};


export default UndefinedWidget;