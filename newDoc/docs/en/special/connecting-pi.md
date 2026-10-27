---
  tags:
    - Connections
    - Network
    - Raspberry
    - Wifi
---
# Raspberry Pi Network Connections

If you have started a Raspberry Pi with an [AvNav image](../installation/raspberry.md#images), the network connections for the Raspberry Pi are also managed via AvNav functions.

This primarily concerns the connection from display devices (web browser) to the Raspberry Pi, but also the possibilities to connect the Raspberry Pi to the Internet or an on-board (IP) network.

In addition to access via web browser, the images are also prepared for access via command line (SSH). Normally, this is not required, as all important functions can be controlled directly from within AvNav.

However, for troubleshooting or for more extensive interventions or adjustments to the system, it is very useful to have such access to the system.

If the image has been configured for a local screen, you can work directly with a connected screen and, if necessary, a keyboard and mouse.

However, you should also prepare one of the connections described below in this case - you might find them useful in error situations.

## Connecting to the Raspberry Pi

In principle, you can connect to the Raspberry in several ways:

1. via Ethernet cable  
   This is done either by connecting to a router or switch or via a simple connection, e.g., directly to a laptop.
2. via internal WLAN  
   By default, the Pi sets up an access point with the SSID chosen in the configuration. It appends a number to it. If you connect additional WLAN adapters, you can also create multiple access points.
3. via USB from an Android device  
   Modern Android devices usually have a "USB tethering" function, through which you can pass on the WLAN or cellular connection via USB. Unfortunately, this usually only applies to devices with cellular connectivity.  
   You can also connect to the Pi this way.
4. Via another WLAN.  
   However, this first requires one of the other connection options, as you have to set the access data. It also requires an additional WLAN adapter.

### Connection via Ethernet cable

If you connect the Pi to a router (e.g., in your home network), it will receive an IP address from it. You can connect to the Pi via this address.  
Since it is often tedious to find out this address, the Pi announces itself in the network via [mDNS](https://en.wikipedia.org/wiki/Multicast_DNS) <!--@@linkchanged-->
(Bonjour, Avahi).  
In this way, you can easily connect to AvNav with a browser, for example:

```
http://xxxx.local:8080
```

xxx is the hostname chosen in the [image configuration](../installation/raspberry.md#preparation).  
Access via SSH (under Windows e.g., via [putty](https://www.chiark.greenend.org.uk/%7Esgtatham/putty/)) is also possible this way - the access password for the user "pi" was already set in the image configuration.

If you connect directly to a laptop using a network cable, the Pi will independently set up an IP address after some time. This can take 1...2 minutes. This belongs to the so-called "Automatic Private IP Addressing" range 169.254.x.x. Most desktop systems support this as well. Under Linux, you may have to enable it explicitly.  
So, if the laptop has also set up such an address on its Ethernet interface, a connection via xxxx.local should work as described.

If access via the xxx.local address does not work, you must try to determine the IP address of the Pi, e.g., via the administration of the home router or a suitable app.

### Connection via the built-in WLAN {: #connect-wifi}

You can use the WLAN network created by the Raspberry. The SSID and password were defined in the "avnav.conf" file as described in the [image configuration](../installation/raspberry.md#preparation) (with an additional number appended).

Here, too, you face the problem of first having to find out the IP address of the Pi. As already described for the Ethernet access, access via mDNS should also work here.

```
http://xxx.local
```

If that does not work, you can try the fixed IP addresses defined in the [image configuration](../installation/raspberry.md#preparation). The default address is `192.168.30.10`.

```
http://192.168.30.10
```

This should load the [main page](../base/navpage.md) of AvNav. It should also be possible to use xxxx.local if you want to connect to the Raspberry via SSH (e.g., via [putty](https://www.putty.org/) under Windows).

One limitation remains: Unfortunately, xxx.local does not work on Android devices. Therefore, it is recommended to use a tool there that can use mDNS - a [BonjourBrowser](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser). For iOS there is a [comparable tool](https://apps.apple.com/us/app/bonjour-search-for-http-web-in-wi-fi/id1097517829) - even if the entry "xxx.local" works in the browser there. You will find your Raspberry with the AvNav image in the browsers under the name "avnav-server". Typically, you will see a second entry "avnav" - behind this hides the [SignalK](signalk.md) server on the Raspberry.  
If you can see your Raspberry in the Bonjour Browser, but opening the page fails, it can be due to a peculiarity of Android if, for example, an Internet connection is additionally active via mobile data. In this case, you should temporarily switch off mobile data.

As of version 1.12, the "Android Bonjour Browser App" also supports SSH. The AvNav image (as of 20220421) also announces its SSH access via mDNS. If you then install a suitable SSH client on Android (for example [JuiceSSH](https://play.google.com/store/apps/details?id=com.sonelli.juicessh&hl=en&gl=US) <!--@@linkchanged-->), you can also connect to the Pi via SSH in this way. This is usually not very comfortable for normal work - but in an emergency, you can enter a few commands this way.

When connecting via SSH, the username is "pi". The user password was (hopefully) set in the file "avnav.conf".  

If the password set in the configuration does not work, you can try the default password again. It is "raspberry". Perhaps the *avnav.conf* was not saved correctly beforehand.  
A root shell can be obtained with *sudo -i*.

### Connection from Android via USB {: #connect-usb}

For this, you need an Android device that supports USB tethering. This can usually be recognized in the connection settings. After you have connected the device to the Pi via USB, you must switch on USB tethering. This is usually switched off automatically when you disconnect.  
In addition to the possibility of connecting the Pi to the Internet in this way, you can also access the Pi with a browser or via SSH. Since the IP address must also be determined for this, I again recommend installing the [Bonjour Browser App](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser) - see under [WLAN](#connect-wifi). For SSH access, again [JuiceSSH](https://play.google.com/store/apps/details?id=com.sonelli.juicessh&hl=en&gl=US) <!--@@linkchanged-->.

You can also access the Pi via this path if, for example, the WLAN is not working. In the Bonjour Browser, you will find at least 2 http addresses: Port 8080 for AvNav and Port 3000 for SignalK, plus (from version 20220421) an SSH access.

### Connection via another WLAN {: #connect-clientwifi}

If you have set up a WLAN connection to another network as described below, which requires a WLAN stick, you can enable access to the Pi via this network ("external access" during setup).

You should only do this in a protected network, e.g., in the network of your own LTE router. **Under no circumstances should you allow this in a public WLAN - access is not protected and in principle, anyone from the network can access the Pi**.

If you are connected to the client network, you can access the Pi again as described under [WLAN](#connect-wifi).

## Connecting the Pi to the Internet

For some functions, e.g., for updating software, the Pi needs an Internet connection. This is, of course, not required for the basic navigation functions.

Before the image version 20220421, it should be noted that the Pi does not automatically set its system time as long as no GPS is connected. This can lead to problems with many Internet accesses.  
As of version 20220421, the Pi automatically synchronizes its system time with the network (NTP) after a certain waiting time.

There are the following options for connecting to the Internet:

1. Ethernet connection to a router
2. Connection via another WLAN
3. Connection via an Android device connected via USB

The Pi basically makes its Internet connection available to connected devices via its own WLAN.

### Connection via Ethernet cable

Here, the Pi is connected to a router via an Ethernet cable.  
There is nothing further to set up on the Pi for this; it should happen automatically.  
On some Pi3, it may happen that a network cable that is only connected after the boot process is not recognized correctly. In this case, restart the Pi with the network cable connected.

### Connection via another WLAN

For this, an additional WLAN adapter (USB stick) is required. Please check compatibility with the Pi beforehand - e.g., [here](https://elinux.org/RPi_USB_Wi-Fi_Adapters).

Via 

{{MM("MMserverpage")}} -> ![](../../img/wifi.svg){.inline-image}

you can call up the [Wifi Dialog](serverpage.md#wifi).

### Connection via an Android device connected via USB

As already described for [access](#connect-usb), you can connect an Android device with USB tethering. Internally, a network interface *usb0* is created.  
The Pi can also access the Internet via this.

This can be a simple option if you only need access temporarily and do not have an additional WLAN adapter available.  
If you were previously connected to the Internet differently, it may be that the Pi only really uses the USB connection after a restart.

**Attention:** Switch USB tethering on again on the Android device; it is normally switched off when the Pi is restarted.

## Technical Details

A [NetworkManager](https://networkmanager.dev/) is used for network configuration on the Raspberry.
The package `avnav-raspi-network` provides basic configurations that ensure the Ethernet interface gets its IP via DHCP and a hotspot is set up on the internal Wifi interface.
Some parameters can be [adjusted](../installation/raspberry.md#preparation) for the images.
In addition, a firewall is set up with [firewalld](https://firewalld.org/) so that Ethernet and hotspot are in a "trusted zone" - and a potentially additional Wifi connection is either also in this zone (if `externalAccess` is switched on) or in a separate "public zone", depending on the configuration.

For most actions, however, command-line access should not be necessary. For updates, you use the pre-installed [Update-Plugin](https://github.com/wellenvogel/avnav-update-plugin).