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
import Prism from 'prismjs';
import CodeFlask from 'codeflask';

const languageMap={
    js:'js',
    json:'json',
    html:'html',
    css:'css'
};

class ViewPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
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
        this.changed=this.changed.bind(this);
        this.flask=undefined;
        keyhandler.disable();
    }

    buttons() {
        let self=this;
        return [
            GuiHelpers.mobDefinition,
            {
                name: 'ViewPageSave',
                disabled: !this.state.changed,
                onClick: ()=> {
                    let data = this.flask.getCode();
                    Requests.postJson("?request=upload&type=" + self.type + "&overwrite=true&filename=" + encodeURIComponent(self.name), data)
                        .then((result)=> {
                            this.setState({changed: false});
                        })
                        .catch((error)=> {
                            Toast("unable to save: " + error)
                        });

                }

            },
            {
                name: 'Cancel',
                onClick: ()=> {
                    history.pop()
                }
            }
        ];
    }
    changed(data){
        if (this.state.changed) return;
        this.setState({changed:true});
    }
    componentDidMount(){
        let self=this;
        Requests.getHtmlOrText("?request=download&type="+this.type+"&name="+encodeURIComponent(this.name),{useNavUrl:true,noCache:true}).then((text)=>{
            let ext=this.name.replace(/.*\./,'');
            let language=languageMap[ext];
            this.flask=new CodeFlask(self.refs.editor,{language:language,lineNumbers:true,noInitialCallback:true});
            this.flask.updateCode(text,true);
            this.flask.onUpdate(this.changed);
        },(error)=>{Toast("unable to load "+this.name+": "+error)});

    }
    componentWillUnmount(){
        keyhandler.enable();
    }
    render(){
        let self=this;
        let MainContent=<React.Fragment>
            <div className="mainContainer" ref="editor">
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
                buttonList={self.buttons()}/>
        );
    }
}

module.exports=ViewPage;