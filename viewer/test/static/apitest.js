(function() {
    window.setTimeout(()=> {
        TinyTest.run({
            'test route points': () => {
                let results=[
                    {
                        "name": "WP 2",
                        "last": {
                            "_lat": 54.33241927332065,
                            "_lon": 13.51880589551362
                        },
                        "point": {
                            "lon": "13.559324556191452",
                            "lat": "54.33770414594454",
                            "name": "WP 2"
                        },
                        "dstf": "   1.5",
                        "dst": 2691.8157899116122,
                        "brg": 77.37373500139928
                    },
                    {
                        "name": "WP 3",
                        "last": {
                            "_lat": 54.33770414594454,
                            "_lon": 13.559324556191452
                        },
                        "point": {
                            "lon": "13.57332681843668",
                            "lat": "54.33226150595533",
                            "name": "WP 3"
                        },
                        "dstf": "  0.59",
                        "dst": 1091.0282496962034,
                        "brg": 123.68440263932906
                    },
                    {
                        "name": "WP 4",
                        "last": {
                            "_lat": 54.33226150595533,
                            "_lon": 13.57332681843668
                        },
                        "point": {
                            "lon": "13.56906403039801",
                            "lat": "54.30842681573759",
                            "name": "WP 4"
                        },
                        "dstf": "   1.4",
                        "dst": 2664.6769973299115,
                        "brg": 185.95692454721024
                    },
                    {
                        "name": "WP 5",
                        "last": {
                            "_lat": 54.30842681573759,
                            "_lon": 13.56906403039801
                        },
                        "point": {
                            "lon": "13.501309267789537",
                            "lat": "54.1631546005587",
                            "name": "WP 5"
                        },
                        "dstf": "   9.0",
                        "dst": 16742.912903990746,
                        "brg": 195.2751383258966
                    },
                    {
                        "name": "WP 6",
                        "last": {
                            "_lat": 54.1631546005587,
                            "_lon": 13.501309267789537
                        },
                        "point": {
                            "lon": "13.612677980818736",
                            "lat": "54.17566175021352",
                            "name": "WP 6"
                        },
                        "dstf": "   4.0",
                        "dst": 7381.460461257745,
                        "brg": 79.09492439681948
                    },
                    {
                        "name": "WP 7",
                        "last": {
                            "_lat": 54.17566175021352,
                            "_lon": 13.612677980818736
                        },
                        "point": {
                            "lon": "13.711603412571709",
                            "lat": "54.20475398291015",
                            "name": "WP 7"
                        },
                        "dstf": "   3.9",
                        "dst": 7203.299535177441,
                        "brg": 63.274770662182746
                    },
                    {
                        "name": "WP 8",
                        "last": {
                            "_lat": 54.20475398291015,
                            "_lon": 13.711603412571709
                        },
                        "point": {
                            "lon": "13.747034369960204",
                            "lat": "54.165464916464146",
                            "name": "WP 8"
                        },
                        "dstf": "   2.7",
                        "dst": 4939.722635372374,
                        "brg": 152.1647510706994
                    },
                    {
                        "name": "WP 9",
                        "last": {
                            "_lat": 54.165464916464146,
                            "_lon": 13.747034369960204
                        },
                        "point": {
                            "lon": "13.742498612715305",
                            "lat": "54.15769701941491",
                            "name": "WP 9"
                        },
                        "dstf": "  0.49",
                        "dst": 912.8346716304275,
                        "brg": 198.87639413971877
                    },
                    {
                        "name": "WP10",
                        "last": {
                            "_lat": 54.15769701941491,
                            "_lon": 13.742498612715305
                        },
                        "point": {
                            "lon": "13.751003169715345",
                            "lat": "54.142555391700824",
                            "name": "WP10"
                        },
                        "dstf": "  0.96",
                        "dst": 1772.4252940313231,
                        "brg": 161.78803585521692
                    },
                    {
                        "name": "WP11",
                        "last": {
                            "_lat": 54.142555391700824,
                            "_lon": 13.751003169715345
                        },
                        "point": {
                            "lon": "13.730478876454915",
                            "lat": "54.13710836579051",
                            "name": "WP11"
                        },
                        "dstf": "  0.79",
                        "dst": 1467.731955605165,
                        "brg": 245.63595940173138
                    }
                ];
                let routeJson = [
                    {
                        "lon": "13.51880589551362",
                        "lat": "54.33241927332065",
                        "name": "WP 1"
                    },
                    {
                        "lon": "13.559324556191452",
                        "lat": "54.33770414594454",
                        "name": "WP 2"
                    },
                    {
                        "lon": "13.57332681843668",
                        "lat": "54.33226150595533",
                        "name": "WP 3"
                    },
                    {
                        "lon": "13.56906403039801",
                        "lat": "54.30842681573759",
                        "name": "WP 4"
                    },
                    {
                        "lon": "13.501309267789537",
                        "lat": "54.1631546005587",
                        "name": "WP 5"
                    },
                    {
                        "lon": "13.612677980818736",
                        "lat": "54.17566175021352",
                        "name": "WP 6"
                    },
                    {
                        "lon": "13.711603412571709",
                        "lat": "54.20475398291015",
                        "name": "WP 7"
                    },
                    {
                        "lon": "13.747034369960204",
                        "lat": "54.165464916464146",
                        "name": "WP 8"
                    },
                    {
                        "lon": "13.742498612715305",
                        "lat": "54.15769701941491",
                        "name": "WP 9"
                    },
                    {
                        "lon": "13.751003169715345",
                        "lat": "54.142555391700824",
                        "name": "WP10"
                    },
                    {
                        "lon": "13.730478876454915",
                        "lat": "54.13710836579051",
                        "name": "WP11"
                    }
                ];
                const getResult=(name)=>{
                    for (let i in results){
                        if (results[i].name === name) return results[i];
                    }
                }
                let lastPoint = undefined;
                let sum = 0;
                let LatLon=avnav.api.LatLon();
                const fmt = avnav.api.formatter.formatDistance;
                let result = [];
                for (let i = 0; i < routeJson.length;
                     i++
                ) {
                    let point = routeJson[i];
                    let ll = new LatLon(point.lat, point.lon);
                    if (lastPoint !== undefined) {
                        let dst = ll.distanceTo(lastPoint);
                        let brg = lastPoint.initialBearingTo(ll);
                        console.log(point.name, lastPoint, point, "dst", fmt(dst), "brg", brg);
                        let res=getResult(point.name);
                        TinyTest.assert(res !== undefined,"no result for "+point.name);
                        TinyTest.assertRange(res.brg,brg,1e-6);
                        TinyTest.assertRange(res.dst,dst,1e-6);
                    }
                    lastPoint = ll;
                }
            },
            'dms parse lon': () => {
                let wplon = "013° 34.7303′ E";
                let wpnlon = avnav.api.dms().parse(wplon);
                TinyTest.assertRange(13.578838333333334,wpnlon,1e-6);
                console.log(wplon, wpnlon);
            },
            'dms parse lat':()=> {
                let wplat = "54° 11.0796′ N";
                let wpnlat = avnav.api.dms().parse(wplat);
                console.log(wplat, wpnlat);
                TinyTest.assertRange(54.18466,wpnlat,1e-6);
            },
            'parseLatLon':()=>{
                let wplon = "013° 34.7303′ E";
                let wplat = "54° 11.0796′ N";
                let wp = avnav.api.LatLon().parse(wplat, wplon);
                TinyTest.assertRange(13.578838333333334,wp.lon,1e-6)
                TinyTest.assertRange(54.18466,wp.lat,1e-6);
                console.log(wp);
            }
        });
    },2000);
}());
