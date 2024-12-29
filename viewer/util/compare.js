/**
 * Created by andreas on 25.09.17.
 */
import {shallowEqualObjects as equalsObjects, shallowEqualArrays as equalsArrays} from 'shallow-equal';

let Compare=function(oldData, newData){
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

export const RecursiveCompare=(oldData,newData)=>{
    if ( oldData === newData) return true;
    if (oldData === undefined) return false;
    if (newData === undefined) return false;
    if (typeof (newData) !== typeof (oldData)) return false;
    if (newData instanceof Date && oldData instanceof Date){
        return newData.getTime() === oldData.getTime()
    }
    if (newData instanceof Array && oldData instanceof Array){
        if (oldData.length !== newData.length) return false;
        for (let i=0;i<oldData.length;i++){
            let ec=RecursiveCompare(oldData[i],newData[i]);
            if (! ec) {
                return false;
            }
        }
        return true;
    }
    if (newData instanceof Object && oldData instanceof Object){
        let oKeys=Object.keys(oldData);
        let nKeys=Object.keys(newData);
        if (oKeys.length !== nKeys.length) return false;
        for (let i=0;i<oKeys.length;i++){
            let k=oKeys[i];
            if (!Object.prototype.hasOwnProperty.call(newData,k)){
                return false;
            }
            let ec=RecursiveCompare(oldData[k],newData[k]);
            if (! ec) {
                return false;
            }
        }
        return true;
    }
    return oldData === newData;
}

export default Compare;
