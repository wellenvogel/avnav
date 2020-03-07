/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import helper from '../util/helper.js';
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

//add all extensions here that we can edit
//if set to undefined we will edit them but without highlighting
const languageMap={
    js:'js',
    json:'json',
    html:'markup',
    css:'css',
    xml: 'markup',
    gpx: 'markup',
    txt: undefined
};
const MAXEDITSIZE=50000;

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
                name: 'ViewPageView',
                visible: this.canChangeMode(),
                toggle: this.state.readOnly,
                onClick: ()=>{
                    this.setState({readOnly: true})
                }
            },
            {
                name: 'ViewPageEdit',
                visible: this.canChangeMode(),
                toggle: !this.state.readOnly,
                onClick: ()=>{
                    this.setState({readOnly: false})
                }
            },
            {
                name: 'ViewPageSave',
                disabled: !this.state.changed,
                visible: !this.state.readOnly || this.canChangeMode(),
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
                    else if(self.getExt() == 'xml'){
                        try{
                            let doc=helper.parseXml(data);
                            let errors=doc.getElementsByTagName('parsererror');
                            if (errors.length > 0){
                                Toast("invalid xml: "+errors[0].textContent.replace(/ *[bB]elow is a .*/,''));
                                return;
                            }
                        }catch(e){
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
    canChangeMode(){
        return this.getExt() == 'html';
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
        if (this.isImage()) return;
        Requests.getHtmlOrText(this.getUrl(),{useNavUrl:true,noCache:true}).then((text)=>{
            if (! this.state.readOnly || this.canChangeMode()) {
                let language = self.getLanguage();
                this.flask = new CodeFlask(self.refs.editor, {
                    language: language,
                    lineNumbers: true,
                    defaultTheme: false,
                    noInitialCallback: true,
                    highLighter: Prism.highlightElement
                });
                //this.flask.addLanguage(language,Prism.languages[language]);
                this.flask.updateCode(text, true);
                this.flask.onUpdate(this.changed);
            }
            this.setState({data:text})
        },(error)=>{Toast("unable to load "+this.name+": "+error)});

    }
    componentWillUnmount(){
        keyhandler.enable();
    }
    render(){
        let self=this;
        let mode=this.isImage()?0:(this.getExt() == 'html')?1:2;
        let showView=this.state.readOnly || this.canChangeMode();
        let showEdit=!this.state.readOnly || this.canChangeMode();
        let viewData=this.state.changed?this.flask.getCode():this.state.data;
        let viewClass="mainContainer view";
        if (!this.state.readOnly) viewClass+=" hidden";
        if (mode == 0) viewClass+=" image";
        let editClass="mainContainer edit";
        if (this.state.readOnly) editClass+=" hidden";
        let MainContent=<React.Fragment>
            {showView &&
                <div className={viewClass}>
                    {(mode == 1)&&  <div dangerouslySetInnerHTML={{__html: viewData}}/>}
                    {(mode == 0) && <img className="readOnlyImage" src={this.getUrl(true)}/>}
                    {(mode == 2) && <textarea className="readOnlyText" defaultValue={viewData} readOnly={true}/>}
                </div>}
            {showEdit &&
                <div className={editClass} ref="editor">
                </div>
            }
            </React.Fragment>;

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="viewpage"
                title={(this.state.readOnly?"Showing":"Editing")+": "+this.name}
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons()}/>
        );
    }
}

ViewPage.VIEWABLES=Object.keys(languageMap).concat(IMAGES);
ViewPage.EDITABLES=Object.keys(languageMap);
ViewPage.IMAGES=IMAGES;
ViewPage.MAXEDITSIZE=MAXEDITSIZE;

module.exports=ViewPage;