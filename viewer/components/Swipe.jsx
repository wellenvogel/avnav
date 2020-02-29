/**
 * Created by andreas on 03.12.16.
 * modified from https://github.com/leandrowd/react-easy-swipe/blob/master/src/react-swipe.js
 * add some drag/drop support basing on https://github.com/clauderic/react-sortable-hoc/blob/master/src/utils.js
 */

import React, { Component} from 'react';
import PropTypes from 'prop-types';

function getPosition(event) {
    if (event.touches && event.touches.length) {
        return {
            x: event.touches[0].pageX,
            y: event.touches[0].pageY,
        };
    } else if (event.changedTouches && event.changedTouches.length) {
        return {
            x: event.changedTouches[0].pageX,
            y: event.changedTouches[0].pageY,
        };
    } else {
        return {
            x: event.pageX,
            y: event.pageY,
        };
    }
}
class ReactSwipe extends Component {

    constructor() {
        super();
        this._handleSwipeStart = this._handleSwipeStart.bind(this);
        this._handleSwipeMove = this._handleSwipeMove.bind(this);
        this._handleSwipeEnd = this._handleSwipeEnd.bind(this);
        this._cancelSwipe=this._cancelSwipe.bind(this);
    }
    componentDidMount(){
        if (this.props.includeMouse) {
            document.addEventListener('mouseup', this._handleSwipeEnd);
        }
    }
    componentWillUnmount(){
        if (this.props.includeMouse) {
            document.removeEventListener('mouseup', this._handleSwipeEnd);
        }
        this._handleSwipeEnd();
    }
    _handleSwipeStart(e) {
        const { x, y } = getPosition(e);
        this.touchStart = { x, y };
        let rectangle=e.target.getBoundingClientRect();
        //console.log(e.target);
        //console.log("swipe start x="+x+", y="+y+",target="+e.target+",top="+rectangle.top);
        this.touchStartXY={x:x-rectangle.left,y:y-rectangle.top};
        this.touchPosition={deltaX:0,deltaY:0};
        if (this.props.onSwipeStart)this.props.onSwipeStart(this.touchStartXY);
        e.preventDefault();
    }

    _handleSwipeMove(e) {
        if (! this.touchStart) return;
        let {x,y}=getPosition(e);
        const deltaX = x - this.touchStart.x;
        const deltaY = y - this.touchStart.y;
        this.swiping = true;
        this.touchPosition = { deltaX, deltaY };
        // handling the responsability of cancelling the scroll to
        // the component handling the event
        if(this.props.onSwipeMove)this.props.onSwipeMove({
            x: deltaX,
            y: deltaY
        },this._getAbsolutePosition());
        e.preventDefault();

    }

    _getAbsolutePosition(){
        return {x:this.touchStartXY.x+this.touchPosition.deltaX,
            y:this.touchStartXY.y+this.touchPosition.deltaY};
    }

    _handleSwipeEnd(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!this.touchStart || ! this.touchPosition) return;
        //console.log("swipe end tsx="+this.touchStart.x+",tsy="+this.touchStart.y);
        if (this.swiping) {
            if (this.touchPosition.deltaX < 0) {
                if(this.props.onSwipeLeft)this.props.onSwipeLeft(1);
            } else if (this.touchPosition.deltaX > 0) {
                if (this.props.onSwipeRight)this.props.onSwipeRight(1);
            }
            if (this.touchPosition.deltaY < 0) {
                if (this.props.onSwipeUp) this.props.onSwipeUp(1);
            } else if (this.touchPosition.deltaY > 0) {
                if (this.props.onSwipeDown)this.props.onSwipeDown(1);
            }
        }
        if (this.props.onSwipeEnd)this.props.onSwipeEnd(this._getAbsolutePosition());
        this.touchStart = null;
        this.swiping = false;
        this.touchPosition = null;
    }
    _cancelSwipe(){
    }

    render() {
        let props={
            onTouchMove:this._handleSwipeMove,
            onTouchStart:this._handleSwipeStart,
            onTouchEnd :this._handleSwipeEnd ,
            onTouchCancel: this._handleSwipeEnd,
            className:this.props.className,
            style:this.props.style
        };
        if (this.props.includeMouse){
            props.onMouseDown=this._handleSwipeStart;
            props.onMouseMove=this._handleSwipeMove;
            props.onMouseUp=this._handleSwipeEnd;
        }
        return (
            <div
                {...props}
            >

                { this.props.children }

            </div>
        );
    }
}

ReactSwipe.displayName = 'ReactSwipe';

ReactSwipe.propTypes = {
    className: PropTypes.string,
    style: PropTypes.object,
    children: PropTypes.node,
    onSwipeUp: PropTypes.func,
    onSwipeDown: PropTypes.func,
    onSwipeLeft: PropTypes.func,
    onSwipeRight: PropTypes.func,
    onSwipeStart: PropTypes.func,
    onSwipeMove: PropTypes.func,
    onSwipeEnd: PropTypes.func,
    includeMouse: PropTypes.bool
};


export default ReactSwipe;
