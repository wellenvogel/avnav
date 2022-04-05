export default class Average{
    constructor(length) {
        this.length=parseInt(length||0);
        this.currentValue=undefined;
        this.values=[];
    }
    reset(opt_length){
        this.currentValue=undefined;
        this.values=[];
        if (opt_length !==undefined){
            this.length=parseInt(opt_length);
        }
    }
    getLength(){
        return this.length;
    }
    add(val){
        if (this.currentValue === undefined || this.length < 1) {
            this.currentValue = val;
            this.values.push(val);
            return val;
        }
        if (this.values.length >= this.length){
            this.currentValue-=this.values.shift();
        }
        this.currentValue+=val;
        this.values.push(val)
        return this.currentValue/this.values.length;
    }
    val(){
        if (this.values.length < 1){
            return this.currentValue;
        }
        return this.currentValue/this.values.length;
    }

}