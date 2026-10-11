---
  tags:
    - Raspberry
    - Installation
    - Images
---
# Raspberry PI

AvNav is available in various versions for the Raspberry Pi:

* [Ready-to-use Images](#images)
* [Packages](#packages)
* [OpenPlotter](#openplotter)

## Images

As of version 20220421, the images support both so-called "headless" operation — i.e., neither a keyboard nor a monitor is connected to the Pi — as well as operation with a connected (touch) screen (optionally with a keyboard and mouse).

AvNav is optimized for touch devices, but you can, of course, operate it with a screen, keyboard, and mouse as well.

How you use the images depends on your use case. In "headless" operation, the Raspberry is used only as a server, and the display occurs on mobile devices, for example. For this, a Raspberry Pi 3B(+) is sufficient. If a monitor and peripherals such as a keyboard and mouse are connected directly to the Raspberry, you should choose a Pi4 or Pi5 with at least 2GB of RAM.

These images are maintained by [BlackSea](https://www.segeln-forum.de/cms/user/27970-blacksea/) (many thanks...). They are built with pi-gen and contain AvNav, SignalK, and additional software. A description can be found in the [Repository](https://github.com/free-x/AvNav-Image).

On Windows/Linux/OSx, you download the image [from free-x](https://github.com/free-x/AvNav-Image) and transfer it to an SD card using, for example, the [raspi-imager](https://www.raspberrypi.com/software/).  
In the imager, select "Use Custom" under "CHOOSE OS" and select the `.img` file. Do not select any "customizations".

These images include:

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

The images are pre-configured so that NMEA0183 data from all interfaces are routed to AvNav and from there to [SignalK](../special/signalk.md). AvNav additionally retrieves all data from SignalK and can display it. For details on SignalK integration, see the [description](../special/signalk.md).  
NMEA2000 data runs via Canboat to SignalK and to AvNav.  
For details on Canboat, see [NMEA2000](../special/nmea2000.md).

### Image Preparation {: #preparation}

new as of version "20210322", extended as of version "20220421"

Before using the prepared SD card in the Raspberry, you should adjust some settings. This applies especially to passwords:  
The images have a configuration file "avnav.conf". It can be found in the first partition of the SD card (boot partition). This file can be adjusted with a text editor.  
You can also set whether a local screen should be used ("Touch version") there.

It is easier to use a small web interface [here]({{HPLINK("configGen/index.html")}}).

[![](../img/ConfigImagesUi.png)]({{HPLINK("configGen/index.html")}})

Meaning of the fields:

|  |  |  |
| --- | --- | --- |
| Name | Default | Description |
| Image Release | trixie | trixie or bookworm. Selects the AvNav image version to be adjusted. |
| ConfigSequence | 1 | If you want to ensure the settings from avnav.conf are re-activated in the system, you can increase this value. Otherwise, AvNav remembers which settings have already been applied and will not apply them again. |
| Wifi SSID | avnav | The name of the WLAN network the Raspberry should create. For bookworm, a single-digit number is appended to the name. |
| Wifi Password | avnav-secret | The password for the WLAN network. This should definitely be changed. Anyone who can connect to the WLAN can also influence navigation! |
| Wifi Country | Germany | Sets the country for Wifi settings. Selection from the list. |
| Wifi Interface | wlan0 | (from trixie) Selects which interface should be used for the Wifi hotspot. By default, the internal wlan0 interface is used. If another interface (plugged-in adapter) is to be used, the name of the interface must be entered here. To find it, plug it in, go to the Wifi page (under Server) and check the IP configuration (Info button) - all interfaces are listed there. If an interface other than wlan0 is entered, wlan0 can later be used for client connections. |
| Wifi band | bg | (from trixie) Wifi band for the hotspot. bg = 2.4 GHz, a = 5GHz. |
| Wifi channel | 7 | (from trixie) Wifi channel for the hotspot. |
| Wifi address | 192.168.30.10/24 | (from trixie) The base address (and range as a bitmask) for the network created by the hotspot. |
| User pi password | raspberry | The password for the user "pi". This standard user is used when connecting via SSH or when accessing the Raspberry directly via monitor and keyboard. The password for the user "pi" should also definitely be changed. |
| Base Board | None | Select from supported base boards. * **MCS:** If this option is enabled, the necessary software for the [Marine Control Server from GeDad](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/) is activated at the next boot. Changing this setting will trigger an automatic reboot the first time the Raspberry starts with this setting. * **OBPPLOTTERV3:** This sets the configuration for the [Open Boat Projects Plotter (V3)](https://open-boat-projects.org/de/10-plotter-raspi-4b). |
| HAT {: #configHATS } | None | Select a supported Pi-HAT. AvNav will make the corresponding entries for overlays in /boot/config.txt and create the CAN network interfaces. * WAVESHAREB: [Waveshare RS485 CAN HAT (B)](https://www.waveshare.com/wiki/RS485_CAN_HAT_%28B%29) * WAVESHAREA8: [Waveshare RS485 CAN HAT (8Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHAREA12: [Waveshare RS485 CAN HAT (12 Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHARE2CH: [Waveshare 2CH CAN HAT](https://www.waveshare.com/wiki/2-CH_CAN_HAT) * PICANM: [PICAN-M](https://cdn.shopify.com/s/files/1/0563/2029/5107/files/pican-m_UGB_20.pdf?v=1619008196) * MCARTHUR: [MacArthur HAT](https://github.com/OpenMarine/MacArthur-HAT) |
| Module RTL8188EU | off | If enabled, the [kernel driver](https://github.com/lwfinger/rtl8188eu/tree/v5.2.2.4) for WLAN adapters with the RTL8188EU chipset is set up via [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html). When the system kernel is updated (command line), the driver is recompiled. Currently not available for Bookworm images (or newer) as these drivers do not exist. |
| Module RTL8192EU | off | If enabled, the [kernel driver](https://github.com/Mange/rtl8192eu-linux-driver) for WLAN adapters with the RTL8192EU chipset is set up via [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html). When the system kernel is updated (command line), the driver is recompiled. Currently not available for Bookworm images (or newer) as these drivers do not exist. |
| TimeZone | Europe/Berlin | The timezone to be used in the image. |
| WifiCountry | Germany | The country (must be set for the Wifi adapter for legal reasons). |
| InternalWifi as Client | off | If enabled, the internal Wifi adapter of the Pi is not defined as an Access Point, but can connect to other networks. Attention: This requires another way to access the Pi — see [[Connecting to the Raspberry](../special/connecting-pi.md)]. |
| KeyboardLayout | German | Layout for a connected keyboard (command line and X). |
| KeyboardType | Generic 105-key PC(intl.) | Type of connected keyboard. |
| TouchSupport (from 20220421) | off | If enabled, an X server starts with a Firefox browser in Kiosk mode. Via a button in AvNav, you can switch to a different "screen" that provides a file manager, terminal, etc. |
| Display DPI (from 20220421) | 96 | Only for the local screen. The resolution in dots/inch for the connected display. Clicking opens a small calculator where the screen dimensions can be specified in mm and pixels to calculate the DPI value. Several display elements are scaled based on this value. |
| OnScreen KeyboardHeight (from 20220421) | 7 | The height of a key row on the OnScreen Keyboard. With a correct DPI setting, this value should be a good compromise. If set very high, there may not be enough screen space left when the keyboard is displayed... |
| HideCursor (from 20220421) | on | Hides the cursor on the local screen. If you want to use a mouse, this switch must be set to "off". |

After entering the values, you can download the "avnav.conf" file by clicking the "download" button. This must be saved to the first partition of the SD card. Any existing sample file must be overwritten! To do this, the partition must be visible on your computer. Under Windows, you will usually only be able to see the first partition. You might need to remove and re-insert the SD card after writing the image to see it.

It is recommended to save the "avnav.conf" file in a safe place to reuse it if you create a new SD card.

Now you can insert the SD card into the Raspberry and start it. The first boot may take some time as the entire file system on the SD card must be created. Depending on the settings in the configuration, the Raspberry may reboot another time.

Once the Raspberry has finished its system setup, you can [connect to it](../special/connecting-pi.md).

### Local Screen

If you enabled screen support in [Preparation](#preparation), a service named "avnav-startx" starts. It creates a local X server, a user session for the user "pi" with [openbox](https://openbox.org/help/Contents) as the window manager, and Firefox in Kiosk mode.

[onboard](http://manpages.ubuntu.com/manpages/bionic/man1/onboard.1.html) is used as the On Screen Keyboard.

On the main AvNav page (and on some other pages), a "Raspberry" button is displayed. This switches to a second virtual screen where you can find a file manager, a terminal, and various other tools.  
The system is intentionally not designed as a full desktop system to remain as resource-efficient as possible.

Since you can only access system tools via the button in the AvNav app, it makes sense to have an additional way to access the Pi as described above.  
This allows you to access the system in case of errors.  
A restart of the user interface from the command line can be done with:

```
sudo systemctl restart avnav-startx
```

If Firefox no longer starts correctly, you can delete the user profile. It will be automatically recreated on the next start.  
**Attention**: AvNav settings that have not been saved on the server will be lost.

```
sudo systemctl stop avnav-startx  
rm -rf /home/pi/.mozilla/firefox/avnav  
sudo systemctl start avnav-startx
```

As of version 20230614, an additional panel is displayed on the main screen whenever AvNav is not (or not fully) active.

![](../img/xui-ffpanel.png){: data-gallery=g1 }

Via this panel, some navigation functions in Firefox can be controlled, you can switch to the 2nd screen (system), and you can run the reset function (described above) for the Firefox user profile (![](../img/SailBoatRed96.png){ .inline-image }).

This allows for system operation even if AvNav fails to start completely, contrary to expectations. The reset function is also available on the system screen (only for complete new installations).
 
### Repositories

Debian repositories containing all necessary packages are pre-configured on the AvNav images. See [Package Installation](#packages).
These repositories are also used by the [AvNav Updater](https://github.com/wellenvogel/avnav-update-plugin). 


## Packages { #packages}

If you do not wish to use the AvNav images or OpenPlotter on the Raspberry Pi, you can also install AvNav as a package on a Debian or Ubuntu system. 
To do this, follow the installation instructions for [Linux packages](linux.md#packages).
In this case, only the `avnav` package should be installed, not any of the `avnav-raspi` packages.

On AvNav images, updates should be performed via the AvNav Updater. However, for repair purposes or for installing beta versions, package installation can also be used.

The following basic AvNav packages are installed:

* avnav - AvNav base package
* avnav-raspi-base - AvNav image-specific functions for AvNav (from Debian trixie)
* avnav-raspi-network - Configuration of the network with [NetworkManager](https://networkmanager.dev/) (from Debian trixie)

## OpenPlotter

If you want a complete desktop system with many other applications, the OpenPlotter version can be a good base. A Pi4 or Pi5 with 4GB of RAM is recommended for this. 2GB of RAM will also suffice, but there won't be much room for future requirements.

For [OpenPlotter](https://openmarine.net/openplotter), there is a complete integration of AvNav (thanks to [e-sailing](https://github.com/e-sailing)).
The repository <https://www.free-x.de/deb4op/>, which already comes standard with OpenPlotter 2 (and 3), contains the necessary packages. You can therefore install them easily:

```
sudo apt update
sudo apt install openplotter-avnav
```

Since March 2021, AvNav has been officially available in OpenPlotter. After an OpenPlotter update, "openplotter-avnav" should already be available.

The "avnav-raspi....deb" packages should not be installed on OpenPlotter because they conflict with OpenPlotter's network settings. Within the OpenPlotter-AvNav configuration, you can change the HTTP port for AvNav if there are problems with other apps. The default values are: :8080 for browser access, :8082 for ocharts.

If you install AvNav using the OpenPlotter app, AvNav receives all NMEA data from SignalK and does not search for USB devices itself. All device configurations or interface settings can be made directly in OpenPlotter and SignalK.