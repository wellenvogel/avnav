/**
 * Created by andreas on 27.07.19.
 */

const K=999; //the real value does not matter

//the global definition of all used store keys
//every leaf entry having the value "K" will be replaced with its path as a string
let keys={
    nav:{
        gps:{
            lat:K,
            lon:K,
            position: K,
            course: K,
            speed: K,
            rtime: K,
            raw: K,
            valid: K,
            windAngle: K,
            windSpeed: K,
            windReference: K,
            positionAverageOn:K,
            speedAverageOn: K,
            courseAverageOn: K,
            depthBelowTransducer: K,
            alarms: K,
            sequence: K //will be incremented as last operation on each receive
        },
        center:{
            course: K,
            distance: K,
            markerCourse: K,
            markerDistance: K,
            position: K
        },
        wp:{
            course: K,
            distance: K,
            eta: K,
            xte: K,
            vmg: K,
            position: K,
            name: K
        },
        anchor:{
            distance: K,
            direction:K,
            watchDistance: K
        },
        route:{
            name: K,
            numPoints: K,
            len:K,
            remain: K,
            eta: K,
            nextCourse: K,
            isApproaching: K
        },
        editRoute:{
            name: K,
            numPoints: K,
            len: K,
            remain: K,
            eta: K,
            isActive: K
        },
        ais:{
            nearest: K, //to be displayed
            list:K,
            trackedMmsi: K,
            updateCount:K
        }
    },
    gui:{
        global:{
            smallDisplay: K,
            pageName: K,
            pageOptions:K,
            onAndroid:K,
            propertySequence:K,
            hasActiveInputs: K,
            currentDialog: K, //holds the data for the currently visible dialog - if any
            windowDimensions: K,
            layout: K, //the loaded layout object
            layoutSequence: K, //updated on layout load
        },
        navpage:{
            zoom: K,
            requiredZoom: K, //the zoom that we would like to get
            topWidgets: K, //the list of top widgets to be displayed
            leftWidgets: K, //the list of left widgets,
            bottomLeftWidgets: K,
            bottomRightWidgets: K
        },
        mainpage:{
            chartList: K,
            status: K,
            addOns: K,
        },
        gpspage:{
            pageNumber:K,
        },
        aispage:{
            sortField:K,
        },
        addonpage:{
            activeAddOn:K,
        }

    },
    //all keys below this one are synced with the property handler
    //so we can only have values here that correspond to available properties
    properties:{
        connectedMode: K,
        nightMode: K,
        buttonFontSize: K,
        localAlarmSound: K

    }
};

//replace all "K" values with their path as string
function update_keys(base,name){
    for (let k in base){
        let cname=name?(name+"."+k):k;
        if (base[k] === K){
            base[k]=cname;
        }
        if (typeof (base[k]) === 'object'){
            update_keys(base[k],cname);
        }
    }
}

update_keys(keys);

module.exports=keys;
