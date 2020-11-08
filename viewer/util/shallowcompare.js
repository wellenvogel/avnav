/**
 * Created by andreas on 25.09.17.
 */
import equalsObjects from 'shallow-equal/objects';
import equalsArrays from 'shallow-equal/arrays';

let ShallowCompare=function(oldData,newData){
    if (oldData === undefined && newData === undefined) return true;
    if (oldData === undefined) return false;
    if (newData === undefined) return false;
    if (typeof (newData) !== typeof (oldData)) return false;
    if (newData instanceof Array && oldData instanceof Array){
        return equalsArrays(oldData,newData)
    }
    if (newData instanceof Date && oldData instanceof Date){
        return newData.getTime() == oldData.getTime()
    }
    if (newData instanceof Object && oldData instanceof Object){
        return equalsObjects(newData,oldData);
    }
    return oldData == newData;
};

export default ShallowCompare;
