/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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

import base from '../base.js';

const getTokenHandlerKey=(tokenUrl,opt_tokenFunction)=>{
    return (opt_tokenFunction||'none')+"-"+tokenUrl;
};
const addUser=(tokenScript,chartKey)=>{
    if (! tokenScript) return;
    if ( ! tokenScript.users) {
        tokenScript.users=[chartKey];
        return true;
    }
    for (let k in tokenScript.users){
        if (tokenScript.users[k] == chartKey) return false;
    }
    tokenScript.users.push(chartKey)
};
const removeUser=(tokenScript,chartKey)=>{
    if (! tokenScript || ! tokenScript.users) return 0;
    for (let k in tokenScript.users){
        if (tokenScript.users[k] == chartKey){
            tokenScript.users.splice(k);
            return tokenScript.users.length;
        }
    }
    return tokenScript.users.length;
};
class CryptHandler{
    constructor(){
        this.loadedTokenScripts={};

        this.heartBeatTime=20000;
        this.heartBeat=this.heartBeat.bind(this);
        this.timer=window.setInterval(this.heartBeat,this.heartBeatTime)

    }

    heartBeat(){
        for (let k in this.loadedTokenScripts) {
            let entry=this.loadedTokenScripts[k];
            if (entry.heartBeatFunction && entry.users && entry.users.length > 0) entry.heartBeatFunction();
        }
    }
    resetHartbeats(){
        for (let k in this.loadedTokenScripts) {
            this.loadedTokenScripts[k].heartBeatFunction=undefined;
            this.loadedTokenScripts[k].encryptFunction=undefined;
            this.loadedTokenScripts[k].users=[];
        }
    };
    removeChartEntry(chartKey){
        for (let k in this.loadedTokenScripts){
            let entry=this.loadedTokenScripts[k];
            let remain=removeUser(entry,chartKey);
            if (remain == 0){
                this.loadedTokenScripts[k].encryptFunction=undefined;
                this.loadedTokenScripts[k].heartBeatFunction=undefined;
            }
        }
    }
    createOrActivateEncrypt(chartKey,tokenUrl,opt_tokenFunction){
        let self=this;
        let key=getTokenHandlerKey(tokenUrl,opt_tokenFunction);
        return new Promise((resolve,reject)=>{
            let scriptId=opt_tokenFunction;
            if (! scriptId) scriptId="tokenHandler"+(new Date()).getTime();
            if (! this.loadedTokenScripts[key]){
                base.log("load new tokenhandler "+tokenUrl);
                let scriptel=document.createElement("script");
                scriptel.setAttribute("type","text/javascript");
                document.getElementsByTagName("head")[0].appendChild(scriptel);
                scriptel.setAttribute("id",scriptId);
                scriptel.onload=()=>{
                    base.log("token handler "+scriptId+" loaded");
                    this.loadedTokenScripts[key]={};
                    let baseObject=window.avnav[scriptId];
                    if (! baseObject || ! baseObject.heartBeat){
                        reject("unable to install crypto handler");
                        return;
                    }
                    baseObject.heartBeat()
                        .then((res)=>{
                            self.loadedTokenScripts[key]= {
                                heartBeatFunction: baseObject.heartBeat,
                                encryptFunction: baseObject.encryptUrl,
                                users:[chartKey]
                            };
                            resolve({
                                encryptFunction:baseObject.encryptUrl
                            });
                            return;
                        })
                        .catch((err)=> {
                            reject("error initializing chart access: " + err);
                            return;
                        });
                };
                scriptel.setAttribute("src",tokenUrl);
            }
            else{
                if (this.loadedTokenScripts[key].encryptFunction){
                    //this tokenhandler is loaded and heartbeat is running
                    addUser(this.loadedTokenScripts[key],chartKey);
                    resolve({
                        encryptFunction:this.loadedTokenScripts[key].encryptFunction
                    });
                    return;
                }
                let baseObject=window.avnav[scriptId];
                //script already loaded
                if (! baseObject || ! baseObject.heartBeat){
                    reject("unable to install crypto handler");
                }
                baseObject.heartBeat()
                    .then((res)=>{
                        self.loadedTokenScripts[key]= {
                            heartBeatFunction: baseObject.heartBeat,
                            encryptFunction: baseObject.encryptUrl,
                            users:[chartKey]
                        };
                        resolve({
                            encryptFunction:baseObject.encryptUrl
                        });
                        return;
                    })
                    .catch((err)=> {
                        reject("error initializing chart access: " + err);
                        return;
                    });
            }
        });
    };

}

export default  new CryptHandler();