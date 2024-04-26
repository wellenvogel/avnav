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
class ImportDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            subdir:props.subdir,
            useSubdir:props.subdir?true:false
        };
    }
    render(){
        return (
            <React.Fragment>
                <div className="importDialog flexInner">
                    <h3 className="dialogTitle">Upload Chart to Importer</h3>
                    <InputReadOnly
                        dialogRow={true}
                        label="name"
                        value={this.props.name}
                    />
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
                                this.props.okFunction(this.props,this.state.useSubdir?this.state.subdir:undefined);
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
    allowSubDir: PropTypes.bool
}

export default ImportDialog;