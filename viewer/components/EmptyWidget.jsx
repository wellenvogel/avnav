/**
 * Created by andreas on 23.02.16.
 */

var React=require("react");

var EmptyWidget=React.createClass({
    propTypes: {
        name: React.PropTypes.string,
        onClick: React.PropTypes.func,
        classes: React.PropTypes.string
    },
    render: function(){
        var self=this;
        var classes="avn_widget "+this.props.classes||"";
        if (this.props.className) classes+=" "+this.props.className;
        var style=this.props.style||{};
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
        </div>
        );
    }

});

module.exports=EmptyWidget;