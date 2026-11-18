import '../avnav_viewer';
import {AISItem, computeAis} from '../nav/aiscomputations';

window.runRegressionTests = () => {
    const defaults = {onlyShowMoving:true, minAISspeed:0.2, showA:true, showB:true, showOther:true,
        lostTime:600, warningDist:100, warningTime:60, courseVectorTime:0};
    const results=[];
    for (const [name, received, visible] of [
        ['anchored class A', {type:1,status:1,speed:0}, true],
        ['moored class A', {type:1,status:5,speed:0}, false],
        ['moving moored report', {type:1,status:5,speed:1}, true],
        ['not under command', {type:1,status:2,speed:0}, true],
        ['aground', {type:1,status:6,speed:0}, true],
        ['distress', {type:1,status:14,speed:0}, true],
        ['unknown class A status', {type:1,speed:0}, true],
        ['stationary class B', {type:18,speed:0}, false],
        ['class B extended', {type:19,speed:0}, false],
        ['threshold class B', {type:18,speed:0.2}, true],
        ['navigation aid', {type:21}, true],
        ['base station', {type:4}, true],
        ['string fields', {type:'1',status:'5',speed:'0'}, false],
    ]) {
        for (const enabled of [true,false]) {
            const item=new AISItem({lat:50,lon:1,mmsi:123456789,...received});
            computeAis([item], {}, undefined, undefined, {...defaults, onlyShowMoving:enabled});
            const expected=enabled ? visible : true;
            if (item.shouldHandle !== expected) throw Error(`${name}: visible=${item.shouldHandle}, expected ${expected}`);
            results.push({name, enabled, visible:item.shouldHandle});
        }
    }
    for (const [type, status, hiddenClass] of [[1,1,'showA'],[18,0,'showB'],[21,0,'showOther']]) {
        const item=new AISItem({lat:50,lon:1,mmsi:123456789,type,status,speed:1});
        computeAis([item],{},undefined,undefined,{...defaults,[hiddenClass]:false});
        if(item.shouldHandle) throw Error(`${hiddenClass} must still apply`);
        results.push({hiddenClass, visible:false});
    }
    return results;
};
