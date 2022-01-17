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
import InputMonitor from '../hoc/InputMonitor.jsx';
import Mob from '../components/Mob.js';
import Addons from '../components/Addons.js';
import remotechannel, {COMMANDS} from "../util/remotechannel";


class AddOnPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            Mob.mobDefinition,
            {
                name: 'Back',
                onClick: ()=>{window.history.back();}
            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.state={
            addOns:[]
        };
        this.buildButtonList=this.buildButtonList.bind(this);
        if (this.props.options && this.props.options.activeAddOn !== undefined){
            globalStore.storeData(keys.gui.addonpage.activeAddOn,this.props.options.activeAddOn);
        }
        if (globalStore.getData(keys.gui.addonpage.activeAddOn) === undefined){
            globalStore.storeData(keys.gui.addonpage.activeAddOn,0);
        }
        this.remoteToken=remotechannel.subscribe(COMMANDS.addOn,(number)=>{
            let i=parseInt(number);
            if (i < 0 || i >= this.state.addOns.length) return;
            globalStore.storeData(keys.gui.addonpage.activeAddOn, -1);
            window.setTimeout(()=> {
                globalStore.storeData(keys.gui.addonpage.activeAddOn, i);
            },100);
        })
    }
    componentWillUnmount() {
        remotechannel.unsubscribe(this.remoteToken);
    }

    componentDidMount(){
        let self=this;
        Addons.readAddOns(true)
            .then((items)=>{
                let currenIndex=globalStore.getData(keys.gui.addonpage.activeAddOn);
                if (self.props.options && self.props.options.addonName){
                    for (let i=0;i<items.length;i++){
                        if (items[i].name == self.props.options.addonName){
                            if (i != currenIndex){
                                currenIndex=i;
                                globalStore.storeData(keys.gui.addonpage.activeAddOn,i);
                            }
                            break;
                        }
                    }
                }
                if (currenIndex === undefined || currenIndex < 0 || currenIndex >= items.length){
                    globalStore.storeData(keys.gui.addonpage.activeAddOn,0);
                }
                self.setState({addOns:items})
            })
            .catch(()=>{});
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
                        remotechannel.sendMessage(COMMANDS.addOn,i);
                        if (addOn.newWindow === 'true'){
                            window.open(addOn.url,'_blank');
                            return;
                        }
                        //first unload the iframe completely to avoid pushing to the history
                        globalStore.storeData(keys.gui.addonpage.activeAddOn, -1);
                        window.setTimeout(()=> {
                            globalStore.storeData(keys.gui.addonpage.activeAddOn, i);
                        },100);
                    },
                    toggle: activeIndex == i,
                    overflow: true,
                    visible: addOn.newWindow !== 'true' || addOn.url.match(/^http/) || ! globalStore.getData(keys.gui.global.onAndroid,false)
                };
                rt.push(button);
            }
        }
        return this.buttons.concat(rt);
    }
    render(){
        let self=this;
        let Rt=Dynamic((props)=> {
                let currentAddOn={};
                if (self.state.addOns) {
                    currentAddOn = self.state.addOns[props.activeAddOn || 0] || {};
                }
                let url=currentAddOn.url;
                if (url && ! currentAddOn.keepUrl){
                    let urladd="_="+(new Date()).getTime();
                    if (url.match(/\?/)) url+="&"+urladd;
                    else url+="?"+urladd;
                }
                let showInWindow=currentAddOn.newWindow === 'true';
                let MainContent= InputMonitor((props)=>
                    <div className="addOnFrame">
                        {(currentAddOn.url && ! showInWindow)?<iframe src={url} className="addOn"/>:null}
                    </div>);
                return (
                    <Page
                        className={self.props.className}
                        style={self.props.style}
                        id="addonpage"
                        title={showInWindow?'':currentAddOn.title}
                        mainContent={
                            <MainContent/>
                        }
                        buttonList={self.buildButtonList(self.state.addOns,props.activeAddOn||0)}/>
                );
            },{
            storeKeys:{
                activeAddOn:keys.gui.addonpage.activeAddOn,
                }
            }
        );
        return <Rt/>;
    }
}

export default AddOnPage;