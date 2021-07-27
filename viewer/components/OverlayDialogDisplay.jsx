/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React from 'react';
import PropTypes from 'prop-types';
import MapEventGuard from "../hoc/MapEventGuard";
 //"active input" to prevent resizes
const Container=MapEventGuard(React.forwardRef((props,ref)=>{
    return (
        <div className="overlay_cover_active" onClick={props.onClick} ref={ref}>
            {props.children}
        </div>
    )
}));
class OverlayDialog extends React.Component {
    constructor(props) {
        super(props);
        this.container=null;
        this.state={
            update:0
        }
    }

    render() {
        let Content=this.props.content;
        let className="dialog";
        if (this.props.className) className+=" "+this.props.className;
        return (
            <Container ref={(el)=>this.container=el} onClick={this.props.closeCallback}>
                <div ref={(el)=>this.box=el} className={className} onClick={
                    (ev)=>{
                    ev.preventDefault();
                    ev.stopPropagation();
                    }
                }>
                    <Content closeCallback={this.props.closeCallback} /></div>
            </Container>
        );
    }

}


OverlayDialog.propTypes={
    parent: PropTypes.element,
    onClick: PropTypes.func, //click on container
    closeCallback: PropTypes.func, //handed over to the child to close the dialog
    className: PropTypes.string
};


export default  OverlayDialog;
