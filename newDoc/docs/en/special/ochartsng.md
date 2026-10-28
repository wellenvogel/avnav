---
  tags:
    - Charts
    - Vector charts
    - S57
    - ocharts
    - Plugin

---

# AvNav O-Charts(NG)

*AvNav O-ChartsNG* is a new implementation replacing the legacy *AvNav O-Charts* plugin.  
The plugin includes a series of new features:

* It now also runs on [Android](#android)
* It provides a direct online connection to the O-Charts shop
* Unencrypted S57 charts can now be used (after a one-time [conversion](#chartconversions))
* The display can be customized with greater granularity
* No large disk caches are created. This reduces the write load on the SD card and lowers CPU usage.
* No restart is required when adding new charts.
* More processor cores can be used, so it should run faster on most systems.
* Significantly fewer external packages are required, in particular, no functional X11 environment is needed.
* It requires less memory.

Compared to the old O-Charts plugin, there are the following limitations:

* **oeRNC charts (raster charts from O-Charts) cannot be read**
* Charts from OpenCPN cannot be used directly. Since OpenCPN does not provide a defined structure for its configuration, the charts must be installed again in parallel within the plugin. However, except for Android, the same key is used.

## Overview

AvNav can process charts directly in various raster formats. For official vector-format nautical charts, there is the company [O-Charts](https://o-charts.org/), which provides charts for many regions of the world for OpenCPN.

After some discussions with the company, these charts can now also be used for AvNav via this plugin.

oeSENC vector charts can be used.  
Additionally, the plugin can use free S57 charts after a [conversion](#chartconversions).

The conversion into the raster charts required by AvNav takes place at runtime, whenever the charts need to be displayed. A certain portion of the chart tiles is kept in the server's memory so that they can be provided again very quickly. This speeds up the display when switching between different zoom levels or when multiple displays are connected.

The handling of the charts is performed entirely by the plugin - this also applies to installation.

Charts must be installed via

{{MM("MMchartspage")}} -> ![](../../img/icon-ochartsng.svg){: .inline-image }

and thus via the plugin interface described here. Uploading via `Charts` or `Import` does not work!

![](../../img/ochartsng-gui1.png)
///caption
OchartsNG Interface
///

## Introduction

In the introduction to the [navigation page](../base/navpage.md) and in the video there, important basic functions are already explained. This chapter supplements this information and provides a detailed explanation.

## Chart types

AvNav O-ChartsNG can display O-Chart vector charts (oeSENC) as described in this document.  
Furthermore, unencrypted vector charts (S57) can be used. These are freely available for download for various regions.  
To use such S57 charts, they must first be converted into the OpenCPN SENC format used.  
For instructions on conversion, see [Chart conversions](#chartconversions).

## Acquisition and installation of charts {: #Charts}

**Important Note**: If you do not have an O-Charts dongle, the charts are bound to the system. Therefore, if there are problems importing or using the charts, please **do not** re-image the system – try a repair instead. If you re-image the system, the licenses may become invalid. I am happy to help with problems - contact me via [email](mailto:andreas@wellenvogel.net), for example.

Only when using AvNav images is an image update possible. Please test beforehand if in doubt.

To buy charts in the O-Charts shop, you must first create an account [there](https://o-charts.org/shop/en/autenticacion?back=my-account) <!--@@linkchanged-->.  
Subsequently, you must register your systems, on which you want to use the charts, [on the O-Charts page](https://o-charts.org/shop/en/8-oesenc) <!--@@linkchanged-->.

For the entire process, there are two paths – the "[online process](https://o-charts.org/manuals/?lng=en)" <!--@@linkchanged--> and the ["offline process"](https://o-charts.org/manuals/offline.php?lng=en) <!--@@linkchanged-->.  
The online process requires the system on which the AvNav server runs to be connected to the Internet. This does not have to be the same system the browser runs on.  
For Android, registering a new system is only possible via the online process.

### The offline process {: #offlineprocess}

**Not for Android – please use the [online process](#onlineprocess) there**

This consists of the following steps:

1. Generating a "fingerprint" for the system on which the charts are to be used. This can be generated and downloaded in AvNav via the plugin's user interface.
2. Uploading this fingerprint to O-Charts and creating a system (essentially assigning a name).
3. Buying charts.
4. Assigning them to the created system.
5. After a short time, you will receive an email from O-Charts with a download link for the charts (zip file).
6. Uploading the charts to AvNav again via the plugin's user interface.

For updates, steps 4, 5, and 6 are repeated (for step 4, only requesting the update).

For additional chart sets, steps 3-6 are sufficient.

For steps 2, 3, 4, and 5, a system with an Internet connection is, of course, required. This can be a laptop or an Android tablet, for example.

**Important note for Android**: Registering a system (steps 1 and 2) can only be done via the [online process](#onlineprocess).

I have created a [video](https://www.youtube.com/watch?v=q24VRAtbbEE) to clarify the offline process. Here is a brief description again.

**Note**: If the charts are already registered for OpenCPN on the same system, you can start directly with step 6. This does not apply to Android – the same license cannot be used for OpenCPN and AvNav there.

#### Generating the fingerprint

Go to the plugin interface via

{{MM("MMchartspage")}} -> ![](../../img/icon-ochartsng.svg){: .inline-image }

and select the "Charts" tab.

![](../../img/ochartsng-gui-charts1.png)

Initiate the fingerprint generation with "Get Fingerprint". If you are using an O-Charts dongle, generate the fingerprint via "Get Fingerprint(Dongle)". This only becomes visible if a dongle is detected (dongle line is green).

![](../../img/ochartsng-gui-charts2.png)

Save the generated file on your device in the dialog.

#### Uploading the fingerprint to O-Charts

Go to the [O-Charts page](https://o-charts.org/shop/en/8-oesenc) <!--@@linkchanged--> and upload the fingerprint.

![](../../img/ocharts-buying.png)

Select the file saved in step 2 with "Choose File". Give it a sensible name (this will appear later in the emails with the download links).

#### Buying charts

Buy the desired [oeSENC charts](https://o-charts.org/shop/en/8-oesenc) <!--@@linkchanged--> from O-Charts.

#### Assigning to the created system

![](../../img/ocharts-assign.png)

At 1, you can assign them to a previously created system (not possible here anymore, because the charts are already assigned to the 2 maximum available systems). At 2, the email with the download link is then requested. This is also done for updates – visible in the image here: The last version retrieved is 21, version 23 is available.

#### Downloading the charts

![](../../img/ocharts-download.png)

After a short time, you will receive an email from O-Charts with the download link for the purchased chart. Download this file (zip).

#### Uploading the zip file to AvNav

![](../../img/ochartsng-upload1.png)

Upload the file downloaded in step 5 to AvNav in the O-Chart plugin interface via "Upload Zip".  
A progress bar is displayed during the upload.

![](../../img/ochartsng-upload2.png)

At the end of the upload, the file is unpacked on the AvNav server, and several checks are performed. This can take a few seconds.

The charts are, unless configured otherwise, uploaded to the directory */home/pi/avnav/data/ocharts/charts*.

If the newly uploaded charts contain an update for an already existing chart set, the existing set will be deactivated. You can change this later with *Enable/Disable/Auto*. Chart sets that are no longer needed can be deleted.

Important note: The charts are only available for download in your account on the O-Charts page during their validity period (1 year). Therefore, the zip file should be kept in a safe place. You can also upload it to AvNav and use it after the validity period has expired. You will then, of course, no longer receive updates.

When all charts have been successfully read in, the status will change to green (READY).

![](../../img/ochartsng-upload4.png)

If the status changes to "ERROR" (red), a zip file may have been uploaded that was assigned to another system. Details can be found in the log file (/home/pi/avnav/data/ocharts/provider.log).

After successful import, the charts are available and appear on the navigation page in the chart selection list.

{{MM("MMnavpage")}}->{{BT("NavSelectChart")}}

### The online process {: #onlineprocess}

**For Android, the AvOcharts app must be installed beforehand - see the [notes for Android](#android)**

For the online process to be used, the system on which AvNav is running (the server, not just a client in the browser!) must be connected to the Internet.

The process allows you to register a system, check if the current system is known in the shop, and view the charts that have been assigned to this system. You can then download and install them directly.  
Actually purchasing the charts and assigning them to the system must be done via the O-Charts shop website. A link button is provided in the O-ChartsNG web interface that connects directly to the shop.  
AvNav O-ChartsNG does not store login data for the shop. However, since the application runs in the browser, login data can be stored there, just as for any other website.

**Security warning**: Communication between AvNav O-ChartsNG and the O-Charts shop is encrypted. However, communication between the browser and the AvNav server is not. Therefore, the online process should only be used if you are in a secure Wi-Fi, e.g., behind an LTE router or a mobile hotspot – but never directly in a public Wi-Fi if the browser and server are not running on the same computer.

![](../../img/ochartsng-shop1.png)

When you open the "Shop" tab, you are initially not logged into the shop. You can see whether a dongle is currently active or not. The "ShopPage" button takes you directly to the O-Charts website, but it makes more sense to log in first.

Click "Login" and enter your username and password to log into the O-Charts shop.

![](../../img/ochartsng-shoploggedin.png)

If the system has already been registered in the shop, the "Shop name", i.e., the name used there for the system, is displayed. The list of charts/updates assigned to the system is also displayed (see [offline process](#offlineprocess)).  
If the version of a chart in the shop is newer than the local one or if a chart is not yet available locally, you can install it directly.

![](../../img/ochartsng-shopupdate.png)

![](../../img/ochartsng-shopdownload.png)

After downloading, the chart is unpacked and can be used immediately. If it is an update for an existing chart, the new version becomes active and the old one is "disabled". This corresponds to the behavior when uploading a chart. You can delete the old version later on the "Charts" tab if you no longer need it.

**Important Note**:  
The charts in the shop remain available only during their validity period (1 year). Please keep the charts in a safe place locally. You can do this either by requesting it on the shop website (as in the offline process) or you can download the ZIP file directly from the "Charts" tab.

If the system is not yet known in the shop, you can register it here:

![](../../img/ochartsng-shopunknown.png)

On a Linux system, you are asked for a name for the system; on Android, the name is preset and cannot be changed.

Once you have registered the system, you can go directly to the shop website via "ShopPage" to purchase or assign charts. When you return from there, you must update the list of assigned charts via "Refresh".

## Adjusting the appearance {: #MainSettings}

Since O-Charts are available as vector charts, their appearance can be customized in many areas. However, some limitations must be noted:

1. Customization occurs on the server side and is therefore equally effective for all connected displays.
2. If the appearance is changed, the chart tiles saved in the internal cache are deleted, so there may be slight delays on slower systems afterward.

Parameters are changed via the plugin interface

{{MM("MMchartspage")}} -> ![](../../img/icon-ochartsng.svg){: .inline-image }

"Main Settings" tab.

![](../../img/ochartsng-settings1.png)
When a setting is changed (1), the parameter is displayed in bold. The changes only take effect when "Update Settings" (2) is clicked.

With *Cancel*, changes can be undone; the *Defaults* button resets settings to default values. The parameters largely correspond to the [settings available in OpenCPN](https://opencpn.org/wiki/dokuwiki/doku.php?id=opencpn:opencpn_user_manual:options_setting).

The following table lists the settings.

| Name | Meaning | Default |
| --- | --- | --- |
| Show Text | Show text for objects on the chart | on |
| Important Text Only | Hide less important text | off |
| Light Descriptions | Descriptions for lights | on |
| Show Depths | Show depth values | on |
| Show Quality | Show extra objects for chart quality | off |
| Chart Information Objects | Special objects on the chart | on |
| Buoy/Light Labels | Labels for lights/buoys | on |
| National text on chart | National text | on |
| Show Lights | Show lights | on |
| Show Anchor Info | Show information about the anchorage | on |
| Color Scheme | Color scheme for display | DAY\_BRIGHT |
| Chart Bounds | Show chart boundaries | on |
| Reduced Detail at Small Scale | Reduce details at smaller zoom levels | on |
| De-Cluttered Text | Better arrangement of text | on |
| Display Category | Type of display (Base, Standard, All, User Standard) | Standard |
| Graphics Style | Graphical display (Paper Chart, Simplified) | Paper Chart |
| Boundaries | Type of boundaries (Plain, Symbolized) | Plain |
| Colors | 4Color, 2 Color | 4 Color |
| Text Font Size | Scaling for text size | 1 (approx. 12px) |
| Soundings Font Size | Scaling for depth values | 1 (approx. 12px) |
| Scale | Base scaling. Higher values provide more details at smaller zoom levels | 1 |
| UnderZoom | Number of zoom levels a higher-resolution chart is downscaled when no chart is available at the desired level | 4 |
| AreaUnder | If no chart for the area is found in the "UnderZoom" range, use further (higher) zoom levels. For these charts, only environmental outlines (land, depth) are displayed – no further information. Be careful with this setting; it can affect display performance more significantly. | 2 |
| OverZoom | Number of zoom levels a lower-resolution chart is upscaled when there is no higher-resolution chart. **Note**: UnderZoom, AreaUnder, and OverZoom significantly determine how intensive the rendering process is, i.e., how many charts must be involved in creating a tile. Smaller values lead to fewer charts (faster) but can lead to white areas between chart parts in certain regions. The defaults should be a good compromise. | 4 |
| Scale Tolerance | When symbols are needed in different sizes or the chart is scaled, new symbols must be calculated internally. With a tolerance, you can slightly reduce the number of these recalculations. | 0.1 |
| Rotation Tolerance | Many objects (especially lines) are needed at different rotation angles on the chart. To reduce the number of objects to be created, some tolerance for the angle makes sense. | 2 |
| SymbolScale | Scaling of symbol sizes. Since some symbols are based on raster images, scaling > 2 is usually not useful. | 1 |
| Depth | Unit for depth values (Meters, Feet, Fathoms) | Meters |
| Shallow Depth | Depth for shallow water | 2 |
| Safety Depth | Depth for safety contour | 3 |
| Deep Depth | Depth for deep water | 5 |

Under the "Detail Settings" tab, individual chart features can be specifically switched on or off. These settings only take effect in the "User Standard" display mode.

## Feature info (object query) {: #featureinfo}

When you click on the chart, you get the [Feature Info](featureinfo.md) from AvNav. If you are using an O-Charts chart and click on the chart symbol in the list, you get the currently most important information near the click point (buoy, light).

![](../../img/ochartsng-featureinfo1.png)

Via "Info", the raw information of the charts can be displayed.

![](../../img/ochartsng-featureinfo2.png)

Clicking on the (blue) chart name provides some further information about the chart.

![](../../img/ochartsng-featureinfo3.png)

With the "Charts" button, you can display a list of the charts used at this location.  
With the "RenderedOnly" switch, only objects from the charts in the list that are currently displayed in the image are shown. Otherwise, all objects near the click are displayed.

## Installation {: #Installation}

### Linux/Raspberry

The plugin is available as a Debian package.  
It is present in the standard repositories.

For the [AvNav images](../installation/raspberry.md), the package

* avnav-ochartsng

is already installed.

If you want to do it directly from the command line, you can do so with the following commands:

```
sudo apt-get update  
sudo apt-get install avnav-ochartsng  
sudo systemctl restart avnav
```
For general notes on installing AvNav packages, see the [installation description](../installation/linux.md).

Alternatively, you can also download and install the packages from the [Daily Builds directory]({{DLLINK("daily-ochartsng")}}) or [Release directory]({{DLLINK("release-ochartsng")}}).

You can do this, for example, with the following commands (replace the version with the desired one):

```
cd /home/pi/avnav  
wget -O avnav-ochartsng_20260703-raspbian-trixie_arm64.deb https://www.wellenvogel.net/software/avnav/downloads/daily-ochartsng/20260703/avnav-ochartsng_20260703-raspbian-trixie_arm64.deb  
sudo apt install  ./avnav-ochartsng_20260703-raspbian-trixie_arm64.deb
sudo systemctl restart avnav
```

You can, of course, also download the packages to a PC first, transfer them to the Raspberry Pi, e.g., with WinSCP, and install them there.

#### AvNav-ocharts and AvNav-ochartsng together

If you install the O-ChartsNG plugin, it initially uses a different port (8083) than the old plugin (ocharts), so there are no conflicts.
If you are performing an update on an older system where the ocharts plugin is still installed, you should disable it under

{{MM("MMpluginspage")}}

In the new plugin, you can activate the "useLegacy" switch (in the [plugin configuration](#PluginConfig)). If this switch is activated, the new plugin also uses all charts that were previously installed with the old one. Alternatively, you can upload the charts again to the new plugin or directly from the shop, if they are still valid.

If you want to use both plugins in parallel, the system should have sufficient RAM (2GB).

### Android

For Android, there is a separate app (avocharts) that contains O-ChartsNG. This must be installed separately.

See [AndroidApp](#android) below.

## Releases {: #Releases}

All releases and all beta versions (developer versions or daily builds) can be found at:

* [Releases]({{DLLINK("release-ochartsng")}})
* [Daily Builds]({{DLLINK("daily-ochartsng")}})

### Release versions

20260703 [link]({{DLLINK("release-ochartsng/20260703")}})

Preparation for new AvNav versions

Notes on older versions can be found in the [old documentation]({{OLDLINK("hints/ochartsng.html#Releases")}}).

## License notices {: #License}

The use of charts for AvNav with the oeSENC-pi plugin has been discussed and coordinated with O-Charts and is therefore legal within the meaning of the licenses.  
The [license terms](https://o-charts.org/manuals/docs/EN_rrc_eula_ChartSetsForOpenCPN.md) <!--@@linkchanged--> of [O-Charts](https://o-charts.org/shop/en/content/3-our-conditions) <!--@@linkchanged--> must be strictly observed. In particular, it is not permitted to copy the charts or use them on systems other than the licensed ones.

Access to the charts within AvNav is only possible from the local network; a maximum of 5 devices (clients) can use the O-Charts from one AvNav server simultaneously.

For software licenses, see the [Readme.](https://github.com/wellenvogel/ochartsng/blob/master/Readme.md)

## Plugin configuration {: #PluginConfig}

**Only under Linux.**
For Android, see [Android/Settings](#androidsettings).  
Some settings for the plugin can be adjusted under

{{MM("MMpluginspage")}}

![](../../img/ochartsng-plugin1.png)

Via "Config", you can adjust the plugin settings.

![](../../img/ochartsng-plugin2.png)

| Name | Meaning | Default |
| --- | --- | --- |
| port | Http Port | 8083 |
| debug | Level for logging, 0-ERROR,1-INFO,2-DEBUG | 1 |
| memPercent | The percentage of system memory the provider should use at maximum. If you do not set this or set it too low, the provider internally calculates a minimum value and uses it. This can potentially be very small, especially when using raster charts, forcing the computer to constantly open and close chart files – which can significantly reduce speed. If you have sufficient memory (e.g., > 2GB), performance is improved by setting the memory to 1GB. | 50 |
| tileCachekb | Memory in KB for storing already generated chart tiles (if set to 0, no internal storage occurs) | 40960 |
| useLegacy | Also use charts that were installed with the old avnav-ocharts plugin. | off |

## Android App {: #android}

AvNav OchartsNG is also available for Android and provides the charts for the [AvNav Android app](../installation/android.md).  
You must install the separate Android app ["avocharts"](https://play.google.com/store/apps/details?id=de.wellenvogel.ochartsprovider).

![](../../img/ochartsng-android-main.png)

When you start the app, you can initially adjust some settings.  
If you see this image (status red), the actual chart server is not yet running. It is only started by clicking "Start".

Later, it will normally not be necessary to start the avocharts app separately. This will happen automatically as soon as AvNav starts. But by starting it directly, you might be able to detect errors by looking at the output ("OUT") or the log file ("LOG").  
**Please note**: The automatic start only works with apps of the same type – i.e., an AvNav release app can only start an avocharts release app, an AvNav beta app an avocharts beta app.  
If you therefore install the avocharts beta app and want to use it with AvNav (release – from the store), you must start avocharts manually and also click "START" again.
{: #androidstartup}

### Settings {: #androidsettings}

To adjust settings, you can click on the displayed settings or on the settings icon (top right).

![](../../img/ochartsng-android-settings.png)

| Name | Meaning | Default |
| --- | --- | --- |
| Port | The HTTP port that the chart server will use. If you receive error messages at startup and see something like "address already in use" under "OUT", you must change this port. | 8083 |
| LogLevel | 0 - errors, 1- info, 2- debug | 1 |
| Workdir | The [working directory](#workingdirectory) for charts, logs, and settings | internal |
| Shutdown | Time (in s) the chart server waits for a signal from AvNav (heartbeat) before it stops automatically (this is only active if avocharts was started automatically by AvNav) | 30 |
| Memory | Permitted memory usage (in %) of system memory (RAM) | 50 |
| Testmode | for internal tests | off |
| Use alt key | See below [Notes](#androidbetarelease) on release/beta versions |  |
| Disk symbol (upper right) | Save key (See below [Notes](#androidbetarelease) on release/beta versions) |  |

When you have finished adjusting the settings, use the back arrow to return to the main page.

### Working directory {: #workingdirectory}

AvOcharts saves charts, logs, and the settings of *Main Settings* and *Detailed Settings* under a directory on the device (working directory). This directory is independent of the [AvNav working directory](../installation/android.md#android-main-einstellungen).

You have the following selection:

![](../../img/ochartsng-android-workdir.png)

Depending on the device, you can select different storage locations for your data (technical information can be found in the [Android documentation](https://developer.android.com/training/data-storage/app-specific?hl=de)). If your device has an SD card, there is the selection shown above:

| Name | Meaning |
| --- | --- |
| Internal Storage | This is a storage location in the internal flash memory of your device. It is completely private and (unless your device is rooted) inaccessible to other apps such as a file manager. This is the default setting. The string "\*" before the entry shows that the directory is already used as a working directory and contains data. |
| External Storage | This storage is still in the internal flash memory but is treated differently by the Android system and is therefore called "external - emulated". Other apps can access this location. The path for a file manager is typically [internal storage]/Android/data/de.wellenvogel.ochartsprovider.main/files (or [internal storage]/Android/data/de.wellenvogel.ochartsprovider.main.beta/files for a beta version). |
| External Storage-1 | This path is only visible if your device has an SD card installed. As an explanation, "removable [SD card]" is also displayed. If available, this directory is actually located on an external SD card. If you want to use it, the SD card must always be installed when avocharts (or AvNav) is running. If the SD card is removed while avocharts is running, it may crash. Other apps like a file manager can access the data. The location is [SD card]/Android/data/de.wellenvogel.ochartsprovider/files (or [SD card]/Android/data/de.wellenvogel.ochartsprovider.beta/files). |

If you change the working directory, all data in the old working directory becomes invisible to avocharts. They remain available, however, and you can return to the old directory at any time.

When avocharts starts, it is checked whether the selected working directory is still available. You will be prompted to select another directory if not.  
If avocharts is started by autostart from AvNav, it tries a fallback to the internal working directory if the selected one is not available, e.g., because the SD card was removed.

For external directories, you can generally use a file manager to copy data there and from there. Avocharts, however, potentially does not recognize this data if it is currently running. Therefore, it is recommended to upload the data directly in the app. But you can, for example, create a zip file with this data as a backup. And you can very easily view the log files from avocharts.

All (potential) working directories are deleted if you uninstall avocharts or clear its data.

Note: Settings (from the table above) are not stored in the working directory.

### First start

You can let the chart server run with "START".

![](../../img/ochartsng-android-running.png)

When the server is running, this is displayed in the notification bar. If the startup is not successful (status becomes red again), you can look into the output ("OUT") and into the log ("LOG").

A click on "APP" opens a browser window with the O-ChartsNG page – the same view that you also get from within AvNav. This is, however, only intended to check if everything is running correctly. The actual use should take place from within AvNav.

### Beta and Release versions {: #androidbetarelease}

Due to the way the O-Charts license server works, you cannot use charts purchased, for example, in the beta version in the release version and vice-versa.  
To avoid this, you can export the required license information (key) from the app and import it again in the other version.

Note: You can still only use the license on the respective device!  
To export the key, click on the diskette icon in the top right on the settings page and save it. Also, think about a backup; without this key, you cannot use the charts later in the other app version.

If you later use the other version of the app, then activate "use alternate key" there, click on the *alternate key*, and find an "Import" button there.  
You can easily check if you have the correct license by logging into the shop and checking if the system is correctly recognized – see [online process](#onlineprocess).

Please also note the notes on [automatic startup](#androidstartup).

## Technical details

The charts are provided by a server (separate program).  
Communication with AvNav is realized under Linux by an AvNav [plugin](plugins.md), and on Android by the avocharts app.

The web interface is a Reactjs app and is also provided by the server. In AvNav, it is integrated as a User App.

The complete code can be found on [GitHub](https://github.com/wellenvogel/ochartsng).

Installation occurs (under Linux) in /usr/lib/avnav/plugins/ochartsng. The data directory is /home/pi/avnav/data/ochartsng. You can set some additional parameters for the plugin directly in the [avnav_server.xml](configfile.md). This should normally not be necessary.

You can, for example, set the data directory.

```
<AVNPluginHandler>  
...  
<system-ochartsng dataDir="$DATADIR/ochartsng"/>  
</AVNPluginHandler>
```

### Chart conversions {: #chartconversions}

Unencrypted vector charts like S57 must be converted to the used internal "SENC" format before use.  
There are 2 options for this:

#### Conversion with AvNav

The AvNav O-ChartsNG plugin adds a converter to the [AvNav importer](charts.md#converter). This converter contains a Python script to convert S57 to a zip archive, which can then be uploaded.  
To use the S57 charts, you can simply upload a zip with the S57 charts to the [AvNav importer](charts.md#converter) after O-ChartsNG has been installed.  
If you are using AvNav and O-ChartsNG under Linux, the charts are automatically available in O-ChartsNG once the conversion is complete.

If you want to use O-ChartsNG on another system (e.g., Android), you additionally need an installation of AvNav under Linux or under [Windows](../installation/windows.md).

O-ChartsNG itself does not run under Windows, but the converter is also available for Windows. After you have installed AvNav for Windows, you must activate the "Update" dialog there and specify the URL for the O-ChartsNG S57 converter for Windows:

- Release: <https://www.wellenvogel.de/software/avnav/downloads/release-ochartsng/latest/ochartsng-latest.zip>
- Daily: <https://www.wellenvogel.de/software/avnav/downloads/daily-ochartsng/latest/ochartsng-latest.zip>

After that, you upload the S57 charts to the converter, and after the conversion is complete, you download the zip file with the converted charts. This zip file can then be installed directly in O-ChartsNG (Linux and Android).

#### Conversion with OpenCPN

If you already have a computer with OpenCPN, you can convert the charts there.  
To do this, activate the charts in OpenCPN. In the OpenCPN settings/tab "chart files", click on "Prepare all ENC Charts".

![](../../img/ochartsng-convert-opencpn.png)

This generates a series of files with the extension **.s57* in the OpenCPN directory (under Linux: ~/.opencpn/SENC). From this directory, you copy all files with the same names as the S57 files into a new, empty directory. This should have a "descriptive" name – it will be displayed later. Then, create a text file "Chartinfo.txt" in this directory with exactly one line of text:

ChartInfo: -name of the chart-

Then, create a zip archive containing the chart directory as a subdirectory. You can then upload this archive to AvNav O-ChartsNG.  
For Linux, there is a [script](https://github.com/wellenvogel/ochartsng/blob/master/tools/collectS57.sh) to automate the collection of charts.