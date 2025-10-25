/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * Depth widgets with offset, max and flexible depth units
 */
import DirectWidget from "./DirectWidget";
import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys";
import formatter from "../util/formatter";
import {EditableFloatParameterUI} from "./EditableParameterUI";
import {DEPTH_UNITS, unitToFactor} from "../nav/navcompute";
import {concatsp} from "../util/helper";

export const DepthDisplayFlex=(props)=>{
    const iprops={...props};
    iprops.unit=props.dunit;
    iprops.formatter=(v)=>{
        return formatter.formatDistance(v,props.dunit,props.digits,props.fillRight);
    }
    if (iprops.offset && iprops.value != null){
        iprops.value+=parseFloat(iprops.offset );
    }
    if (iprops.value != null && iprops.value < parseFloat(iprops.warningd)){
        iprops.className=concatsp(iprops.className,"critical");
    }
    iprops.default="-".repeat(iprops.digits>2?iprops.digits:3);
    return <DirectWidget {...iprops}/>
}

DepthDisplayFlex.displayName="DepthDisplayFlex";
DepthDisplayFlex.propTypes = {
    ...DirectWidget.propTypes,
    dunit: PropTypes.string,
    offset: PropTypes.number,
    warningd: PropTypes.number,
    digits: PropTypes.number,
    fillRight: PropTypes.bool,
}
const unitConverter={
    fromDisplay:(props,value)=>{
        if (value == null || value == '') return value;
        const factor=unitToFactor(props.dunit)
        return value*factor
    },
    toDisplay:(props,value)=>{
        if (value == null || value == '') return value;
        const factor=unitToFactor(props.dunit)
        const rt=value/factor;
        if (isNaN(rt)){return ""}
        return rt;
    }
}
DepthDisplayFlex.predefined={
    storeKeys:{
        value: keys.nav.gps.depthBelowTransducer
    },
    editableParameters:{
        formatter: false,
        formatterParams:false,
        unit: false,
        caption: true,
        dunit:{
            type:'SELECT',
            displayName:"unit",
            list:DEPTH_UNITS,
            default:'m',
            description:'Select the unit for the depth display'},
        digits:{
            type:'NUMBER',
            default:0,
            description:'minimal number of digits for the depth display, set to 0 to let the system choose',
            list:[0,10]
        },
        fillRight:{
            type:'BOOLEAN',
            default: false,
            description: 'let the fractional part extend to have the requested number of digits',
            condition: {digits:(all,dv)=>dv>0}
        },
        offset: new EditableFloatParameterUI({
            name:'offset',
            displayName:'offset',
            default:0,
            description:'Add this offset to the measured value from depthBelowTransducer',
            converter: unitConverter
        }),
        warningd:new EditableFloatParameterUI({
            name:'warningd',
            displayName:'warning',
            default: 0,
            description: 'Add a warning color to the display if the depth (including offset) goes below this value',
            converter: unitConverter
            }),
        maxValue:new EditableFloatParameterUI({
            name:'maxValue',
            default: 12000,
            description:'Any value above this is considered to be invalid',
            converter: unitConverter
            }),
    },
    caption: 'DBT'

}
