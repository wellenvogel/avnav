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
import Toast from '../components/Toast.jsx';
import keyhandler from '../util/keyhandler.js';

class ViewPage extends React.Component{
    constructor(props){
        super(props);
        this.buttons=[
            GuiHelpers.mobDefinition,
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        let state={
            data:'',
            changed:false
        };
        if (! this.props.options ) {
            history.pop();
        }
        this.type=this.props.options.type;
        this.name=this.props.options.name;
        this.state=state;
        keyhandler.disable();
    }

    componentDidMount(){
        let self=this;
        Requests.getHtmlOrText("?request=download&type="+this.type+"&name="+encodeURIComponent(this.name),{useNavUrl:true,noCache:true}).then((text)=>{
            self.setState({data:text});
        },(error)=>{Toast("unable to load "+this.name+": "+error)});

    }
    componentWillUnmount(){
        keyhandler.enable();
    }
    render(){
        let self=this;
        let MainContent=<React.Fragment>
            <div className="mainContainer listContainer scrollable" >
            <textarea className="infoFrame"
                defaultValue={this.state.data}/>
            </div>
            </React.Fragment>;

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="viewpage"
                title={this.name}
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}

module.exports=ViewPage;