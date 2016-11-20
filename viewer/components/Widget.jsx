/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");

var Widget=React.createClass({
    propTypes:{
        name: React.PropTypes.string,
        unit: React.PropTypes.string,
        caption: React.PropTypes.string,
        dataKey:React.PropTypes.string,
        //formatter: React.PropTypes.func,
        click: React.PropTypes.func,
        store: React.PropTypes.object.isRequired,
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
    dataChanged: function(){
        var v=this.props.store.getValue(this.props.dataKey);
        if (v != this.state.val){
            this.setState({val:v});
        }
    },
    componentWillMount: function(){
        this.props.store.register(this);
    },
    componentWillUnmount: function(){
        this.props.store.deregister(this);
    },
    render: function(){
        var self=this;
        var classes="avn_widget "+this.props.classes||"";
        return (
        <div className={classes} onClick={this.props.click}>
            <div className='avn_widgetData'>{this.state.val}</div>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            <div className='avn_widgetInfoRight'>{this.props.unit}</div>
        </div>
        );
    }

});

module.exports=Widget;