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
  avnav.api.formatter.formatTemperature=formatTemperature;
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
})();