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
        if (val === undefined){
            if (this.values.length > 0){
                //we remove the oldest entry
                //so after length adds of undefined the value becomes undefined
                let old=this.values.shift();
                if (this.values.length > 0) this.currentValue-=old;
                else this.currentValue=undefined;
                return;
            }
            this.currentValue=undefined;
            return;
        }
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

/**
 * course avergaing is finally not that simple
 * we have to consider the "wrap around" at 360/0
 * So we follow an approach to use sin and cos of the course to average on them
 * To save compute time we use a "linearized" approach for sin and cos
 * When converting back after the averaging on "sin" and "cos" we use some
 * inverse linearized sin and cos. We always use the value that fits better - i.e. is closer to 0
 */
export class CourseAverage extends Average{
    constructor(length) {
        super(length);
    }
    inRange(val){
        while (val >= 360) val-=360;
        while (val < 0) val+=360;
        return val;
    }
    //some simplified (i.e. linearized) sin
    linSin(val){
        val=this.inRange(val);
        if (val >= 0 && val < 90) return val;
        if (val >= 90 && val < 180) return 90-(val-90);
        if (val >= 180 && val < 270) return -(val-180);
        return -90+(val-270);
    }
    //some simplified (i.e. linearized) cos
    linCos(val){
        val=this.inRange(val);
        if (val >= 0 && val < 90) return 90-val;
        if (val >= 90 && val < 180) return -(val-90);
        if (val >= 180 && val < 270) return -90+(val-180);
        return val-270;
    }
    getEntry(val){
        return [this.linSin(val),this.linCos(val)]
    }
    add(val){
        if (this.length < 1) return;
        if (val === undefined){
            if (this.values.length > 0){
                this.values.shift()
            }
            return;
        }
        this.values.push(this.getEntry(val));
        if (this.values.length > this.length ){
            this.values.shift()
        }
    }
    reverse(x,y){
        //to acurate we use the vale that is closer to 90°
        //at 45 x and y should be equal anyway
        if (x >= 0){
            //q1,q2
            if (y >= 0){
                //q1
                return x <= 45 ? x : 90 - y;
            }
            else{
                //q2
                return x <= 45 ? 90 + (90 - x) : 180 - (90 + y)
            }
        }
        else{
            //q3,q4
            if (y >= 0){
                //q4
                return x <= 45 ? 360 + x : 270 + y;
            }
            else{
                //q3
                return x <= 45 ? 180 - x : 270 + y;
            }
        }
    }
    val(){
        if (this.values.length < 1) return undefined;
        let sum=[0,0];
        this.values.forEach((v)=>{
            sum[0]+=v[0];
            sum[1]+=v[1];
        });
        sum[0]=sum[0]/this.values.length;
        sum[1]=sum[1]/this.values.length;
        return this.reverse(sum[0],sum[1]);
    }
    //could be static
    fract(first,second,f){
        if (second === undefined || f < 0 || f > 1) return first;
        let fc=[this.linSin(first),this.linCos(first)]
        let sc=[this.linSin(second),this.linCos(second)]
        let comp=[fc[0]+f*(sc[0]-fc[0]),fc[1]+f*(sc[1]-fc[1])]
        return this.reverse(comp[0],comp[1]);
    }
}