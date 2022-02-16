/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import helper from '../util/helper.js';
import React from 'react';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import Mob from '../components/Mob.js';
import Toast,{hideToast} from '../components/Toast.jsx';
import OverlayDialog from '../components/OverlayDialog.jsx';
import keyhandler from '../util/keyhandler.js';
import CodeFlask from 'codeflask';
import Prism from 'prismjs';
import GuiHelpers from '../util/GuiHelpers.js';
import InputMonitor from '../hoc/InputMonitor.jsx';
import Helper from "../util/helper.js";
import {ItemActions} from "../components/FileDialog";

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


class ViewPageBase extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        let state={
            data:'',
            changed:false,
            readOnly:false
        };
        if (! this.props.options ) {
            this.props.history.pop();
        }
        this.type=this.props.options.type;
        this.name=this.props.options.name;
        this.url=this.props.options.url;
        this.html=this.props.options.html;
        if (this.props.options.readOnly || this.isImage() || this.url || this.html){
            state.readOnly=true;
        }
        if (this.html){
            state.data=this.html;
        }
        this.state=state;
        this.changed=this.changed.bind(this);
        this.flask=undefined;
        keyhandler.disable();
    }

    buttons() {
        let self=this;
        return [
            Mob.mobDefinition(this.props.history),
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
                    let actions=ItemActions.create({type:self.type,name:self.name});
                    let uploadFunction;
                    if (actions.localUploadFunction){
                        uploadFunction=actions.localUploadFunction;
                    }
                    else{
                        uploadFunction=(name,data,overwrite)=>{
                            return Requests.postPlain({
                                request:'upload',
                                type:self.type,
                                overwrite: overwrite,
                                name: name
                            },data)
                        }
                    }
                    uploadFunction(self.name,data,true)
                        .then((ok)=>this.setState({changed: false}))
                        .catch((error)=>Toast("unable to save: " + error));
                }

            },
            {
                name: 'Cancel',
                onClick: ()=> {
                    if (this.state.changed){
                        OverlayDialog.confirm("Discard Changes?")
                            .then((data)=>{this.props.history.pop();})
                            .catch((e)=>{});
                        return;
                    }
                    this.props.history.pop()
                }
            }
        ];
    }
    changed(data){
        if (this.state.changed) return;
        this.setState({changed:true});
    }
    getExt(){
        if (this.url) return Helper.getExt(this.url);
        if (this.html) return 'html';
        let actions=ItemActions.create({type:this.type,name:this.name});
        return actions.extForView;
    }
    isImage(){
        let ext=this.getExt().toLowerCase();
        return (GuiHelpers.IMAGES.indexOf(ext) >= 0);
    }
    canChangeMode(){
        return this.getExt() == 'html' && ! this.props.options.readOnly && ! this.url && ! this.html;
    }
    getLanguage(){
        let ext=this.getExt();
        let language=languageMap[ext];
        if (! language) language="text";
        return language;
    }
    getUrl(includeNavUrl){
        if (this.url) return this.url;
        return (includeNavUrl?globalStore.getData(keys.properties.navUrl):"")+"?request=download&type="+this.type+"&name="+encodeURIComponent(this.name);
    }
    componentDidMount(){
        let self=this;
        if (this.isImage()) return;
        if (this.html) {
            return;
        }
        Requests.getHtmlOrText(this.getUrl(true),{noCache:true}).then((text)=>{
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
        },(error)=>{Toast("unable to load "+(this.url||this.name)+": "+error)});

    }
    componentWillUnmount(){
        keyhandler.enable();
    }
    render(){
        let self=this;
        let mode=this.isImage()?0:(this.getExt() == 'html')?1:2;
        if (this.url){
            mode=this.props.options.useIframe?4:1;
        }
        if (this.html) mode=1;
        let showView=this.state.readOnly || this.canChangeMode();
        let showEdit=!this.state.readOnly || this.canChangeMode();
        let viewData=(showEdit && this.flask)?this.flask.getCode():this.state.data;
        let viewClass="mainContainer view";
        if (!this.state.readOnly) viewClass+=" hidden";
        if (mode === 4) viewClass+=" flex";
        if (mode == 0) viewClass+=" image";
        let editClass="mainContainer edit";
        if (this.state.readOnly) editClass+=" hidden";
        let MainContent=<React.Fragment>
            {showView &&
                <div className={viewClass}>
                    {(mode == 1)&&  <div dangerouslySetInnerHTML={{__html: viewData}}/>}
                    {(mode == 0) && <img className="readOnlyImage" src={this.getUrl(true)}/>}
                    {(mode == 2) && <textarea className="readOnlyText" defaultValue={viewData} readOnly={true}/>}
                    {(mode == 4) &&
                    <div className="addOnFrame">
                        <iframe className="viewPageIframe addOn" src={this.getUrl(true)}/>
                    </div>
                    }
                </div>}
            {showEdit &&
                <div className={editClass} ref="editor">
                </div>
            }
            </React.Fragment>;

        return (
            <Page
                {...this.props}
                id="viewpage"
                title={(this.state.readOnly?"Showing":"Editing")+": "+this.name}
                mainContent={
                            MainContent
                        }
                buttonList={self.buttons()}/>
        );
    }
}

var ViewPage=InputMonitor(ViewPageBase);
ViewPage.VIEWABLES=Object.keys(languageMap).concat(GuiHelpers.IMAGES);
ViewPage.EDITABLES=Object.keys(languageMap);
ViewPage.MAXEDITSIZE=MAXEDITSIZE;

export default ViewPage;