import WidgetFactory from './WidgetFactory.jsx';
import {getTicks} from "./CanvasGauges";
import Helper from "../util/helper";


const temperatureTranslateFunction=(props)=>{
    let rt=props;
    let majorTicks=getTicks(props.minValue,props.maxValue,10);
    if (majorTicks){
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
    if (props.inputIsKelvin){
        if (props.value !== undefined){
            rt.value=props.value-273.15;
        }
    }
    return rt;
};

const voltageTranslateFunction=(props)=>{
    let rt=props;
    let majorTicks=getTicks(props.minValue,props.maxValue,10);
    if (majorTicks){
        rt.majorTicks=majorTicks;
    }
    rt.highlights=[];
    let warningStart=parseFloat(props.minValue||0);
    let okStart=parseFloat(props.minValue||0);
    if (props.startDanger){
        rt.highlights.push(
            {from:parseFloat(props.minValue),to:parseFloat(props.startDanger),color:props.colorDanger});
        warningStart=parseFloat(props.startDanger);
        okStart=warningStart;
    }
    if (props.startWarning){
        rt.highlights.push(
            {from:warningStart,to:parseFloat(props.startWarning),color:props.colorWarning}
        );
        okStart=parseFloat(props.startWarning);
    }
    if (props.colorOk !== undefined) {
        rt.highlights.push(
            {from: okStart, to: props.maxValue || 200, color: props.colorOk}
        );
    }
    return rt;
};


export default  ()=>{
    let prefix="radGauge_";
    const compassParam={
        formatterParameters: false,
        inputRadian:{type:'BOOLEAN',description:'enable to use data that is provided in radian (like from SignalK)'}
    }
    const compassTranslateFunction=(props)=>{
        if (props.value !== undefined){
            const v=parseFloat(props.value);
            return {
                value: props.inputRadian?Helper.degrees(v):v
            };
        }
    }
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
        "animationTarget": "plate",
        colorPlate:"rgba(255, 255, 255, 0)",
        translateFunction: compassTranslateFunction
    },compassParam);

    WidgetFactory.registerWidget({
        name:prefix+"Speed",
        type: 'radialGauge',
        translateFunction: (props)=>{
            let rt=props;
            if (props.minValue !== undefined && props.maxValue !== undefined){
                let inc=Math.floor((parseFloat(props.maxValue)-parseFloat(props.minValue))/10);
                if (inc < 1) inc=1;
                let majorTicks=[];
                for (let i=Math.round(props.minValue);i<=parseFloat(props.maxValue);i+=inc){
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
        colorPlate:"rgba(255, 255, 255, 0)",
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
        valueBox: false,
        minValue:{type:'NUMBER',default:0},
        maxValue:{type:'NUMBER',default: 100},
        colorHighlight:{type:'COLOR',default:"rgba(200, 50, 50, .75)"},
        startHighlight:{type:'NUMBER'}
    });

    WidgetFactory.registerWidget({
        name:prefix+"Temperature",
        type: 'radialGauge',
        translateFunction: temperatureTranslateFunction,
        formatter: 'formatDecimal',
        formatterParameters: '3,0',
        unit: '°C',
        minValue:-20,
        startAngle:90,
        ticksAngle:180,
        valueBox:false,
        maxValue:50,
        majorTicks:[],
        minorTicks:10,
        strokeTicks:true,
        highlights:[
        ],
        colorPlate:"rgba(255, 255, 255, 0)",
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
        formatter: false,
        formatterParameters: false,
        valueBox: false,
        minValue:{type:'NUMBER',default:-100},
        maxValue:{type:'NUMBER',default:100},
        inputIsKelvin:{type:'BOOLEAN',default:false},
        colorHighlight:{type:'COLOR',default:"rgba(200, 50, 50, .75)"},
        startHighlight:{type:'NUMBER',default: 30}
    });

    WidgetFactory.registerWidget({
        name:prefix+"Voltage",
        type: 'radialGauge',
        translateFunction: voltageTranslateFunction,
        formatter: 'formatDecimal',
        formatterParameters: '2,2',
        unit: 'V',
        minValue:0,
        startAngle:90,
        ticksAngle:180,
        valueBox:false,
        maxValue:18,
        majorTicks:[],
        minorTicks:10,
        strokeTicks:true,
        highlights:[
        ],
        colorPlate:"rgba(255, 255, 255, 0)",
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
        formatter: false,
        formatterParameters: false,
        valueBox: false,
        minValue:{type:'NUMBER',default:9},
        maxValue:{type:'NUMBER',default:16},
        startWarning:{type:'NUMBER',default: 12.2},
        colorWarning:{type:'COLOR',default:"#e7ed0c"},
        startDanger:{type:'NUMBER',default: 11.5},
        colorDanger:{type:'COLOR',default:"#ed1414"},
        colorOk:{type:'COLOR'}
    });
    prefix="linGauge_";
    const compass = {
        type: 'linearGauge',
        "unit": "°",
        "formatter": "formatDirection",
        "drawValue": false,
        tickSide: "right",
        numberSide: "right",
        borders: false,
        barBeginCircle: 0,
        barProgress: false,
        barWidth: 0,
        "animationDuration": 1000,
        "animationRule": "linear",
        "minorTicks": 9,
        "highlights": [],
        "needleType": "line",
        "needleWidth": 5,
        needleStart: 0,
        needleEnd: 100,
        "borderShadowWidth": 0,
        "valueBox": false,
        "ticksAngle": 360,
        "startAngle": 180,
        "animationTarget": "plate",
        colorPlate: "rgba(255, 255, 255, 0)",
        translateFunction: compassTranslateFunction
    }
    WidgetFactory.registerWidget({
        ...compass,
        name: prefix + "Compass",
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
        ]
        },compassParam);
    WidgetFactory.registerWidget({
        ...compass,
        name: prefix + "Compass180",
        "minValue": -180,
        "maxValue": 180,
        "majorTicks": [
            "-180",
            "-135",
            "-90",
            "-45",
            "0",
            "45",
            "90",
            "135",
            "180"
        ],
        formatterParameters: [false,true]
    },compassParam);

    WidgetFactory.registerWidget(
        {
            name: prefix+"Temperature",
            type: 'linearGauge',
            "unit":"°C",
            "formatter":"formatDecimal",
            formatterParameters: "3,0",
            translateFunction: temperatureTranslateFunction,
            drawValue:false,
            tickSide: "right",
            numberSide: "right",
            borders:false,
            barBeginCircle:0,
            barProgress:true,
            "animationDuration": 1000,
            "animationRule":"linear",
            "minValue": -20,
            "maxValue": 50,
            "majorTicks": [
            ],
            "minorTicks": 10,
            "highlights": [
            ],
            "needleType":"line",
            needleWidth:5,
            needleStart:0,
            needleEnd:100,
            "borderShadowWidth":0,
            "valueBox": false,
            colorPlate:"rgba(255, 255, 255, 0)",
        },{
            formatter: false,
            formatterParameters: false,
            valueBox: false,
            minValue:{type:'NUMBER'},
            maxValue:{type:'NUMBER'},
            inputIsKelvin:{type:'BOOLEAN',default:false},
            colorBar:{type:'COLOR',default: '#ccc'},
            colorBarProgress:{type:'COLOR',default:'#888'},
            colorHighlight:{type:'COLOR',default:"rgba(200, 50, 50, .75)"},
            startHighlight:{type:'NUMBER',default:30}
        });

    WidgetFactory.registerWidget({
        name:prefix+"Voltage",
        type: 'linearGauge',
        translateFunction: voltageTranslateFunction,
        formatter: 'formatDecimal',
        formatterParameters: '2,2',
        unit: 'V',
        minValue:0,
        valueBox:false,
        maxValue:18,
        majorTicks:[],
        minorTicks:10,
        strokeTicks:true,
        highlights:[
        ],
        tickSide: "right",
        numberSide: "right",
        borders:false,
        barBeginCircle:0,
        barProgress:false,
        barWidth:0,
        barStrokeWidth:0,
        colorPlate:"rgba(255, 255, 255, 0)",
        borderShadowWidth:0,
        needleType:"line",
        needleWidth:4,
        needleStart:0,
        needleEnd:100,
        animationDuration:1000,
        animationRule:"linear"
    },{
        formatter: false,
        formatterParameters: false,
        valueBox: false,
        minValue:{type:'NUMBER',default:9},
        maxValue:{type:'NUMBER',default:16},
        startWarning:{type:'NUMBER',default: 12.2},
        colorWarning:{type:'COLOR',default:"#e7ed0c"},
        startDanger:{type:'NUMBER',default: 11.5},
        colorDanger:{type:'COLOR',default:"#ed1414"},
        colorOk:{type:'COLOR'}
    });
};