/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");

var CenterDisplayWidget=React.createClass({
    propTypes:{
        onClick: React.PropTypes.func,
        store: React.PropTypes.object.isRequired,
        classes: React.PropTypes.string
    },
    _getValues:function(){
        return{
            markerCourse:this.props.store.getData('centerMarkerCourse'),
            markerDistance:this.props.store.getData('centerMarkerDistance'),
            centerCourse:this.props.store.getData('centerCourse'),
            centerDistance:this.props.store.getData('centerDistance'),
            centerPosition: this.props.store.getData('centerPosition')
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
        var classes="avn_widget avn_centerWidget "+this.props.classes||"";
        var small = (this.props.mode == "small");
        var tableClass="";
        if (small) tableClass="avn_widgetDataFirst";
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
                <div className="avn_widgetInfoLeft">Center</div>
            { ! small && <div className="avn_centerPosition">{this.state.centerPosition}</div>}
                <div className={"avn_table "+tableClass}>
                    <div className="avn_row">
                        <div className="avn_label avn_marker"></div>
                        <div className="avn_center_value">
                            <span>{this.state.markerCourse}</span>
                            <span className="avn_unit">&#176;</span>
                        </div>
                        <div className="avn_center_value">
                            /
                        </div>
                        <div className="avn_center_value">
                            <span>{this.state.markerDistance}</span>
                            <span className="avn_unit">nm</span>
                        </div>
                    </div>
                    <div className="avn_row">
                        <div className="avn_label avn_boat"></div>
                        <div className="avn_center_value">
                            <span >{this.state.centerCourse}</span>
                            <span className="avn_unit">&#176;</span>
                        </div>
                        <div className="avn_center_value">
                            /
                        </div>
                        <div className="avn_center_value">
                            <span >{this.state.centerDistance}</span>
                            <span className="avn_unit">nm</span>

                        </div>
                    </div>
                </div>
            </div>
        );
    }

});

module.exports=CenterDisplayWidget;