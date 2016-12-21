/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavData=require('../nav/navdata');

var AisTargetWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        click: React.PropTypes.func,
        store: React.PropTypes.instanceOf(NavData).isRequired,
        propertyHandler: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string,
        layoutUpdate: React.PropTypes.func
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
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getValues());
    },
    componentDidUpdate: function(){
        if (this.props.layoutUpdate){
            this.props.layoutUpdate();
        }
    },
    render: function(){
        var self=this;
        var classes="avn_widget avn_aisTargetWidget "+this.props.classes||"";
        var imgSrc=this.state.statusUrl;
        return (
            (this.state.mmsi !== undefined)?
            <div className={classes} style={avnav.assign({},this.props.style,{backgroundColor:this.state.color})} onClick={this.click}>
                <div className="avn_widgetInfoLeft">AIS</div>
                <div className="avn_widgetData avn_widgetDataFirst">
                    <span className='avn_label '>D</span>
                    <span className="avn_ais_data">{this.state.dst}</span>
                    <span className="avn_unit">nm</span>
                </div>
                <div className="avn_widgetData">
                    <span className='avn_label '>C</span>
                    <span className="avn_ais_data">{this.state.cpa}</span>
                    <span className="avn_unit">nm</span>
                </div>
                <div className="avn_widgetData">
                    <span className='avn_label '>T</span>
                    <span className="avn_ais_data">{this.state.tcpa}</span>
                    <span className="avn_unit">h</span>
                </div>
                <div className="avn_widgetData">
                    <span className='avn_ais_front avn_ais_data'>{this.state.front}</span>
                </div>
            </div>:
                null
        );
    },
    click:function(){
        this.props.click({mmsi:this.state.mmsi});
    }

});

module.exports=AisTargetWidget;