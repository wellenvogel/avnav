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
        "formatter":"formatDecimal",
        "formatterParameters":"3,0",
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
};