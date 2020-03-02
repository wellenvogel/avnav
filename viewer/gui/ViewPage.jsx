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
        let state={
            data:undefined,
            changed:false
        };
        if (! this.props.options ) {
            history.pop();
        }
        this.type=this.props.options.type;
        this.name=this.props.options.name;
        this.state=state;
        this.changed=this.changed.bind(this);
        keyhandler.disable();
        let self=this;
        this.timer=GuiHelpers.lifecycleTimer(this,(seq)=>{
            if (self.refs.editor && self.state.data !== undefined){
                if (self.refs.editor.value != this.state.data) self.changed();
            }
            self.timer.startTimer(seq);
        },1000,true)
    }

    buttons() {
        let self=this;
        return [
            GuiHelpers.mobDefinition,
            {
                name: 'ViewPageSave',
                disabled: !this.state.changed,
                onClick: ()=> {
                    let data = this.refs.editor.value;
                    Requests.postJson("?request=upload&type=" + self.type + "&overwrite=true&filename=" + encodeURIComponent(self.name), data)
                        .then((result)=> {
                            this.setState({changed: false,data:data});
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
            <textarea className="infoFrame" ref="editor"
                defaultValue={this.state.data}
                onChange={this.onChange}
                />
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