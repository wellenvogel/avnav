
const txt="Really exit AvNav?";

class LeaveHandler{
    constructor(){
        this.prevent=true;
        let self=this;
        window.onbeforeunload=(ev)=>{
            if (!self.prevent) return;
            (ev || window.event).returnValue =txt;
            return txt;
        }
    }
    stop(){
        this.prevent=false;
    }
    activate(delay){
        let self=this;
        window.setTimeout(()=>{self.prevent=true},delay||100);
    }

}

export default new LeaveHandler();