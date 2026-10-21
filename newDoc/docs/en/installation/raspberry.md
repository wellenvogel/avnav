---
  tags:
    - Raspberry
    - Installation
    - Images
---
# Raspberry PI

AvNav is available in various versions for the Raspberry Pi:

* [Ready-made images](#images)
* [Packages](#packages)
* [OpenPlotter](#openplotter)

## Images

Since version 20220421, the images support both so-called "headless" operation - i.e., neither a keyboard nor a monitor is connected to the Pi - as well as operation with a connected (touch) screen, naturally with an optional keyboard and mouse.

The operation of AvNav is optimized for touch devices, but it can also be operated with a screen, keyboard, and mouse.

How you use the images depends on your use case. In "headless" mode, the Raspberry is used only as a server; the display is then provided on mobile devices, for example. For this case, a Raspberry Pi 3B(+) is sufficient. If a monitor and peripherals such as a keyboard and mouse are connected directly to the Raspberry, you should choose a Pi4 or Pi5 with at least 2GB of RAM.

These images are maintained by [BlackSea](https://www.segeln-forum.de/cms/user/27970-blacksea/) (many thanks...). These are built with *pi-gen* and contain AvNav, SignalK, and other software. A description can be found in the [repository](https://github.com/free-x/AvNav-Image).

On Windows/Linux/OSx, you download the image [from free-x](https://github.com/free-x/AvNav-Image) and transfer it to an SD card using, for example, the [Raspi-Imager](https://www.raspberrypi.com/software/).
In the Imager, select "Use Custom" under "CHOOSE OS" and select the *.img file. Do not select any "customizations".

These images contain:

* avnav
* avnav-raspi-base
* avnav-raspi-network
* [avnav-update-plugin](https://github.com/wellenvogel/avnav-update-plugin)
* [avnav-ochartsng-plugin](../special/ochartsng.md)
* [avnav-mapproxy-plugin](https://github.com/wellenvogel/avnav-mapproxy-plugin)
* [avnav-history-plugin](https://github.com/wellenvogel/avnav-history-plugin)
* [SignalK](../special/signalk.md)
* [Canboat](../special/nmea2000.md)
* Support for the [MCS Board](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/)
* Optionally an X-Server with Openbox and Firefox in kiosk mode
* Support for various [HATs](#configHATS)

The images are pre-configured so that NMEA0183 data from all interfaces is routed to AvNav and from there to [SignalK](../special/signalk.md). AvNav also retrieves all data from SignalK and can display it. For details on SignalK integration, see this [description](../special/signalk.md).
NMEA2000 data runs via Canboat to SignalK and to AvNav.
For details on Canboat, see [NMEA2000](../special/nmea2000.md).

### Image Preparation {: #preparation}

New as of version "20210322", extended as of version "20220421"

Before using the prepared SD card or SSD in the Raspberry, you should adjust a few settings. This applies primarily to passwords:
The images have a configuration file "avnav.conf". It can be found in the first partition of the SD card (boot partition). This file can be adjusted with a text editor.
You can also set whether a local screen should be used ("Touch version") there.

It is easier to use a small [web interface]({{HPLINK("configGen/index.html")}}).

[![](../img/ConfigImagesUi.png)]({{HPLINK("configGen/index.html")}})

The meaning of the fields:
{: #configUi}

| Name | Default | Description |
| --- | --- | --- |
| Image Release | trixie | Selection of the AvNav image version to be adjusted: Trixie or Bookworm |
| ConfigSequence {: #configSequence} | 1 | If you want to ensure that the settings from avnav.conf are reactivated in the system, you can increase this value. Otherwise, AvNav remembers which settings have already been applied and does not re-apply them. |
| Wifi SSID {: #configWifi} | avnav | The name of the WLAN network the Raspberry should create. For Bookworm, a single-digit number is appended to the name. |
| Wifi Password | avnav-secret | The password for the WLAN network. This should definitely be changed. Anyone who can connect to the WLAN can otherwise also influence navigation! |
| Wifi Country | Germany | Sets the country for the Wifi settings. Selection from the list. |
| Wifi Interface | wlan-internal | Applies from Trixie: Here you can select which interface should be used for the Wifi hotspot. By default, the internal interface *wlan-internal* is used. If another interface, e.g., an inserted adapter, is to be used, the name of the interface must be entered here. To do this, after inserting, first open the Wifi page in the *Server* section and view the IP configuration via the *Info* button. All interfaces are displayed there. If an interface other than *wlan-internal* is entered, *wlan-internal* can later be used for client connections. |
| Wifi band | bg | Applies from Trixie: Wifi band for the hotspot. bg = 2.4 GHz, a = 5GHz. |
| Wifi channel | 7 | Applies from Trixie: Wifi channel for the hotspot |
| Wifi address | 192.168.30.10/24 | Applies from Trixie: The base address (and the range as a bitmask) for the network created by the hotspot. |
| User pi password | raspberry | This is the password for the user "pi". This standard user is used when connecting via SSH or when accessing the Raspberry directly via monitor and keyboard. The password for the user "pi" should also be changed. |
| Base Board {: #configBoards} | None | Here you can choose from supported base boards. * **MCS:** If this option is activated, the necessary software for the [Marine Control Server from GeDad](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/) is activated on the next boot. Changing this setting will result in an automatic reboot when the Raspberry starts for the first time with this setting. * **OBPPLOTTERV3:** This sets the configuration for the [Open Boat Projects Plotter (V3)](https://open-boat-projects.org/de/10-plotter-raspi-4b). |
| HAT {: #configHATS } | None | Here you can select a supported Pi HAT. AvNav will make the corresponding entries for the overlays in /boot/config.txt and create the CAN network interfaces. * WAVESHAREB: [Waveshare RS485 CAN HAT (B)](https://www.waveshare.com/wiki/RS485_CAN_HAT_%28B%29) * WAVESHAREA8: [Waveshare RS485 CAN HAT (8Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHAREA12: [Waveshare RS485 CAN HAT (12 Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHARE2CH: [Waveshare 2CH CAN HAT](https://www.waveshare.com/wiki/2-CH_CAN_HAT) * PICANM: [PICAN-M](https://cdn.shopify.com/s/files/1/0563/2029/5107/files/pican-m_UGB_20.pdf?v=1619008196) * MCARTHUR: [MacArthur HAT](https://github.com/OpenMarine/MacArthur-HAT) |
| Module RTL8188EU | off | **not for Trixie and newer** When switched on, the [kernel driver](https://github.com/lwfinger/rtl8188eu/tree/v5.2.2.4) for WLAN adapters with the RTL8188EU chipset is set up via [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html). When the system kernel is updated (command line), the driver is recompiled. Not currently available for Bookworm images (or newer) because these drivers do not exist for them. |
| Module RTL8192EU | off | **not for Trixie and newer** When switched on, the [kernel driver](https://github.com/Mange/rtl8192eu-linux-driver) for WLAN adapters with the RTL8192EU chipset is set up via [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html). When the system kernel is updated (command line), the driver is recompiled. Not currently available for Bookworm images (or newer) because these drivers do not exist for them. |
| TimeZone | Europe/Berlin | The time zone to be used in the image. |
| InternalWifi as Client | off | **not for Trixie and newer** When switched on, the internal Wifi adapter of the Pi is not defined as an access point, but can connect to other networks. Note: This requires an alternative way to access the headless Pi - see [[Connecting to the Raspberry](../special/connecting-pi.md)]. |
| KeyboardLayout | German | Layout for a connected keyboard (command line and X) |
| KeyboardType | Generic 105-key PC(intl.) | Type of connected keyboard |
| TouchSupport (from 20220421) {: #configTouch}| off | When switched on, an X server starts with a Firefox browser in kiosk mode. Via a button in AvNav, you can switch to another "screen" where a file manager, terminal, etc., are available. |
| Display DPI (from 20220421) {: #configDpi} | 96 | Only for the local screen: The resolution in dots/inch for the connected display. Clicking opens a small calculator where the dimensions of the screen in mm and pixels can be entered to calculate the DPI value. Some display elements are scaled based on this value. |
| OnScreen KeyboardHeight (from 20220421) {: #configKeyHeight}| 7 | The height of a key row on the displayed On-Screen Keyboard. With the correct DPI setting, this value should be a good compromise. If you choose a very large value, there might not be enough screen space left when the keyboard is displayed... |
| HideCursor (from 20220421) | on | Hiding the cursor on the local screen. If you want to work with a mouse, this switch must be set to "off". |

After entering the values, you can download the "avnav.conf" file by clicking the "download" button. This must be saved to the first partition of the SD card. Any sample file that may already exist there must be overwritten! Naturally, this partition must be visible on the computer for this. Under Windows, you will generally only be able to see the first partition. You might need to remove and re-insert the SD card after writing the image.

It is therefore recommended to save the "avnav.conf" file in a safe place so that it can be reused if necessary when creating a new SD card.

Now you can insert the SD card into the Raspberry and start it. The first boot process may take some time because the entire file system on the SD card must be created. Depending on the settings in the configuration, the Raspberry will restart one more time.

Once the Raspberry has finished its system setup, you can [connect](../special/connecting-pi.md) to it.

### Local Screen

If screen support was turned on during [preparation](#preparation), the service "avnav-startx" starts. This creates a local X server, a user session for the user "pi" with [openbox](https://openbox.org/help/Contents) as the window manager, and Firefox in kiosk mode.

[onboard](http://manpages.ubuntu.com/manpages/bionic/man1/onboard.1.html) is used as the on-screen keyboard.

On the main AvNav page (and on some other pages), a "Raspberry" button is displayed. This switches to a second virtual screen where you can find a file manager, a terminal, and various other tools.
The system is deliberately not designed as a complete desktop system in order to be as resource-efficient as possible.

Since you can only reach the system tools via the button in the AvNav app, it makes sense to set up another way to access the Pi as described above.
This allows you to access the system in case of an error.
A restart of the user interface from the command line can be done with:

```
sudo systemctl restart avnav-startx
```

If Firefox should ever fail to start correctly, you can delete the user profile. It will be recreated automatically at the next start.
**Attention**: AvNav settings that have not been saved to the server will be lost.

```
sudo systemctl stop avnav-startx  
rm -rf /home/pi/.mozilla/firefox/avnav  
sudo systemctl start avnav-startx
```

Starting from version 20230614, an additional panel is displayed on the main screen whenever AvNav is not (or not fully) active.

![](../img/xui-ffpanel.png){: data-gallery=g1 }

Via this panel, some navigation functions in Firefox can be controlled, you can switch to the second screen (system), and you can execute the reset function described above for the Firefox user profile (![](../img/SailBoatRed96.png){ .inline-image}).

This allows operation of the system even if, contrary to expectations, AvNav does not start completely. The reset function can also be found on the system screen, but only for complete new installations.

### Repositories

Debian repositories are pre-configured on the AvNav images, which contain all necessary packages; see also: [Package Installation](#packages).
These repositories are also used by the [AvNav Updater](https://github.com/wellenvogel/avnav-update-plugin).

## Packages { #packages}

If you do not want to use the AvNav images or OpenPlotter on the Raspberry Pi, you can also install AvNav as a package on a Debian or Ubuntu system.
To do this, you can follow the installation instructions for [Linux packages](linux.md#packages).
In this case, only the "avnav" package should be installed, none of the "avnav-raspi" packages.

On AvNav images, updates should be carried out via the AvNav Updater. However, the package installation can also be used for repair purposes or for installing beta versions.

The following basic AvNav packages are installed:

* avnav - AvNav base package
* avnav-raspi-base - Applies from Debian Trixie: Specific functions for the AvNav image
* avnav-raspi-network - Applies from Debian Trixie: Configuration of the network with [NetworkManager](https://networkmanager.dev/)

## OpenPlotter

If you want a complete desktop system with many additional applications, the OpenPlotter variant can be a good base. A Pi4 or Pi5 with 4GB of RAM is recommended for this. 2GB of RAM will also suffice - but then there won't be much room left for future requirements.

For [OpenPlotter](https://openmarine.net/openplotter), there is a complete integration of AvNav (thanks to [e-sailing](https://github.com/e-sailing)).
In the repository <https://www.free-x.de/deb4op/>, which already comes standard with OpenPlotter 2 and 3, the necessary packages are already available. Thus, you can simply install them:

```
sudo apt update
sudo apt install openplotter-avnav
```

Since 2021/03, AvNav is officially available in OpenPlotter. So, after an update of OpenPlotter, "openplotter-avnav" should already be available.

The "avnav-raspi....deb" packages should not be installed on OpenPlotter because they conflict with the network settings of OpenPlotter. Within the OpenPlotter-AvNav configuration, you can change the HTTP port for AvNav if there should be problems with other apps. The default values are: :8080 for browser access, :8082 for O-Charts.

If you install AvNav with the OpenPlotter app, AvNav receives all NMEA data from SignalK and does not search for USB devices itself. All device configurations or interface setups can thus be made directly in OpenPlotter and SignalK.