import WidgetFactory from './WidgetFactory.jsx';
import assign from 'object-assign';

export default ()=>{
    let prefix="radGauge.";
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
    prefix="horGauge.";
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