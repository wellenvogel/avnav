/**
 * Created by andreas on 02.05.14.
 */

import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Mob from '../components/Mob.js';
import Addons from '../components/Addons.js';
import UserAppDialog from '../components/UserAppDialog.jsx';


const AddonItem=(props)=>{
    let className="addonItem listEntry";
    if (props.invalid) className+=" invalid";
    if (props.className) className+=" "+props.className;
    let source=props.source||'user';
    if (props.invalid) source+=", invalid";
    if (props.newWindow === 'true') source+=", new window";
    let url=(props.originalUrl!==undefined)?props.originalUrl:props.url;
    return (
        <div className={className} onClick={props.onClick}>
            <img className="appIcon" src={props.icon}/>
            <div className="itemMain">
                <div className="info">{url}</div>
                {props.title && <div className="itemTitle">{props.title}</div>}
                <div className="sourceInfo">{source}</div>
            </div>
            {!props.invalid &&<Button name="AddonConfigView" className="smallButton"
                                      onClick={(ev)=>{
                                        ev.preventDefault();
                                        ev.stopPropagation();
                                        history.push("addonpage",{addonName:props.name})
                                      }
                }/>}
        </div>
    )
};

class AddonConfigPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            Mob.mobDefinition,
            {
                name: 'AddonConfigPlus',
                onClick: ()=> {
                    UserAppDialog.showUserAppDialog({},false,true)
                        .then(()=>this.readAddons())
                        .catch(()=>this.readAddons());
                }

            },
            {
                name: 'AddonConfigAddOns',
                onClick: ()=> {
                    history.push('addonpage')
                }

            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.state={
            addOns:[]
        };
    }
    readAddons(){
        let self=this;
        Addons.readAddOns(true,true)
            .then((items)=>{
                self.setState({addOns:items})
            })
            .catch(()=>{});
    }
    componentDidMount(){
        this.readAddons();
    }

    render() {
        let self=this;
        let MainContent = (props)=>
            <ItemList
                className="addonItems"
                scrollable={true}
                itemList={props.items}
                itemClass={AddonItem}
                onItemClick={(item)=>{
                    UserAppDialog.showUserAppDialog(item,{name:item.name},true)
                        .then(()=>self.readAddons())
                        .catch(()=>self.readAddons());
                }}
                />;
        return (
            <Page
                className={self.props.className}
                style={self.props.style}
                id="addonconfigpage"
                title="Configure UserApps"
                mainContent={
                            <MainContent
                                items={self.state.addOns}
                            />
                        }
                buttonList={self.buttons}/>
        );

    }
}

export default AddonConfigPage;