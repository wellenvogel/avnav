/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var Store=require('../util/store');
var Formatter=require('../util/formatter');

var WindWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        onItemClick: React.PropTypes.func,
        store: React.PropTypes.instanceOf(Store).isRequired,
        classes: React.PropTypes.string,
        updateCallback: React.PropTypes.func
    },
    _getValues:function(){
        return{
            windAngle: this.props.store.getData('windAngle'),
            windSpeed: this.props.store.getData('windSpeed'),
            windReference: this.props.store.getData('windReference')
        };
    },
    getInitialState: function(){
        return this._getValues();

    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getValues());
    },
    render: function(){
        var self = this;
        var classes = "avn_widget avn_windWidget " + this.props.classes || ""+ " "+this.props.className||"";
        var style = this.props.style || {};
        let windSpeed="";
        let showKnots=this.props.propertyHandler.getProperties().windKnots;
        let formatter=new Formatter();
        try{
            windSpeed=parseFloat(this.state.windSpeed);
            if (showKnots){
                let nm=this.props.propertyHandler.getProperties().NM;
                windSpeed=windSpeed*3600/nm;
            }
            if (windSpeed < 10) windSpeed=formatter.formatDecimal(windSpeed,1,2);
            else windSpeed=formatter.formatDecimal(windSpeed,3,0);
        }catch(e){}
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                <div className="avn_windInner">
                    <div className='avn_widgetData'>{this.state.windAngle}</div>
                    <div className='avn_widgetInfoLeft'>WD</div>
                    <div className='avn_widgetInfoRight'>°</div>
                </div>
                <div className="avn_windInner">
                    <div className='avn_widgetData'>{windSpeed}</div>
                    <div className='avn_widgetInfoLeft'>WS</div>
                    <div className='avn_widgetInfoRight'>{showKnots?"kn":"m/s"}</div>
                </div>
            </div>

        );

    },
    click:function(){
        this.props.onItemClick(avnav.assign({},this.props,this.state));
    }

});

module.exports=WindWidget;