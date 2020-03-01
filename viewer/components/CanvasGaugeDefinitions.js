import WidgetFactory from './WidgetFactory.jsx';
import assign from 'object-assign';

export default ()=>{
    let prefix="radGauge_";
    WidgetFactory.registerWidget(
      //Compass
    {
        name: prefix+"Compass",
        type: 'radialGauge',
        "unit":"°",
        "formatter":"formatDirection",
        "drawValue":true,
        "animationDuration": 1000,
        "animationRule":"linear",
        "minValue": 0,
        "maxValue": 360,
        "majorTicks": [
        "N",
        "NE",
        "E",
        "SE",
        "S",
        "SW",
        "W",
        "NW",
        "N"
    ],
        "minorTicks": 9,
        "highlights": [
    ],
        "needleCircleSize":0,
        "needleCircleOuter":false,
        "needleType":"line",
        "needleStart":65,
        "needleEnd":99,
        "needleWidth":5,
        "borderShadowWidth":0,
        "valueBox": false,
        "ticksAngle": 360,
        "startAngle": 180,
        "animationTarget": "plate"
    });

    WidgetFactory.registerWidget({
        name:prefix+"Speed",
        type: 'radialGauge',
        translateFunction: (props)=>{
            let rt=assign({},props);
            if (props.minValue !== undefined && props.maxValue !== undefined){
                let inc=Math.floor((parseFloat(props.maxValue)-parseFloat(props.minValue))/10);
                let majorTicks=[];
                for (let i=Math.round(props.minValue);i<=props.maxValue;i+=inc){
                    majorTicks.push(i);
                }
                rt.majorTicks=majorTicks;
            }
            if (props.startHighlight){
                rt.highlights=[
                    {from:parseFloat(props.startHighlight),to:parseFloat(props.maxValue||200),color:props.colorHighlight}
                ];
            }
            else{
                rt.highlights=[];
            }
            return rt;
        },
        formatter: 'formatSpeed',
        minValue:0,
        startAngle:90,
        ticksAngle:180,
        valueBox:false,
        maxValue:16,
        majorTicks:"0,2,4,6,8,10,12,14,16",
        minorTicks:2,
        strokeTicks:true,
        highlights:[
            {"from": 6, "to": 16, "color": "rgba(200, 50, 50, .75)"}
            ],
        colorPlate:"#fff",
        borderShadowWidth:"0",
        borders:false,
        needleType:"arrow",
        needleWidth:2,
        needleCircleSize:7,
        needleCircleOuter:true,
        needleCircleInner:false,
        animationDuration:1000,
        animationRule:"linear"
    },{
        minValue:{type:'NUMBER'},
        maxValue:{type:'NUMBER'},
        colorHighlight:{type:'COLOR',default:"rgba(200, 50, 50, .75)"},
        startHighlight:{type:'NUMBER'}
    });
    prefix="horGauge_";
    WidgetFactory.registerWidget(
        //Compass
        {
            name: prefix+"Compass",
            type: 'horizontalGauge',
            "unit":"°",
            "formatter":"formatDirection",
            "drawValue":false,
            tickSide: "right",
            numberSide: "right",
            borders:false,
            barBeginCircle:0,
            barProgress:false,
            barWidth:0,
            "animationDuration": 1000,
            "animationRule":"linear",
            "minValue": 0,
            "maxValue": 360,
            "majorTicks": [
                "0",
                "45",
                "90",
                "135",
                "180",
                "225",
                "270",
                "315",
                "360"
            ],
            "minorTicks": 9,
            "highlights": [
            ],
            "needleType":"line",
            "needleStart":65,
            "needleEnd":99,
            "needleWidth":5,
            "borderShadowWidth":0,
            "valueBox": false,
            "ticksAngle": 360,
            "startAngle": 180,
            "animationTarget": "plate"
        });
};