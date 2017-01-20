/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavData=require('../nav/navdata');

var AisTargetWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        onItemClick: React.PropTypes.func,
        store: React.PropTypes.instanceOf(NavData).isRequired,
        propertyHandler: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string,
        updateCallback: React.PropTypes.func
    },
    _getValues:function(){
        var aisTarget=this.props.store.getAisHandler().getNearestAisTarget();
        var color;
        var aisProperties={};
        if (aisTarget && aisTarget.mmsi){
            aisProperties.warning=aisTarget.warning;
            if (aisTarget.nearest) aisProperties.nearest=true;
        }
        color=this.props.propertyHandler.getAisColor(aisProperties);
        var front=this.props.store.getValue('aisFront');
        if (front == "" || front == " ") front="X";
        return{
            dst:this.props.store.getValue('aisDst'),
            cpa:this.props.store.getValue('aisCpa'),
            tcpa:this.props.store.getValue('aisTcpa'),
            front:front,
            color: color,
            mmsi:aisTarget?aisTarget.mmsi:undefined
        };
    },
    getInitialState: function(){
        return this._getValues();
        this.lastRendered=0;
        this.lastNotified=-1;
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getValues());
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
        var self=this;
        var classes="avn_widget avn_aisTargetWidget "+this.props.classes||"";
        var imgSrc=this.state.statusUrl;
        var small = (this.props.mode == "small");
        if (this.state.mmsi !== undefined) {
            this.lastRendered=1;
            return (

                <div className={classes}
                     style={avnav.assign({},this.props.style,{backgroundColor:this.state.color})}
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
                    <div className="avn_widgetData">
                        <span className='avn_label '>T</span>
                        <span className="avn_ais_data">{this.state.tcpa}</span>
                        <span className="avn_unit">h</span>
                    </div>
                    <div className="avn_widgetData">
                        <span className='avn_ais_front avn_ais_data'>{this.state.front}</span>
                    </div>
                </div>
            );
        }
        else{
            this.lastRendered=0;
            return null;
        }

    },
    click:function(){
        this.props.onItemClick(avnav.assign({},this.props,this.state));
    }

});

module.exports=AisTargetWidget;