/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");

var ActiveRouteWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        click: React.PropTypes.func,
        store: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string
    },
    _getValues:function(){
        var approaching=this.props.store.getRoutingHandler().getApproaching();
        return{
            name:this.props.store.getValue('routeName'),
            remain:this.props.store.getValue('routeRemain'),
            eta:this.props.store.getValue('routeEta'),
            next:this.props.store.getValue('routeNextCourse'),
            nextName: this.props.store.getValue('routeNextName'), //if empty: do not show...
            isApproaching: approaching
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
        this.setState(v);
    },
    componentWillMount: function(){
        this.props.store.register(this);
    },
    componentWillUnmount: function(){
        this.props.store.deregister(this);
    },
    render: function(){
        var self=this;
        var classes="avn_widget avn_activeRouteWidget "+this.props.classes||"";
        if (this.state.isApproaching) classes +=" avn_route_display_approach ";
        return (
        <div className={classes} onClick={this.props.click}>
            <div className="avn_widgetInfoLeft">RTE</div>
            <div className="avn_routeName">{this.state.name}</div>
            <div>
                <span className="avn_routeRemain">{this.state.remain}</span>
                <span className='avn_unit'>nm</span>
            </div>
            <div className="avn_routeEta">{this.state.eta}</div>
            { this.state.isApproaching ?
                <div className="avn_routeNext">
                    <span class="avn_routeNextCourse">{this.state.next}</span>
                    <span class='avn_unit'>&#176;</span>
                </div>
                : <div></div>
            }
        </div>
        );
    }

});

module.exports=ActiveRouteWidget;