/*
 example user.js file
 you can adapt avnav using this file
 especially you can define your own widgets (displays)
 for the API see https://github.com/wellenvogel/avnav/blob/master/viewer/util/api.js
 you can reach it at window.avnav.api
 some code is added here as an example that you can use as a basis for your own work
 Remark: Whenever you change something in this file, you need to reload in your browser
 to make the changes active
 the complete code inside this file will be wrapped into an anonymous function
 */


/*
 Example 1:
 register an own simple display just being able to display
 a value using the default widget.
 So there is no need to write any display code. But we will add a formatter,
 that will convert Hz into rpm.
 We are going to display a rpm value - and expect the input to be in Hz
 The formatter will get the current value as first parameter
 we also allow a second parameter (can be set in the layout editor at formatterParameters),
 if this is set to something not empty we will just return the input value
 */
var rpmFormatter = function (value, opt_keep) {
    if (value === undefined) return "???";
    if (opt_keep) {
        return avnav.api.formatter.formatDecimal(parseFloat(value), 4.1);
    }
    return avnav.api.formatter.formatDecimal(parseFloat(value) * 60, 4, 1); //1Hz->60rpm
};
var rpmWidget = {
    /**
     * this is the name you will see in the layout editor
     * you should use a name that starts with "user" to avoid any conflicts
     * when you try to register a name that already exists there will be an exception
     */
    name: "userRpm",
    /**
     * the unit that is being shown (can be changed in the widget editor)
     */
    unit: "rpm",
    /**
     * the default caption - can be changed in the widget editor
     */
    caption: "RPM",
    /**
     * our own formatter function
     */
    formatter: rpmFormatter

};
/*
 uncomment the next line to register rhe widget
 */
//avnav.api.registerWidget(rpmWidget);

/**
 * Example 2:
 * an own definition of a "gauge" widget
 * avnav includes the canvas gauges library
 * for all the parameters refer to https://canvas-gauges.com/documentation/user-guide/configuration
 * in this example we define a radial gauge that can display rpm
 * we also show how to give the user a chance to select a couple of parameters in the layout editor
 * for avnav's own definitions of gauges refer to
 * https://github.com/wellenvogel/avnav/blob/master/viewer/components/CanvasGaugeDefinitions.js
 * we reuse the same formatter like for example 1
 */
var rpmGauge = {
    /**
     * a unique name to select the widget
     */
    name: "userRpmGauge",
    unit: "rpm",
    caption: "RPM",
    /**
     * the type of the widget we would like to use
     * in this case: a radial gauge
     * alternatively it could be linearGauge for a linear one
     */
    type: "radialGauge",
    /**
     * we again use our rpm formatter
     */
    formatter: rpmFormatter,
    /**
     * default min value but we allow the user to overwrite this in the editor
     */
    minValue: 0,
    /**
     * default max value but we allow the user to overwrite this in the editor
     */
    maxValue: 4000,
    /**
     * to compute some values that depend on the settings the user has choosen in the layout
     * editor we can have a "translation" function
     * it will receive all settings and the value as an input and can do arbitrary translations
     * this function is completely optional - so just only implement this
     * if you really need to
     * as we would like to have just 10 numbers and the user can choose the range - we need to compute this
     * and we also need to compute the highlight area (if any)
     * the output if this function goes to the gauge - so you can also set any additional parameters you need here
     */
    translateFunction: function (props) {
        //we need to compute the "ticks" that should be displayed from
        //minValue and maxValue
        if (props.minValue !== undefined && props.maxValue !== undefined) {
            var inc = Math.floor((props.maxValue - props.minValue) / 10);
            if (inc < 1) inc = 1;
            var majorTicks = [];
            for (var i = Math.round(props.minValue); i <= props.maxValue; i += inc) {
                majorTicks.push(i);
            }
            props.majorTicks = majorTicks;
        }
        //if the user defined a highlight range
        //we set this
        if (props.startHighlight) {
            props.highlights = [
                {from: props.startHighlight, to: props.maxValue || 10000, color: props.colorHighlight}
            ];
        }
        else {
            props.highlights = [];
        }
        return props;
    },

    /**
     * some settings to adapt the gauge to our needs
     * refer to https://canvas-gauges.com/documentation/user-guide/configuration
     * if you want to give the user a chance to adapt some, just add a user parameter definition for it - see below
     */
    startAngle: 90,
    ticksAngle: 180,
    valueBox: false,
    minorTicks: 2,
    strokeTicks: true,
    colorPlate: "#fff",
    borderShadowWidth: "0",
    borders: false,
    needleType: "arrow",
    needleWidth: 2,
    needleCircleSize: 7,
    needleCircleOuter: true,
    needleCircleInner: false,
    animationDuration: 1000,
    animationRule: "linear"
};
/**
 * the definitions of parameters that the user can change
 * in the layout editor (beside the default parameters)
 * each parameter will become part of the data that the widget will receive
 *
 */
var rpmGaugeUserParameter = {
    minValue: {type: 'NUMBER', default: 0},
    maxValue: {type: 'NUMBER', default: 4000},
    colorHighlight: {type: 'COLOR', default: "rgba(200, 50, 50, .75)"},
    startHighlight: {type: 'NUMBER'}
};
/**
 * uncomment the next line to really register the widget
 */
//avnav.api.registerWidget(rpmGauge,rpmGaugeUserParameter);

/**
 * Example 3:
 * a widget that renders some own html to display a value
 * we again use the formatter we already defined
 * with the definition of "renderHtml" we create some own new widget
 * so there is no predefined handling of any data being fetched or any formatting
 * as we would like to give the user a chance to select which value he would like to see,
 * we define some parameters that he can set
 */

var example3UserParameters = {
    //formatterParameters is already well known to avnav, so no need for any definition
    //just tell avnav that the user should be able to set this
    formatterParameters: true,
    //we would like to get a value from the internal data store
    //if we name it "value" avnav already knows how to ask the user about it
    value: true
};

var example3Widget = {
    name: "userSpecialRpm",
    unit: "rpm",
    caption: "RPMspecial",
    renderHtml: function (props) {
        var fmtParam = ((props.formatterParameters instanceof  Array) && props.formatterParameters.length > 0) ? props.formatterParameters[0] : undefined;
        var fv = rpmFormatter(props.value, fmtParam);
        return "<div class=\"widgetData\">" + fv + "</div>";
    }
};
/**
 * uncomment the next line to really register the widget
 */
//avnav.api.registerWidget(example3Widget,example3UserParameters);

/**
 * for other examples and especially a widget with own drawing to a canvas refer to
 * https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js
 */
