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

Since version 20220421, the images support both "headless" operation - i.e., neither keyboard nor monitor is connected to the Pi - as well as operation with a connected (touch) screen (optional keyboard and mouse are also welcome).

AvNav is optimized for touch devices, but of course, it can also be operated with a screen, keyboard, and mouse.

How you use the images depends on your use case. In "headless" operation, the Raspberry is only used as a server, and the display occurs, for example, on mobile devices. For this case, a Raspberry Pi 3B(+) is sufficient. If a monitor and peripherals like a keyboard and mouse are connected directly to the Raspberry, you should choose a Pi4 or Pi5 with at least 2GB of RAM.

These images are maintained by [BlackSea](https://www.segeln-forum.de/cms/user/27970-blacksea/) (many thanks...). These are built with pi-gen and contain AvNav, SignalK, and other software. A description can be found in the [repository](https://github.com/free-x/AvNav-Image).

Under Windows/Linux/OSx, you download the image [from free-x](https://github.com/free-x/AvNav-Image) and transfer it, for example, with the [raspi-imager](https://www.raspberrypi.com/software/) to an SD card.
In the imager, select "Use Custom" under "CHOOSE OS" and select the .img file. Do not choose any "customizations".

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
* Support for [MCS](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/)
* Optionally an X-Server with openbox and firefox in Kiosk mode
* Support for various [HATs](#configHATS)

The images are preconfigured so that NMEA0183 data is routed from all interfaces to AvNav and from there to [SignalK](../special/signalk.md). AvNav additionally retrieves all data from SignalK and can display it. For details on SignalK integration, see the [description](../special/signalk.md).
NMEA2000 data runs via Canboat to SignalK and to AvNav.
For details on Canboat, see [NMEA2000](../special/nmea2000.md).

### Image Preparation {: #preparation}

New as of version "20210322", extended as of version "20220421"

Before using the prepared SD card in the Raspberry, some settings should be adjusted. This especially applies to passwords:
The images have a configuration file "avnav.conf". It can be found in the first partition of the SD card (boot partition). This file can be adjusted with a text editor.
There, you can also set whether a local screen should be used ("Touch variant").

It is easier with a small web interface [here](../../configGen/index.html).

[![](../img/ConfigImagesUi.png)](../../configGen/index.html)

The meaning of the fields:

| | | |
| --- | --- | --- |
| Name | Default | Description |
| Image Release | trixie | trixie or bookworm. Selects the AvNav image version to be adjusted. |
| ConfigSequence | 1 | If you want to ensure that the settings from avnav.conf are re-activated in the system, you can increase this value. Otherwise, AvNav remembers which settings have already been applied and does not re-apply them. |
| Wifi SSID | avnav | The name of the WLAN network the Raspberry should create. For bookworm, a single-digit number is appended to the name. |
| Wifi Password | avnav-secret | The password for the WLAN network. This should definitely be changed. Anyone who can connect to the WLAN can also influence the navigation! |
| Wifi Country | Germany | Sets the country for the Wifi settings. Selection from the list. |
| Wifi Interface | wlan0 | (from trixie) Here you can choose which interface should be used for the Wifi hotspot. By default, the internal interface wlan0 is used. If a different interface (plugged-in adapter) is to be used, the name of the interface must be entered here. To do this, after plugging it in, first call up the Wifi page (under Server) and check the IP configuration (Info button) - all interfaces are displayed here. If an interface other than wlan0 is entered, wlan0 can be used later for client connections. |
| Wifi band | bg | (from trixie) Wifi band for the hotspot. bg = 2.4 GHz, a = 5GHz. |
| Wifi channel | 7 | (from trixie) Wifi channel for the hotspot. |
| Wifi address | 192.168.30.10/24 | (from trixie) The base address (and the range as a bitmask) for the network that the hotspot creates. |
| User pi password | raspberry | This is the password for the "pi" user. This standard user is used when connecting via SSH or accessing the Raspberry directly via monitor and keyboard. The password for the "pi" user should also be changed without fail. |
| Base Board | None | Here you can choose from supported base boards. * **MCS:** If this option is enabled, the necessary software for the [Marine Control Server from GeDad](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/) is activated on the next boot. Changing the setting then leads to an automatic reboot when the Raspberry starts with this setting for the first time. * **OBPPLOTTERV3:** This sets the configuration for the [Open Boat Projects Plotter (V3)](https://open-boat-projects.org/de/10-plotter-raspi-4b). |
| HAT {: #configHATS } | None | Here you can select a supported Pi-HAT. AvNav will make the corresponding entries for the overlays in /boot/config.txt and create the CAN network interfaces. * WAVESHAREB: [Waveshare RS485 CAN HAT (B)](https://www.waveshare.com/wiki/RS485_CAN_HAT_%28B%29) * WAVESHAREA8: [Waveshare RS485 CAN HAT (8Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHAREA12: [Waveshare RS485 CAN HAT (12 Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHARE2CH: [Waveshare 2CH CAN HAT](https://www.waveshare.com/wiki/2-CH_CAN_HAT) * PICANM: [PICAN-M](https://cdn.shopify.com/s/files/1/0563/2029/5107/files/pican-m_UGB_20.pdf?v=1619008196) * MCARTHUR: [MacArthur HAT](https://github.com/OpenMarine/MacArthur-HAT) |
| Module RTL8188EU | off | If enabled, the [kernel driver](https://github.com/lwfinger/rtl8188eu/tree/v5.2.2.4) for WLAN adapters with the RTL8188EU chipset is set up via [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html). If the system kernel is updated (command line), the driver will be recompiled. Not currently available for Bookworm images (or newer), as these drivers do not exist. |
| Module RTL8192EU | off | If enabled, the [kernel driver](https://github.com/Mange/rtl8192eu-linux-driver) for WLAN adapters with the RTL8192EU chipset is set up via [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html). If the system kernel is updated (command line), the driver will be recompiled. Not currently available for Bookworm images (or newer), as these drivers do not exist. |
| TimeZone | Europe/Berlin | The timezone to be used in the image. |
| WifiCountry | Germany | The country (must be set for the Wifi adapter for legal reasons). |
| InternalWifi as Client | off | If enabled, the internal Wifi adapter of the Pi is not defined as an access point, but can connect to other networks. Caution: This requires a different way to access the Pi - see [[Connecting to the Raspberry](../special/connecting-pi.md)]. |
| KeyboardLayout | German | Layout for a connected keyboard (command line and X). |
| KeyboardType | Generic 105-key PC(intl.) | Type of connected keyboard. |
| TouchSupport (from 20220421) | off | If enabled, an X server starts with a Firefox browser in Kiosk mode. Via a button in AvNav, you can switch to a different "screen" where a file manager, terminal, etc., are available. |
| Display DPI (from 20220421) | 96 | Only for the local screen. The resolution in dots/inch for the connected display. Clicking opens a small calculator where the dimensions of the screen in mm and pixels can be entered, which calculates the DPI value. Based on this value, some display elements are scaled. |
| OnScreen KeyboardHeight (from 20220421) | 7 | The height of a key row on the displayed OnScreen Keyboard. With a correct DPI setting, this value should be a good compromise. If you choose a very large value, there might not be enough screen area left when the keyboard is displayed... |
| HideCursor (from 20220421) | on | Hiding the cursor on the local screen. If you want to work with a mouse, this switch must be set to "off". |

After entering the values, you can download the "avnav.conf" file by clicking on the "download" button. This must be saved in the first partition of the SD card. Any existing sample file must be overwritten! To do this, this partition must of course be visible on your computer. Under Windows, you will usually only be able to see the first partition. You might need to remove and re-insert the SD card after writing the image to see it.

It is therefore recommended to save the "avnav.conf" file in a safe place to be able to reuse it if necessary when creating a new SD card.

Now you can insert the SD card into the Raspberry and start it. The first boot can take some time, as the entire file system has to be created on the SD card. Depending on the settings in the configuration, the Raspberry will restart one more time.

When the Raspberry has finally completed its system setup, you can [connect](../special/connecting-pi.md) to it.

### Local Screen

If you enabled screen support during [preparation](#preparation), a service "avnav-startx" starts. This creates a local X server, a user session for user "pi" with [openbox](https://openbox.org/help/Contents) as the window manager, and Firefox in Kiosk mode.

[onboard](http://manpages.ubuntu.com/manpages/bionic/man1/onboard.1.html) is used as the on-screen keyboard.

On the main AvNav page (and some other pages), a "Raspberry" button is displayed. This switches to a second virtual screen where you will find a file manager, a terminal, and various other tools.
The system is deliberately not designed as a complete desktop system in order to be as resource-efficient as possible.

Since system tools are only accessible via the button in the AvNav app, it makes sense to have an alternative access to the Pi as described above.
This allows you to access the system in case of an error. Restarting the user interface from the command line can be done with:

```
sudo systemctl restart avnav-startx
```

If Firefox should ever stop starting correctly, you can remove the user profile. It will be automatically recreated on the next start.
**Attention**: AvNav settings that have not been saved on the server will be lost.

```
sudo systemctl stop avnav-startx  
rm -rf /home/pi/.mozilla/firefox/avnav  
sudo systemctl start avnav-startx
```

Starting from version 20230614, an additional panel is displayed on the main screen whenever AvNav is not (or not completely) active.

![](../img/xui-ffpanel.png){: data-gallery=g1 }

Via this panel, some navigation functions in Firefox can be controlled, it is possible to switch to the 2nd screen (system) - and you can execute the reset function for the Firefox user profile described above (![](../img/SailBoatRed96.png){ .inline-image}).

This makes operating the system possible even if, against expectations, AvNav does not start completely. The reset function can also be found on the system screen (though only for complete new installations).

### Repositories

Debian repositories are preconfigured on the AvNav images, containing all necessary packages. See [Package Installation](#packages).
These repositories are also used by the [AvNav Updater](https://github.com/wellenvogel/avnav-update-plugin).

## Packages { #packages}

If you do not want to use the AvNav images or OpenPlotter on the Raspberry Pi, you can also install AvNav as a package on a Debian or Ubuntu system.
To do this, you can follow the installation instructions for [Linux packages](linux.md#packages).
In this case, only the `avnav` package should be installed, none of the `avnav-raspi` packages.

On AvNav images, updates should be performed via the AvNav Updater. However, the package installation can also be used for repair purposes or for installing beta versions.

The following basic AvNav packages are installed:

* `avnav` - AvNav base package
* `avnav-raspi-base` - AvNav image-specific functions for AvNav (from Debian trixie)
* `avnav-raspi-network` - Configuration of the network with the [NetworkManager](https://networkmanager.dev/) (from Debian trixie)

## OpenPlotter

If you want a complete desktop system with many other applications, the OpenPlotter variant can be a good base. For this, a Pi4 or Pi5 with 4GB of RAM is recommended. 2GB of memory will also suffice, but then there won't be much room for future requirements.

For [OpenPlotter](https://openmarine.net/openplotter), there is a complete integration of AvNav (thanks to [e-sailing](https://github.com/e-sailing)).
In the repository <https://www.free-x.de/deb4op/>, which already comes standard with OpenPlotter 2 (and 3), the necessary packages are already available. Thus, you can simply install them:

```
sudo apt update
sudo apt install openplotter-avnav
```

Since 2021/03, AvNav is officially available in OpenPlotter. Thus, after an update of OpenPlotter, "openplotter-avnav" should already be available.

The packages "avnav-raspi....deb" should not be installed on OpenPlotter because they are not compatible with the network settings of OpenPlotter. Within the OpenPlotter-AvNav configuration, you can change the HTTP port for AvNav if there should be problems with other apps. The default values are: :8080 for browser access, :8082 for ocharts.

If you install AvNav with the OpenPlotter app, AvNav receives all NMEA data from SignalK and does not search for USB devices itself. All device configurations or interface setups can thus be made directly in OpenPlotter and SignalK.