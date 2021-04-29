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
    let encryptPass=function(el){
        if (! el) return;
        if (el.value === '') return;
        let salt=Math.floor((new Date()).getTime())+"";
        let hash=sha512crypt(el.value,salt);
        return hash;
    }
    let getValue=function(el){
        if (! el) return;
        if (el.value === '') return;
        return el.value;
    }
    let selectValue=function(el){
        if (!el) return;
        let v=el.options[el.selectedIndex].value;
        return v;
    }
    let fields={
        AVNAV_SSID: getValue,
        AVNAV_PSK: getValue,
        AVNAV_PASSWD: encryptPass,
        AVNAV_MCS: checkBox,
        AVNAV_WIFI_CLIENT: checkBox,
        AVNAV_HOSTNAME: getValue,
        AVNAV_TIMEZONE: selectValue,
        AVNAV_KBLAYOUT: selectValue,
        AVNAV_KBMODEL: selectValue,
        AVNAV_WIFI_COUNTRY: selectValue
    };
    let templateReplace=function(template,replace){
        if (! template) return;
        let rt=template.split('\n');
        let hasReplaced={};
        //only replace the last occurance
        for (let i=rt.length-1;i>=0;i--){
            for (let k in replace){
                if (hasReplaced[k]) continue;
                let r=RegExp('^#'+k+"=.*");
                if (! rt[i].match(r)) continue;
                let rv=replace[k];
                rt[i]=rt[i].replace(r,k+"='"+rv+"'");
                hasReplaced[k]=true;
            }
        }
        return rt.join("\n");
    }
    let template=undefined;
    let fillSelect=function(parent,data){
        if (! parent || ! data) return;
        let defaultL=parent.getAttribute('data-default');
        let keys=Object.keys(data);
        keys.sort();
        for (let li in keys){
            let lname=keys[li];
            let entry=document.createElement('option');
            entry.setAttribute('value',data[lname]);
            if (data[lname] === defaultL) entry.setAttribute('selected',true);
            entry.textContent=lname;
            parent.appendChild(entry);
        }
    }
    window.addEventListener('load',function(){
       console.log("loaded");
       fetch("avnav.conf")
           .then(function(r){return r.text()})
           .then(function(td){template=td;})
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
                let value=fields[k](el);
                if (k === 'AVNAV_SSID'){
                    if ( ! value || value.length > 32 || value.match(/ /)){
                        alert("invalid SSID, 1...32 characters, no space");
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
       let lang='';
       if (window.location.search.match(/lang=/)){
           lang=window.location.search.replace(/.*lang=/,'').replace('[?&].*','');
       }
       getToolTips(lang);
    });
})()