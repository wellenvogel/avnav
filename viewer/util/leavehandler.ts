

const txt="Really exit AvNav?";
export type LeaveHandlerCallback=(ev:BeforeUnloadEvent)=>boolean;
class LeaveHandler{
    private prevent: boolean=true;
    private subscriptions: Record<number,LeaveHandlerCallback> = {};
    private subscriptionId: number;
    constructor(){
        this.prevent=true;
        this.subscriptions={};
        this.subscriptionId=0;
        window.onbeforeunload=(ev)=>{
            this._callHandlers(ev);
            if (!this.prevent) return;
            (ev || window.event).returnValue =txt;
            if (ev){
                try{
                    ev.preventDefault();
                }catch (e){ /* empty */ }
            }
            return txt;
        }
    }
    subscribe(callback:LeaveHandlerCallback) {
        for (const k in this.subscriptions) {
            if (this.subscriptions[k] === callback) return k;
        }
        const id = this.subscriptionId++;
        this.subscriptions[id] = callback;
        return id;
    }

    _callHandlers(eventData:BeforeUnloadEvent) {
        for (const k in this.subscriptions) {
            const rt = this.subscriptions[k](eventData);
            if (rt) return rt;
        }
        return false;
    }

    /**
     * deregister from map events
     * @param token - the value obtained from register
     */
    unsubscribe(token:number) {
        if (token === undefined) return;
        delete this.subscriptions[token];
    }

    stop(){
        this.prevent=false;
    }
    activate(delay:number) {
        window.setTimeout(()=>{this.prevent=true},delay||100);
    }

}

export default  new LeaveHandler();