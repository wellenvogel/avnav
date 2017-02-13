/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var Store=require('../util/store');

var Widget=React.createClass({
    propTypes:{
        name: React.PropTypes.string,
        unit: React.PropTypes.string,
        caption: React.PropTypes.string,
        dataKey:React.PropTypes.string,
        averageKey: React.PropTypes.string,
        //formatter: React.PropTypes.func,
        onClick: React.PropTypes.func,
        store: React.PropTypes.instanceOf(Store).isRequired,
        classes: React.PropTypes.string
    },
    getInitialState: function(){
        return{
            val:this.props.store.getData(this.props.dataKey),
            average:this.props.averageKey?this.props.store.getData(this.props.averageKey):false
        };
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState({
            val:this.props.store.getData(nextProps.dataKey),
            average:nextProps.averageKey?this.props.store.getData(nextProps.averageKey):false
        });
    },
    render: function(){
        var self=this;
        var classes="avn_widget "+this.props.classes||"";
        if (this.state.average) classes+=" avn_average";
        var val=this.state.val;
        if (val === undefined || val == "") {
            val=this.props.default||"";
        }
        var style=this.props.style||{};
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            <div className='avn_widgetData'>{val}</div>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            {this.props.unit !== undefined?
                <div className='avn_widgetInfoRight'>{this.props.unit}</div>
                :<div className='avn_widgetInfoRight'></div>
            }
        </div>
        );
    }

});

module.exports=Widget;