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
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import GuiHelpers from '../util/GuiHelpers.js';
import Toast,{hideToast} from '../components/Toast.jsx';
import OverlayDialog from '../components/OverlayDialog.jsx';
import keyhandler from '../util/keyhandler.js';
import CodeFlask from 'codeflask';
import Prism from 'prismjs';

const languageMap={
    js:'js',
    json:'json',
    html:'html',
    css:'css',
    txt: 'text'
};

const IMAGES=['png','jpg','svg','bmp','tiff','gif'];

class ViewPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        let state={
            data:'',
            changed:false,
            readOnly:false
        };
        if (! this.props.options ) {
            history.pop();
        }
        this.type=this.props.options.type;
        this.name=this.props.options.name;
        if (this.props.options.readOnly || this.isImage()){
            state.readOnly=true;
        }
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
                visible: !this.state.readOnly,
                onClick: ()=> {
                    hideToast();
                    let data = this.flask.getCode();
                    if (self.getLanguage() == 'json'){
                        try{
                            JSON.parse(data);
                        }
                        catch (ex){
                            let txt=ex.message;
                            if (txt.match(/osition [0-9]/)){
                                try {
                                    let num = txt.replace(/.*osition */, '');
                                    num=parseInt(num);
                                    let lines=data.substr(0,num).replace(/[^\n]*/g,'').length+1;
                                    txt+=" (around line "+lines+")";
                                }catch(e){}

                            }
                            Toast("invalid json: "+txt);
                            return;
                        }
                    }
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
                    if (this.state.changed){
                        OverlayDialog.confirm("Discard Changes?")
                            .then((data)=>{history.pop();})
                            .catch((e)=>{});
                        return;
                    }
                    history.pop()
                }
            }
        ];
    }
    changed(data){
        if (this.state.changed) return;
        this.setState({changed:true});
    }
    getExt(){
        return this.name.replace(/.*\./,'');
    }
    isImage(){
        let ext=this.getExt().toLowerCase();
        return (IMAGES.indexOf(ext) >= 0);
    }
    getLanguage(){
        let ext=this.getExt();
        let language=languageMap[ext];
        if (! language) language="text";
        return language;
    }
    getUrl(includeNavUrl){
        return (includeNavUrl?globalStore.getData(keys.properties.navUrl):"")+"?request=download&type="+this.type+"&name="+encodeURIComponent(this.name);
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
        let isImage=this.isImage();
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
                title={(this.state.readOnly?"Showing":"Edit")+":"+this.name}
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons}/>
        );
    }
}

module.exports=ViewPage;