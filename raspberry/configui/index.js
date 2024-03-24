(function(){
    let getToolTips=function(lang){
        let prefix=(lang === 'de' || ! lang)?'':(lang+'_');
        fetch(prefix+'tooltips.json')
            .then(function(r){return r.json()})
            .then(function(tips){
                for (let k in tips){
                    let el=document.getElementById(k);
                    if (el.tagName.toLowerCase() === 'div'){
                        el.textContent=tips[k];
                    }
                    else {
                        if (el) el.title = tips[k];
                    }
                }
            })
            .catch(function(e){
                if (prefix !== '') getToolTips();
            })
    }
    let download=function(data,name){
        const blob=new Blob([data],{type:'text/text'});
        const url = URL.createObjectURL(blob);
        const a = document.getElementById('downloadLink');
        a.href = url;
        a.download = name;

        // Click handler that releases the object URL after the element has been clicked
        // This is required for one-off downloads of the blob content
        const clickHandler = () => {
            setTimeout(() => {
                URL.revokeObjectURL(url);
                this.removeEventListener('click', clickHandler);
            }, 150);
        };
        a.addEventListener('click', clickHandler, false);
        a.click();
    }
    let checkBox=function(el){
        if (! el) return ;
        return el.checked?'yes':'no'
    };
    let setCheckBox=function(el,value){
        if (! el) return;
        if (! value) return;
        el.checked=value === 'yes';
    }
    let encryptPass=function(el){
        if (! el) return;
        if (el.value === '') return;
        if (el.hasAttribute('data-encrypted')){
            return el.getAttribute('data-encrypted');
        }
        let salt=Math.floor((new Date()).getTime())+"";
        let hash=sha512crypt(el.value,salt);
        el.setAttribute('data-encrypted',hash);
        return hash;
    }
    let hiddenPass="*************************";
    let setPass=function(el,value,initial){
        if (!el) return;
        if (! value) return;
        if (! initial){
            el.value=hiddenPass;
        }
        el.setAttribute('data-encrypted',value);
    }
    let getValue=function(el){
        if (! el) return;
        if (el.value === '') return;
        return el.value;
    }
    let setValue=function(el,value){
        if (! el) return;
        if (! value) return;
        el.value=value;
    }
    let selectValue=function(el){
        if (!el) return;
        let v=el.options[el.selectedIndex].value;
        return v;
    }
    let setSelected=function(el,value){
        if (! el) return;
        if (! value) return;
        el.value=value;
    }

    let fields={
        AVNAV_SSID: {r:getValue,s:setValue},
        AVNAV_PSK: {r:getValue,s:setValue},
        AVNAV_PASSWD: {r:encryptPass,s:setPass},
        AVNAV_MCS: {r:checkBox,s:setCheckBox},
        AVNAV_WIFI_CLIENT: {r:checkBox,s:setCheckBox},
        AVNAV_HOSTNAME: {r:getValue,s:setValue},
        AVNAV_TIMEZONE: {r:selectValue,s:setSelected},
        AVNAV_KBLAYOUT: {r:selectValue,s:setSelected},
        AVNAV_KBMODEL: {r:selectValue,s:setSelected},
        AVNAV_WIFI_COUNTRY: {r:selectValue,s:setSelected},
        AVNAV_STARTX: {r:checkBox,s:setCheckBox},
        AVNAV_DPI: {r:getValue,s:setValue},
        AVNAV_KEYHEIGHT: {r:getValue,s:setValue},
        AVNAV_HIDE_CURSOR: {r:checkBox,s:setCheckBox},
        AVNAV_DISPLAY_DIMENSIONS: {r:getValue,s:setValue},
        AVNAV_BASE_BOARD: {r:getValue,s:setValue},
        AVNAV_OBPPLOTTERV3: {r:getValue,s:setValue},
        AVNAV_HAT: {r:getValue,s:setValue},
        AVNAV_CONFIG_SEQUENCE: {r:getValue,s:setValue},
        AVNAV_MODULE_RTL8188EU: {r:checkBox,s:setCheckBox},
        AVNAV_MODULE_RTL8192EU: {r:checkBox,s:setCheckBox},
    };
    
    let templateReplace=function(template,replace){
        if (! template) return;
        let rt=template.split('\n');
        let hasReplaced={};
        //only replace the last occurance
        for (let i=rt.length-1;i>=0;i--){
            for (let k in replace){
                if (hasReplaced[k]) continue;
                let r=RegExp('^#*'+k+"=.*");
                if (! rt[i].match(r)) continue;
                let rv=replace[k];
                rt[i]=rt[i].replace(r,k+"='"+rv+"'");
                hasReplaced[k]=true;
            }
        }
        //add all values not yet being set
        for (let k in replace){
            if (hasReplaced[k]) continue;
            rt.push(k+"="+replace[k]);
            hasReplaced[k]=true;
        }
        return rt.join("\n");
    }
    let findInCurrent=function(current,key,includeComment){
        if (! current) return;
        let lines=current.split('\n');
        for (let i=0;i< (includeComment?1:2);i++){
            let r;
            if (i == 0 ){
                //1st try without comment lines
                r=RegExp('^'+key+"= *");
            }
            else{
                r=RegExp('^#'+key+"= *");
            }
            for (let l=lines.length-1;l>=0;l--){
                let line=lines[l];
                if (! line.match(r)) continue;
                line=line.replace(r,'');
                line=line.replace(/['"]*/g,'');
                line=line.replace(/#.*/,'');
                line=line.replace(/ .*/,'');
                if (line === 'yes' && i > 0){
                    line='no'; //for yes/no a commented yes is treated as no
                }
                return line;
            }
        }
    }
    let fillCurrentValues=function(data,initial){
        for (let k in fields){
            let dv=findInCurrent(data,k,initial);
            if (dv !== undefined){
                let el=document.getElementById(k);
                fields[k].s(el,dv,initial);
                if (initial){
                    if (el.hasAttribute('data-initial')){
                        el.setAttribute('data-initial',dv);
                    }
                }
            }
        }
    }
    let template=undefined;
    let fillSelect=function(parent,data){
        if (! parent || ! data) return;
        let defaultL=parent.getAttribute('data-default');
        let keys=(data instanceof Array)?data:Object.keys(data);
        keys.sort();
        for (let li in keys){
            let lname=keys[li];
            let entry=document.createElement('option');
            let value=(data instanceof Array)?lname:data[lname];
            if (typeof(value) === 'object'){
                value=lname;
            }
            entry.setAttribute('value',value);
            if (value === defaultL) entry.setAttribute('selected',true);
            entry.textContent=lname;
            parent.appendChild(entry);
        }
    }
    let getValueFor=function(sel){
        return parseFloat(getValue(document.querySelector(sel)))
    }
    const dpiFields={
        swmm:'#XScreenWidth',
        swpix:'#XScreenWPix',
        shmm:'#XScreenHeight',
        shpix:'#XScreenHPix'
    };
    let computeDpi=function(){
        let ipmm=0.0393701;
        let comp={};
        for (let k in dpiFields){
            comp[k]=getValueFor(dpiFields[k]);
        }
        let dpi="<>"
        try{
            let swi=comp.swmm*ipmm;
            let shi=comp.shmm*ipmm;
            dpi=parseInt(Math.max(comp.shpix/shi,comp.swpix/swi));
        }catch(e){

        }
        let t=document.querySelector('#XScreenDPI');
        t.textContent=dpi;
    }
    let showDpi=function(){
        let dialog=document.querySelector('.configui .dialogBack');
        if (dialog){
            dialog.classList.remove('hidden');
        }
        let ov=getValue(document.querySelector('#AVNAV_DISPLAY_DIMENSIONS'));
        if (ov){
            let parts=ov.split(',');
            let idx=0;
            for (let k in dpiFields){
                setValue(document.querySelector(dpiFields[k]),parts[idx]);
                idx++;
            }
        }
        computeDpi();
    }
    let hideDpi=function(ev){
        let dialog=document.querySelector('.configui .dialogBack');
        if (dialog){
            dialog.classList.add('hidden');
        }
        if (ev.target.getAttribute('id') === 'dpiOk'){
            let dpi=document.querySelector('#XScreenDPI');
            setValue(document.querySelector('#AVNAV_DPI'),parseInt(dpi.textContent));
            let sdv='';
            for (let k in dpiFields){
                let v=getValue(document.querySelector(dpiFields[k]));
                if (sdv !== '') sdv+=",";
                sdv+=v===undefined?'':v;
            }
            setValue(document.querySelector('#AVNAV_DISPLAY_DIMENSIONS'),sdv);
        }
    }
    let setFieldValues=function(valueData){
        for (let k in valueData){
            let v=valueData[k];
            let field=fields[k];
            if (! field) continue;
            field.s(document.getElementById(k),v);
        }
    }
    
    window.addEventListener('load',function(){
       console.log("loaded");
       let fieldParent=document.getElementById('parameterContainer');
       for (let k in fields){
            let el=document.getElementById(k);
            if (! el){
                let nel=document.createElement('input');
                nel.setAttribute('type','hidden')
                nel.setAttribute('id',k);
                fieldParent.appendChild(nel);
            } 
       }
       fetch("avnav.conf")
           .then(function(r){return r.text()})
           .then(function(td){
               template=td;
               fillCurrentValues(template,true);
            })
           .catch(function(err){alert(err)});
       fetch("timezones.json")
            .then(function(r){return r.json()})
            .then(function(tzdata){
                let parent=document.getElementById('AVNAV_TIMEZONE');
                if (parent){
                    let defaultTz=parent.getAttribute('data-default');
                    if (! defaultTz) defaultTz='Europe/Berlin';
                    tzdata.forEach(function(name){
                        let entry=document.createElement('option');
                        entry.setAttribute('value',name);
                        entry.textContent=name;
                        if (name == defaultTz){
                            entry.setAttribute('selected',true);
                        }
                        parent.appendChild(entry);
                    })
                }
            })
            .catch(function(err){alert("unable to load timezones: "+err)});
       this.fetch("keyboards.json")
            .then(function(r){return r.json()})
            .then(function(kbdata){
                fillSelect(document.getElementById('AVNAV_KBLAYOUT'),kbdata.layouts);
                fillSelect(document.getElementById('AVNAV_KBMODEL'),kbdata.models);
                //TODO: variants
            })
            .catch(function(err){alert("unable to load keyboard data: "+err)})
       this.fetch("countryCodes.json")
            .then(function(r){return r.json()})
            .then(function(countries){
                fillSelect(document.getElementById('AVNAV_WIFI_COUNTRY'),countries);
            })
            .catch(function(err){alert("unable to fill country list: "+err)}); 
       let pass=document.getElementById('AVNAV_PASSWD');
       if (pass){
           pass.addEventListener('change',function(ev){
               pass.removeAttribute('data-encrypted');
           })
       }
        let BASE_BOARDS = {
            MCS: {
                href: "https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/",
                parameters: {
                    AVNAV_MCS: 'yes',
                    AVNAV_HAT: 'NONE',
                    AVNAV_OBPPLOTTERV3: 'no'
                }
            },
            OBPPLOTTERV3: {
                parameters: {
                    AVNAV_DISPLAY_DIMENSIONS: '217,1280,136,800',
                    AVNAV_DPI: '150',
                    AVNAV_HAT: 'NONE',
                    AVNAV_KEYHEIGHT: '7',
                    AVNAV_STARTX: 'yes',
                    AVNAV_MCS: 'no',
                    AVNAV_OBPPLOTTERV3: 'yes'
                },
            },
            NONE: {
                parameters: {
                    AVNAV_OBPPLOTTERV3: 'no',
                    AVNAV_MCS: 'no',
                }
            }

        }; 
       let baseBoard=document.getElementById('AVNAV_BASE_BOARD');
       if (baseBoard){
        fillSelect(baseBoard,BASE_BOARDS);
        baseBoard.addEventListener('change',function(ev){
            let board=BASE_BOARDS[ev.target.value];
            if (! board) return;
            setFieldValues(board.parameters);
        })
       }
       let HATS=['NONE','PICANM','WAVESHAREA8','WAVESHAREA12','WAVESHAREB','WAVESHARE2CH','MCARTHUR'];
       let hats=document.getElementById('AVNAV_HAT');
       if (hats){
            fillSelect(hats,HATS);
       }
       let bt=document.getElementById('download');
       bt.addEventListener('click',function(){
           if (!template) {
               alert("no template loaded");
               return;
           }
           let replace={};
           let hasReplace=false;
           for (let k in fields){
                let el=document.getElementById(k);
                let value=fields[k].r(el);
                if (k === 'AVNAV_SSID'){
                    if ( ! value || value.length > 32 || value.match(/ /)){
                        alert("invalid SSID, 1...32 characters, no space");
                        return;
                    }
                }
                if (k === 'AVNAV_PSK'){
                    if ( ! value || value.length > 63 || value.length < 8){
                        alert("invalid Wifi Password, 8...63 characters");
                        return;
                    }
                }
                if ( k === 'AVNAV_HOSTNAME'){
                    let allowed=value.replace(/[^a-zA-Z0-9-]/g,'');
                    if (allowed !== value ){
                        alert("invalid hostname - only a-zA-Z0-9 and -");
                        return;
                    }
                }
                if (value !== undefined){
                    replace[k]=value;
                    hasReplace=true;
                }
           }
           if (hasReplace){
               let data=templateReplace(template,replace);
                download(data,'avnav.conf');
           }
       });
       let ubt=this.document.getElementById('upload');
       let fileSelect=this.document.getElementById('fileSelect');
       ubt.addEventListener('click',function(){
           fileSelect.value=null;
           fileSelect.click();
       })
       fileSelect.addEventListener('change',function(ev){
           if (! fileSelect.files || fileSelect.files.lentgh < 1) return;
           let ufile=fileSelect.files[0];
           let MAXSIZE=100000;
           if (ufile.size > MAXSIZE){
               alert("file too big, allowed: "+MAXSIZE);
               return;
           }
           let reader=new FileReader();
           reader.onload=function(e){
               let current=e.target.result;
               fillCurrentValues(current,false);
           }
           reader.readAsText(ufile);
       })
       let lang='';
       if (window.location.search.match(/lang=/)){
           lang=window.location.search.replace(/.*lang=/,'').replace('[?&].*','');
       }
       getToolTips(lang);
       let dpiFields=this.document.querySelectorAll('.configui .dialog input');
       for (let i=0;i<dpiFields.length;i++){
           dpiFields[i].addEventListener('change',computeDpi);
       }
       let dpi=this.document.querySelector('#AVNAV_DPI');
       if (dpi){
           dpi.addEventListener('click',showDpi);
           dpi.addEventListener('focus',showDpi);
       }
       ['dpiOk','dpiCancel'].forEach(function(id){
            let bt=document.querySelector('#'+id);
            if (bt){
                bt.addEventListener('click',hideDpi);
            }
       });
       if (window.location.href.match(/preview/i)){
            let warn=this.document.getElementById('warn');
            if (warn){
                warn.classList.add("warn");
            }
       }
    });
})()
