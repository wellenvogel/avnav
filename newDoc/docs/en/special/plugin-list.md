---
  tags:
    - Plugins
---

# List of AvNav plugins

Plugins listed as **Package** can only be installed on Linux/Raspberry Pi, but not on Android. 
**Zip plugins** can be installed on any architecture - a note is provided in the table.

The 'Repo' column indicates that the package is available for installation in the [package sources](../installation/linux.md#repositories).

The 'Image' column indicates whether the plugin is installed by default in the [AvNav images](../installation/raspberry.md#images).

| Name | Type | Repo | Image| Description |
| --- | --- | --- | --- | --- |
| [ochartsng](ochartsng.md)| Package | yes | yes |Implementation for charts from [O-Charts](https://o-charts.org/) and free S57 charts. **Note:** For Android, the plugin is available as a separate app ["AvOcharts"](https://play.google.com/store/apps/details?id=de.wellenvogel.ochartsprovider) |
| [Seatalk Remote](https://github.com/wellenvogel/avnav-seatalk-remote-plugin)| Package | yes | no | In conjunction with the remote control from [AK-Homberger](https://github.com/AK-Homberger/Seatalk-Autopilot-Remote-Control)|
| [History](https://github.com/wellenvogel/avnav-history-plugin)| Package | yes | yes |Data history and display |
| [Update](https://github.com/wellenvogel/avnav-update-plugin) | Package | yes | yes  | Update AvNav and associated packages without having to use the command line. Config editor and log viewer for AvNav |
| [MapProxy](https://github.com/wellenvogel/avnav-mapproxy-plugin)| Package | yes | yes | integrates [MapProxy](https://mapproxy.org/) for access and download of various online map sources |
| [Obp-RC-Remote](https://github.com/wellenvogel/avnav-obp-rc-remote-plugin) | Package | yes | yes | Plugin for using the [remote control](https://www.segeln-forum.de/thread/78328-fernbedienung-f%C3%BCr-den-raspberry/?postID=2237852#post2237852) from [Christian Hartz](https://www.segeln-forum.de/cms/user/19350-chrhartz/)|
| [Sail-Instrument-Plugin](https://github.com/kdschmidt1/Sail_Instrument)| Package | yes | no | Decoding and calculation of additional course and wind data, Sail Instrument |
| [Obp-PlotterV3](https://github.com/wellenvogel/avnav-obp-plotterv3-plugin)| Package | yes | yes | Special functions for the Open Boat Projects 10 inch Plotter V3 |
| [Font Noto](https://github.com/wellenvogel/avnav-font-noto)| Zip | no | no | Noto fonts for use in AvNav |
| [Font Roboto](https://github.com/wellenvogel/avnav-font-roboto)| Zip | no | no | Roboto fonts for use in AvNav |
| [Logbuch](https://github.com/Surfer2010/avnav-logbuch-plugin/tree/main) | Zip | No | No | A logbook plugin for AvNav (Windows/Linux/Raspberry only) |
| [Legacy Display](https://github.com/Surfer2010/avnav-legacy-display)| Zip | no | no | Display on older browsers e.g. of e-book readers, on which AvNav otherwise does not run. _Windows/Linux/Raspberry only_ |
| [Legacy Display II](https://github.com/wellenvogel/avnav-simpledashplugin) | Zip | no | no | Another variant for a display on old browsers like e-book readers. Customization of the displays by the user by editing HTML pages - or with AI. _All platforms, including Android_ |
|[ocharts - legacy ]({{OLDLINK("hints/ocharts.html")}})| Package | no | no | Charts from [O-Charts](https://o-charts.org/) |
| [rudder-angle](https://gitlab.strukturpunkt.de/kfr/avnav-rudder-angel)| zip | no | no |Display of the rudder angle (via SignalK, _Linux/Raspberry only_) |
| [AvNav documentation]({{DLLINK("release")}}) {: #docplugin}| zip | no | no | This AvNav documentation as a plugin. Please install the current "documentation-xxxx.zip" in each case.|
| [AvNav documentation videos]({{DLLINK("supplement/docvideos.zip")}})| zip | no | no | The videos for the AvNav documentation. This makes the videos available offline when the documentation is opened via this plugin.|

## Documentation as a plugin {: #documentation}

This documentation can be installed in AvNav as a [plugin](#docplugin). A documentation-xxx.zip file is delivered with every [release](../installation/release.md). To install it, download this file from the corresponding [release directory]({{DLLINK("release")}}) and upload it to AvNav on the plugin page

{{MM("MMpluginspage")}}

via the {{BT("Upload")}} button. The documentation creates a button on the user app page

{{MM("MMaddonpage")}}

![Manual](../../img/manual.svg){.inline-image}. The documentation can be opened with this button.

The videos are not embedded directly in the plugin, but are called up as external links on YouTube.

If you want to have the videos available offline as well, you can additionally install the AvNav documentation videos plugin. It can be downloaded from a [fixed link]({{DLLINK("supplement/docvideos.zip")}}) as it changes very rarely.

After installing these videos, there is an additional button ![Video Documentation](../../img/video-help.svg){.inline-image} - if you call up the documentation via this button, the videos are embedded and can also be used offline.