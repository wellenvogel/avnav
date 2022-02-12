/**
 * Created by andreas on 02.05.14.
 */

import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import React from 'react';
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
                                        props.history.push("addonpage",{addonName:props.name})
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
            Mob.mobDefinition(this.props.history),
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
                    self.props.history.push('addonpage')
                }

            },
            {
                name: 'Cancel',
                onClick: ()=>{self.props.history.pop()}
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
                itemClass={(iprops)=>{
                    return <AddonItem
                        {...iprops}
                        history={self.props.history}
                        />
                }}
                onItemClick={(item)=>{
                    UserAppDialog.showUserAppDialog(item,{name:item.name},true)
                        .then(()=>self.readAddons())
                        .catch(()=>self.readAddons());
                }}
                />;
        return (
            <Page
                {...self.props}
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