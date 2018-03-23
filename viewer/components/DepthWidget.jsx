/**
 * Created by free-x on 23.03.18.
 */

var React=require("react");
var NavData=require('../nav/navdata');
var Store=require('../util/store');

var DepthWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        onItemClick: React.PropTypes.func,
        store: React.PropTypes.instanceOf(Store).isRequired,
        classes: React.PropTypes.string,
        updateCallback: React.PropTypes.func
    },
    _getValues:function(){
        return{
            depthBelowTransducer: this.props.store.getData('depthBelowTransducer'),
            depthBelowWaterline: this.props.store.getData('depthBelowWaterline'),
            depthBelowKeel: this.props.store.getData('depthBelowKeel')
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
        var classes = "avn_widget avn_depthWidget " + this.props.classes || "";
        var style = this.props.style || {};
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                <div className="avn_depthInner">
                    <div className='avn_widgetData'>{this.state.depthBelowTransducer}</div>
                    <div className='avn_widgetInfoLeft'>Depth</div>
                    <div className='avn_widgetInfoRight'>m</div>
                </div>
            </div>

        );

    },
    click:function(){
        this.props.onItemClick(avnav.assign({},this.props,this.state));
    }

});

module.exports=DepthWidget;
