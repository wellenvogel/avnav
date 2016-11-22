/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavObject=avnav.nav.NavObject;
var TimeStatusWidget=React.createClass({
    propTypes:{
        click: React.PropTypes.func,
        store: React.PropTypes.instanceOf(NavObject).isRequired,
        classes: React.PropTypes.string
    },
    _getValues:function(){
        return{
            time:this.props.store.getValue('gpsTime'),
            statusUrl:this.props.store.getValue('statusImageUrl')
        };
    },
    getInitialState: function(){
        return this._getValues();
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getValues());
    },
    render: function(){
        var self=this;
        var classes="avn_widget avn_timeStatusWidget "+this.props.classes||"";
        var imgSrc=this.state.statusUrl;
        return (
        <div className={classes} onClick={this.props.click}>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            <img className="avn_boatPositionStatus" src={imgSrc}/>
            <div className="avn_widgetData avn_gpsTime">{this.state.time}</div>
        </div>
        );
    }

});

module.exports=TimeStatusWidget;