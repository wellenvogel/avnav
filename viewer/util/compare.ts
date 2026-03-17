/**
 * Created by andreas on 25.09.17.
 */
import {shallowEqualObjects as equalsObjects, shallowEqualArrays as equalsArrays} from 'shallow-equal';

const Compare=function(oldData:any    , newData:any){
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

export const RecursiveCompare=(oldData:any,newData:any)=>{
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
            const ec=RecursiveCompare(oldData[i],newData[i]);
            if (! ec) {
                return false;
            }
        }
        return true;
    }
    if (newData instanceof Object && oldData instanceof Object){
        const oKeys=Object.keys(oldData);
        const nKeys=Object.keys(newData);
        if (oKeys.length !== nKeys.length) return false;
        for (let i=0;i<oKeys.length;i++){
            const k=oKeys[i];
            if (!Object.prototype.hasOwnProperty.call(newData,k)){
                return false;
            }
            const ec=RecursiveCompare(oldData[k],newData[k]);
            if (! ec) {
                return false;
            }
        }
        return true;
    }
    return oldData === newData;
}

export default Compare;
