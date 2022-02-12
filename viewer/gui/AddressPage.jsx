/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import QRCode from 'qrcode.react';
import Mob from '../components/Mob.js';

const AddressItem=(props)=>{
    let url="http://"+props.value;
    return(
        <div className="address">
            <div className="url">
                {url}
            </div>
            <QRCode value={url}/>
        </div>

    );
};

class AddressPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            {
                name:'AndroidBrowser',
                visible: globalStore.getData(keys.gui.global.onAndroid),
                onClick:()=>{avnav.android.launchBrowser();}
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        this.querySequence=1;
        this.doQuery=this.doQuery.bind(this);
    }
    doQuery(){
        let currentSequence=this.querySequence;
        let self=this;
        Requests.getJson("?request=status",{checkOk:false}).then(
            (json)=>{
                if (self.querySequence != currentSequence) return;
                let list=[];
                if (json.handler){
                    json.handler.forEach((el)=>{
                        if (el.properties && el.properties.addresses) {
                            for (let i = 0; i < el.properties.addresses.length; i++) {
                                list.push(el.properties.addresses[i]);
                            }
                        }
                    });
                }
                globalStore.storeData(keys.gui.addresspage.addressList,list);
                self.timer=window.setTimeout(self.doQuery,globalStore.getData(keys.properties.statusQueryTimeout));
            },
            (error)=>{
                if (self.querySequence != currentSequence) return;
                globalStore.storeData(keys.gui.addresspage.addressList,[]);
                self.timer=window.setTimeout(self.doQuery,globalStore.getData(keys.properties.statusQueryTimeout));
            });
    }
    componentDidMount(){
        this.querySequence++;
        this.doQuery();
    }
    componentWillUnmount(){
        let self=this;
        if (self.timer){
            window.clearTimeout(self.timer);
            delete self.timer;
        }
        self.querySequence++;
    }
    render(){
        let self=this;
        let MainContent=Dynamic((props)=>{
            if (! props.addressList || props.addressList.length < 1) return null;
            let itemList=[];
            props.addressList.forEach((address)=>{
                itemList.push({
                    name:address,
                    value:address
                })
            });
            return (
              <ItemList
                  itemList={itemList}
                  itemClass={AddressItem}
                  scrollable={true}
                  />
            );
        });

        return (
            <Page
                {...self.props}
                id="addresspage"
                title="Server Addresses"
                mainContent={
                            <MainContent
                                storeKeys={{addressList:keys.gui.addresspage.addressList}}
                            />
                        }
                buttonList={self.buttons}/>
        );
    }
}

export default AddressPage;