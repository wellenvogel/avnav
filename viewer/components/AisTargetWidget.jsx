/**
 * Created by andreas on 23.02.16.
 */

let React=require("react");
let NavData=require('../nav/navdata');
let compare=require('../util/shallowcompare');

let AisTargetWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        onItemClick: React.PropTypes.func,
        store: React.PropTypes.instanceOf(NavData).isRequired,
        propertyHandler: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string,
        updateCallback: React.PropTypes.func
    },
    _getValues:function(){
        let mmsi=this.props.store.getData('aisMmsi');
        let color;
        let aisProperties={};
        if (mmsi && mmsi !== ""){
            aisProperties.warning=this.props.store.getData('aisWarning')||false;
            aisProperties.nearest=this.props.store.getData('aisNearest')||false;
        }
        else mmsi=undefined;
        color=this.props.propertyHandler.getAisColor(aisProperties);
        let front=this.props.store.getData('aisFront');
        if (front == "" || front == " ") front="X";
        return{
            dst:this.props.store.getData('aisDst'),
            cpa:this.props.store.getData('aisCpa'),
            tcpa:this.props.store.getData('aisTcpa'),
            front:front,
            color: color,
            mmsi:mmsi
        };
    },
    getInitialState: function(){
        this.lastRendered=0;
        this.lastNotified=-1;
        return this._getValues();

    },
    componentWillReceiveProps: function(nextProps) {
        let nState=this._getValues();
        if (compare(this.state,nState)) return;
        this.setState(nState);
    },
    componentDidUpdate: function(){
        if (this.lastNotified != this.lastRendered) {
            if (this.props.updateCallback) {
                this.props.updateCallback();
            }
            this.lastNotified=this.lastRendered;
        }
    },
    render: function(){
        let self=this;
        let classes="avn_widget avn_aisTargetWidget "+this.props.classes||""+ " "+this.props.className||"";
        let small = (this.props.mode === "small" || this.props.mode === "gps");
        if (this.state.mmsi !== undefined || this.props.mode === "gps") {
            let style=avnav.assign({},this.props.style,{backgroundColor:this.state.color});
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
                        <span className="avn_ais_data">{this.state.dst}</span>
                        <span className="avn_unit">nm</span>
                    </div> }
                    { ! small && <div className="avn_widgetData">
                        <span className='avn_label '>C</span>
                        <span className="avn_ais_data">{this.state.cpa}</span>
                        <span className="avn_unit">nm</span>
                    </div> }
                    {this.state.mmsi !== undefined &&
                    <div className="avn_widgetData">
                        <span className='avn_label '>T</span>
                        <span className="avn_ais_data">{this.state.tcpa}</span>
                        <span className="avn_unit">h</span>
                    </div>
                    }
                    {this.state.mmsi !== undefined &&
                    <div className="avn_widgetData">
                        <span className='avn_ais_front avn_ais_data'>{this.state.front}</span>
                    </div>
                    }
                </div>
            );
        }
        else{
            this.lastRendered=0;
            return null;
        }

    },
    click:function(ev){
        ev.stopPropagation();
        this.props.onItemClick(avnav.assign({},this.props,this.state));
    }

});

module.exports=AisTargetWidget;