---
  tags:
    - Raspberry
    - Installation
    - Images
---
# Raspberry PI

AvNav is available for the Raspberry Pi in several variants:

* [Ready-made images](#images)
* [Packages](#packages)
* [OpenPlotter](#openplotter)

## Images

Since version 20220421, the images support both "headless" operation - meaning neither a keyboard nor a monitor is connected to the Pi - as well as operation with a connected (touch) screen (keyboard and mouse are also optional).

The operation of AvNav is optimized for touch devices - but it can of course also be operated with a screen, keyboard, and mouse.

How you use the images depends on your use case. In "headless" operation, the Raspberry is only used as a server, and the display is handled on mobile devices, for example. For this case, a Raspberry Pi 3B(+) is sufficient. If a monitor and peripherals like a keyboard and mouse are connected directly to the Raspberry, you should choose a Pi4 or Pi5 with at least 2GB of RAM.

These images are maintained by [BlackSea](https://www.segeln-forum.de/cms/user/27970-blacksea/) (many thanks...). They are built with pi-gen and contain AvNav, SignalK, and other software. A description can be found in the [repository](https://github.com/free-x/AvNav-Image).

Under Windows/Linux/OSx, you download the image [from free-x](https://github.com/free-x/AvNav-Image) and transfer it to an SD card using, for example, the [raspi-imager](https://www.raspberrypi.com/documentation/computers/getting-started.md#raspberry-pi-imager). 
In the Imager, select "Use Custom" under "CHOOSE OS" and select the .img file. Do not select any "customizations".

These images contain:

* avnav
* avnav-raspi
* [avnav-update-plugin](https://github.com/wellenvogel/avnav-update-plugin)
* [avnav-ocharts-plugin](hints/ocharts.md)
* [avnav-mapproxy-plugin](https://github.com/wellenvogel/avnav-mapproxy-plugin)
* [avnav-history-plugin](https://github.com/wellenvogel/avnav-history-plugin)
* [SignalK](hints/CanboatAndSignalk.md)
* [Canboat](hints/CanboatAndSignalk.md)
* Support for [MCS](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/)
* Optionally an X-server with openbox and firefox in kiosk mode
* Support for various [HATs](#configHATS)

The images are preconfigured so that NMEA0183 data from all interfaces is routed to AvNav and from there to [SignalK](hints/CanboatAndSignalk.md). AvNav also retrieves all data from SignalK and can display it. For details on SignalK integration, see the [description](hints/CanboatAndSignalk.md#SignalK). 
NMEA2000 data runs via Canboat to SignalK and to AvNav. 
For details on Canboat, see [CanBoatAndSignalK](hints/CanboatAndSignalk.md).

### Image Preparation {: #preparation}

new as of version "20210322", expanded as of version "20220421"

Before using the prepared SD card in the Raspberry, you should adjust some settings. This applies primarily to passwords:
The images have a configuration file "avnav.conf". It can be found in the first partition of the SD card (boot partition). This file can be adjusted with a text editor.
You can also set there whether a local screen should be used ("Touch variant").

It is easier to use a small web interface [here](../configGen/index.md).

[![](img/ConfigImagesUi.png)](../configGen/index.md)

The meaning of the fields:

| | | |
| --- | --- | --- |
| Name | Default | Description |
| ConfigSequence | 1 | If you want to re-apply the settings from avnav.conf to the system, you can increase this value. Otherwise, AvNav remembers which settings have already been applied and does not apply them again. |
| Wifi SSID | avnav | The name of the WLAN network the Raspberry should create. The images are prepared so that you can create additional networks by plugging in WLAN adapters. Therefore, a single-digit number is appended to the name. |
| Wifi Password | avnav-secret | The password for the WLAN network. This should be changed in any case. Anyone who can connect to the WLAN can also influence the navigation! |
| User pi password | raspberry | This is the password for the user "pi". This standard user is used when connecting via SSH or accessing the Raspberry directly via monitor and keyboard. The password for the user "pi" should also be changed. |
| Base Board | None | Here you can choose from supported base boards. * **MCS:** If this option is enabled, the necessary software for the [Marine Control Server from GeDad](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/) will be activated on the next boot. Changing this setting will trigger an automatic reboot when the Raspberry starts for the first time with this setting. * **OBPPLOTTERV3:** This sets the configuration for the [Open Boat Projects Plotter (V3)](https://open-boat-projects.org/de/10-plotter-raspi-4b). |
| HAT | None | Here you can select a supported Pi-HAT. AvNav will make the corresponding entries for the overlays in /boot/config.txt and create the CAN network interfaces. * WAVESHAREB: [Waveshare RS485 CAN HAT (B)](https://www.waveshare.com/wiki/RS485_CAN_HAT_%28B%29) * WAVESHAREA8: [Waveshare RS485 CAN HAT (8Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHAREA12: [Waveshare RS485 CAN HAT (12 Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHARE2CH: [Waveshare 2CH CAN HAT](https://www.waveshare.com/wiki/2-CH_CAN_HAT) * PICANM: [PICAN-M](https://cdn.shopify.com/s/files/1/0563/2029/5107/files/pican-m_UGB_20.pdf?v=1619008196) * MCARTHUR: [MacArthur HAT](https://github.com/OpenMarine/MacArthur-HAT) |
| Module RTL8188EU | off | If enabled, the [kernel driver](https://github.com/lwfinger/rtl8188eu/tree/v5.2.2.4) for WLAN adapters with the RTL8188EU chipset is installed via [DKMS](https://manpages.debian.org/unstable/dkms/dkms.8.en.md). If the system kernel is updated (command line), the driver is recompiled. Not currently available for Bookworm images, as these drivers do not exist. |
| Module RTL8192EU | off | If enabled, the [kernel driver](https://github.com/Mange/rtl8192eu-linux-driver) for WLAN adapters with the RTL8192EU chipset is installed via [DKMS](https://manpages.debian.org/unstable/dkms/dkms.8.en.md). If the system kernel is updated (command line), the driver is recompiled. Not currently available for Bookworm images, as these drivers do not exist. |
| TimeZone | Europe/Berlin | The time zone to be used in the image. |
| WifiCountry | Germany | The country (must be set for the WiFi adapter for legal reasons). |
| InternalWifi as Client | off | If enabled, the internal WiFi adapter of the Pi is not defined as an access point, but can connect to other networks. Note: This requires another way to access the Pi - see [Connecting to the Raspberry](#access). |
| KeyboardLayout | German | Layout for a connected keyboard (command line and X). |
| KeyboardType | Generic 105-key PC(intl.) | Type of connected keyboard. |
| TouchSupport (as of 20220421) | off | If enabled, an X server starts with a Firefox browser in kiosk mode. A button in AvNav allows switching to another "screen" where a file manager, terminal, etc., are available. |
| Display DPI (as of 20220421) | 96 | Only for the local screen. The resolution in dots/inch for the connected display. Clicking it opens a small calculator where you can enter the screen dimensions in mm and pixels; the DPI value is calculated from this. Some display elements are scaled based on this value. |
| OnScreen KeyboardHeight (as of 20220421) | 7 | The height of a key row on the displayed OnScreen Keyboard. With the correct DPI setting, this value should be a good compromise. If you choose a very large value, there might not be enough screen space left when the keyboard is displayed... |
| HideCursor (as of 20220421) | on | Hiding the cursor on the local screen. If you want to work with a mouse, this switch must be set to "off". |

After entering the values, you can download the "avnav.conf" file by clicking the "download" button. This must be saved in the first partition of the SD card. Any existing sample file there must be overwritten! This partition must, of course, be visible on the computer. Under Windows, you will usually only be able to see the first partition. You may need to remove and reinsert the SD card after writing the image.

It is therefore recommended to save the "avnav.conf" file again in a safe place so that it can be reused if necessary when creating a new SD card.

Now you can insert the SD card into the Raspberry and start it. The first boot may take some time because the entire file system must be created on the SD card. Depending on the settings in the configuration, the Raspberry will reboot one more time.

Once the Raspberry has finished its system setup, you can [connect to it](../special/connecting-pi.md).

### Local Screen

If screen support was enabled in the [preparation](#preparation), an "avnav-startx" service starts. This generates a local X server, a user session for user 'pi' with [openbox](https://openbox.org/help/Contents) as the window manager, and Firefox in kiosk mode.

The [onboard](http://manpages.ubuntu.com/manpages/bionic/man1/onboard.1.md) keyboard is used as the On Screen Keyboard.

On the main AvNav page (and on some other pages), a "Raspberry" button is displayed. This switches to a second virtual screen where you can find a file manager, a terminal, and various other tools.
The system is deliberately not designed as a full desktop system in order to be as resource-efficient as possible.

Since you can only reach the system tools via the button in the AvNav app, it makes sense to set up another access to the Pi as described above.
This allows you to access the system in case of an error.
A restart of the user interface from the command line can be done with:

```
sudo systemctl restart avnav-startx
```

If Firefox ever fails to start correctly, you can delete the user profile. It will be automatically recreated on the next start.
**Attention**: AvNav settings that were not saved on the server will be lost.

```
sudo systemctl stop avnav-startx  
rm -rf /home/pi/.mozilla/firefox/avnav  
sudo systemctl start avnav-startx
```

Starting with version 20230614, an additional panel is displayed on the main screen whenever AvNav is not (or not completely) active.

![](../img/xui-ffpanel.png)

Via this panel, some navigation functions can be controlled in Firefox, you can switch to the 2nd screen (system) - and you can execute the reset function for the Firefox user profile (described above) (![](../img/SailBoatRed96.png){ .inline-image}).

This allows the system to be operated even if AvNav does not start completely, contrary to expectations. The reset function can also be found on the system screen (though only for complete new installations).

### Repositories

Debian repositories are preconfigured on the AvNav images, containing all necessary packages. See [Package Installation](#packages) for more info.
These repositories are also used by the [AvNav Updater](TODO).

## Packages { #packages}

If you do not want to use the AvNav images or OpenPlotter on the Raspberry Pi, you can also install AvNav as a package on a Debian or Ubuntu system.
To do this, you can follow the installation instructions for [Linux packages](linux.md#packages).
In this case, only the `avnav` package should be installed, none of the `avnav-raspi` packages.

On AvNav images, updates should be performed via the AvNav Updater. For repair purposes or for installing beta versions, however, package installation can also be used.

The following basic AvNav packages are installed:

* `avnav` - AvNav base package
* `avnav-raspi-base` - AvNav image-specific functions for AvNav (from debian trixie)
* `avnav-raspi-network` - Configuration of the network with [NetworkManager](https://networkmanager.dev/) (from debian trixie)

## OpenPlotter

If you want a complete desktop system with many additional applications, the [OpenPlotter](#openplotter) variant can be a good base. A Pi4 or Pi5 with 4GB of RAM is recommended for this. 2GB of RAM will also be enough - but then there isn't much room for future requirements.

For [OpenPlotter](https://openmarine.net/openplotter), there is full integration of AvNav (thanks to [e-sailing](https://github.com/e-sailing)).
In the repository <https://www.free-x.de/deb4op/>, which already comes standard with OpenPlotter 2 (and 3), the necessary packages are already available. Thus, you can simply install them:

```
sudo apt update
sudo apt install openplotter-avnav
```

Since March 2021, AvNav is officially available in OpenPlotter. After an update of OpenPlotter, "openplotter-avnav" should already be available.

The "avnav-raspi....deb" packages should not be installed on OpenPlotter because they are not compatible with OpenPlotter's network settings. Within the OpenPlotter-AvNav configuration, you can change the HTTP port for AvNav if there are problems with other apps. The default values are: :8080 for browser access, :8082 for ocharts.

If you install AvNav with the OpenPlotter app, AvNav receives all NMEA data from SignalK and does not search for USB devices itself. All device configurations or interface settings can thus be made directly in OpenPlotter and SignalK.