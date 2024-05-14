/**
 *###############################################################################
 # Copyright (c) 2012-2024 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 */
import React from 'react';
import PropTypes from 'prop-types';
import {Checkbox, Input, InputReadOnly} from "./Inputs";
import DB from "./DialogButton";
import helper from '../util/helper'
import assign from 'object-assign';
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import Requests from "../util/requests";
class ImportDialog extends React.Component{
    constructor(props){
        super(props);
        let name=props.name;
        let ext=helper.getExt(name);
        name=name.substr(0,name.length-ext.length-1);
        this.state={
            subdir:props.subdir,
            useSubdir:props.subdir?true:false,
            name:name,
            ext: ext
        };
    }
    render(){
        return (
            <React.Fragment>
                <div className="importDialog flexInner">
                    <h3 className="dialogTitle">Upload Chart to Importer</h3>
                    {!this.props.allowNameChange && <InputReadOnly
                        dialogRow={true}
                        label="name"
                        value={this.state.name}>
                        <span className="ext">.{this.state.ext}</span>
                    </InputReadOnly>
                    }
                    {
                        this.props.allowNameChange && <Input
                            dialogRow={true}
                            value={this.state.name}
                            onChange={(nv)=>{
                                this.setState({name:nv})
                            }}
                            label="name">
                            <span className="ext">.{this.state.ext}</span>
                        </Input>
                    }
                    {this.props.allowSubDir && <Checkbox
                        dialogRow={true}
                        label="use set name"
                        value={this.state.useSubdir}
                        onChange={(nv)=>this.setState({useSubdir:nv})}
                    />}
                    {this.props.allowSubDir && this.state.useSubdir?<Input
                            dialogRow={true}
                            label="set name"
                            value={this.state.subdir}
                            onChange={(nv)=>{this.setState({subdir:nv})}}
                        />
                        :
                        null}

                    <div className="dialogButtons">
                        <DB name="cancel"
                            onClick={()=>{
                                this.props.cancelFunction();
                                this.props.closeCallback();
                            }}
                        >Cancel</DB>
                        <DB name="ok"
                            onClick={()=>{
                                this.props.okFunction(assign({},this.props,{name:this.state.name+"."+this.state.ext}),this.state.useSubdir?this.state.subdir:undefined);
                                this.props.closeCallback();
                            }}
                            disabled={this.state.useSubdir && !this.state.subdir}
                        >OK</DB>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}
ImportDialog.propTypes={
    okFunction: PropTypes.func.isRequired,
    cancelFunction: PropTypes.func.isRequired,
    subdir: PropTypes.string,
    name: PropTypes.string.isRequired,
    allowSubDir: PropTypes.bool,
    allowNameChange: PropTypes.bool
};

export const readImportExtensions=()=>{
    return new Promise((resolve,reject)=>{
        if (!globalStore.getData(keys.gui.capabilities.uploadImport)) resolve([]);
        Requests.getJson({
            request:'api',
            type:'import',
            command:'extensions'
        })
            .then((data)=>{
                resolve(data.items);
            })
            .catch(()=>{
                resolve([])
            });
    })
}
export const checkExt=(ext,extensionList)=>{
    if (!ext || ! extensionList) return {allow:false,subdir:false}
    ext=ext.toUpperCase();
    if (! helper.startsWith(ext,'.')) ext='.'+ext;
    for (let i=0;i<extensionList.length;i++){
        if (extensionList[i].ext === ext) return {allow:true,subdir:extensionList[i].sub}
    }
    return {allow:false,sub:false}
}

export default ImportDialog;