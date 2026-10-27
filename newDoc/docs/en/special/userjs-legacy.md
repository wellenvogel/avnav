# User-specific Java Script Code
==================================
!!! IMPORTANT
    This description refers to JavaScript code located in a legacy `user.js` or `plugin.js` file.
    The description for current module-based JavaScript code can be found [here](userjs.md).

To provide an easy way to customize AvNav to your needs, you can extend AvNav relatively easily with a little bit of Java Script code.

It is possible to define new displays that can then be selected in the Layout Editor. In principle, you can execute arbitrary Java Script code there - but you must, of course, ensure that you do not interfere with the functions of AvNav.

The Java Script code is located in the `user.js` file in the directory `BASEDIR/user/viewer`.
`BASEDIR` is, for example, `/home/pi/avnav/data` on the Pi.


Widgets {: #widgets}
-------------------------------

You can add the following types of displays:

* Widgets with their own formatter (and possibly fixed values) based on the default widget (Example 1 - [user.js](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js): `rpmWidget`, [testPlugin](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js): `testPluing_simpleWidget`)
* Customization/extension of graphic widgets with [canvas gauges](https://canvas-gauges.com/) (Example 2 - [user.js](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js#L69): `rpmGauge`)  
  This also makes it possible to access parameters that are not included in the existing widgets
* Widgets with custom HTML code (Example 3 - [user.js](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js): `userSpecialRpm`, [TestPlugin](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js): `testPlugin_courseWidget`)
* Widgets with graphics in a canvas element (Example in [TestPlugin:](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js) `testPlugin_courseWidget`)
* Widgets with custom HTML that interact with the server part of a plugin ([TestPlugin](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js): `testPlugin_serverWidget`)
* Widgets that display graphics on the map (type: map) - since 20220819 e.g. [SailInstrument](https://github.com/kdschmidt1/Sail_Instrument/blob/e1d87186138e5a3ac894916e9b7e85a3218a4c9a/Sail_Instrument/plugin.js#L223)

The interface for communicating with AvNav can be found [on github](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/util/api.js) or in the template code.  
For map widgets, the [underlying libraries](https://www.movable-type.co.uk/scripts/geodesy-library.md) for geographical calculations can be accessed via the API (function `LatLon` and `Dms`).

### Canvas Gauges

For [Canvas Gauge](https://canvas-gauges.com/) widgets, certain parameters (see [Canvas Gauges description](https://canvas-gauges.com/documentation/user-guide/configuration)) can either be set to fixed values (they must then be present in the widget definition - see the values in the [example from line 134](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js#L134)) or they can be made adjustable for the user in the Layout Editor (they must then be set as [editable WidgetParameter](#widgetparameter) - in the [example from line 156](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js#L156)).

Additionally, a [custom formatter](#formatter) can optionally be defined and set as the default for the widget.

If you want to prevent certain [predefined parameters](#predefinedparameters) from becoming visible to the user in the Layout Editor, they must be specified as `false` in the editable parameters.

```
var rpmGaugeUserParameter = {
...
formatter: false,
formatterParameters: false
};
```

For each gauge widget, the parameter "type" must be specified - either "radialGauge" or "linearGauge".  
They also have the additional parameter:

```
drawValue (boolean)
```

This parameter controls whether a numeric display of the value should also occur. The original "valueBox" parameter of the canvas gauges is ignored!

In addition to the parameters, a `translateFunction` can also be defined. This receives an object with the current values of all parameters as a parameter and can modify it before it is passed to canvas gauges ([example from line 104](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js#L104)). This function must be "stateless", i.e., the return values may only depend on the passed values (and other immutable values). Otherwise, changes may potentially not be visible in the display.

### Custom Widgets

For a self-written widget, the following functions/properties can be implemented:

| Name | Type | Usable for Type | Description |
| --- | --- | --- | --- |
| name | String | all | The name of the widget |
| type | String (optional) | all | Determines which widget should be created. Values: `radialGauge`, `linearGauge`, `map`. If the type is not set, either the default widget is used (no `renderHtml` and no `renderCanvas` function specified) - or a user-defined widget (`userWidget`) |
| renderHtml | Function (optional) | `userWidget` | This method must return a string that is then inserted as HTML code into the widget. If event handlers for elements are to be used, they must be registered beforehand (see `initFunction`) and are simply specified in the HTML code with ``` <button onclick="myHandler">Click!</button> ``` (this is not exact HTML syntax, as only the name of the event handler is specified, no Java Script code). The "this" variable within `renderHtml` points to an object that is specific to the widget (context). When the event handler is called, "this" also points to this context. The object passed as a parameter to `renderHtml` contains the values defined under `storeKeys`. The function is called again every time the values have changed. |
| renderCanvas | Function (optional) | `userWidget`, `map` | This function can be used to draw in the passed canvas object. The object passed as a second parameter to `renderCanvas` contains the values defined under `storeKeys`. The function is called again every time the values have changed. The "this" variable within `renderCanvas` points to an object that is specific to the widget (context). For map widgets, this canvas is an overlay that is placed over the map. Functions for converting coordinates to canvas pixels are available on the widget context. It is important to describe the canvas correctly with `save/restore`, as all map widgets share the same canvas. |
| storeKeys | Object | all | Here you must specify the data that should be read from the central store and passed as parameters to the `renderXXX` functions |
| caption | String (optional) | all | A default caption |
| unit | String (optional) | all | A default unit |
| formatter | Function (optional) | `defaultWidget`, `radialGauge`, `linearGauge` | A formatter for the value. For the `defaultWidget`, this function must be specified. |
| translateFunction | Function (optional) | all except `map` | This function is called with the current values as a parameter (as specified in `storeKeys`) and must return the values calculated from them. If no custom `renderXXX` function is to be used, a conversion of values can take place here before rendering - see [example](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js). |
| initFunction | Function (optional) | `userWidget`, `map` | If present, this function is called once when the widget is created. The widget context is available as a parameter (and as "this"). This object has an `eventHandler` property - the event handlers used in `renderHTML` must be registered here. With the `triggerRedraw` function on the widget context, a re-call of the `renderXXX` functions can be forced. From version 20210422, the `initFunction` receives a 2nd parameter, which contains the properties of the widget. These are in particular all editable widget parameters that have been defined. |
| finalizeFunction | Function (optional) | `userWidget`, `map` | If present, this function is called before the widget is no longer used. The "this" variable points back to the widget context. The context is also available as the first parameter - just like in the `initFunction`. |

The Java Script code receives the following global variables:

| Name | plugin.js/user.js | Description |
| --- | --- | --- |
| AVNAV_BASE_URL | both | The URL to the directory from which the Java Script file was loaded. This can be used, for example, to load further elements from there. For `user.js`, files from the images directory can be accessed via `AVNAV_BASE_URL+"../images"`. For plugins, communication with the Python part can be achieved via `AVNAV_BASE_URL+"/api"`. |
| AVNAV_PLUGIN_NAME | `plugin.js` | The name of the plugin. |

After definition, the widget must be made known to AvNav (`avnav.registerWidget`).

Widget Context
--------------

User widgets and map widgets receive a `WidgetContext`. This is created for each widget and passed to the following functions:

* `initFunction` (this and first parameter)
* `finalizeFunction` (this and first parameter)
* `renderHtml` (this)
* `renderCanvas` (this)

For the context to be used as the "this" parameter, the functions must be defined "classically" using `function` and not as an "arrow function".

Correct:

```
let userWidget={  
 renderHtml: function(context,props){  
 return "<p>Hello</p>";  
 }  
}
```

User data can be stored in the `WidgetContext`, which is needed in subsequent calls.  
It also contains some functions that can be called by the widget code.

| Name | Widget | Parameter | Description |
| --- | --- | --- | --- |
| `eventHandler` | `userWidget` | --- | `eventHandler` is not a function but an array. If event handlers are specified in the `renderHtml` - e.g. `<button onclick="clickHandler"/>`, then a `clickHandler` function must be registered here in the `initFunction`: `this.eventHandler.clickHandler=function(ev){...}` See [TestPlugin](https://github.com/wellenvogel/avnav/blob/7035cba511ea400ebcd7a972b6b0baf79deba04d/server/plugins/testPlugin/plugin.js#L150). |
| `triggerRedraw` | `userWidget` | --- | This function must be called if the widget (e.g. after communication with the server) wants to be redrawn. See [TestPlugin](https://github.com/wellenvogel/avnav/blob/7035cba511ea400ebcd7a972b6b0baf79deba04d/server/plugins/testPlugin/plugin.js#L160). |
| `lonLatToPixel` | `map` | `lon,lat` | Converts the coordinates to pixel coordinates for drawing in `renderCanvas`. Returns an array with x,y coordinate. |
| `pixelToLonLat` | `map` | `x,y` | Calculates longitude and latitude from the canvas coordinates x,y. Returns an array with lon,lat. |
| `getScale` | `map` | --- | Returns the scaling factor for the display. High-resolution displays have a scaling factor > 1. Drawn objects (especially text) should have their dimensions adjusted. |
| `getRotation` | `map` | --- | Returns the rotation of the map (in radians!). |
| `getContext` | `map` | --- | Returns the `renderingContext2D` of the canvas (only active within the `renderCanvas` function). |
| `getDimensions` | `map` | --- | Returns the size of the canvas [width, height]. |
| `triggerRender` | `map` | --- | Same function as `triggerRedraw` for the user widget. |

Widget Parameters {: #widgetparameter}
-------------------------------------

In addition to the widget definition, parameters can be specified when registering the widget, which are then displayed for the widget in the Layout Editor.

Examples can be found in the [user.js template](https://github.com/wellenvogel/avnav/blob/release-20250822/viewer/static/user.js). The values specified in the Layout Editor for these parameters are later available in the `renderHtml` and `renderCanvas` functions (exception: type `KEY`, here the value read from the store is provided).  
For each parameter, you can specify the following values:

| Name | Type | Description |
| --- | --- | --- |
| | `key` | The name of the parameter as it should be displayed in the Layout Editor and as it should be available to the `renderXXX` functions. |
| `type` | String | `STRING`, `NUMBER`, `FLOAT`, `KEY`, `SELECT`, `ARRAY`, `BOOLEAN`, `COLOR`. The type for the parameter. Depending on the type, it is displayed differently to the user. For `COLOR`, a color picker; for `SELECT`, a selection list; and for `KEY`, the list of currently available values in the store. For an array, a comma-separated list can be specified. |
| `default` | depends on type | The default value. For `COLOR`, a color CSS property - e.g. "rgba(200, 50, 50, .75)". |
| `list` | Array (only for type `SELECT`) | An array of strings or objects `{name:'xxx',value:'yyy'}` - these values are displayed for selection. Instead of an array, a function can also be specified that returns an array - or a function that returns a Promise, whose `resolve` function then delivers the array. |

There are a number of predefined parameters for the Layout Editor. For these, no object with properties is specified for the description, but only `true` or `false` (this shows whether they should be offered for change or not).
{: #predefinedparameters}

These are:

* `caption` (`STRING`)
* `unit` (`STRING`)
* `formatter` (`SELECT`)
* `formatterParameters` (`ARRAY`)
* `value` (`KEY`)
* `className` (`STRING`)

An example of a definition:

```
var exampleUserParameters = {
//formatterParameters is already well known to avnav, so no need for any definition
//just tell avnav that the user should be able to set this
formatterParameters: true,
//we would like to get a value from the internal data store
//if we name it "value" avnav already knows how to ask the user about it
value: true,
//we allow the user to define a minValue and a maxValue
minValue: {type: 'NUMBER', default: 0},
maxValue: {type: 'NUMBER', default: 4000},
};
```

Formatter {: #formatter}
--------------------------------------

In addition to the actual displays, custom formatters can also be written that prepare the values for display.  
A number of formatters are already present in the system - see [Layout Editor](layout.md#formatter).

From version 20210106, custom formatters can be registered with AvNav and are then available to all widgets. A formatter is a function that receives the value to be formatted as the first parameter and must return a string as the result.  
The string should always have the same length regardless of the current value (possibly prefix with spaces) in order not to disturb the size adjustment on the dashboard pages.

A formatter function can accept additional parameters to control the conversion. These are typically set via the widget property `formatterParameters` in the [Layout Editor](layout.md#formatter).

Example:

```
const formatTemperature=function(data,opt_unit){
try{
if (! opt_unit || opt_unit.toLowerCase().match(/^k/)){
return avnav.api.formatter.formatDecimal(data,3,1);
}
if (opt_unit.toLowerCase().match(/^c/)){
return avnav.api.formatter.formatDecimal(parseFloat(data)-273.15,3,1)
}
}catch(e){
return "-----"
}
}
formatTemperature.parameters=[
{name:'unit',type:'SELECT',list:['celsius','kelvin'],default:'celsius'}
]
```
```
avnav.api.registerFormatter("mySpecialTemperature",formatTemperature);
```

If a formatter with the same name already exists, `registerFormatter` throws an exception.

Every formatter function should have a `parameters` property. This describes the parameters visible in the Layout Editor for the function. The values in this definition have the same syntax as the [editable widget parameters](#widgetparameter).

Libraries and Images
-----------------------

If your own Java Script code needs to access libraries or images, they can be uploaded to the same directory - images also in the Images `{{BT("AddonConfigImages")}}` directory.

The inclusion of libraries can, for example, be done as follows:

```
var fileref=document.createElement('script');
fileref.setAttribute("type","text/javascript");
fileref.setAttribute("src", AVNAV_BASE_URL+"/my_nice_lib.js");
document.getElementsByTagName("head")[0].appendChild(fileref)
```

It is recommended to assign CSS classes to all widgets so that you can then customize them with [user-specific CSS](usercss.md). IDs should not be used, as the elements can potentially appear multiple times on the page.

If data is to be loaded from the server, it is recommended to use [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).
All files in the user directory (or in the plugin directory for `plugin.js`) are accessible according to the scheme `AVNAV_BASE_URL+"/"+name`.

If, for example, another text, HTML, or other file is to be created in the user directory (without uploading one), you can also do this directly with the "+" button at the bottom right - the file can then, of course, also be edited directly.

Feature Formatter
(featureFormatter) {: #featureFormatter}
------------------------------------------------------------

From version 20210114, there is the possibility to register custom functions that prepare the display of data from overlays.  
Such functions can be implemented in the `user.js` or in plugins.

With

```
avnav.api.registerFeatureFormatter('myHtmlInfo',myHtmlInfoFunction);
```

they are registered. For details see [Overlays](overlays.md#featureFormatter).