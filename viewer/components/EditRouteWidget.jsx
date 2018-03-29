/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");
var NavData=require('../nav/navdata');

var EditRouteWidget=React.createClass({
    propTypes:{
        //formatter: React.PropTypes.func,
        onClick: React.PropTypes.func,
        store: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string,
        mode:   React.PropTypes.string //display info side by side if small
    },
    _getValues:function(){
        return{
            name:this.props.store.getData('edRouteName'),
            remain:this.props.store.getData('edRouteRemain'),
            eta:this.props.store.getData('edRouteEta'),
            numPoints:this.props.store.getData('edRouteNumPoints'),
            len:this.props.store.getData('edRouteLen'),
            isApproaching: this.props.store.getData('isApproaching'),
            editingActive: this.props.store.getData('isEditingActiveRoute'),
            hasRoute: this.props.store.getData('edRouteName') !== undefined
        };
    },
    getInitialState: function(){
        return this._getValues();
    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getValues());
    },
    componentDidUpdate: function(){
        if (this.props.layoutUpdate){
            this.props.layoutUpdate();
        }
    },
    render: function(){
        var self=this;
        var classes="avn_widget avn_editingRouteWidget "+this.props.classes||""+ " "+this.props.className||"";
        if (this.state.editingActive) classes +=" avn_activeRoute ";
        else classes+=" avn_otherRoute";
        if (! this.state.hasRoute){
            return (
                <div className={classes} onClick={this.props.onClick}>
                    <div className="avn_widgetInfoLeft">RTE</div>
                    <div id="avi_route_info_name">No Route</div>
                </div>
            )
        }
        var rname;
        if (this.props.mode === "small"){
            rname=this.state.name;
        }
        else {
            rname = this.state.name.substr(0, 14);
            if (this.state.name.length > 14) rname += "..";
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style}>
            <div className="avn_widgetInfoLeft">RTE</div>
            <div className="avn_routeName">{rname}</div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">PTS:</span>
                <span className="avn_routeInfo">{this.state.numPoints}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">DST:</span>
                <span className="avn_routeInfo">{this.state.len}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">RTG:</span>
                <span className="avn_routeInfo">{this.state.remain}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">ETA:</span>
                <span className="avn_routeInfo avd_edRouteEta">{this.state.eta}</span>
            </div>
        </div>
        );
    }

});

module.exports=EditRouteWidget;