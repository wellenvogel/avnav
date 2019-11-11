/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Toast from '../util/overlay.js';
import MapHolder from '../map/mapholder.js';


class WpaPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];

    }


    componentDidMount(){
    }
    componentDidUpdate(){
    }
    componentWillUnmount(){
    }
    render(){
        let self=this;

        const MainContent=(props)=> {
            return(
            <React.Fragment>

            </React.Fragment>
            );
        };

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="wpapage"
                title="Wifi Client connection"
                mainContent={
                            <MainContent
                                
                            />
                        }
                buttonList={self.buttons}/>
        );
    }
}

module.exports=WpaPage;