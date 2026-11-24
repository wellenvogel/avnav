import '../avnav_viewer';
import {getTemplate} from '../components/EditDialog';
window.runRegressionTests = () => {
    const template=getTemplate('route.gpx');
    const cases=[['empty',template],['route',template.replace('<!--<rte>', '<rte>').replace('</rte> -->','</rte>')],
        ['track',template.replace('<!--<trk>', '<trk>').replace('</trk> -->','</trk>')]];
    return cases.map(([name,text])=>{
        const doc=new DOMParser().parseFromString(text,'application/xml');
        const error=doc.querySelector('parsererror');
        if(error) throw Error(`${name}: ${error.textContent}`);
        if(doc.documentElement.localName !== 'gpx') throw Error('expected GPX root');
        if(name === 'route' && doc.querySelectorAll('rtept').length !== 1) throw Error('expected waypoint');
        if(name === 'track' && doc.querySelectorAll('trkpt').length !== 1) throw Error('expected track point');
        return {name,validXml:true};
    });
};
