export default class Average{
    constructor(length) {
        this.length=parseInt(length||0);
        this.currentValue=undefined;
        this.values=[];
    }
    isum(v1,v2){
        return v1+v2;
    }
    idiff(v1,v2){
        return v1-v2;
    }
    inorm(v,len){
        return v/len;
    }
    encode(v){
        return v;
    }
    decode(v){
        return v;
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
        let oval=val;
        val=this.encode(val);
        if (val === undefined){
            if (this.values.length > 0){
                //we remove the oldest entry
                //so after length adds of undefined the value becomes undefined
                let old=this.values.shift();
                if (this.values.length > 0) {
                    this.currentValue=this.idiff(this.currentValue-old);
                }
                else this.currentValue=undefined;
                return;
            }
            this.currentValue=undefined;
            return;
        }
        if (this.currentValue === undefined || this.length < 1) {
            this.currentValue = val;
            this.values.push(val);
            return oval;
        }
        if (this.values.length >= this.length){
            this.currentValue=this.idiff(this.currentValue,this.values.shift());
        }
        this.currentValue=this.isum(this.currentValue,val);
        this.values.push(val)
        return this.decode(this.inorm(this.currentValue,this.values.length));
    }
    val(){
        if (this.values.length < 1){
            return this.decode(this.currentValue);
        }
        return this.decode(this.inorm(this.currentValue,this.values.length));
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
    isum(v1,v2){
        return [v1[0]+v2[0],v1[1]+v2[1]];
    }
    idiff(v1,v2){
        return [v1[0]-v2[0],v1[1]-v2[1]];
    }
    inorm(v,len){
        return [v[0]/len,v[1]/len];
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
    encode(val){
        if (val === undefined) return val;
        val=this.inRange(val);
        return [this.linSin(val),this.linCos(val)]
    }
    decode(v){
        if (v === undefined) return v;
        let x=v[0];
        let y=v[1];
        //to acurate we use the vale that is closer to 0
        let useX=Math.abs(x) <= Math.abs(y);
        if (x >= 0){
            //q1,q2
            if (y >= 0){
                //q1
                return useX ? x : 90 - y;
            }
            else{
                //q2
                return useX ? 90 + (90 - x) : 180 - (90 + y)
            }
        }
        else{
            //q3,q4
            if (y >= 0){
                //q4
                return useX ? 360 + x : 270 + y;
            }
            else{
                //q3
                return useX ? 180 - x : 270 + y;
            }
        }
    }
    //could be static
    fract(first,second,f){
        if (second === undefined || f < 0 || f > 1) return first;
        let fc=this.encode(first);
        let sc=this.encode(second);
        let comp=[fc[0]+f*(sc[0]-fc[0]),fc[1]+f*(sc[1]-fc[1])]
        return this.decode([comp[0],comp[1]]);
    }
}