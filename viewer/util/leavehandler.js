import splitsupport from "./splitsupport";

const txt="Really exit AvNav?";

class LeaveHandler{
    constructor(){
        this.prevent=true;
        let self=this;
        this.subscriptions={};
        this.subscriptionId=0;
        window.onbeforeunload=(ev)=>{
            this._callHandlers(ev);
            if (!self.prevent) return;
            (ev || window.event).returnValue =txt;
            if (ev){
                try{
                    ev.preventDefault();
                }catch (e){}
            }
            return txt;
        }
    }
    subscribe(callback) {
        for (let k in this.subscriptions) {
            if (this.subscriptions[k] === callback) return k;
        }
        let id = this.subscriptionId++;
        this.subscriptions[id] = callback;
        return id;
    }

    _callHandlers(eventData) {
        for (let k in this.subscriptions) {
            let rt = this.subscriptions[k](eventData);
            if (rt) return rt;
        }
        return false;
    }

    /**
     * deregister from map events
     * @param token - the value obtained from register
     */
    unsubscribe(token) {
        if (token === undefined) return;
        delete this.subscriptions[token];
    }

    stop(){
        this.prevent=false;
    }
    activate(delay){
        let self=this;
        window.setTimeout(()=>{self.prevent=true},delay||100);
    }

}

export default  new LeaveHandler();