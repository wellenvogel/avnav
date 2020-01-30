(function() {
  //register some new formatter
  //the type can be "c"|"k"
  //value is in kelvin
  var formatTemperature=function(value,type){
        if (value === undefined) return value;
        if (type === "c"){
            value=value-273.15;
        }
        return avnav.api.formatter.formatDecimal(value,3,1);
  };
  /**
  format a pressure
  @param type: either "h" for hPa, or... for unchanged
  **/
  var formatPressure=function(pressure,type){
    var fract=0;
    if (type === "h"){
      pressure=pressure/100;
      fract=1;
    }
    return avnav.api.formatter.formatDecimal(pressure,4,fract);
  }

  /** a widget to display the pressure in hPa
      necessary parameters:
        storeKeys  { value: nav.gps.signalk....}
        caption    string

  **/
  var hpaWidget={
    name: "signalKPressureHpa",
    unit: "hPa",
    formatter: function(val){return formatPressure(val,"h");},
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
    formatter: function(value){return formatTemperature(value,"c")},
    default: '---'
  };
  avnav.api.registerWidget(celsiusWidget);
  avnav.api.registerWidget(hpaWidget);
})();