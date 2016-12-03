/**
 * Created by andreas on 03.12.16.
 * modified from https://github.com/leandrowd/react-easy-swipe/blob/master/src/react-swipe.js
 */

import React, { Component, PropTypes } from 'react';

class ReactSwipe extends Component {
    static propTypes = {
        tagName: PropTypes.string,
        className: PropTypes.string,
        style: PropTypes.object,
        children: PropTypes.node,
        onSwipeUp: PropTypes.func,
        onSwipeDown: PropTypes.func,
        onSwipeLeft: PropTypes.func,
        onSwipeRight: PropTypes.func,
        onSwipeStart: PropTypes.func,
        onSwipeMove: PropTypes.func,
        onSwipeEnd: PropTypes.func
    };

    static defaultProps = {
        tagName: 'div',
        onSwipeUp() {},
        onSwipeDown() {},
        onSwipeLeft() {},
        onSwipeRight() {},
        onSwipeStart() {},
        onSwipeMove() {},
        onSwipeEnd() {}
    };

    constructor() {
        super();
        this._handleSwipeStart = this._handleSwipeStart.bind(this);
        this._handleSwipeMove = this._handleSwipeMove.bind(this);
        this._handleSwipeEnd = this._handleSwipeEnd.bind(this);
    }

    _handleSwipeStart(e) {
        const { pageX, pageY } = e.touches[0];
        this.touchStart = { pageX, pageY };
        var rectangle=e.target.getBoundingClientRect();
        this.touchStartXY={x:pageX-rectangle.left,y:pageY-rectangle.top};
        this.touchPosition={deltaX:0,deltaY:0};
        this.props.onSwipeStart(this.touchStartXY);
    }

    _handleSwipeMove(e) {
        const deltaX = e.touches[0].pageX - this.touchStart.pageX;
        const deltaY = e.touches[0].pageY - this.touchStart.pageY;
        this.swiping = true;
        this.touchPosition = { deltaX, deltaY };
        // handling the responsability of cancelling the scroll to
        // the component handling the event
        const shouldPreventDefault = this.props.onSwipeMove({
            x: deltaX,
            y: deltaY
        },this._getAbsolutePosition());

        if (shouldPreventDefault) {
            e.preventDefault();
        }

    }

    _getAbsolutePosition(){
        return {x:this.touchStartXY.x+this.touchPosition.deltaX,
            y:this.touchStartXY.y+this.touchPosition.deltaY};
    }

    _handleSwipeEnd() {
        if (this.swiping) {
            if (this.touchPosition.deltaX < 0) {
                this.props.onSwipeLeft(1);
            } else if (this.touchPosition.deltaX > 0) {
                this.props.onSwipeRight(1);
            }
            if (this.touchPosition.deltaY < 0) {
                this.props.onSwipeUp(1);
            } else if (this.touchPosition.deltaY > 0) {
                this.props.onSwipeDown(1);
            }
        }
        this.props.onSwipeEnd(this._getAbsolutePosition());
        this.touchStart = null;
        this.swiping = false;
        this.touchPosition = null;
    }

    render() {
        return (
            <this.props.tagName
                onTouchMove = { this._handleSwipeMove }
                onTouchStart = { this._handleSwipeStart }
                onTouchEnd = { this._handleSwipeEnd }
                className = { this.props.className }
                style = { this.props.style }
            >

                { this.props.children }

            </this.props.tagName>
        );
    }
}

ReactSwipe.displayName = 'ReactSwipe';

export default ReactSwipe;
