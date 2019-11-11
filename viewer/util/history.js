
import globalStore from './globalstore.jsx';
import keys from './keys.jsx';
class History{
    constructor(store,startlocation,startoptions){
        this.history=[];
        this.store=store;
        this.pop=this.pop.bind(this);
        this.push=this.push.bind(this);
        this.updateStore=this.updateStore.bind(this);
        this.reset=this.reset.bind(this);
        if (startlocation){
            this.push(startlocation,startoptions);
        }
    }
    replace(location,options){
        if (this.history.length < 1){
            this.push(location,options);
            return;
        }
        this.history.splice(-1,1,{location:location,options:options||{}});
        this.updateStore();
    }
    push(location,options){
        this.history.push({location:location,options:options||{}});
        this.updateStore();
    }
    pop(){
        this.history.splice(-1,1);
        this.updateStore(true);
    }

    /**
     * remove all except the first entries
     */
    reset(){
        this.history.splice(1,this.history.length);
        this.updateStore();
    }

    /**
     *
     * @param opt_returning - legacy support with returning flag
     */
    updateStore(opt_returning){
        let topEntry={};
        if (this.history.length > 0){
            topEntry=this.history[this.history.length-1];
            if (opt_returning){
                if (! topEntry.options){
                    topEntry.options={};
                }
                topEntry.options.returning=true;
            }
        }
        this.store.storeMultiple(topEntry,{
            location:keys.gui.global.pageName,
            options:keys.gui.global.pageOptions});
    }
}
module.exports=new History(globalStore);