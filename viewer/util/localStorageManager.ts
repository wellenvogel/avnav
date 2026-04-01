
export const PREFIX_NAMES={
    LAYOUT:'avnav.layout',
    LASTCHART:'avnav.lastChartV2',
    ROUTING: 'avnav.routing',
    ROUTE: 'avnav.route.', //prefix for routes, let them sync via the server
    CENTER: 'avnav.center',
    SPLITSETTINGS:'avnav.splitsettings',
    SETTINGS_NAME:'avnav.settingsname',
    SETTINGS_CHANGED:'avnav.settingschanged',
}
export const UNPREFIXED_NAMES={
    CHARTINFO: 'avnav.chartinfo',
    O_SESSION: 'avnav.ochartProvider.sessionId',
    EULAS:'avnav.eulas',
    SETTINGS: 'avnav.settings',
    LICENSE: 'avnav.licenseAccepted',
    SPLITMODE: 'avnav.splitmode',
    EXTERNAL: 'avnav.external',  //user.mjs and plugins
}

export const STORAGE_NAMES={...UNPREFIXED_NAMES,...PREFIX_NAMES};

const log=(name:string,text:string)=>{
    console.trace("LocalStorage invalid name "+name+": "+text);
}

class LocalStorage{
    private prefix: string;
    private impl: Storage;
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
    setPrefix(prefix:string){
        this.prefix=prefix;
    }
    getPrefix(){
        return this.prefix;
    }

    _getRealNameImpl(name:string,nameList:Record<string,string>){
        for (const k in nameList){
            if (name === nameList[k]){
                return name;
            }
        }
    }
    getRealName(name:string, suffix?:string,opt_omitPrefix?:boolean) {
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
    getItem(name:string,suffix?:string,opt_omitPrefix?:boolean) {
        if (! this.impl) return;
        const realName=this.getRealName(name,suffix,opt_omitPrefix);
        if (! realName) return;
        return this.impl.getItem(realName);
    }
    setItem(name:string,suffix:string,data:any){
        if (! this.impl) return;
        const realName=this.getRealName(name,suffix);
        if (! realName) return;
        return this.impl.setItem(realName,data);
    }
    removeItem(name:string,suffix?:string){
        if (! this.impl) return;
        const realName=this.getRealName(name,suffix);
        if (! realName) return;
        this.impl.removeItem(realName);
    }
    listByPrefix(prefix:string){
        if (! this.impl) return [];
        const realName=this.getRealName(prefix);
        if (! realName) return [];
        const len=realName.length;
        const rt=[];
        for (let i=0;i< this.impl.length;i++){
            const key=this.impl.key(i);
            if (key.substring(0,len) === realName){
                rt.push(key);
            }
        }
        return rt;
    }
    deleteByPrefix(prefix:string){
        const names=this.listByPrefix(prefix);
        for (const name of names){
            this.removeItem(name);
        }
    }
}

export default new LocalStorage();