/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavData=require('../nav/navdata');
var compare=require('../util/shallowcompare');

var ActiveRouteWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        onClick: React.PropTypes.func,
        store: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string,
        updateCallback: React.PropTypes.func
    },
    _getValues:function(){
        return{
            name:this.props.store.getData('routeName'),
            remain:this.props.store.getData('routeRemain'),
            eta:this.props.store.getData('routeEta'),
            next:this.props.store.getData('routeNextCourse'),
            nextName: this.props.store.getData('routeNextName'), //if empty: do not show...
            isApproaching: this.props.store.getData('isApproaching')
        };
    },
    getInitialState: function(){
        var rt=this._getValues();
        this.lastApproaching=rt.isApproaching;
        return rt;
    },
    componentWillReceiveProps: function(nextProps) {
        var nextState=this._getValues();
        if (compare(this.state,nextState)) return;
        if (this.state.isApproaching !== nextState.isApproaching){
            this.doLayoutUpdate=true;
        }
        this.setState(nextState);
    },
    componentDidUpdate: function(){
        if (this.props.updateCallback && this.doLayoutUpdate){
            this.doLayoutUpdate=false;
            this.props.updateCallback();
        }
    },
    componentDidMount: function(){
        avnav.log("mount ActiveRouteWidget")
    },
    componentWillUnmount: function(){
        avnav.log("unmount ActiveRouteWidget")
    },
    render: function(){
        var self=this;
        var classes="avn_widget avn_activeRouteWidget "+this.props.classes||"";
        if (this.state.isApproaching) classes +=" avn_route_display_approach ";
        if (this.state.isApproaching != this.lastApproaching){
            this.doLayoutUpdate=true;
            this.lastApproaching=this.state.isApproaching;
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style}>
            <div className="avn_widgetInfoLeft">RTE</div>
            <div className="avn_routeName">{this.state.name}</div>
            <div>
                <span className="avn_routeRemain">{this.state.remain}</span>
                <span className='avn_unit'>nm</span>
            </div>
            <div className="avn_routeEta">{this.state.eta}</div>
            { this.state.isApproaching ?
                <div className="avn_routeNext">
                    <span className="avn_routeNextCourse">{this.state.next}</span>
                    <span className='avn_unit'>&#176;</span>
                </div>
                : <div></div>
            }
        </div>
        );
    }

});

module.exports=ActiveRouteWidget;