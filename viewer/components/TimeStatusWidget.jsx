/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var Store=require('../util/store');
var TimeStatusWidget=React.createClass({
    propTypes:{
        onClick: React.PropTypes.func,
        store: React.PropTypes.instanceOf(Store).isRequired,
        classes: React.PropTypes.string
    },
    _getValues:function(){
        return{
            time:this.props.store.getData('gpsTime'),
            statusUrl:this.props.store.getData('statusImageUrl')
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
        var classes="avn_widget avn_timeStatusWidget "+this.props.classes||""+ " "+this.props.className||"";
        var imgSrc=this.state.statusUrl;
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            <img className="avn_boatPositionStatus" src={imgSrc}/>
            <div className="avn_widgetData avn_gpsTime">{this.state.time}</div>
        </div>
        );
    }

});

module.exports=TimeStatusWidget;