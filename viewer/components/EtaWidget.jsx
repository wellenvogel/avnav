/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");

var EtaWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        click: React.PropTypes.func,
        store: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string
    },
    _getValues:function(){
        return{
            eta:this.props.store.getValue('markerEta'),
            name:this.props.store.getValue('markerName')
        };
    },
    getInitialState: function(){
        return this._getValues();
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getValues());
    },
    dataChanged: function(){
        var v=this._getValues();
        if (v.eta != this.state.eta || v.name != this.state.name){
            this.setState(v);
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
        var classes="avn_widget avn_etaWidget "+this.props.classes||"";
        return (
        <div className={classes} onClick={this.props.click}>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            <div className="avn_widgetData avn_markerEta">{this.state.eta}</div>
            <div className="avn_widgetData avn_markerName" >{this.state.name}</div>
        </div>
        );
    }

});

module.exports=EtaWidget;