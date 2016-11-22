/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavData=require('../nav/navdata');

var Widget=React.createClass({
    propTypes:{
        name: React.PropTypes.string,
        unit: React.PropTypes.string,
        caption: React.PropTypes.string,
        dataKey:React.PropTypes.string,
        //formatter: React.PropTypes.func,
        click: React.PropTypes.func,
        store: React.PropTypes.instanceOf(NavData).isRequired,
        classes: React.PropTypes.string
    },
    getInitialState: function(){
        return{
            val:this.props.store.getValue(this.props.dataKey)
        };
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState({
            val:this.props.store.getValue(nextProps.dataKey)
        });
    },
    render: function(){
        var self=this;
        var classes="avn_widget "+this.props.classes||"";
        var val=this.state.val;
        if (val === undefined || val == "") {
            val=this.props.default||"";
        }
        return (
        <div className={classes} onClick={this.props.click}>
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