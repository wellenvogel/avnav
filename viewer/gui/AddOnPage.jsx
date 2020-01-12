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


class AddOnPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            GuiHelpers.mobDefinition,
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.state={};
        this.checkOptions=this.checkOptions.bind(this);
        this.buildButtonList=this.buildButtonList.bind(this);
    }
    checkOptions(){
        if (! (this.props.options && this.props.options.addOns)){
            history.pop();
        }
    }
    componentDidMount(){
        this.checkOptions();
    }
    componentDidUpdate(){
        this.checkOptions();
    }
    buildButtonList(activeIndex){
        let rt=[];
        if (this.props.options && this.props.options.addOns){
            for (let i=0;i< this.props.options.addOns.length;i++ ){
                let addOn=this.props.options.addOns[i];
                let button={
                    name:addOn.key,
                    icon: addOn.icon,
                    onClick:()=>{
                        globalStore.storeData(keys.gui.addonpage.activeAddOn,i);
                    },
                    toggle:activeIndex==i
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
                if (self.props.options && self.props.options.addOns){
                    currentAddOn=self.props.options.addOns[props.activeAddOn||0]||{};
                }
                return (
                    <Page
                        className={self.props.className}
                        style={self.props.style}
                        id="addonpage"
                        title={currentAddOn.title}
                        mainContent={
                            <div className="addOnFrame">
                                <iframe src={currentAddOn.url} className="addOn"/>
                            </div>
                        }
                        buttonList={self.buildButtonList(props.activeAddOn||0)}/>
                );
            },{
            storeKeys:{
                activeAddOn:keys.gui.addonpage.activeAddOn
                }
            }
        );
        return <Rt/>;
    }
}

module.exports=AddOnPage;