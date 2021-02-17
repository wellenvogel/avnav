(function() {
  //register some new formatter
  //the type can be "c"|"k"
  //value is in kelvin
  var formatTemperature=function(value,type){
    if (! Number.isFinite(value)) return "---";
        if (type === "c"){
            value=value-273.15;
        }
        return avnav.api.formatter.formatDecimal(value,3,1);
  };
  //we define the parameters for our formatter
  //to be shown in the layout editor
  //the syntax is similar to the editable parameters of a widget
  formatTemperature.parameters=[
    {name:'unit',type:'SELECT',list:['k','c'],default:'k'}
  ];
  /**
  format a pressure
  @param type: either "h" for hPa, or... for unchanged
  **/
  var formatPressure=function(pressure,type){
    if (! Number.isFinite(pressure)) return "---";
    var fract=0;
    if (type === "h" || type === 'hpa'){
      pressure=pressure/100;
      fract=0;
    }
    return avnav.api.formatter.formatDecimal(pressure,4,fract);
  }
  formatPressure.parameters=[
    {name:'unit',type:'SELECT',list:['pa','hpa'],default:'pa'}
  ];

  /** a widget to display the pressure in hPa
      necessary parameters:
        storeKeys  { value: nav.gps.signalk....}
        caption    string

  **/
  var hpaWidget={
    name: "signalKPressureHpa",
    unit: "hPa",
    formatter: formatPressure,
    formatterParameters: ['hpa'],
    default: "---"
  }
  /** a widget to display the temperature in celsius
      necessary parameters:
        storeKeys  { value: nav.gps.signalk....}
        caption    string

  **/
  var celsiusWidget={
    name: "signalKCelsius",
    unit: "°",
    formatter: formatTemperature,
    formatterParameters: ['c'],
    default: '---'
  };
  avnav.api.registerWidget(celsiusWidget);
  avnav.api.registerWidget(hpaWidget);
  //with newer versions of avnav we can also register our formatters
  //to make them available to other widgets
  avnav.api.registerFormatter('skTemperature',formatTemperature);
  avnav.api.registerFormatter('skPressure',formatPressure);
})();