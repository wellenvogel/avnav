(function() {
    window.setTimeout(()=> {
        let testsets=[
            {
                name: 'q1',
                waypoints: [
                    {"lon": 13.46481754474968, "lat": 54.10810325512469, "name": "WP 1"},
                    {"lon": 13.468166666666667, "lat": 54.11538104291324, "name": "WP 2"}
                ],
                testpoints: [
                    ["54°06.66'N", "013°28.14'E"], //right side
                    ["54°06.73'N", "013°27.82'E"], //left side
                    ["54°06.40'N", "013°28.28'E"], //right side nearly outside
                    ["54°06.26'N", "013°28.14'E"], //right side outside
                    ["54°07.06'N", "013°28.44'E"], //right side behind target
                    ["54°06.72'N", "013°27.99'E"], //on course
                    ["54°06.49'N", "013°27.89'E"], //start point
                    ["54°06.71'N", "013°27.98'E"], //slightly left
                    ["54°06.92'N", "013°28.09'E"], //destination
                ]
            },
            {
                name: 'q2',
                waypoints: [
                    {"lon": 13.46481754474968, "lat": 54.10810325512469, "name": "WP 1"},
                    {"lon": 13.472969266821604, "lat": 54.105126060954404, "name": "WP 2"}
                ],
                testpoints: [
                    ["54°06.50'N", "013°28.18'E"], //left side
                    ["54°06.34'N", "013°27.98'E"], //right side
                    ["54°06.42'N", "013°28.08'E"], //nearly on
                    ["54°06.35'N", "013°28.73'E"], //left after target
                    ["54°06.14'N", "013°28.44'E"], //right after target
                    ["54°06.72'N", "013°27.86'E"], //left before start
                    ["54°06.41'N", "013°27.65'E"], //right before start
                ]
            },
            {
                name: 'q3',
                waypoints: [
                    {"lon": 13.46481754474968, "lat": 54.10810325512469, "name": "WP 1"},
                    {"lon": 13.458224892739876, "lat": 54.10384632131624, "name": "WP 2"}
                ],
                testpoints: [
                    ["54°06.32'N", "013°27.80'E"], //left
                    ["54°06.41'N", "013°27.61'E"], //right
                    ["54°06.10'N", "013°27.55'E"], //left after target
                    ["54°06.27'N", "013°27.13'E"], //right after target
                    ["54°06.52'N", "013°28.20'E"], //left before start
                    ["54°06.66'N", "013°27.84'E"], //right before start
                    ["54°06.36'N", "013°27.69'E"], //on track
                ]
            },
            {
                name: 'q4',
                waypoints: [
                    {"lon": 13.464728465190955, "lat": 54.10854720253275, "name": "WP 1"},
                    {"lon": 13.458937624792682, "lat": 54.11408311247243, "name": "WP 2"}
                ],
                testpoints: [
                    ["54°06.64'N", "013°27.53'E"], //left
                    ["54°06.74'N", "013°27.84'E"], //right
                    ["54°06.88'N", "013°27.20'E"], //left after
                    ["54°07.01'N", "013°27.57'E"], //right after
                    ["54°06.35'N", "013°27.82'E"], //left before
                    ["54°06.43'N", "013°28.37'E"], //right before
                    ["54°06.69'N", "013°27.70'E"], //on track
                ]
            },
            {
                name: 'cross',
                waypoints: [
                    {"lon": 13.464728465190955, "lat": 54.10854720253275, "name": "WP 1"},
                    {"lon": 13.470786574851976, "lat": 54.103924671947794, "name": "WP 2"}
                ],
                testpoints: [
                    ["54°06.51'N", "013°28.53'E"], //segment < 360, current >0
                ]
            },
            {
                name: 'long50',
                waypoints: [
                    {"lon": 14.14261292205835, "lat": 55.35112111609973, "name": "WP 1"},
                    {"lon": 13.470786574851976, "lat": 54.103924671947794, "name": "WP 2"}
                ],
                testpoints: [
                    ["54°26.73'N", "013°36.48'E"], //left narrow
                    ["54°37.29'N", "012°58.90'E"], //left wide (app 25nm)
                ],
                percent: 10
            }
        ];
        const NavCompute=window.avnav.debug.navcompute;
        const LatLon=window.avnav.api.LatLon();
        const getTestPoints=(testset)=>{
            let rt=[];
            testset.testpoints.forEach((tp)=>{
                rt.push(LatLon.parse(tp[0],tp[1]));
            })
            return rt;
        }
        const getLeg=(testset)=>{
            return {
                from: new LatLon(testset.waypoints[0].lat,testset.waypoints[0].lon),
                to: new LatLon(testset.waypoints[1].lat,testset.waypoints[1].lon)
            }
        };
        let xteReferences={};
        TinyTest.run({
            'print json':()=>{
              console.log(JSON.stringify(testsets)+"");
            },
            'parse points':()=>{
                testsets.forEach((ts)=>{
                    console.log("##TS: ",ts.name);
                    let tps=getTestPoints(ts);
                    tps.forEach((tp)=>{
                        console.log("["+tp.lat+","+tp.lon+"],");
                    })
                })
            },
            'xte great circle':()=>{
                testsets.forEach((ts)=> {
                    console.log("##TS: ",ts.name);
                    xteReferences[ts.name]=[];
                    let testPoints = getTestPoints(ts);
                    let leg = getLeg(ts);
                    let num = 0;
                    testPoints.forEach((tp) => {
                        let xte = tp.crossTrackDistanceTo(leg.from, leg.to);
                        xteReferences[ts.name][num]=xte;
                        console.log("XTE(gc):", num, tp, xte);
                        num += 1;
                    });
                });
            },
            'xte navcompute':()=>{
                testsets.forEach((ts)=> {
                    console.log("##TS: ",ts.name);
                    let testPoints = getTestPoints(ts);
                    let leg = getLeg(ts);
                    let num = 0;
                    testPoints.forEach((tp) => {
                        let xte = NavCompute.computeXte(leg.from, leg.to, tp);
                        console.log("XTE(navcompute):", num, tp, xte);
                        TinyTest.assertRangePercent(xteReferences[ts.name][num],xte,ts.percent||1);
                        num += 1;
                    });
                })
            },
            'xte rhumb line navcompute':()=>{
                testsets.forEach((ts)=> {
                    console.log("##TS: ",ts.name);
                    let testPoints = getTestPoints(ts);
                    let leg = getLeg(ts);
                    let num = 0;
                    testPoints.forEach((tp) => {
                        let xte = NavCompute.computeRhumbXte(leg.from, leg.to, tp);
                        console.log("XTE(navcompute-rl):", num, tp, xte);
                        TinyTest.assertRangePercent(xteReferences[ts.name][num],xte,ts.percent||1);
                        num += 1;
                    });
                })
            },
            'midpoint diff for 50nm': ()=>{
                let ts=testsets[5]; //long50
                let leg=getLeg(ts);
                let mpgc=leg.from.midpointTo(leg.to);
                let mprl=leg.from.rhumbMidpointTo(leg.to);
                let diff=mpgc.distanceTo(mprl);
                console.log("MPdistance",mpgc,mprl,diff);

            }

        })
    },2000);
}());
