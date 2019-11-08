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
import Requests from '../util/requests.js';
import MapHolder from '../map/mapholder.js';
import GuiHelpers from './helpers.js';

class GpsPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.state={};
        this.buttons=[
            {
                name:'GpsCenter',
                onClick:()=>{
                    MapHolder.centerToGps();
                    history.pop();
                }
            },
            {
                name: "Gps2",
                storeKeys:{pageNumber:keys.gui.gpspage.pageNumber},
                updateFunction:(state)=>{return {toggle:state.pageNumber != 1}},
                onClick:()=>{
                    let page=globalStore.getData(keys.gui.gpspage.pageNumber,1);
                    if (page == 1) page=2;
                    else page=1;
                    globalStore.storeData(keys.gui.gpspage.pageNumber,page);
                }
            },
            {
                name: "AnchorWatch",
                storeKeys: {watchDistance:keys.nav.anchor.watchDistance},
                updateFunction:(state)=>{
                    return {toggle:state.watchDistance !== undefined}
                },
                onClick: ()=>{
                    GuiHelpers.anchorWatchDialog(undefined);
                }
            },
            {
                name:'Cancel',
                onClick:()=>{history.pop();}
            }
        ];
    }

    componentDidMount(){
        let self=this;

    }
    render(){
        let self=this;
        let MainContent=<React.Fragment>

            </React.Fragment>;

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="gpspage"
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}

module.exports=GpsPage;