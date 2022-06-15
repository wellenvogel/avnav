(function() {
    window.setTimeout(()=> {
        let waypoints=[
            {"lon": 13.46481754474968, "lat": 54.10810325512469, "name": "WP 1"},
            {"lon": 13.468166666666667, "lat": 54.11538104291324, "name": "WP 2"}
        ];
        let testpoints=[
            ["54°06.66'N", "013°28.14'E"], //right side
            ["54°06.73'N", "013°27.82'E"], //left side
            ["54°06.40'N", "013°28.28'E"], //right side nearly outside
            ["54°06.26'N", "013°28.14'E"], //right side outside
            ["54°07.06'N", "013°28.44'E"], //right side behind target
            ["54°06.72'N", "013°27.99'E"], //on course
            ["54°06.49'N", "013°27.89'E"], //start point
            ["54°06.71'N", "013°27.98'E"], //slightly left
            ["54°06.92'N", "013°28.09'E"], //destination
        ];
        const NavCompute=window.avnav.debug.navcompute;
        const LatLon=window.avnav.api.LatLon();
        const getTestPoints=()=>{
            let rt=[];
            testpoints.forEach((tp)=>{
                rt.push(LatLon.parse(tp[0],tp[1]));
            })
            return rt;
        }
        const getLeg=()=>{
            return {
                from: new LatLon(waypoints[0].lat,waypoints[0].lon),
                to: new LatLon(waypoints[1].lat,waypoints[1].lon)
            }
        }
        TinyTest.run({
            'parse points':()=>{
                getTestPoints();
            },
            'xte great circle':()=>{
                let testPoints=getTestPoints();
                let leg=getLeg();
                let num=0;
                testPoints.forEach((tp)=> {
                    let xte = tp.crossTrackDistanceTo(leg.from, leg.to);
                    console.log("XTE(gc):",num,tp,xte);
                    num+=1;
                });
            },
            'xte navcompute':()=>{
                let testPoints=getTestPoints();
                let leg=getLeg();
                let num=0;
                testPoints.forEach((tp)=> {
                    let xte = NavCompute.computeXte(leg.from,leg.to,tp);
                    console.log("XTE(navcompute):",num,tp,xte);
                    num+=1;
                });
            },
            'xte rhumb line navcompute':()=>{
                let testPoints=getTestPoints();
                let leg=getLeg();
                let num=0;
                testPoints.forEach((tp)=> {
                    let xte = NavCompute.computeRhumbXte(leg.from,leg.to,tp);
                    console.log("XTE(navcompute-rl):",num,tp,xte);
                    num+=1;
                });
            }
        })
    },2000);
}());
