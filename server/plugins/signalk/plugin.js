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

  //contribution from Tom (tom.christ@freenet.de)
  /**
  * SignalK Rad in Degree
  */
  var signalKDegreeFormatter = function (value) {
      if (value === undefined) return "???";
      return avnav.api.formatter.formatDecimal(parseFloat(Math.abs(value)) / Math.PI * 180, 4, 0);
  };

  /**
  * Widget for roll from SignalK (durch IMU erzeugt)
  */
  var signalKRollWidget = {
      /**
       * this is the name you will see in the layout editor
       * you should use a name that starts with "user" to avoid any conflicts
       * when you try to register a name that already exists there will be an exception
       */
      name: "signalKRoll",
      /**
       * the unit that is being shown (can be changed in the widget editor)
       */
      unit: "°",
      /**
       * the default caption - can be changed in the widget editor
       */
      caption: "Roll",
      /**
       * default critical value but we allow the user to overwrite this in the editor
       */
       criticalValue: 45,
      /**
       * Erzeugung von eigenem Html code
       */
      renderHtml: function (props) {
          var degree = signalKDegreeFormatter(props.value);
          var degree_pfeil = "0";
          // arrow left + Wert
          if (props.value <0 && degree != 0){
              degree_pfeil = "\u21D0" + degree;
          }
          // value + space + arrow right
          if (props.value >0 && degree != 0){
              degree_pfeil = degree + "\xA0\u21D2";
          }
          // large text
          if (degree < parseFloat(props.criticalValue)){
              return "<div class=\"widgetData\">"  + degree_pfeil + "</div>";
          }
          // red if >= criticalValue
          return "<div class=\"widgetData critical\" >"  + degree_pfeil + "</div>";
      }
  };
  // Show/Hide Parameters
  var signalKRollParameters = {
      formatterParameters: false,
      value:  {type: 'KEY', default: 'nav.gps.signalk.navigation.attitude.pitch'},
      // red from this value on
      criticalValue: {type: 'NUMBER', default: 45},
  };
  //register the widget
  avnav.api.registerWidget(signalKRollWidget,signalKRollParameters);
  /**
  *  Pitch from SignalK (created by IMU)
  */
  var signalKPitchWidget = {
      /**
       * this is the name you will see in the layout editor
       * you should use a name that starts with "user" to avoid any conflicts
       * when you try to register a name that already exists there will be an exception
       */
      name: "signalKPitch",
      /**
       * the unit that is being shown (can be changed in the widget editor)
       */
      unit: "°",
      /**
       * the default caption - can be changed in the widget editor
       */
      caption: "Pitch",
      /**
       * default critical value but we allow the user to overwrite this in the editor
       */
       criticalValue: 20,
      /**
       * Erzeugung von eigenem Html code
       */
      renderHtml: function (props) {
          var degree = signalKDegreeFormatter(props.value);
          var degree_pfeil = "0";
          // value + space + arrow down
          if (props.value <0 && degree != 0){
              degree_pfeil = degree + "\xA0\u21D3";
          }
          // value + space + arrow up
          if (props.value >0 && degree != 0){
              degree_pfeil = degree + "\xA0\u21D1";
          }
          // large text
          if (degree < parseFloat(props.criticalValue)){
              return "<div class=\"widgetData\">"  + degree_pfeil + "</div>";
          }
          // red if critical
          return "<div class=\"widgetData critical\">"  + degree_pfeil + "</div>";
      }

  };

  // Show/Hide Parameters
  var signalKPitchParameters = {
      formatterParameters: false,
      value: {type: 'KEY', default: 'nav.gps.signalk.navigation.attitude.pitch'},
      criticalValue: {type: 'NUMBER', default: 20},
  };

  //register he widget
  avnav.api.registerWidget(signalKPitchWidget,signalKPitchParameters);

  
  
})();