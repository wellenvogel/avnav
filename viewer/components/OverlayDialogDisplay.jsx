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
 //"active input" to prevent resizes
class OverlayDialog extends React.Component {
    constructor(props) {
        super(props);
        this.updateDimensions = this.updateDimensions.bind(this);
    }

    render() {
        let Content=this.props.content;
        let className="dialog";
        if (this.props.className) className+=" "+this.props.className;
        return (
            <div ref="container" className="overlay_cover_active" onClick={this.props.onClick}>
                <div ref="box" className={className} onClick={
                    (ev)=>{
                    ev.preventDefault();
                    ev.stopPropagation();
                    }
                }>
                    <Content closeCallback={this.props.closeCallback}/></div>
            </div>
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
        let props = this.props;
        let assingToViewport = true;
        if (props.parent) {
            try {
                //expected to be a dom element
                let containerRect = props.parent.getBoundingClientRect();
                assign(this.refs.container.style, {
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
            assign(this.refs.container.style, {
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            });
        }
        let rect = this.refs.container.getBoundingClientRect();
        assign(this.refs.box.style, {
            maxWidth: rect.width + "px",
            maxHeight: rect.height + "px",
            position: 'fixed',
            opacity: 0
        });
        let self = this;
        window.setTimeout(function () {
            if (!self.refs.box) return; //could have become invisible...
            let boxRect = self.refs.box.getBoundingClientRect();
            assign(self.refs.box.style, {
                left: (rect.width - boxRect.width) / 2 + "px",
                top: (rect.height - boxRect.height) / 2 + "px",
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


module.exports= OverlayDialog;
