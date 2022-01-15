/**
 * Created by andreas on 23.02.16.
 */

import  React from "react";
import PropTypes from 'prop-types';
import compare from '../util/shallowcompare';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import PropertyHandler from '../util/propertyhandler.js';
import AisFormatter from '../nav/aisformatter.jsx';
import assign from 'object-assign';
import GuiHelper from '../util/GuiHelpers.js';


class AisTargetWidget extends React.Component{
    constructor(props){
        super(props);
        this.click=this.click.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget",this.click);
    }
    shouldComponentUpdate(nextProps,nextState){
        return ! compare(this.props.current,nextProps.current);
    }
    componentDidUpdate(){
    }
    render(){
        let current=this.props.current||{};
        let self=this;
        let classes="widget aisTargetWidget "+this.props.className||"";
        let small = (this.props.mode === "horizontal" );
        let aisProperties={};
        let color=undefined;
        if (current.mmsi && current.mmsi !== "") {
            aisProperties.warning = current.warning || false;
            aisProperties.nearest = current.nearest || false;
            aisProperties.tracking = (current.mmsi === this.props.trackedMmsi);
            color=PropertyHandler.getAisColor(aisProperties);
        }
        let front=AisFormatter.format('passFront',current);
        if (current.mmsi !== undefined || this.props.mode === "gps" || this.props.isEditing) {
            let style=assign({},this.props.style,{backgroundColor:color});
            return (

                <div className={classes}
                     style={style}
                     onClick={this.click}>
                    <div className="infoLeft">AIS</div>
                    <div className="aisPart">
                        { !small && <div className="widgetData">
                            <span className='label '>D</span>
                            <span className="aisData">{AisFormatter.format('distance', current)}</span>
                            <span className="unit">nm</span>
                        </div> }
                        { !small && <div className="widgetData">
                            <span className='label '>C</span>
                            <span className="aisData">{AisFormatter.format('cpa', current)}</span>
                            <span className="unit">nm</span>
                        </div> }
                    </div>
                    <div className="aisPart">
                        {current.mmsi !== undefined &&
                        <div className="widgetData">
                            <span className='label '>T</span>
                            <span className="aisData">{AisFormatter.format('tcpa', current)}</span>
                            <span className="unit">h</span>
                        </div>
                        }
                        {current.mmsi !== undefined &&
                        <div className="widgetData">
                            <span className='aisFront aisData'>{front}</span>
                        </div>
                        }
                    </div>
                </div>
            );
        }
        else{
            return null;
        }

    }
    click(ev){
        if (ev.stopPropagation) ev.stopPropagation();
        this.props.onClick(assign({},this.props,{mmsi:this.props.current?this.props.current.mmsi:undefined}));
    }

}

AisTargetWidget.storeKeys={
    current: keys.nav.ais.nearest,
    isEditing: keys.gui.global.layoutEditing,
    trackedMmsi: keys.nav.ais.trackedMmsi
};

AisTargetWidget.propTypes={
    //formatter: React.PropTypes.func,
    onClick: PropTypes.func,
    className: PropTypes.string,
    current: PropTypes.object,
    mode: PropTypes.string
};

export default AisTargetWidget;