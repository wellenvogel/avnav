/**
 * Created by andreas on 02.05.14.
 */


import Button from '../components/Button.jsx';
import React from 'react';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import keys, {KeyHelper} from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import PropertyHandler from '../util/propertyhandler';
import loadSettings from "../components/LoadSettingsDialog";
import LayoutHandler from "../util/layouthandler";
import Toast from "../components/Toast";

class WarningPage extends React.Component{
    constructor(props){
        super(props);
        this.state={};
    }
    componentDidMount(){
        let self=this;
        Requests.getHtmlOrText('warning.html').then((text)=>{
            self.setState({warning:text});
        },(error)=>{});
    }
    okFunction(){
        if (window.localStorage){
            window.localStorage.setItem(globalStore.getData(keys.properties.licenseAcceptedName),"true");
        }
        let flattenedKeys=KeyHelper.flattenedKeys(keys.properties);
        PropertyHandler.listSettings(true)
            .then(
                (settingsList)=>{
                    if (settingsList && settingsList.length > 1){
                        return loadSettings(globalStore.getMultiple(flattenedKeys),
                            settingsList[0].value,
                            "Select initial Settings")
                    }
                    else{
                        return Promise.reject();
                    }
                },
                (error)=>{
                    return Promise.reject();
                })
            .then((values)=>{
                if (values[keys.properties.layoutName] !== globalStore.getData(keys.properties.layoutName)){
                    if (! LayoutHandler.hasLoaded(values[keys.properties.layoutName])){
                        Promise.reject("layout not loaded, cannot activate it");
                        return;
                    }
                    LayoutHandler.activateLayout();
                }
                globalStore.storeMultiple(values);
                return 0;
            })
            .then((r)=>this.props.history.replace('mainpage'))
            .catch((e)=>{
                if (e) Toast(e);
                this.props.history.replace('mainpage');
            })
    }
    render(){
        let self=this;
        let MainContent = <React.Fragment>
            <div className="listContainer scrollable" ref="frame">
                <div className="warningFrame">
                    <div className="warningText" dangerouslySetInnerHTML={{__html: this.state.warning}}>
                    </div>
                </div>
                <div className="warningButtonContainer">
                    <Button
                        name="WarningOK"
                        onClick={()=>{
                            this.okFunction()
                        }
                    }
                        />
                </div>
            </div>
        </React.Fragment>;

        return (
            <Page
                {...this.props}
                id="warningpage"
                title="Warning"
                mainContent={
                            MainContent
                        }
                buttonList={[
                    {
                    name: 'Cancel',
                    storeKeys: {visible: keys.gui.global.onAndroid},
                    onClick: ()=> {
                        avnav.android.goBack()
                    }

                    }
                ]}/>
        );
    }
}

export default WarningPage;