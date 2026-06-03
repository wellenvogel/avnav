/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import keys from '../util/keys';
import Formatter from '../util/formatter';
import {WidgetFrame} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";
import routeobjects from "../nav/routeobjects";
import Helper from '../util/helper';
import {IWidgetProps} from "../util/types";
import {Icon} from "./Icons";

const STORE_KEYS={
    isApproaching: keys.nav.route.isApproaching,
    routeName: keys.nav.route.name,
    eta: keys.nav.route.eta,
    remain: keys.nav.route.remain,
    nextCourse: keys.nav.route.nextCourse,
    isEditing: keys.gui.global.layoutEditing,
};
const EDITABLE={
    legacy:{type:'BOOLEAN',
        displayName:'legacy',
        default:false,
        description:"color the complete widget depending on the target state instead of only a badge"}
}

interface SecondRowProps{
    remain?:string,
    eta?:string,
    approach?:boolean,
    small?:boolean,
}
const SecondRow=({remain,eta,approach,small}:SecondRowProps)=>{
    return <div className={"secondRow"}>
        {(approach && ! small) && <Icon />}
        {(eta !== undefined) && <div className="routeEta">{eta}</div>}
        {(approach && small) && <Icon />}
        {
            (remain !== undefined) && <div>
                <span className="routeRemain">{remain}</span>
                <span className='unit'>nm</span>
            </div>
        }
    </div>
}

interface ActiveRouteWidgetProps extends IWidgetProps,
    Record<keyof typeof STORE_KEYS, any>,
    Record<keyof typeof EDITABLE, boolean>{}

const ActiveRouteWidget =(props:ActiveRouteWidgetProps)=>{
        if (!props.routeName && ! props.isEditing) return null;
        let classes = "activeRouteWidget";
        const approaching=props.isApproaching;
        if (approaching && props.legacy) classes += " approach ";
        const display={
            name:routeobjects.nameToBaseName(props.routeName),
            remain: Formatter.formatDistance(props.remain),
            eta: Formatter.formatTime(props.eta),
            next: Formatter.formatDirection(props.nextCourse),
        };
        const isServer=routeobjects.isServerName(props.routeName);
        const resizeSequence=useStringsChanged(display,props);
        const small = (props.mode === "horizontal");
        return (
            <WidgetFrame {...props} addClass={classes} caption="RTE" unit={undefined} resizeSequence={resizeSequence} disconnect={!isServer}>
                <div className={Helper.concatsp("widgetData",small?"small":undefined)}>
                    <div className="routeName">{display.name}</div>
                    {small && <SecondRow eta={display.eta} approach={approaching && ! props.legacy} remain={display.remain} small={small} />}
                    {!small && <div className="routeRemain">
                        <span className="routeRemain">{display.remain}</span>
                        <span className='unit'>nm</span>
                    </div>}
                    {!small && <SecondRow eta={display.eta} approach={approaching && ! props.legacy} small={small} />}
                    { ! small && ( (approaching) ?
                        <div className={Helper.concatsp(props.legacy?undefined:"routeNext")}>
                            <span
                                className="routeNextCourse">{display.next}</span>
                            <span className='unit'>&#176;</span>
                        </div>
                        : <div></div>
                    )
                    }
                </div>
            </WidgetFrame>
        );
    }



ActiveRouteWidget.storeKeys=STORE_KEYS;
ActiveRouteWidget.editableParameters= EDITABLE;

export default ActiveRouteWidget;