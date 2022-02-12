/**
 * Created by andreas on 02.05.14.
 */


import Button from '../components/Button.jsx';
import React from 'react';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';

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
                            if (window.localStorage){
                                window.localStorage.setItem(globalStore.getData(keys.properties.licenseAcceptedName),"true");
                            }
                            this.props.history.replace('mainpage');
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