---
  tags:
    - Server
    - Configuration
    - Network
    - Wifi
---
# Server Page

Via 

{{MM("MMserverpage")}} 

you can reach a page that summarizes the settings of the AvNav server.

![Server Page](../../img/serverpage.png)
///caption
Server Page
///

## Settings
On the left side, the various components of the server can be configured. For a description, see the chapter [Configuration](configfile.md).

Normally, only the server components that are not configured on any of the other pages (e.g., connections, routes, etc.) are displayed here. Using the button
{{BT("StatusAll")}}, the view can be expanded to show all functional units.

## Buttons

Via the buttons on the right side, a number of functions or sub-pages can be reached. The displayed functions depend on the system, whether Android, Windows, or Linux/Raspberry.

| Button | System | Function |
| --- | --- | --- |
| {{BT("MainInfo")}} | all | Display a page with version and license information |
| {{BT("StatusAll")}} | all | Show all server functions |
| {{BT("StatusAddresses")}}| all | Show a page with the IP addresses of the server |
| {{BT("StatusAndroid")}}| Android | Open the [Android Settings](../installation/android.md#Settings) |
| {{BT("AndroidBrowser")}} | Android | Open the AvNav interface in the system browser (only if the [WebServer](configfile.md#webserver) has been activated) |
| {{BT("StatusShutdown")}} | Linux/Raspberry | Stops the AvNav server computer. Only if a `shutdown` command is set up in the [CommandHandler](configfile.md#avncommandhandler) - such as on the [AvNav Images](../installation/raspberry.md#images). |
| {{BT("StatusRestart")}} | Linux/Raspberry/Windows | Restart the AvNav server, not the computer - only the AvNav server software. |
| {{BT("StatusLog")}} | Linux/Raspberry/Windows | Shows the log file of the AvNav server and offers the possibility to download it. |
| {{BT("StatusDebug")}}| Linux/Raspberry/Windows | Display a dialog to turn on the AvNav debug mode for a certain time. This makes the log output much more detailed and potential errors can be found. |
| {{BT("StatusAdd")}} | all | Set up a new connection. Only in the expanded view. |
| ![](../../img/wifi.svg){.inline-image}| [AvNav Images](../installation/raspberry.md#images) (trixie) | Show a [configuration page](#wifi) for Wifi client connections |

## Wifi Client Configuration {: #wifi }

This function is only available on the [AvNav Images](../installation/raspberry.md#images) or if the `avnav-raspi-network` package has been installed.

To connect AvNav to another Wifi network, the AvNav server must have an additional network adapter (USB Wifi stick) (in addition to the adapter used for the AvNav Access Point). See also the [notes on connecting](connecting-pi.md).

In the [Image Configuration](../installation/raspberry.md#preparation), you can decide which of the available network adapters is used for the Access Point. All others are available here.

The configuration of the networks is done via the [Network Manager](https://networkmanager.dev/).

By clicking on ![](../../img/wifi.svg){.inline-image}, you get a dialog for configuration.

![Wifi](../../img/wifi1.png)
///caption
Wifi Configuration
///

In the upper area, all available network interfaces that are not used for the internal Access Point are displayed. If a connection to a Wifi network already exists, it is displayed with its IP address under the interface.

By clicking on it, you can call up a dialog to disconnect.

By clicking on one of the displayed networks, you get a connection dialog.

![Wifi Dialog](../../img/wifi2.png)
///caption
Wifi Connection Dialog
///

You can set (or change) the parameters for the connection here.

| Name | Description |
| --- | --- |
| password | The Wifi password for the network |
| externalAccess | If set, the AvNav server can also be accessed via this network. **Attention: This is a security risk. The AvNav server is not protected against unauthorized access. Therefore, only activate it in trusted networks - not in a public Wifi network** |
| autoConnect | If switched on, the system will attempt to reconnect to this network automatically |
| priority | If several networks are configured with *autoconnect*, they are used according to the priority specified here. "0" is the lowest priority. |

With {{DB("DBOk")}}, the dialog is closed and the connection is established. The progress is displayed.

Using the (i) button in the top right, you can view the entire network configuration of the server.