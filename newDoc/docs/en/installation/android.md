---
  tags:
    - Installation
    - Android
---

# Android

This page describes how to install AvNav as an Android app. It also covers some specific features of this AvNav variant.

## Overview

As an alternative to installing the AvNav server on a [Linux-](linux.md)/[Raspberry](raspberry.md) or [Windows-](windows.md) system and using an Android device for the display, you can also install AvNav as an app on an Android device. This allows both the server part and the display part to run directly on this device.

For starters, this may be easier than the other variants.

You can download and install the app as an `.apk` file from the AvNav releases webpage - or install it directly from the [Google Play Store](https://play.google.com/store/apps/details?id=de.wellenvogel.avnav.main)<!--@@linkchanged-->.

## Essential Functions

Internally, the app essentially consists of the same functional blocks as the other AvNav versions.

![](../../img/software-android.png)

The NMEA multiplexer processes NMEA0183 data from various sources. In addition to the internal device GPS, data can come from sources such as TCP connections, UDP ports, USB devices, or Bluetooth connections. Most sources support sending and receiving data simultaneously. Multiple sources of the same type can be configured. In the app configuration, there is a so-called "handler" for each source.
Configuration is performed, as in other AvNav variants, via

{{MM("MMchannelspage")}}

or via

{{MM("MMserverpage")}}


[Under this link](../special/configfile.md#android) you can find the description of the configurable values.


The actual [display with the chart view and the widgets](../base/navpage.md) can be used normally within the app. In parallel, other devices can access it via a browser - see the [notes](#external) on what needs to be configured for this.

Since the server part of the Android app is a separate implementation, [plugins](../special/plugins.md) that have Python components cannot be used under Android. The [list of plugins](../special/plugin-list.md) indicates whether they can also be used on Android.

The display part of the app can be closed so that the multiplexer continues to run in the background. This allows AvNav to be used to provide NMEA data for other Android apps. In AvNav, you configure a *TcpWriter* for this, and in the accessing apps, you connect via the address 127.0.0.1 and the port configured in the *TcpWriter*.

## Charts and Storage Locations (Working Directory) {: #workingdirectory}

AvNav saves all its data and charts in a working directory.

In the Android settings

{{MM("MMserverpage")}} -> {{BT("StatusAndroid")}}

you can select the working directory.

![](../../img/android-settings-workdir.png)

Depending on the device, you can select different storage locations for the data. Technical information on this can be found in the [Android documentation](https://developer.android.com/training/data-storage/app-specific?hl=en)<!--@@linkchanged-->.

If the device has an SD card, the selection shown above appears:

| Name | Explanation |
| --- | --- |
| Internal Storage | This is a storage location in the device's internal flash memory. It is completely private and, unless the device is rooted, not accessible to other apps such as a file manager. This is the default setting. It is also available in versions prior to 20250822. The "*" before the entry indicates that this directory has already been used as a working directory and contains data. |
| External Storage | This storage is still in the internal flash memory, but is treated differently by the Android system and is therefore referred to as "external - emulated". Other apps can access this location. You can select this location if other apps (e.g., a file manager) need to access the data. The path for a file manager is typically [internal storage]/Android/data/de.wellenvogel.avnav.main/files (or [internal storage]/Android/data/de.wellenvogel.avnav.main.beta/files for a beta version). |
| External Storage-1 | This path is only visible if the device has an SD card installed. "removable [SD card]" is also displayed as an explanation. If available, this directory is actually located on an external SD card. If you want to use it, the SD card must always be installed when AvNav is running. If the SD card is removed while AvNav is running, it may cause a crash. Other apps like a file manager can access the data. The storage location is [SD card]/Android/data/de.wellenvogel.avnav.main/files (or [SD card]/Android/data/de.wellenvogel.avnav.main.beta/files). |

If you change the working directory, all data in the old working directory becomes invisible to AvNav. However, it remains available, and you can return to the old directory at any time.

When AvNav starts, it checks whether the selected working directory is still available. If not, you will be prompted to select another one.

For external directories, you can generally use a file manager to copy data to and from them. However, AvNav may not recognize this data if it is already running. Therefore, it is recommended to upload the data directly in the app. You can, for example, create a zip file with this data as a backup.

All *WorkDir* directories are cleared when you uninstall AvNav or clean up the data.

**Important note:** Settings, e.g., the multiplexer configuration and other Android settings, are not saved in the *WorkDir*.

If you choose an additional chart directory, it is located outside of AvNav. You can save charts in Gemf or XML format there. This directory can be created and accessed outside of AvNav. It is not touched when AvNav is uninstalled or when data is removed.

To use O-Charts or S57 charts, you must install the separate app [avocharts](../special/ochartsng.md#android) and install the charts there.

## First Start

After starting the app for the first time, you will be on an introductory page:

![](../../img/android-start-first.png)

After clicking, you reach the settings page:

![](../../img/android-settings-main.png)

Here, in addition to other settings, you can select the internal or external working directory and set the external chart directory, for example.
Furthermore, all settings can be reset here.
A list of all Android-specific settings can be found [here](#Settings).

The "Settings" page can be exited via the "OK" button (top right) or the "Back" button.
Whenever you exit the settings, AvNav checks whether the necessary permissions have been granted.
AvNav requires the following permissions:

* precise location (GPS) while using the app
* notifications to display that AvNav is running, even when in the background

Additionally, AvNav checks whether battery saver mode is active. If so, AvNav cannot use the device's internal GPS in the background. AvNav will then display a warning.

Afterward, the [navigation page](../base/navpage.md) of the app is called up.

After the first start, the app starts the navigation page directly.

## External Access {: #external}

The app allows you to connect from other devices using a browser. To do this, the web server must be activated in the app:

{{MM("MMserverpage")}} -> WebServer -> {{SB("Edit")}}

When activating the web server, `external` must be enabled. `mdnsEnabled` ensures that a Bonjour-capable app (e.g., [BonjourBrowser](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser)) can connect to the app's server.

This also allows, for example, access from a laptop or computer - which can simplify uploading and editing files or adjusting the layout.

## Background

The NMEA multiplexer and the AvNav web server can also run in the background without the display. This can be used if the display is intended for users on another device - or if another app is used for navigation and only the AvNav multiplexer is needed.

To do this, after starting on the main page, access the exit dialog via

{{MMA("MainExit")}}

and select "BACKGROUND".
In the background, track recording and the router remain active; a potential anchor watch also remains active and may trigger alarms.
Via the notification (in the Android message bar), the app can be brought back to the foreground or terminated directly.
A potentially triggered alarm can also be terminated via the notification.

## Settings {: #Settings}

In addition to the normal settings accessible via

{{MM("MMsettingspage")}}

{{MM("MMchannelspage")}}

or

{{MM("MMserverpage")}}

there are Android-specific settings accessible via

{{MM("MMserverpage")}} -> {{BT("StatusAndroid")}}

### Android Main Settings

| Name | Meaning | Default |
| --- | --- | --- |
| working directory | Selection of where the AvNav [working directory](#workingdirectory) should be created (internal storage or external storage) | internal storage |
| additional charts directory | An additional chart directory, which should ideally be created on an external SD card | --- |
| reset external chart dir | Reset the additional chart directory | |
| show demo charts | Display demo charts. This requires an active internet connection) | on |
| Alarm-Sounds | Here, alarm sounds generated by the server can be turned off. In the browser, these may additionally need to be turned off. | on |
| Hide System Bars | Hide the Android status and navigation bar | on |
| autoconnect USB devices | If enabled, automatic detection of USB devices starts as soon as a supported USB device is connected. If this switch is turned off, you can also configure USB devices via the + button on the server/status page. | on |
| allow unknown plugins | AvNav has an (experimental) plugin interface that allows other apps to inform AvNav via provided functions (currently only charts). This switch also allows plugins that are not yet known to AvNav. Note: avocharts does not require this. | on |
| reset to defaults | Reset multiplexer settings to default values | |

### Android Sound Settings

| Name | Meaning | Default |
| --- | --- | --- |
| Sound for XXX alarm | Here you can select the sound for the various alarms | |
| reset to defaults | Reset sound settings to defaults | |