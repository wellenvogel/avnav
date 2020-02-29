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
import Requests from '../util/requests.js';
import GuiHelpers from '../util/GuiHelpers.js';
import InputMonitor from '../hoc/InputMonitor.jsx';

const readAddOns = function () {
    if (globalStore.getData(keys.gui.global.onAndroid, false)) return;
    if (!globalStore.getData(keys.gui.capabilities.addons)) return;
    Requests.getJson("?request=readAddons").then((json)=>{
            let items = [];
            for (let e in json.data) {
                let button = json.data[e];
                let entry = {
                    key: button.key,
                    url: button.url,
                    icon: button.icon,
                    title: button.title
                };
                if (entry.key) {
                    items.push(entry);
                }
            }
            globalStore.storeData(keys.gui.addonpage.addOns, items);
        },
        (error)=>{
            Toast("reading addons failed: " + error);
        });
};

class AddOnPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            GuiHelpers.mobDefinition,
            {
                name: 'Back',
                onClick: ()=>{window.history.back();}
            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.state={};
        this.buildButtonList=this.buildButtonList.bind(this);
        if (this.props.options && this.props.options.activeAddOn !== undefined){
            globalStore.storeData(keys.gui.addonpage.activeAddOn,this.props.options.activeAddOn);
        }
        if (globalStore.getData(keys.gui.addonpage.activeAddOn) === undefined){
            globalStore.storeData(keys.gui.addonpage.activeAddOn,0);
        }
    }
    componentDidMount(){
        readAddOns();
    }
    buildButtonList(addOns,activeIndex){
        let rt = [];
        if (addOns) {
            for (let i = 0; i < addOns.length; i++) {
                let addOn = addOns[i];
                let button = {
                    name: addOn.key,
                    icon: addOn.icon,
                    onClick: ()=> {
                        //first unload the iframe completely to avoid pushing to the history
                        globalStore.storeData(keys.gui.addonpage.activeAddOn, -1);
                        window.setTimeout(()=> {
                            globalStore.storeData(keys.gui.addonpage.activeAddOn, i);
                        },100);
                    },
                    toggle: activeIndex == i
                };
                rt.push(button);
            }
        }
        return rt.concat(this.buttons);
    }
    render(){
        let self=this;
        let Rt=Dynamic((props)=> {
                let currentAddOn={};
                if (props.addOns) {
                    currentAddOn = props.addOns[props.activeAddOn || 0] || {};
                }
                let MainContent= InputMonitor((props)=>
                    <div className="addOnFrame">
                        {currentAddOn.url?<iframe src={currentAddOn.url} className="addOn"/>:null}
                    </div>);
                return (
                    <Page
                        className={self.props.className}
                        style={self.props.style}
                        id="addonpage"
                        title={currentAddOn.title}
                        mainContent={
                            <MainContent/>
                        }
                        buttonList={self.buildButtonList(props.addOns,props.activeAddOn||0)}/>
                );
            },{
            storeKeys:{
                activeAddOn:keys.gui.addonpage.activeAddOn,
                addOns: keys.gui.addonpage.addOns
                }
            }
        );
        return <Rt/>;
    }
}

module.exports=AddOnPage;