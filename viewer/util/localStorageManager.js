import assign from 'object-assign';
export const PREFIX_NAMES={
    LAYOUT:'avnav.layout',
    LASTCHART:'avnav.lastChart',
    ROUTING: 'avnav.routing',
    ROUTE: 'avnav.route.', //prefix for routes, let them sync via the server
    CENTER: 'avnav.center',
    SPLITSETTINGS:'avnav.splitsettings'
}
export const UNPREFIXED_NAMES={
    CHARTINFO: 'avnav.chartinfo',
    O_SESSION: 'avnav.ochartProvider.sessionId',
    EULAS:'avnav.eulas',
    SETTINGS: 'avnav.settings',
    LICENSE: 'avnav.licenseAccepted',
    DEFAULTROUTE: 'avnav.defaultRoute',
    SPLITMODE: 'avnav.splitmode'
}

export const STORAGE_NAMES=assign({},UNPREFIXED_NAMES,PREFIX_NAMES);

const log=(name,text)=>{
    console.trace("LocalStorage invalid name "+name+": "+text);
}

class LocalStorage{
    constructor() {
        this.prefix="";
        this.impl=(typeof(window.localStorage) === 'object')?window.localStorage:undefined;
    }
    hasPrefix(){
        return (this.prefix && this.prefix !== '');
    }
    hasStorage(){
        return this.impl !== undefined;
    }
    setPrefix(prefix){
        this.prefix=prefix;
    }
    getPrefix(){
        return this.prefix;
    }

    _getRealNameImpl(name,nameList){
        for (let k in nameList){
            if (name === nameList[k]){
                return name;
            }
        }
    }
    getRealName(name, suffix,opt_omitPrefix) {
        if (! name) return;
        let realName=this._getRealNameImpl(name,PREFIX_NAMES);
        if (realName){
           let prefix=opt_omitPrefix?undefined:this.prefix;
           if (!prefix) prefix="";
           if (suffix) return prefix+realName+suffix;
                return prefix+realName;
        }
        realName=this._getRealNameImpl(name,UNPREFIXED_NAMES);
        if (realName){
           if (suffix) return realName+suffix;
                return realName;
        }
        log(name, "not found");
    }
    getItem(name,suffix,opt_omitPrefix){
        if (! this.impl) return;
        let realName=this.getRealName(name,suffix,opt_omitPrefix);
        if (! realName) return;
        return this.impl.getItem(realName);
    }
    setItem(name,suffix,data){
        if (! this.impl) return;
        let realName=this.getRealName(name,suffix);
        if (! realName) return;
        return this.impl.setItem(realName,data);
    }
    removeItem(name,suffix){
        if (! this.impl) return;
        let realName=this.getRealName(name,suffix);
        if (! realName) return;
        this.impl.removeItem(realName);
    }
    listByPrefix(prefix){
        if (! this.impl) return [];
        let realName=this.getRealName(prefix);
        if (! realName) return [];
        let len=realName.length;
        let rt=[];
        for (let i=0;i< this.impl.length;i++){
            let key=this.impl.key(i);
            if (key.substr(0,len) === realName){
                rt.push(key);
            }
        }
        return rt;
    }
}

export default new LocalStorage();