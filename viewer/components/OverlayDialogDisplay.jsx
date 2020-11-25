/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React from 'react';
import Promise from 'promise';
import PropTypes from 'prop-types';
import assign from 'object-assign';
import base from '../base.js';
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
        this.updateDimensions = this.updateDimensions.bind(this);
        this.container=null;
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
                    <Content closeCallback={this.props.closeCallback} updateDimensions={this.updateDimensions}/></div>
            </Container>
        );
    }

    componentDidMount() {
        this.updateDimensions();
        window.addEventListener('resize', this.updateDimensions);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateDimensions);

    }

    componentDidUpdate() {
        this.updateDimensions();
    }

    updateDimensions() {
        if (!this.props.content) return;
        if (! this.container) return;
        let props = this.props;
        let assingToViewport = true;
        if (props.parent) {
            try {
                //expected to be a dom element
                let containerRect = props.parent.getBoundingClientRect();
                assign(this.container.style, {
                    position: "fixed",
                    top: containerRect.top + "px",
                    left: containerRect.left + "px",
                    width: containerRect.width + "px",
                    height: containerRect.height + "px"
                });
                assingToViewport = false;
            } catch (e) {
                base.log("invalid parent for dialog: " + e);
            }
        }
        if (assingToViewport) {
            assign(this.container.style, {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            });
        }
        if (! this.box) return;
        let rect = this.container.getBoundingClientRect();
        assign(this.box.style, {
            maxWidth: rect.width + "px",
            maxHeight: rect.height + "px",
            position: 'fixed',
            opacity: 0
        });
        let self = this;
        window.setTimeout(function () {
            if (!self.box) return; //could have become invisible...
            let boxRect = self.box.getBoundingClientRect();
            let left=(rect.width - boxRect.width) / 2;
            let top=(rect.height - boxRect.height) / 2;
            assign(self.box.style, {
                left: left + "px",
                top: top + "px",
                maxWidth: (rect.width-left)+"px",
                maxHeight: (rect.height-top)+"px",
                opacity: 1
            });
        }, 0);

    }
};

OverlayDialog.propTypes={
    parent: PropTypes.element,
    onClick: PropTypes.func, //click on container
    closeCallback: PropTypes.func, //handed over to the child to close the dialog
    className: PropTypes.string
};


export default  OverlayDialog;
