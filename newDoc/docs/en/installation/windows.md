---
  tags:
    - Windows
    - Installation
---

# Windows

For Windows, there is an installer - in a new, non-backward compatible version starting from release "20240520".

For updates to older AvNav versions, please note the instructions for Windows at the very bottom!

The current version for download can be found [here]({{DLLINK("release/latest/avnav-service-latest.exe")}}).
This installer creates an app called "avnavservice", which starts automatically by default (user autostart).

This service generates a notification, represented by an icon, which shows a menu with the most important functions when clicked. This service does not yet contain the actual AvNav software or the necessary Python packages. However, these can be installed via the menu.
To uninstall *avnavservice*, the Windows Control Panel should be used.

![](../img/windows-notification-1.png)

![](../img/windows-notification-2.png)

The service menu has the following entries:

|  |  |
| --- | --- |
| Name | Function |
| Start | Starts the AvNav server. Only active if the AvNav software has been installed and the server is not yet running. The service remembers whether AvNav was started. The service will automatically restart the server at the next Windows startup unless "Stop" has been activated in the meantime. |
| Stop | Stops the AvNav server. |
| Open | Opens the default browser with the URL for the AvNav server. |
| Logs | Opens an Explorer window in the AvNav log directory (PROFILEDIR/AvNav/logs). The standard *avnav.log* is located there, in addition to the startup output in the *service-err.log* file. To get to the AvNav XML configuration, for example, you only need to navigate one directory up in Explorer. |
| Config | Allows you to set the HTTP port for AvNav (default value: 8080). |
| Update | This entry contains "Install" if the AvNav software has not yet been installed. An installation dialog will open (see [below](#windowsinstall)). |
| Remove | Removes the installed AvNav software, but all user data in the *PROFILEDIR/AvNav* folder is preserved. Before uninstalling *avnavservice* via *Control Panel/Programs* or *Settings/Apps* (from W10 onwards), "Remove" should be used - otherwise, you will have to remove the *PROFILEDIR/AppData/Local/avnav* directory manually later. |
| Exit | Stops AvNav and terminates *avnavservice*; the notification disappears as a result. To restart the service, use the Start menu. Normally, you can leave the service running. If the AvNav server is stopped, hardly any system resources are used. Only after a fresh installation of *avnavservice* do you need to stop and start it once. |

### Installation {: #windowsinstall}

After clicking on Install/Update, a small dialog is displayed.

![](../img/windows-install-1.png)

The URL entered there points to the current AvNav software. However, you can enter any URL here that points to a current AvNav software package (zip file) - e.g., from the [daily]({{DLLINK("daily")}}) or [release]({{DLLINK("release")}}) pages.

After clicking OK, a window showing the installation progress is displayed.

![](../img/windows-install-2.png)

After closing this window, you can restart the AvNav server via "Start" in the menu.

### Windows notes

The *avnavservice* requires PowerShell version 5.x or higher - it should be available on all modern Windows systems.

If the AvNav installation fails, it may be because the latest C/C++ libraries are not installed. These can be downloaded from [Microsoft](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170) <!--@@linkchanged-->. The direct link is usually [here](https://aka.ms/vs/17/release/vc_redist.x64.exe).

This new Windows service replaces the old AvNavNet installation with its own interface. Releases from 20240520 onwards are no longer compatible with the old version. It is recommended to completely remove an old installation before using the new installer.

Map conversion is now fully integrated into AvNav and can be used as described in the app documentation.
You can use serial devices connected to the Windows system in AvNav as usual, e.g., a GPS stick.

Since the AvNav server runs in the background, you can also use it, for example, as an NMEA multiplexer and logger.