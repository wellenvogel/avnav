---
  tags:
    - Plugins
    - Extensions
    - JavaScript
    - Python
---

# Plugins {: #overview }

Plugins can extend the functionality of AvNav. Typical plugin applications are:

  * Adding new displays (widgets)
  * Adding layouts
  * New icons, colors, button text
  * Fonts
  * New chart formats
  * New chart sources or charts
  * History functions
  * ...

AvNav provides various interfaces for this, through which plugins can contribute extensions:

  * Extensions for the display part using JavaScript code or CSS
  * User Apps, i.e., custom GUIs embedded in AvNav
  * Extensions for the server part (_only Windows/Linux/Raspberry_ - not Android).

## Installing Plugins {: #installation }

There are two ways to install plugins:

  1. As Debian packages

     On Linux and Raspbian, plugins can be distributed as Debian packages. These install their contents to /usr/lib/avnav/plugins/*plugin-name*.

     In AvNav, these plugins are visible with the prefix `system-`.

  2. As a Zip file
     
     For this, the ZIP file must contain exactly one folder with the name of the plugin. Code and data must be located below this folder. Such a Zip file can then be installed in AvNav via 

     {{MM("MMpluginspage")}}=>{{BT("Upload")}}

     They are installed in the AvNav data directory under `plugins`.

     These plugins are visible with the prefix `user-`.

In addition, there are some plugins that are delivered directly with AvNav. These are visible with the prefix `builtin-`.

On the plugin page {{MM("MMpluginspage")}}, you get a list of currently installed plugins.

![Plugins](../../img/plugins-list.png)
///caption
Plugin list
///

Clicking on an entry opens a dialog.

![Plugins](../../img/plugins-click.png)
///caption
Plugin dialog
///

If it is a `user-` plugin as in the example, you can delete it via the dialog or download it as a Zip file. If the plugin includes a [UserApp](../base/userapps.md), you can reach it directly from here via the button {{DB("DBUserApp")}}.

Via {{DB("DBConfig")}}, you can change parameters for the plugin - or deactivate it if necessary.
{: #pluginconfig }

![Plugins](../../img/plugins-click2.png)
///caption
Plugin configuration
///


## List of Plugins 

A list of plugins can be found [here](plugin-list.md).

## Creating Plugins

Plugins are Zip files or Debian packages containing various components. Each plugin is installed in a directory on the AvNav server. The exact structure of the Zip file or the Debian package is described under [Build](#build).

The components described here must be located in the base directory of the plugin.

### JavaScript Code {: #jscode }

_All platforms_

The plugin's JavaScript code must be located in the file *plugin.mjs*. This file is loaded as a [JavaScript module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)<!--@@linkchanged-->. The code is only loaded if the plugin has not been [deactivated](#pluginconfig). After an update, the code is automatically reloaded. The same interfaces and functions are available for the plugin JavaScript code as for the [user JavaScript code](userjs.md).

??? "Compatibility with earlier versions - plugin.js"
    In earlier versions, the JavaScript code was in a *plugin.js* file. This was a simple JavaScript file, not a module.
    The current version still supports a *plugin.js* file.
    Since this file is also loaded as a JavaScript module in the current version and modules require stricter JavaScript code, loading errors may occur. In that case, you may need to [adapt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#other_differences_between_modules_and_non-module_scripts) your code.<!--@@linkchanged-->
    If both files are present, only the *plugin.mjs* is loaded.
    
    If you want to keep your module compatible with older AvNav versions (before 202607xx), you can put all the code in the plugin.mjs file and additionally add a plugin.js file with the following content:
    
    ``` js
    import("./plugin.mjs").then((module)=>module.default(avnav.api));
    ```
    However, you must then always test in your code whether any new API functions are already available.


### CSS {: #plugincss }

_All platforms_

In a `plugin.css` file, a plugin can provide CSS to adjust the appearance of AvNav. The same functions as for [user CSS](usercss.md) are available.

As a plugin developer, you should keep in mind that the CSS code becomes effective immediately once the plugin is loaded. If, for example, you only want to contribute additional displays (widgets), you should design the CSS code so that it only affects these specific widgets - not other representations in AvNav.

### plugin.json {: #pluginjson }

_All platforms_

A plugin can include a `plugin.json` file. This must contain a JSON object with various keys.
``` json
{
    "version":"20260810",
    "description":"Test plugin from the documentation".
}
```
The keys and their meanings (all are optional).

| Key | Type | Description |
| --- | --- | ---|
| version | String | The plugin version |
| description | String | A short description of the plugin (max. 80 characters) |
| charts | Array | A description of [charts](charts.md#pluginjsondef) that the plugin provides.|
| userApps | Array | A list of user apps - see [below](#pluginuserapps) |
| layouts | Array | A list of objects describing layouts. Each element must contain the keys `name` for the layout name and `file` for a relative filename to the layout JSON file |


#### UserApps {: #pluginuserapps }

The entries for the *userApps* parameter must contain the following values:

| Name | Type | Description |
| --- | --- | --- |
| url | String, required | the URL for the user app. Can be a relative path to an HTML file in the plugin |
| iconFile | String | relative path to an icon file. Alternatively via CSS.|
| shortText  | String | short text for the button. Alternatively via CSS |
| longText | String | long text for the button. Alternatively via CSS |
| title | String | title for the display. If not set, no title line is displayed |
| page | String | the [AvNav page](https://github.com/wellenvogel/avnav/blob/master/viewer/util/pageids.ts) on which the button for the user app should be displayed. |
| name | String | The name for the button. Also used for the CSS class. The final CSS name is formed from *prefix-pluginname-name*, so for a zip plugin named "test" and the name "ui": `user-test-ui`.|


### Python Code {: #pluginpython }

_Only on Windows/Linux/Raspberry. Not on Android._

To extend server functions, plugins can also contain Python code. The entry point is a `plugin.py` file.

AvNav offers a range of interfaces for Python code.

![Plugin Python](../../img/software-with-plugin.png)

The drawing provides a rough overview of the internal structure of the
AvNav server and the points where a plugin can read or inject data.

| Point | Function | Example |
| --- | --- | --- |
| A | Injecting NMEA data into the internal list. These are then available at all outputs. Note: Such data is initially not available to the WebApp as long as there is no decoder for this data set. | Reading a sensor and creating the appropriate NMEA0183 data set. |
| B | Reading received NMEA data. Here, all NMEA data passing through AvNav can be read (optionally with a filter). | In combination with point "C", decoding NMEA data sets |
| C | Injecting data into AvNav's internal memory. The data in the internal memory is stored in a tree structure. Each element is addressed by a key in the form "a.b.c....". Example: "gps.lat". All key values starting with "gps." are automatically transmitted to the WebApp and are then available there under "nav.gps....". (see [Layout Editor](../base/layout.md) and [user-specific JavaScript](userjs.md)). Key values must be registered by the plugin beforehand; it is not possible to overwrite keys already used in the system. Exception: The user configures "allowKeyOverride" to true for the plugin. | Injecting a value read from a sensor - e.g., *gps.temperature.outside* or decoded NMEA data. |
| D | Reading data from internal memory. | Calculation of new data and injection under "C" - or forwarding to an external connection. |
| E | Handling HTTP Requests | The JavaScript parts can send an HTTP request that can be processed in the Python code. Responses typically in JSON |

An example of a *plugin.py* can be found on [GitHub](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.py).

For the plugin to be recognized by AvNav, the following requirements must be met:

1. There must be at least one class in *plugin.py*, the name
   should be "Plugin"
2. The class must have a static method (@classmethod) named
   "pluginInfo" that returns a *dictionary*.  
   ``` python
   # description (mandatory)
   # data: list of keys to be stored (optional)
   # path - the key - see AVNApi.addData, all pathes starting with "gps." will be sent to the GUI
   # description
   @classmethod
   def pluginInfo(cls):  
    return {
        'description': 'a test plugins',
        'data': [
            {
                'path': 'gps.test',
                'description': 'output of testdecoder',
            }
            ]   
    }
   ```
3. The constructor of the plugin class must expect one parameter.  
   When called, an instance of the [API](https://github.com/wellenvogel/avnav/blob/master/server/avnav_api.py) is passed here, through which communication with AvNav takes place.
4. The class must have a *run* method (without parameters).  
   This is called in its own thread after initialization is complete.  
   Typically, this method will contain an infinite loop to implement the
   plugin function.

#### Plugin API

The following functions are available via the [API](https://github.com/wellenvogel/avnav/blob/master/server/avnav_api.py)

| Function | Description |
| --- | --- |
| log,debug,error | Logging functions. Lines are written to the AvNav log file. You should avoid writing such entries in large numbers for *log* and *error*, otherwise potentially important information may be lost in the log (i.e., not an error entry every second...) |
| getConfigValue | reads a *config* value from the [avnav_server.xml](configfile.md#plugins). |
| fetchFromQueue | Interface B: reads data from the internal NMEA list. An example is available in the API code. The filter parameter works like in the [avnav_server.xml](configfile.md#filter). |
| addNMEA | Interface A: writes an NMEA data set to the internal list. You can leave the checksum calculation to AvNav and can also prevent decoding in AvNav. The *source* parameter is a value that can be used in [blackList parameters](configfile.md#blackList). |
| addData | Interface C: writes a value to the internal memory. Only values whose keys were present in the return of the *pluginInfo* method can be written. |
| getSingleValue | Interface D: reads a data value from the internal memory. To summarize several such read operations, the function *getDataByPrefix* exists |
| setStatus | The current status of the plugin should be set here. This is the value that is displayed on the plugin page {{MM("MMpluginspage")}}. |
| registerUserApp | A plugin can register a [User App](../base/userapps.md). This requires a URL and an icon file. The icon file should be in the plugin directory. $HOST can be used in the URL, which is then replaced by the correct IP address of the AvNav server. |
| registerLayout | If the plugin brings its own widgets, it may be helpful to provide a prepared layout that the user can then select. To do this, download the layout after creation with the [Layout Editor](../base/layout.md) and save it in the plugin directory. |
| registerSettingsFile (since 20220225) | Registration of a custom settings file that can be exported from the settings page beforehand. The filename (second parameter) is relative to the plugin directory. The name (first parameter) is displayed to the user. In this file, you can use $prefix$ in the layout name if the layout is registered in the same plugin.` "layoutName": "$prefix$.main" ` |
| getDataDir | The directory where AvNav stores data |
| registerChartProvider | If the plugin provides [charts](charts.md#insertingpython), a callback is registered here that returns a list of the charts. |
| registerRequestHandler | If the plugin is to handle HTTP requests (Interface E), a callback must be registered here that processes the request. The URL for the call is: <pluginBase>/api. Here, *pluginBase* is the value returned by *getBaseUrl*. The [JavaScript parts](#jscode) can form the API URL with the function `api.getBaseUrl()+"/api"`. In the simplest case, the called callback function can return a *dictionary*, which is sent back as JSON. |
| getBaseUrl | returns the base URL for the plugin |
| registerUsbHandler (from 20201227) | registers a callback for a USB device. With this registration, AvNav is informed not to ignore the USB device. The callback is called with the device path for the device when the device is detected. The USB ID can most easily be determined by observing the status page when plugging in the device. See also [AVNUsbSerialReader](configfile.md#avnusbserialreader). This allows a plugin to easily handle a specific device itself. An example can be found on [GitHub](https://github.com/wellenvogel/avnav-seatalk-remote-plugin/blob/master/plugin.py). |
| getAvNavVersion (from 20210115) | Current AvNav version (int) |
| saveConfigValues (from 20210322) | Save *config* values for the plugin in avnav_server.xml. The parameter must be a *dictionary* with the values. The plugin must ensure that it can start again later with these values. |
| registerEditableParameters (from 20210322) | Registers a list of *config* values that can be changed at runtime. The first parameter is a list of *dictionaries* with the parameter descriptions, the second is a callback that is called with the changed values upon changes (will typically call *saveConfigValues*). The syntax for the parameter list is described in the [Source Code](https://github.com/wellenvogel/avnav/blob/master/server/avnav_api.py). |
| registerRestart (from 20210322) | Registers a stop callback. This allows the plugin to be disabled. |
| unregisterUserApp (from 20210322) | Deregisters a user app. |
| deregisterUsbHandler (from 20210322) | Deregisters a USB device ID (see *registerUsbHandler*) |
| shouldStopMainThread (from 20210322) | Can be used in the main loop to check whether the plugin should be stopped. In any other thread, it will always return *true*. |
| sendRemoteCommand (from 20230426) | Sends a remote control command, see the [Source Code](https://github.com/wellenvogel/avnav/blob/3a291c2e08bfaa13b12246f9a456a4a896533d52/server/avnav_api.py#L344) for details. |
| registerSettingsFile (from 20230426) | Makes a file with saved settings known. This can then be loaded by the user. |
| registerCommand (from 20230426) | Registers a command that can be executed by AvNav. This can be used, for example, to replace an existing command. New commands are also possible. See the [Source Code](https://github.com/wellenvogel/avnav/blob/3a291c2e08bfaa13b12246f9a456a4a896533d52/server/avnav_api.py#L364) or the [AVNCommandHandler configuration](configfile.md#avncommandhandler) for details. |
| registerConverter (since 20240520) | Registers a chart converter. For an example, see the [O-ChartsNG Plugin](https://github.com/wellenvogel/ochartsng/blob/f10d8aa8b10ce89320b939a91e14ceaa822054a0/avnav-plugin/plugin.py#L407) |
| deregisterConverter (since 20240520) | Deregisters a chart converter |
| clearAlarms (20250723) | Clears all alarms |
| startAlarm (202607xx) | Creates an alarm |
| clearAlarm (202607xx) | Clears an alarm |
| getRunningAlarms (202607xx) | List of all active alarms |

## Build {: #build }

### Zip file
To provide a plugin for use by other AvNav users, it is preferably provided as a Zip file. Plugins as a Zip file can be used on all platforms supported by AvNav. If they are also intended for Android, they should not contain Python code, as it is not used there.
Such a Zip file for an example plugin named `doctest` has, for example, the following content
```
d doctest
f doctest/plugin.json
f doctest/plugin.mjs
f doctest/plugin.css
d doctest/images
f doctest/images/icon.svg
```
After [installation](#installation), the plugin becomes visible in AvNav as `user-doctest`.

This Zip file can be created with any Zip tool. It is important that the name of the directory inside the Zip file remains the same for new versions. The name of the Zip file does not matter for AvNav - however, it should contain the plugin and a version to simplify usage by the user.

Preferably, you should maintain the plugin on a Git platform (e.g., [GitHub](https://github.com/) ) and provide the Zip file in every release. You should set the value for `version` in the [plugin.json](#pluginjson) each time.

If you want to build the plugin under Linux, there is an example of a simple build script to create the Zip file [here](https://github.com/wellenvogel/avnav-font-noto/blob/master/build.sh).

### Debian Packages

If a plugin is only intended to run on Linux/Raspberry, you can also deliver it as a Debian package. You can use the [Debian Package Tools](https://www.debian.org/doc/manuals/maint-guide/build.en.html) directly for this. If that is too complicated, you can use [NFPM](https://nfpm.goreleaser.com/docs/) or the [Gradle OsPackage Plugin](https://github.com/nebula-plugins/gradle-ospackage-plugin). For NFPM, there is a Docker container, making build creation very simple. An example can be found in the [avnav-update-plugin](https://github.com/wellenvogel/avnav-update-plugin/blob/master/buildPkg.sh).

The package must be built so that all data belonging to the plugin is unpacked under `/usr/lib/avnav/plugins/plugin-name`.

Plugins delivered as Debian packages require an AvNav restart after installation.


## Activating and Hiding System Plugins

To make plugins that were installed with Debian packages "invisible", there is a script /usr/lib/avnav/plugin.sh. As *root*, you can call this script to control the visibility of system plugins and to set default parameters.
A call without parameters generates a help text with the call options.

## Special Functions for the Raspberry Pi {: #scripts}

Plugins created as Debian packages for the Raspberry Pi (system plugins) can provide a shell script "plugin-startup.sh".
This script allows plugins to configure system parameters.
It is always called during the system boot process.
Whether and with which parameters such a script is called depends on a parameter in the file */boot/firmware/avnav.conf* (see [Image Preparation](../installation/raspberry.md#preparation)).

The parameter name is:
`AVNAV_<PLUGIN>`

Where <PLUGIN> is the plugin name, i.e., the name of its directory translated into uppercase and without any characters except 0-9 and a-z.
If this parameter is set to "yes", the plugin script is called.

There are 3 call variants:

### plugin-startup.sh enable

This call takes place at the first boot with the parameter in the avnav.conf set to "yes".
The plugin should now make all necessary changes to the system. If possible, in such a way that changes can be undone later.
Typically, this concerns adjustments in the */boot/firmware/config.txt* file or other configuration files.
The script should return "1" if a reboot is necessary, otherwise "0" or "< 0" for errors.

There are some [helper functions](https://github.com/wellenvogel/avnav/blob/master/raspberry/setup-helper.sh) that can be used in the script. You include these helper functions in the script with
``` sh
. "$AVNAV_SETUP_HELPER"
```
in the script.
The environment variable `AVNAV_SETUP_HELPER` is set when the script is called.
An example can be found in the [obp-plotterv3-plugin](https://github.com/wellenvogel/avnav-obp-plotterv3-plugin/blob/master/plugin-startup.sh).

### plugin-startup.sh disable

This call is executed when the parameter in the *avnav.conf* is changed from *yes* to another value or removed. The script should revert the changes made to the system, as far as possible.

Note: Since the handling is normally only intended to take place once during the first use of an image, it is not a big problem if changes are not undone.

### plugin.startup.sh [no parameters]

This call occurs at every boot process. In this case, no settings should be changed in the system - it could be very surprising for the user if system settings were suddenly changed during an arbitrary startup process. However, necessary initializations of hardware, for example, can be carried out.