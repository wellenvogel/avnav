import React from 'react';
import PropTypes from 'prop-types';
import Headline from './Headline.jsx';
import ButtonList from './ButtonList.jsx';
import Toast from '../util/overlay.js';

class Page extends React.Component {
    constructor(props){
        super(props);
    }
    render() {
        let props=this.props;
        let className = "page";
        if (props.className) className += " " + props.className;
        return <div className={className} id={props.id}>
            <div className="leftPart">
                {props.title ? <Headline title={props.title}/> : null}
                {props.mainContent ? props.mainContent : null}
                {props.bottomContent ? props.bottomContent : null}
            </div>
            <ButtonList itemList={props.buttonList}/>
        </div>
    }
    componentWillUnmount(){
        Toast.hideToast();
    }

}

Page.propTypes={
    id: PropTypes.string.isRequired,
    className: PropTypes.string,
    title: PropTypes.string,
    mainContent: PropTypes.any,
    bottomContent: PropTypes.any,
    buttonList: PropTypes.any
};

module.exports=Page;