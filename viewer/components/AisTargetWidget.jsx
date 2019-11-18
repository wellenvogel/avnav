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


class AisTargetWidget extends React.Component{
    constructor(props){
        super(props);
        this.lastRendered=0;
        this.lastNotified=-1;
        this.click=this.click.bind(this);
    }
    shouldComponentUpdate(nextProps,nextState){
        return ! compare(this.props.current,nextProps.current);
    }
    componentDidUpdate(){
        if (this.lastNotified != this.lastRendered) {
            if (this.props.updateCallback) {
                this.props.updateCallback();
            }
            this.lastNotified=this.lastRendered;
        }
    }
    render(){
        if (! this.props.current){
            return null;
        }
        let current=this.props.current;
        let self=this;
        let classes="avn_widget avn_aisTargetWidget "+this.props.classes||""+ " "+this.props.className||"";
        let small = (this.props.mode === "small" || this.props.mode === "gps");
        let aisProperties={};
        if (current.mmsi && current.mmsi !== ""){
            aisProperties.warning=current.warning||false;
            aisProperties.nearest=current.nearest||false;
        }
        let color=PropertyHandler.getAisColor(aisProperties);
        let front=AisFormatter.format('passFront',current);
        if (current.mmsi !== undefined || this.props.mode === "gps") {
            let style=assign({},this.props.style,{backgroundColor:color});
            if (this.lastRendered !== 1){
              //if we did not render the last time, we always render without any with/height
                delete style.width;
                delete style.height;
            }
            this.lastRendered=1;
            return (

                <div className={classes}
                     style={style}
                     onClick={this.click}>
                    <div className="avn_widgetInfoLeft">AIS</div>

                    { ! small && <div className="avn_widgetData avn_widgetDataFirst">
                        <span className='avn_label '>D</span>
                        <span className="avn_ais_data">{AisFormatter.format('distance',current)}</span>
                        <span className="avn_unit">nm</span>
                    </div> }
                    { ! small && <div className="avn_widgetData">
                        <span className='avn_label '>C</span>
                        <span className="avn_ais_data">{AisFormatter.format('cpa',current)}</span>
                        <span className="avn_unit">nm</span>
                    </div> }
                    {current.mmsi !== undefined &&
                    <div className="avn_widgetData">
                        <span className='avn_label '>T</span>
                        <span className="avn_ais_data">{AisFormatter.format('tcpa',current)}</span>
                        <span className="avn_unit">h</span>
                    </div>
                    }
                    {current.mmsi !== undefined &&
                    <div className="avn_widgetData">
                        <span className='avn_ais_front avn_ais_data'>{front}</span>
                    </div>
                    }
                </div>
            );
        }
        else{
            this.lastRendered=0;
            return null;
        }

    }
    click(ev){
        ev.stopPropagation();
        this.props.onClick(assign({},this.props,{mmsi:this.props.current?this.props.current.mmsi:undefined}));
    }

}

AisTargetWidget.storeKeys={
    current: keys.nav.ais.nearest
};

AisTargetWidget.propTypes={
    //formatter: React.PropTypes.func,
    onClick: PropTypes.func,
    classes: PropTypes.string,
    updateCallback: PropTypes.func,
    current: PropTypes.object,
    mode: PropTypes.string
};

module.exports=AisTargetWidget;